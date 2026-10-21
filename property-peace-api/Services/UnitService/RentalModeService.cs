using System.Data;
using System.Security.Claims;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Utils;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.UnitService;

public sealed record ChangeRentalModeRequest(ERentalMode TargetMode, bool Confirmed);
public sealed record RentalModeBlocker(string Code, string Message, string Resolution);
public sealed record RentalModePreflight(long UnitId, ERentalMode CurrentMode, ERentalMode TargetMode,
    bool CanChange, IReadOnlyList<RentalModeBlocker> Blockers, string ConfirmationMessage);

/// <summary>All decisions use the authorized unit's property, never a caller-supplied organization.</summary>
public sealed class RentalModeService(DataContext db, IHttpContextAccessor context, ILogger<RentalModeService> logger)
{
    private long? OrganizationId()
    {
        var http = context.HttpContext;
        if (http?.Items.TryGetValue("OrganizationId", out var org) != true || org is not long organizationId || organizationId <= 0 ||
            http.Items.TryGetValue("UserId", out var user) != true || user is not long userId || userId <= 0 ||
            !long.TryParse(http.User.FindFirstValue(ClaimTypes.NameIdentifier), out var subject) || subject != userId)
            return null;
        return organizationId;
    }

    private static ServiceResponse<RentalModePreflight> Error(string message, int status) =>
        ServiceResponse<RentalModePreflight>.CreateError(message, statusCode: status, suppressDetailedErrors: true);

    private Task<bool> CanManageAsync(long org, CancellationToken ct)
    {
        var userId = (long)context.HttpContext!.Items["UserId"]!;
        return db.OrganizationMembers.AsNoTracking().AnyAsync(m =>
            m.OrganizationId == org && m.UserId == userId && m.IsActive &&
            m.Organization.IsActive && !m.Organization.IsDeleted &&
            (m.Role == "Owner" || m.Role == "Manager" && m.CanManageProperties), ct);
    }

    public async Task<ServiceResponse<RentalModePreflight>> Preflight(long unitId, ERentalMode target, CancellationToken ct = default)
    {
        if (OrganizationId() is not long org) return Error("Forbidden", 403);
        if (unitId <= 0 || !Enum.IsDefined(target)) return Error("Invalid unit or rental mode", 400);
        try
        {
            if (!await CanManageAsync(org, ct)) return Error("Forbidden", 403);
            var unit = await db.Units.AsNoTracking().FirstOrDefaultAsync(u => u.Id == unitId &&
                u.Property.OrganizationId == org && !u.Property.IsDeleted &&
                (u.OrganizationId == null || u.OrganizationId == org), ct);
            if (unit is null) return Error("Unit not found", 404);
            if (unit.RentalMode == target) return Error("Unit already has this rental mode", 400);
            return ServiceResponse<RentalModePreflight>.CreateSuccess(await Evaluate(unit, target, org, ct));
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            logger.LogError(ex, "Rental mode preflight unavailable for unit {UnitId}", unitId);
            return Error("Rental mode preflight unavailable", 503);
        }
    }

    public async Task<ServiceResponse<RentalModePreflight>> Change(long unitId, ChangeRentalModeRequest? request, CancellationToken ct = default)
    {
        if (OrganizationId() is not long org) return Error("Forbidden", 403);
        if (unitId <= 0 || request is null || !Enum.IsDefined(request.TargetMode)) return Error("Invalid unit or rental mode", 400);
        if (!request.Confirmed) return Error("Explicit confirmation is required", 400);
        try
        {
            if (!await CanManageAsync(org, ct)) return Error("Forbidden", 403);
            // Serializable lease-range read and unit update must be in the same transaction.
            // Lease insertion must also re-read mode inside its serializable transaction.
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            if (db.Database.IsSqlServer())
                await db.Database.SqlQueryRaw<long>(
                    "SELECT Id AS Value FROM [property].[Units] WITH (UPDLOCK, HOLDLOCK) WHERE Id = {0}", unitId)
                    .SingleOrDefaultAsync(ct);
            var unit = await db.Units.FirstOrDefaultAsync(u => u.Id == unitId &&
                u.Property.OrganizationId == org && !u.Property.IsDeleted &&
                (u.OrganizationId == null || u.OrganizationId == org), ct);
            if (unit is null) return Error("Unit not found", 404);
            if (unit.RentalMode == request.TargetMode) return Error("Unit already has this rental mode", 400);
            var decision = await Evaluate(unit, request.TargetMode, org, ct);
            if (!decision.CanChange)
            {
                var conflict = Error("Rental mode change blocked", 409);
                conflict.Data = decision;
                return conflict;
            }
            unit.RentalMode = request.TargetMode;
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return ServiceResponse<RentalModePreflight>.CreateSuccess(decision with { CurrentMode = request.TargetMode }, "Rental mode changed; existing history retained");
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            logger.LogError(ex, "Rental mode change unavailable for unit {UnitId}", unitId);
            return Error("Rental mode change unavailable; retry preflight", 503);
        }
    }

