using brownstone_hub_api.Data;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.MoneyCenter;

public sealed class EfMoneyCenterDataSource(DataContext db) : IMoneyCenterDataSource
{
    private readonly DataContext _db = db;

    public Task<bool> PropertyBelongsToOrganizationAsync(long organizationId, long propertyId, CancellationToken ct) =>
        _db.Properties.AsNoTracking().AnyAsync(x => x.Id == propertyId && x.OrganizationId == organizationId && !x.IsDeleted, ct);

    public Task<bool> UnitBelongsToOrganizationAsync(long organizationId, long unitId, long? propertyId, CancellationToken ct) =>
        _db.Units.AsNoTracking().AnyAsync(x => x.Id == unitId && x.OrganizationId == organizationId
            && x.Property.OrganizationId == organizationId && !x.Property.IsDeleted
            && (!propertyId.HasValue || x.PropertyId == propertyId.Value), ct);

    public async Task<MoneyCenterOperationalData> LoadAsync(long organizationId, MoneyCenterQuery query, CancellationToken ct)
    {
        // Keep archived names and transaction scope in unfiltered accounting history. Explicit scopes
        // are still fail-closed by the active-record ownership checks above.
        var propertyQuery = _db.Properties.AsNoTracking().Where(x => x.OrganizationId == organizationId);
        if (query.PropertyId.HasValue) propertyQuery = propertyQuery.Where(x => x.Id == query.PropertyId.Value);
        if (query.UnitId.HasValue) propertyQuery = propertyQuery.Where(x => x.Units.Any(u => u.Id == query.UnitId.Value && u.OrganizationId == organizationId));
        var properties = await propertyQuery.Select(x => new MoneyCenterPropertyRecord(x.Id,
            string.IsNullOrWhiteSpace(x.Name) ? x.StreetAddress : x.Name!)).ToListAsync(ct);
        var propertyIds = properties.Select(x => x.Id).ToList();

        var unitQuery = _db.Units.AsNoTracking().Where(x => x.OrganizationId == organizationId && propertyIds.Contains(x.PropertyId));
        if (query.UnitId.HasValue) unitQuery = unitQuery.Where(x => x.Id == query.UnitId.Value);
        var units = await unitQuery.Select(x => new MoneyCenterUnitRecord(x.Id, x.PropertyId, x.Name)).ToListAsync(ct);
        var unitIds = units.Select(x => x.Id).ToList();

        // Only active leases contribute scheduled rent due. Deleted leases remain reachable below for
        // historical payments but must not recreate current obligations.
        var leaseEntities = await _db.Leases.AsNoTracking().Where(x => x.OrganizationId == organizationId
                && !x.IsDeleted && !x.Unit.Property.IsDeleted && propertyIds.Contains(x.Unit.PropertyId) && unitIds.Contains(x.UnitId)
                && x.StartDate.HasValue && x.EndDate.HasValue && x.RentAmount.HasValue && x.RentAmount > 0)
            .Select(x => new { x.Id, PropertyId = x.Unit.PropertyId, x.UnitId, x.RentAmount, x.StartDate, x.EndDate, x.RentFrequency, x.RentDueDay })
            .ToListAsync(ct);
        var leases = leaseEntities.Select(x => new MoneyCenterLeaseRecord(x.Id, x.PropertyId, x.UnitId, x.RentAmount!.Value,
            Utc(x.StartDate!.Value), Utc(x.EndDate!.Value), x.RentFrequency ?? "Monthly", x.RentDueDay ?? 1)).ToList();

        var paymentEntities = await _db.Payments.AsNoTracking()
            .Where(x => x.OrganizationId == organizationId && propertyIds.Contains(x.PropertyId)
                && (!query.UnitId.HasValue || x.Lease.UnitId == query.UnitId.Value))
            .Select(x => new { Payment = x, UnitId = (long?)x.Lease.UnitId })
            .ToListAsync(ct);
        var intents = paymentEntities.Where(x => !string.IsNullOrWhiteSpace(x.Payment.StripePaymentIntentId))
            .Select(x => x.Payment.StripePaymentIntentId!).Distinct().ToList();
        var settlements = await _db.StripeRentPayments.AsNoTracking()
            .Where(x => x.OrganizationId == organizationId && intents.Contains(x.PaymentIntentId))
            .ToDictionaryAsync(x => x.PaymentIntentId, ct);
        var representedLossByIntent = paymentEntities
            .Where(x => x.Payment.StripePaymentIntentId != null && x.Payment.Reference != null
                && (x.Payment.Reference.Contains(":loss", StringComparison.Ordinal)
                    || x.Payment.Reference.EndsWith(":dispute-recovery", StringComparison.Ordinal)))
            .GroupBy(x => x.Payment.StripePaymentIntentId!, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => Math.Max(0m, -g.Sum(x => x.Payment.Amount)), StringComparer.Ordinal);
        var payments = paymentEntities.Select(row =>
        {
            var payment = row.Payment;
            settlements.TryGetValue(payment.StripePaymentIntentId ?? "", out var settlement);
            // Settlement counters describe the original positive receipt. Negative durable adjustment
            // rows already carry cash loss and must never receive the projection themselves.
            var projectSettlementLoss = payment.Amount > 0 && settlement != null;
            var representedLoss = projectSettlementLoss
                ? representedLossByIntent.GetValueOrDefault(payment.StripePaymentIntentId ?? "")
                : 0m;
            var refunded = projectSettlementLoss ? settlement!.RefundedAmountCents / 100m : 0m;
            var disputed = projectSettlementLoss
                ? Math.Max(0L, settlement!.DisputedAmountCents - settlement.DisputeRecoveredAmountCents) / 100m
                : 0m;
            var refundCovered = Math.Min(refunded, representedLoss);
            refunded -= refundCovered;
            representedLoss -= refundCovered;
            disputed = Math.Max(0m, disputed - representedLoss);
            var settlementAttention = settlement != null && (settlement.Status is StripeRentPaymentStatus.Created
                or StripeRentPaymentStatus.Processing or StripeRentPaymentStatus.TransferReconciliationPending
                or StripeRentPaymentStatus.ReversalPending or StripeRentPaymentStatus.Reversed
                or StripeRentPaymentStatus.RecoveryFailed or StripeRentPaymentStatus.Blocked
                or StripeRentPaymentStatus.Failed or StripeRentPaymentStatus.Canceled);
            return new MoneyCenterPaymentRecord(payment.Id, payment.PropertyId, row.UnitId, payment.LeaseId, payment.Amount, Utc(payment.PaymentDate),
                payment.Status, payment.DepositId.HasValue, payment.FeeId.HasValue ? "Lease fee" : payment.DepositId.HasValue ? "Deposit" : "Rent",
                payment.Method, payment.Reference, refunded, disputed, settlementAttention);
        }).ToList();

        var expenseEntities = await _db.Expenses.AsNoTracking()
            .Where(x => x.OrganizationId == organizationId && propertyIds.Contains(x.PropertyId)
                && (!query.UnitId.HasValue || x.UnitId == query.UnitId.Value))
            .Select(x => new
            {
                x.Id, x.PropertyId, x.UnitId, x.Amount, x.ExpenseDate, x.IsPaid, x.PaidDate, x.DueDate,
                x.Category, x.Name, Vendor = x.VendorEntity != null ? x.VendorEntity.Name : x.Vendor,
                x.IsTaxDeductible, HasReceipt = x.ReceiptUrl != null || x.Receipts.Any()
            }).ToListAsync(ct);
        var expenses = expenseEntities.Select(x => new MoneyCenterExpenseRecord(x.Id, x.PropertyId, x.UnitId, x.Amount,
            Utc(x.ExpenseDate), x.IsPaid, UtcNullable(x.PaidDate), UtcNullable(x.DueDate), x.Category, x.Name,
            x.Vendor, x.IsTaxDeductible, x.HasReceipt)).ToList();

        var activePropertyIds = await _db.Properties.AsNoTracking()
            .Where(x => x.OrganizationId == organizationId && !x.IsDeleted && propertyIds.Contains(x.Id))
            .Select(x => x.Id).ToListAsync(ct);
        var futureEntities = await _db.FutureExpenses.AsNoTracking()
            .Where(x => x.OrganizationId == organizationId && activePropertyIds.Contains(x.PropertyId)
                && (!query.UnitId.HasValue || x.UnitId == query.UnitId.Value))
            .Select(x => new { x.Id, x.PropertyId, x.UnitId, x.Amount, x.DueDate, x.Category, x.Name, Vendor = x.VendorEntity != null ? x.VendorEntity.Name : x.Vendor })
            .ToListAsync(ct);
        var future = futureEntities.Select(x => new MoneyCenterFutureExpenseRecord(x.Id, x.PropertyId, x.UnitId,
            x.Amount, Utc(x.DueDate), x.Category, x.Name, x.Vendor)).ToList();

        var recurringEntities = await _db.RecurringExpenses.AsNoTracking()
            .Where(x => x.OrganizationId == organizationId && activePropertyIds.Contains(x.PropertyId)
                && (!query.UnitId.HasValue || x.UnitId == query.UnitId.Value)
                && !x.IsPaused && x.NextOccurrenceDate.HasValue)
            .Select(x => new { x.Id, x.PropertyId, x.UnitId, x.Amount, x.NextOccurrenceDate, x.EndDate, x.DayOfPeriod, x.Frequency, x.Category, x.Name, x.Vendor })
            .ToListAsync(ct);
        var recurring = recurringEntities.Select(x => new MoneyCenterRecurringExpenseRecord(x.Id, x.PropertyId, x.UnitId,
            x.Amount, Utc(x.NextOccurrenceDate!.Value), x.Frequency.ToString(), x.Category, x.Name, x.Vendor,
            UtcNullable(x.EndDate), x.DayOfPeriod)).ToList();

        return new(properties, units, leases, payments, expenses, future, recurring);
    }

    private static DateTimeOffset Utc(DateTime value) => new(DateTime.SpecifyKind(value, DateTimeKind.Utc));
    private static DateTimeOffset? UtcNullable(DateTime? value) => value.HasValue ? Utc(value.Value) : null;
}
