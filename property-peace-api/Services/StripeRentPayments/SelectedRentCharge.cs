using System.Globalization;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Services.Payments;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.StripeRentPayments;

/// <summary>Only full calendar-month installments matching oldest-first rent accounting are selectable.</summary>
internal static class SelectedRentCharge
{
    internal static bool IsRent(string? chargeId) => chargeId?.StartsWith("rent:", StringComparison.Ordinal) == true;

    // Syntax and lease identity only: reservation validates live scope/eligibility before Stripe.
    internal static bool IsSupportedSelector(string? chargeId, long leaseId)
    {
        if (chargeId == null) return true;
        if (IsRent(chargeId))
            return IsWellFormed(chargeId) && chargeId.StartsWith($"rent:{leaseId}:", StringComparison.Ordinal);
        return chargeId.StartsWith("fee:", StringComparison.Ordinal)
            && long.TryParse(chargeId.AsSpan(4), NumberStyles.None, CultureInfo.InvariantCulture, out var id)
            && id > 0 && chargeId == $"fee:{id}";
    }

    internal static bool IsWellFormed(string chargeId)
    {
        var fields = chargeId.Split(':');
        return fields.Length == 3 && long.TryParse(fields[1], NumberStyles.None, CultureInfo.InvariantCulture, out var id)
            && id > 0 && DateTime.TryParseExact(fields[2], "yyyy-MM-dd", CultureInfo.InvariantCulture,
                DateTimeStyles.None, out var date) && chargeId == $"rent:{id}:{date:yyyy-MM-dd}";
    }

    internal static async Task<LeaseChargeDto> OldestUnpaidAsync(DataContext db, string chargeId,
        long leaseId, long organizationId, CancellationToken cancellationToken)
    {
        if (!IsWellFormed(chargeId) || !chargeId.StartsWith($"rent:{leaseId}:", StringComparison.Ordinal))
            throw new InvalidOperationException("Selected rent charge does not belong to the authorized lease.");
        var lease = await db.Leases.AsNoTracking().SingleOrDefaultAsync(l => l.Id == leaseId
            && l.OrganizationId == organizationId && l.IsActive && !l.IsDeleted, cancellationToken)
            ?? throw new InvalidOperationException("Lease is not active in the authorized organization.");
        // Daily proration, weekly schedules, mid-month starts/ends and non-first due days
        // cannot safely be represented by this ledger's full monthly installment rows.
        if (!string.Equals(lease.RentFrequency?.Trim(), "Monthly", StringComparison.OrdinalIgnoreCase)
            || lease.RentDueDay != 1 || !lease.StartDate.HasValue || !lease.EndDate.HasValue
            || lease.StartDate.Value.Day != 1 || lease.EndDate.Value.Day != DateTime.DaysInMonth(lease.EndDate.Value.Year, lease.EndDate.Value.Month)
            || lease.RentAmount is not > 0)
            throw new InvalidOperationException("Selected rent is unavailable for this billing schedule.");
        var rows = await new LeaseChargeLedger(db).ForLandlord(leaseId, organizationId, DateTime.Today)
            ?? throw new InvalidOperationException("Selected rent lease is not in the authorized organization.");
        var oldest = rows.Where(x => x.Type == "Rent" && x.Remaining > 0)
            .OrderBy(x => x.DueDate).FirstOrDefault();
        // A month still accruing daily cannot be reconciled to a full installment yet.
        if (oldest == null || oldest.ChargeId != chargeId || oldest.DueDate?.AddMonths(1) > DateTime.Today)
            throw new InvalidOperationException("Selected rent must be the oldest unpaid eligible installment.");
        return oldest;
    }
}
