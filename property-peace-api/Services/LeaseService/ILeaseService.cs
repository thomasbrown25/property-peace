
using brownstone_hub_api.Dtos.Lease;

namespace brownstone_hub_api.Services.LeaseService
{
    public interface ILeaseService
    {
        Task<ServiceResponse<LoadLeaseDto>> AddOrUpdateLease(UpdateLeaseDto lease);
        Task<ServiceResponse<LoadLeaseDto>> UpdateLeaseSignature(UpdateLeaseSignatureDto signatureInfo);
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
            string? frontendBaseUrl);
        
        Task<ServiceResponse<Services.ESignatureService.SignatureEnvelopeDto>> SendLeaseForSignatureAsync(
            long leaseId, 
            SendLeaseForSignatureDto request,
            long landlordId,
            long? organizationId);
        
        Task<ServiceResponse<SyncSignatureStatusResultDto>> SyncLeaseSignatureStatusAsync(
            long leaseId,
            string? landlordEmail);

        /// <summary>Syncs signature status from DocuSign when triggered by Connect webhook (no user context).</summary>
        Task<ServiceResponse<SyncSignatureStatusResultDto>> SyncLeaseSignatureStatusFromConnectAsync(long leaseId, long organizationId);

        Task SendLeaseAddedNotificationAsync(long leaseId, long tenantId, long? organizationId = null);
        Task<ServiceResponse<bool>> RemoveTenantFromLease(long leaseId, long tenantId);
        Task<ServiceResponse<bool>> AddTenantToLease(long leaseId, long tenantId);
        /// <summary>Marks the lease as no longer a draft (IsDrafted = false). Call when user completes all "Finish Setting Up" steps on the lease page.</summary>
        Task<ServiceResponse<LoadLeaseDto>> CompleteDraft(long leaseId);
        /// <summary>Marks the move-in report template step as completed for this lease (per-lease).</summary>
        Task<ServiceResponse<LoadLeaseDto>> SetMoveInReportTemplateCompletedAt(long leaseId);
    }
}