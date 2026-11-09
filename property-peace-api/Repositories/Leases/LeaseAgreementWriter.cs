using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.LeaseAgreement;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.Leases;

/// <summary>
/// Supplemental-only persistence. The existing schema stores these on Lease and its child tables;
/// this allowlist intentionally never runs the broad lease mapper or changes lease-owned fields.
/// The caller scopes/authorizes the lease and commits all changes with one SaveChangesAsync.
/// </summary>
public static class LeaseAgreementWriter
{
    public static async Task ApplyAsync(DataContext context, Lease lease, UpdateLeaseAgreementDto dto)
    {
        if (dto.PetsAllowed.HasValue) lease.PetsAllowed = dto.PetsAllowed;
        if (dto.SmokingAllowed != null) lease.SmokingAllowed = dto.SmokingAllowed;
        if (dto.HasSharedUtilities.HasValue) lease.HasSharedUtilities = dto.HasSharedUtilities;
        if (dto.SharedUtilitiesDisclosure != null) lease.SharedUtilitiesDisclosure = dto.SharedUtilitiesDisclosure;
        if (dto.MaintenanceNotificationMethods != null) lease.MaintenanceNotificationMethods = dto.MaintenanceNotificationMethods;
        if (dto.IncludeEarlyTerminationClause.HasValue) lease.IncludeEarlyTerminationClause = dto.IncludeEarlyTerminationClause;
        if (dto.EarlyTerminationClauseText != null) lease.EarlyTerminationClauseText = dto.EarlyTerminationClauseText;
        if (dto.AdditionalTerms != null) lease.AdditionalTerms = dto.AdditionalTerms;
        if (dto.BuiltBefore1978.HasValue) lease.BuiltBefore1978 = dto.BuiltBefore1978;
        if (dto.AwareOfLeadPaint.HasValue) lease.AwareOfLeadPaint = dto.AwareOfLeadPaint;
        if (dto.LeadPaintExplanation != null) lease.LeadPaintExplanation = dto.LeadPaintExplanation;
        if (dto.HasLeadPaintRecords.HasValue) lease.HasLeadPaintRecords = dto.HasLeadPaintRecords;
        if (dto.LeadPaintRecordsExplanation != null) lease.LeadPaintRecordsExplanation = dto.LeadPaintRecordsExplanation;

        // Null collections preserve existing rows; [] explicitly clears them. Child identity and
        // ownership supplied by the client are ignored; both derive from the authorized parent.
        if (dto.Pets != null)
        {
            context.Pets.RemoveRange(await context.Pets.Where(x => x.LeaseId == lease.Id).ToListAsync());
            context.Pets.AddRange(dto.Pets.Select(x => new Pet
            {
                LeaseId = lease.Id, OrganizationId = lease.OrganizationId,
                Type = x.Type, Breed = x.Breed, Weight = x.Weight, Age = x.Age
            }));
        }
        if (dto.Parking != null)
        {
            var parking = await context.Parking.FirstOrDefaultAsync(x => x.LeaseId == lease.Id);
            if (parking == null)
            {
                parking = new Parking { LeaseId = lease.Id, OrganizationId = lease.OrganizationId };
                context.Parking.Add(parking);
            }
            parking.IncludeParkingRules = dto.Parking.IncludeParkingRules;
            parking.ParkingTypes = dto.Parking.ParkingTypes;
            parking.CustomRules = dto.Parking.CustomRules;
            parking.UpdatedAt = DateTime.UtcNow;
        }
        if (dto.UtilityServiceResponsibilities != null)
        {
            context.UtilityServiceResponsibilities.RemoveRange(await context.UtilityServiceResponsibilities.Where(x => x.LeaseId == lease.Id).ToListAsync());
            context.UtilityServiceResponsibilities.AddRange(dto.UtilityServiceResponsibilities.Select(x => new UtilityServiceResponsibility
            {
                LeaseId = lease.Id, OrganizationId = lease.OrganizationId,
                Name = x.Name, Responsibility = x.Responsibility, IsRequired = x.IsRequired
            }));
        }
        if (dto.MaintenanceResponsibilities != null)
        {
            context.MaintenanceResponsibilities.RemoveRange(await context.MaintenanceResponsibilities.Where(x => x.LeaseId == lease.Id).ToListAsync());
            context.MaintenanceResponsibilities.AddRange(dto.MaintenanceResponsibilities.Select(x => new MaintenanceResponsibility
            {
                LeaseId = lease.Id, OrganizationId = lease.OrganizationId,
                Name = x.Name, Description = x.Description, Responsibility = x.Responsibility
            }));
        }
        if (dto.LeaseKeys != null)
        {
            context.LeaseKeys.RemoveRange(await context.LeaseKeys.Where(x => x.LeaseId == lease.Id).ToListAsync());
            context.LeaseKeys.AddRange(dto.LeaseKeys.Select(x => new LeaseKey
            {
                LeaseId = lease.Id, OrganizationId = lease.OrganizationId,
                KeyType = x.KeyType, Copies = x.Copies
            }));
        }
    }
}
