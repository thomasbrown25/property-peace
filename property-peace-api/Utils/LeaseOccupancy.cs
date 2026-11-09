using System.Linq.Expressions;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.Unit;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Utils;

/// <summary>Lease-backed occupancy on a UTC calendar date. End dates are inclusive.
/// Month-to-month leases honor their stored end date (extended by the renewal service);
/// legacy leases with no end date remain open-ended. Tenants and cached flags are irrelevant.
/// </summary>
public static class LeaseOccupancy
{
    public static Expression<Func<Lease, bool>> ActiveOn(DateTime date)
    {
        var day = date.Date;
        return l => !l.IsDeleted && l.IsActive &&
            (l.LeaseAgreement == null || l.LeaseAgreement.IsDrafted != true) &&
            l.StartDate.HasValue && l.StartDate.Value.Date <= day &&
            (!l.EndDate.HasValue || l.EndDate.Value.Date >= day);
    }

    public static bool IsActiveOn(Lease lease, DateTime date) =>
        IsActiveOn(lease.IsActive, lease.IsDeleted, lease.LeaseAgreement?.IsDrafted,
            lease.StartDate, lease.EndDate, date);

    public static bool IsActiveOn(LoadLeaseDto lease, DateTime date) =>
        IsActiveOn(lease.IsActive, lease.IsDeleted, lease.LeaseAgreement?.IsDrafted,
            lease.StartDate, lease.EndDate, date);

    private static bool IsActiveOn(bool active, bool deleted, bool? draft,
        DateTime? start, DateTime? end, DateTime date) =>
        active && !deleted && draft != true && start.HasValue &&
        start.Value.Date <= date.Date && (!end.HasValue || end.Value.Date >= date.Date);

    public static bool IsOccupied(LoadUnitDto unit, DateTime date) =>
        unit.Leases.Any(l => IsActiveOn(l, date)) ||
        (unit.Lease != null && IsActiveOn(unit.Lease, date));
}
