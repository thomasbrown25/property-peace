using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.Payments;

/// <summary>Read-only projection of lease obligations and finalized receipts. No provider or payment writes.</summary>
public sealed class LeaseChargeLedger(DataContext db)
{
    public async Task<List<LeaseChargeDto>?> ForTenant(long leaseId, long tenantUserId, DateTime? today = null, long? selectedOrganizationId = null)
    {
        var organizationId = await db.TenantLeases.AsNoTracking()
            .Where(tl => tl.LeaseId == leaseId && tl.Tenant.UserId == tenantUserId
                && !tl.Tenant.IsDeleted && !tl.Lease.IsDeleted
                && !tl.Lease.Unit.Property.IsDeleted
                && tl.Lease.OrganizationId.HasValue
                && tl.Tenant.OrganizationId == tl.Lease.OrganizationId
                && tl.Lease.OrganizationId == tl.Lease.Unit.Property.OrganizationId
                && tl.Lease.Unit.Property.Organization != null
                && tl.Lease.Unit.Property.Organization.IsActive
                && !tl.Lease.Unit.Property.Organization.IsDeleted)
            .Select(tl => tl.Tenant.OrganizationId).SingleOrDefaultAsync();
        return organizationId.HasValue && (!selectedOrganizationId.HasValue || selectedOrganizationId == organizationId)
            ? await ForLandlord(leaseId, organizationId.Value, today) : null;
    }

    public async Task<List<LeaseChargeDto>?> ForLandlord(long leaseId, long organizationId, DateTime? today = null)
    {
        var lease = await db.Leases.AsNoTracking().SingleOrDefaultAsync(l => l.Id == leaseId
            && !l.IsDeleted && !l.Unit.Property.IsDeleted
            && l.OrganizationId == organizationId && l.Unit.Property.OrganizationId == organizationId
            && l.Unit.Property.Organization != null && l.Unit.Property.Organization.IsActive
            && !l.Unit.Property.Organization.IsDeleted);
        if (lease == null) return null;

        var fees = await db.LeaseFees.AsNoTracking().Where(f => f.LeaseId == leaseId && f.OrganizationId == organizationId).ToListAsync();
        var bills = await db.LeaseDeposits.AsNoTracking().Where(d => d.LeaseId == leaseId && d.OrganizationId == organizationId).ToListAsync();
        var deposits = await db.Deposits.AsNoTracking().Where(d => d.LeaseId == leaseId && d.OrganizationId == organizationId).ToListAsync();
        var payments = await db.Payments.AsNoTracking().Where(p => p.LeaseId == leaseId && p.OrganizationId == organizationId)
            .OrderBy(p => p.PaymentDate).ThenBy(p => p.Id).ToListAsync();
        var result = new List<LeaseChargeDto>();
        var date = (today ?? DateTime.Today).Date;
        if (lease.StartDate.HasValue && lease.EndDate.HasValue && lease.RentAmount > 0 && lease.RentDueDay.HasValue)
        {
            var dueDay = lease.RentDueDay.Value;
            for (var month = new DateTime(lease.StartDate.Value.Year, lease.StartDate.Value.Month, 1);
                 month <= date && month <= lease.EndDate.Value.Date; month = month.AddMonths(1))
            {
                var day = dueDay == -1 ? DateTime.DaysInMonth(month.Year, month.Month)
                    : Math.Clamp(dueDay, 1, DateTime.DaysInMonth(month.Year, month.Month));
                var due = month.AddDays(day - 1);
                if (due < lease.StartDate.Value.Date || due > date || due > lease.EndDate.Value.Date) continue;
                result.Add(New($"rent:{leaseId}:{due:yyyy-MM-dd}", "Rent", $"Rent · {due:MMMM yyyy}", due, lease.RentAmount.Value));
            }
        }
        foreach (var fee in fees.Where(f => f.Amount > 0).OrderBy(f => f.DueDate).ThenBy(f => f.Id))
            result.Add(New($"fee:{fee.Id}", "Fee", string.IsNullOrWhiteSpace(fee.Name) ? "Fee" : fee.Name.Trim(), fee.DueDate, fee.Amount));
        // Deposit receipts have no obligation/type foreign key. Expose one pooled
        // obligation rather than inventing a security/pet/lease-bill allocation.
        var depositDue = Math.Max(0m, lease.DepositAmount ?? 0m) + Math.Max(0m, lease.PetDepositAmount ?? 0m)
            + bills.Sum(d => Math.Max(0m, d.Amount));
        if (depositDue > 0)
            result.Add(New($"deposit:pooled:{leaseId}", "Deposit", "Deposits", lease.StartDate, depositDue));

        // A receipt in Deposits may represent the same money as a linked Payment. Prefer
        // the payment for display when it is final, otherwise credit the received receipt once.
        var finalPayments = payments.Where(p => p.Amount > 0 && IsFinal(p.Status)).ToList();
        var rentPayments = payments.Where(p => !p.FeeId.HasValue && !p.DepositId.HasValue).ToList();
        // Canonical Stripe loss accounting writes signed Completed adjustment rows
        // against the same intent. Status alone is not the net collection amount.
        var adjustments = rentPayments.Where(p => IsAdjustment(p) && IsFinal(p.Status)).ToList();
        var rentCredits = rentPayments.Where(p => p.Amount > 0 && !IsAdjustment(p)
            && (IsFinal(p.Status) || (IsLossStatus(p.Status) && p.StripePaymentIntentId != null
                && adjustments.Any(a => a.StripePaymentIntentId == p.StripePaymentIntentId))))
            .GroupBy(p => p.StripePaymentIntentId == null ? $"payment:{p.Id}" : $"intent:{p.StripePaymentIntentId}")
            .Select(g => new { Payment = g.First(), Amount = Math.Max(0m, g.Sum(p => p.Amount) + adjustments
                .Where(a => a.StripePaymentIntentId != null && a.StripePaymentIntentId == g.First().StripePaymentIntentId)
                .Sum(a => a.Amount)) }).ToList();
        // Unmatched signed adjustments still reduce the lease's collectible rent;
        // do not silently discard an accounting loss just because its original is absent.
        var matchedIntents = rentCredits.Select(x => x.Payment.StripePaymentIntentId).Where(x => x != null).ToHashSet();
        var unmatchedLoss = Math.Max(0m, -adjustments.Where(a => a.StripePaymentIntentId == null
            || !matchedIntents.Contains(a.StripePaymentIntentId)).Sum(a => a.Amount));
        var creditsToAllocate = new Dictionary<long, decimal>();
        foreach (var credit in rentCredits.AsEnumerable().Reverse())
        {
            var deducted = Math.Min(unmatchedLoss, credit.Amount);
            unmatchedLoss -= deducted;
            creditsToAllocate[credit.Payment.Id] = credit.Amount - deducted;
        }
        foreach (var credit in rentCredits)
        {
            var amount = creditsToAllocate[credit.Payment.Id];
            if (amount > 0)
                Allocate(result.Where(r => r.Type == "Rent"), credit.Payment.Id, amount, credit.Payment.Status, credit.Payment.PaymentDate);
        }
        var feeCredits = payments.Where(p => p.FeeId.HasValue)
            .GroupBy(p => p.StripePaymentIntentId == null ? $"fee:{p.FeeId}:payment:{p.Id}"
                : $"fee:{p.FeeId}:intent:{p.StripePaymentIntentId}");
        foreach (var group in feeCredits)
        {
            var original = group.FirstOrDefault(p => p.Amount > 0 && !FeeCollection.IsAdjustment(p));
            if (original == null) continue;
            var credited = FeeCollection.Credited(group);
            if (credited > 0)
                Allocate(result.Where(r => r.ChargeId == $"fee:{original.FeeId}"), original.Id,
                    credited, original.Status, original.PaymentDate);
        }
        foreach (var receipt in deposits.Where(d => d.Amount > 0 && d.ReceivedDate != default).OrderBy(d => d.ReceivedDate).ThenBy(d => d.Id))
        {
            var linked = finalPayments.Where(p => p.DepositId == receipt.Id).ToList();
            // Returning held money is not a reversal of the original collection.
            var net = receipt.Amount;
            foreach (var payment in linked)
            {
                var applied = Math.Min(net, payment.Amount);
                Allocate(result.Where(r => r.Type == "Deposit"), payment.Id, applied, payment.Status, payment.PaymentDate);
                net -= applied;
            }
            Allocate(result.Where(r => r.Type == "Deposit"), receipt.Id, net, "Received", receipt.ReceivedDate);
        }
        // Deposit-linked payments without a receipt are still final receipts; never count
        // a linked Payment again after reconciling its Deposit row above.
        var receiptIds = deposits.Select(d => d.Id).ToHashSet();
        foreach (var payment in finalPayments.Where(p => p.DepositId.HasValue && !receiptIds.Contains(p.DepositId.Value)))
            Allocate(result.Where(r => r.Type == "Deposit"), payment.Id, payment.Amount, payment.Status, payment.PaymentDate);
        return result;
    }