    // The cached OverdueAmount is not a ledger. Recalculate even for ended/inactive leases;
    // only finalized rent payments (not fees/deposits) can settle their contractual rent.
    private async Task<bool> HasUnpaidRent(long unitId, CancellationToken ct)
    {
        var leases = await db.Leases.AsNoTracking().Where(l => l.UnitId == unitId && l.RentAmount > 0)
            .Select(l => new { l.Id, l.StartDate, l.EndDate, l.RentAmount, l.RentFrequency })
            .ToListAsync(ct);
        if (leases.Count == 0) return false;
        var credits = await db.Payments.AsNoTracking().Where(p => p.Lease.UnitId == unitId &&
                p.FeeId == null && p.DepositId == null && (p.Status == "Completed" || p.Status == "Paid"))
            .GroupBy(p => p.LeaseId).Select(g => new { LeaseId = g.Key, Amount = g.Sum(p => p.Amount) })
            .ToDictionaryAsync(p => p.LeaseId, p => p.Amount, ct);
        foreach (var lease in leases)
        {
            // An incomplete paid-rent contract cannot be demonstrated settled; fail closed.
            if (lease.StartDate is null || lease.EndDate is null || lease.EndDate < lease.StartDate)
                return true;
            var expected = RentCalculator.ExpectedForLease(new LoadLeaseDto
            {
                IsActive = true, StartDate = lease.StartDate, EndDate = lease.EndDate,
                RentAmount = lease.RentAmount, RentFrequency = lease.RentFrequency
            }, lease.StartDate.Value.Date, lease.EndDate.Value.Date.AddDays(1));
            if (expected > credits.GetValueOrDefault(lease.Id)) return true;
        }
        return false;
    }

