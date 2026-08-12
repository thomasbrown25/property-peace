using brownstone_hub_api.Data;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.Expenses;

internal static class ExpenseOrganizationGuard
{
    public static async Task ValidateAsync(
        DataContext db,
        long organizationId,
        long landlordId,
        long propertyId,
        long? unitId,
        long? vendorId,
        long? maintenanceRequestId)
    {
        if (organizationId <= 0)
            throw new InvalidOperationException("Organization context is required.");

        if (!await db.OrganizationMembers.AnyAsync(m =>
                m.OrganizationId == organizationId && m.UserId == landlordId && m.IsActive))
            throw new InvalidOperationException("Landlord does not belong to the active organization.");

        if (!await db.Properties.AnyAsync(p =>
                p.Id == propertyId && p.OrganizationId == organizationId && !p.IsDeleted))
            throw new InvalidOperationException("Property does not belong to the active organization.");

        if (unitId.HasValue && !await db.Units.AnyAsync(u =>
                u.Id == unitId.Value && u.PropertyId == propertyId && u.OrganizationId == organizationId))
            throw new InvalidOperationException("Unit does not belong to the selected property and active organization.");

        if (vendorId.HasValue && !await db.Vendors.AnyAsync(v =>
                v.Id == vendorId.Value && v.OrganizationId == organizationId && !v.IsDeleted))
            throw new InvalidOperationException("Vendor does not belong to the active organization.");

        if (maintenanceRequestId.HasValue && !await db.MaintenanceRequests.AnyAsync(m =>
                m.Id == maintenanceRequestId.Value && m.OrganizationId == organizationId &&
                m.PropertyId == propertyId && (!unitId.HasValue || m.UnitId == unitId)))
            throw new InvalidOperationException("Maintenance request does not belong to the selected property, unit, and active organization.");
    }

    public static async Task ValidateReferencesAsync(
        DataContext db,
        long organizationId,
        long propertyId,
        long? unitId,
        long? vendorId,
        long? maintenanceRequestId)
    {
        if (organizationId <= 0)
            throw new InvalidOperationException("Organization context is required.");

        if (!await db.Properties.AnyAsync(p =>
                p.Id == propertyId && p.OrganizationId == organizationId && !p.IsDeleted))
            throw new InvalidOperationException("Property does not belong to the active organization.");

        if (unitId.HasValue && !await db.Units.AnyAsync(u =>
                u.Id == unitId.Value && u.PropertyId == propertyId && u.OrganizationId == organizationId))
            throw new InvalidOperationException("Unit does not belong to the selected property and active organization.");

        if (vendorId.HasValue && !await db.Vendors.AnyAsync(v =>
                v.Id == vendorId.Value && v.OrganizationId == organizationId && !v.IsDeleted))
            throw new InvalidOperationException("Vendor does not belong to the active organization.");

        if (maintenanceRequestId.HasValue && !await db.MaintenanceRequests.AnyAsync(m =>
                m.Id == maintenanceRequestId.Value && m.OrganizationId == organizationId &&
                m.PropertyId == propertyId && (!unitId.HasValue || m.UnitId == unitId)))
            throw new InvalidOperationException("Maintenance request does not belong to the selected property, unit, and active organization.");
    }
}