    private static bool IsFinal(string? status) => status is not null &&
        (status.Equals("Completed", StringComparison.OrdinalIgnoreCase) || status.Equals("Paid", StringComparison.OrdinalIgnoreCase));

    private static bool IsLossStatus(string? status) => status is not null &&
        (status.Equals("PartiallyRefunded", StringComparison.OrdinalIgnoreCase)
            || status.Equals("Refunded", StringComparison.OrdinalIgnoreCase)
            || status.Equals("Disputed", StringComparison.OrdinalIgnoreCase));

    private static bool IsAdjustment(Payment payment) => payment.Method is "Stripe loss adjustment" or "Stripe dispute recovery adjustment";

    private static LeaseChargeDto New(string id, string type, string title, DateTime? due, decimal amount) =>
        new() { ChargeId = id, Type = type, Title = title, DueDate = due, Amount = amount, Remaining = amount };

    private static void Allocate(IEnumerable<LeaseChargeDto> charges, long id, decimal amount, string status, DateTime date)
    {
        foreach (var charge in charges)
        {
            if (amount <= 0) break;
            var applied = Math.Min(charge.Remaining, amount);
            if (applied <= 0) continue;
            charge.Paid += applied;
            charge.Remaining -= applied;
            charge.Payments.Add(new LeaseChargePaymentDto { Id = id, Amount = applied, Status = status, PaymentDate = date });
            amount -= applied;
        }
    }
}