    private async Task<RentalModePreflight> Evaluate(Unit unit, ERentalMode target, long org, CancellationToken ct)
    {
        var blockers = new List<RentalModeBlocker>();
        if (target == ERentalMode.ShortTerm)
        {
            var today = DateTime.Today;
            // A unitless lease listing/application covers every unit in its property, even
            // in multi-unit buildings; a sibling's unit-specific record does not.
            if (await db.Listings.AsNoTracking().AnyAsync(l => l.PropertyId == unit.PropertyId &&
                (l.OrganizationId == null || l.OrganizationId == org) &&
                (l.UnitId == unit.Id || l.UnitId == null) &&
                l.Status == EListingStatus.Active, ct))
                blockers.Add(new("lease_listing", "This unit has a published long-term lease listing.",
                    "Unpublish the lease listing before switching modes; its history will be retained."));
            if (await db.RentalApplications.AsNoTracking().AnyAsync(a => a.PropertyId == unit.PropertyId &&
                (a.OrganizationId == null || a.OrganizationId == org) &&
                (a.UnitId == unit.Id || a.UnitId == null) &&
                (a.Status == EApplicationStatus.Pending || a.Status == EApplicationStatus.Submitted ||
                 a.Status == EApplicationStatus.UnderReview || a.Status == EApplicationStatus.OnHold ||
                 a.Status == EApplicationStatus.Approved), ct))
                blockers.Add(new("lease_application", "This unit has an active long-term rental application.",
                    "Resolve or withdraw the rental application before switching modes; retain its history."));
            // Include drafts and inconsistent active flags; only definitively ended contracts may be ignored.
            if (await db.Leases.AnyAsync(l => l.UnitId == unit.Id && !l.IsDeleted &&
                (l.IsActive || !l.EndDate.HasValue || l.EndDate.Value >= today), ct))
                blockers.Add(new("lease", "This unit has an active, scheduled, or open-ended lease/draft.",
                    "End or cancel the lease and any future term before switching modes."));
            if (await db.Tenants.AsNoTracking().AnyAsync(t => t.UnitId == unit.Id && !t.IsDeleted, ct))
                blockers.Add(new("tenant_assignment", "This unit still has a directly assigned tenant.",
                    "Unassign or move the tenant before switching modes."));
            if (await HasUnpaidRent(unit.Id, ct) ||
                await db.Leases.AnyAsync(l => l.UnitId == unit.Id &&
                    l.OverdueAmount.HasValue && l.OverdueAmount.Value > 0, ct) ||
                await db.Deposits.AnyAsync(d => d.Lease.UnitId == unit.Id &&
                    (d.RefundedDate == null || d.RefundAmount == null || d.RefundAmount < d.Amount), ct) ||
                await db.Payments.AnyAsync(p => p.Lease.UnitId == unit.Id &&
                    (p.Status != "Completed" && p.Status != "Paid" && p.Status != "Failed" &&
                     p.Status != "Canceled" && p.Status != "Refunded" ||
                     p.StripeDisputeId != null && p.Status != "Refunded" ||
                     p.DisputedAt != null && p.Status != "Refunded"), ct) ||
                await db.StripeRentPayments.AnyAsync(p => p.Lease!.UnitId == unit.Id &&
                    (p.Status == StripeRentPaymentStatus.Created || p.Status == StripeRentPaymentStatus.Processing ||
                     p.Status == StripeRentPaymentStatus.Held || p.Status == StripeRentPaymentStatus.TransferPending ||
                     p.Status == StripeRentPaymentStatus.TransferReconciliationPending ||
                     p.Status == StripeRentPaymentStatus.ReversalPending || p.Status == StripeRentPaymentStatus.Transferred ||
                     p.ReversedAmountCents > 0 && p.ReversedAmountCents < p.AmountCents ||
                     (p.StripeRefundId != null || p.RefundedAt != null || p.RefundedAmountCents > 0) &&
                         p.RefundedAmountCents < p.AmountCents ||
                     p.Status == StripeRentPaymentStatus.RecoveryFailed || p.Status == StripeRentPaymentStatus.Blocked ||
                     p.DisputedAt != null && (p.DisputeClosedAt == null ||
                         p.DisputedAmountCents > p.DisputeRecoveredAmountCents)), ct))
                blockers.Add(new("tenant_obligation", "This unit has unresolved rent, deposit, or payment obligations.",
                    "Settle outstanding rent, return deposits, and resolve pending payments or disputes."));
        }
        else if (target == ERentalMode.LongTerm)
        {
            if (await db.ShortStayOccupancyClaims.AsNoTracking().AnyAsync(c => c.UnitId == unit.Id, ct))
                blockers.Add(new("short_stay_claim", "This unit has held or confirmed short-stay nights.",
                    "Resolve active reservation claims before switching modes; reservation history must be retained."));
            if (await db.ShortStayGuidebookDrafts.AsNoTracking().AnyAsync(g => g.UnitId == unit.Id, ct))
                blockers.Add(new("guidebook_draft", "This unit has a short-stay guidebook draft.",
                    "Remove the guidebook draft before switching to long-term mode."));
            // A disabled feed can still own imported dates. Do not hide them by changing mode.
            // Change evaluates under the same serializable unit lock used by feed writes.
            if (await db.ShortStayIcalSubscriptions.AsNoTracking().AnyAsync(s => s.UnitId == unit.Id &&
                (s.Enabled || s.Occurrences.Any()), ct))
                blockers.Add(new("airbnb_calendar", "This unit has an active Airbnb calendar feed or imported dates.",
                    "Disconnect the Airbnb calendar feed and resolve/remove all imported dates before switching to long-term mode. Disabling the feed alone does not clear imported dates."));
        }
        // Claims block conversion independently of a channel feed; no booking metrics are inferred.
        return new(unit.Id, unit.RentalMode, target, blockers.Count == 0, blockers,
            "Changing mode hides the other mode's workflows but retains all lease and financial history. Confirm this unit's change.");
    }
}
