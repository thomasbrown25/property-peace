
using brownstone_hub_api.Dtos.Lease;

namespace brownstone_hub_api.Services.LeaseService
{
    public interface ILeaseService
    {
        Task<ServiceResponse<LoadLeaseDto>> AddOrUpdateLease(UpdateLeaseDto lease);
        Task<ServiceResponse<LoadLeaseDto>> GetLease(long unitId);
        Task<ServiceResponse<LoadLeaseDto>> GetLeaseById(long leaseId);
        Task<ServiceResponse<List<LoadLeaseDto>>> GetLeasesByLandlordId(long landlordId);
        Task<ServiceResponse<LoadLeaseDto>> GetActiveLease(long propertyId);
        Task<ServiceResponse<LoadLeaseDto>> DeleteLease(long leaseId);
        Task<ServiceResponse<List<LoadLeaseDto>>> GetLeasesByTenantUserId(long tenantUserId);
        Task<ServiceResponse<LoadLeaseDto>> EndLease(long leaseId);
        Task<ServiceResponse<LoadLeaseDto>> ReopenLease(long leaseId);
        Task<ServiceResponse<List<LoadLeaseDto>>> GetLeaseHistory();
        
        // Lease signature methods
        Task<ServiceResponse<SignLandlordOnlyResultDto>> SignLandlordOnlyAsync(
            long leaseId, 
            SendLeaseForSignatureDto request, 
            string? frontendBaseUrl,
            CancellationToken cancellationToken);
        
        Task<ServiceResponse<Services.ESignatureService.SignatureEnvelopeDto>> SendLeaseForSignatureAsync(
            long leaseId, 
            SendLeaseForSignatureDto request,
            long landlordId,
            long? organizationId,
            CancellationToken cancellationToken);
        
        Task<ServiceResponse<SyncSignatureStatusResultDto>> SyncLeaseSignatureStatusAsync(
            long leaseId,
            string? landlordEmail,
            CancellationToken cancellationToken);

        Task<ServiceResponse<bool>> CancelLeaseSignatureAsync(long leaseId, string? reason, CancellationToken cancellationToken);
        Task<ServiceResponse<bool>> ResendLeaseSignatureAsync(long leaseId, CancellationToken cancellationToken);


        Task SendLeaseAddedNotificationAsync(long leaseId, long tenantId, long? organizationId = null);
        Task<ServiceResponse<bool>> RemoveTenantFromLease(long leaseId, long tenantId);
        Task<ServiceResponse<bool>> AddTenantToLease(long leaseId, long tenantId);
        /// <summary>Marks the lease as no longer a draft (IsDrafted = false). Call when user completes all "Finish Setting Up" steps on the lease page.</summary>
        Task<ServiceResponse<LoadLeaseDto>> CompleteDraft(long leaseId);
        /// <summary>Marks the move-in report template step as completed for this lease (per-lease).</summary>
        Task<ServiceResponse<LoadLeaseDto>> SetMoveInReportTemplateCompletedAt(long leaseId);
    }
}