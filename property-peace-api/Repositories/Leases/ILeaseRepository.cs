using brownstone_hub_api.Dtos.Admin;
using brownstone_hub_api.Dtos.Lease;

namespace brownstone_hub_api.Repositories.Leases
{
    public interface ILeaseRepository
    {
        Task<LoadLeaseDto> AddLease(UpdateLeaseDto lease, long? organizationId = null);
        Task<LoadLeaseDto> UpdateLease(UpdateLeaseDto lease);
        Task<LoadLeaseDto> UpdateLeaseSignature(UpdateLeaseSignatureDto signatureInfo);
        Task<LoadLeaseDto> GetLease(long unitId, long? organizationId = null);
        Task<LoadLeaseDto> GetLeaseById(long leaseId, long organizationId);
        Task<LoadLeaseDto> DeleteLease(long id);
        Task<List<LoadLeaseDto>> GetLeasesByLandlordId(long landlordId, bool isActive = true);
        Task<List<LoadLeaseDto>> GetLeasesByOrganizationId(long organizationId, bool isActive = true);
        Task<List<LoadLeaseDto>> GetLeasesByPropertyId(long propertyId, bool isActive = true, long? organizationId = null);
        Task<LoadLeaseDto> GetActiveLease(long propertyId, long? organizationId = null);
        Task<List<LoadLeaseDto>> GetLeasesByTenantUserId(long tenantUserId);
        Task<int> DeleteLeasesByPropertyId(long propertyId);
        Task<LoadLeaseDto> EndLease(long leaseId);
        Task<LoadLeaseDto> ReopenLease(long leaseId);
        Task<List<LoadLeaseDto>> GetLeaseHistoryByOrganizationId(long organizationId);
        Task<bool> RemoveTenantFromLease(long leaseId, long tenantId);
        Task<bool> AddTenantToLease(long leaseId, long tenantId);
        Task<int> DeactivateLeasesByPropertyId(long propertyId);
        /// <summary>Sets IsDrafted = false for the lease. Call when user completes all "Finish Setting Up" steps on the lease page.</summary>
        Task<LoadLeaseDto> CompleteDraft(long leaseId, long organizationId);
        /// <summary>Gets a single lease by id without organization filter. For admin use (e.g. rent reminder job). Returns null if not found.</summary>
        Task<LoadLeaseDto?> GetLeaseByIdForAdminAsync(long leaseId);
        /// <summary>Gets all active, non-draft leases for admin dropdown (id + label).</summary>
        Task<List<AdminLeaseOptionDto>> GetLeasesForAdminListAsync();
        /// <summary>Marks the move-in report template step as completed for this lease (per-lease completion).</summary>
        Task<LoadLeaseDto> SetMoveInReportTemplateCompletedAt(long leaseId, long organizationId);
        /// <summary>Resolves lease by DocuSign envelope ID for Connect webhook. Returns null if not found.</summary>
        Task<LeaseConnectInfoDto?> GetLeaseByDocuSignEnvelopeIdAsync(string envelopeId);
        /// <summary>Gets active leases with AutoRenewLease enabled whose EndDate is on or before the given date (for auto-renew processing).</summary>
        Task<List<LoadLeaseDto>> GetLeasesEndingOnOrBeforeForAutoRenew(DateTime date);
        /// <summary>Copies related entities (fees, deposits, landlords, co-signers, pets, parking, keys, utilities, maintenance) from source lease to the new lease.</summary>
        Task CopyLeaseRelatedEntitiesToNewLeaseAsync(long sourceLeaseId, long newLeaseId);
        /// <summary>Lightweight query returning only fields needed by RentCalculator (IsActive, RentAmount, StartDate, EndDate, RentFrequency). No navigation property loads.</summary>
        Task<List<LoadLeaseDto>> GetLeasesForRentCalculationAsync(long organizationId);
    }
}