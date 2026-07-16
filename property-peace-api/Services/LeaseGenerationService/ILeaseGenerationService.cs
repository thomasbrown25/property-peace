using brownstone_hub_api.Dtos.LeaseGeneration;

namespace brownstone_hub_api.Services.LeaseGenerationService
{
    public interface ILeaseGenerationService
    {
        Task<ServiceResponse<PlaceholderCatalogDto>> GetPlaceholderCatalogAsync();
        Task<ServiceResponse<LoadLeaseInstanceDto>> CreateLeaseInstanceAsync(CreateLeaseInstanceDto dto);
        /// <summary>Creates a lease instance when running outside HTTP context (e.g. background job). Uses provided organizationId and userId.</summary>
        Task<ServiceResponse<LoadLeaseInstanceDto>> CreateLeaseInstanceAsync(CreateLeaseInstanceDto dto, long organizationId, long userId);
        Task<ServiceResponse<LoadLeaseInstanceDto>> ResolvePlaceholdersAsync(long instanceId);
        Task<ServiceResponse<List<string>>> ValidatePlaceholdersAsync(long instanceId);
        Task<ServiceResponse<LoadLeaseInstanceDto>> FinalizeLeaseInstanceAsync(long instanceId);
        /// <summary>Finalizes the lease instance when running outside HTTP context (e.g. background job).</summary>
        Task<ServiceResponse<LoadLeaseInstanceDto>> FinalizeLeaseInstanceAsync(long instanceId, long organizationId);
        Task<ServiceResponse<LoadLeaseInstanceDto>> GetLeaseInstanceByIdAsync(long id);
        Task<ServiceResponse<List<LoadLeaseInstanceDto>>> GetLeaseInstancesByLeaseIdAsync(long leaseId);
        /// <summary>Creates a lease instance from the current lease data, finalizes it, and returns the instance. Caller is responsible for generating and saving PDF (e.g. in controller).</summary>
        Task<ServiceResponse<LoadLeaseInstanceDto>> FinishLeaseAgreementAsync(long leaseId);
        /// <summary>Uses AI to review a finalized lease instance and return a list of issues (missing clauses, risky language, unfilled placeholders, state compliance).</summary>
        Task<ServiceResponse<LeaseReviewResultDto>> ReviewLeaseInstanceAsync(long instanceId);
    }
}
