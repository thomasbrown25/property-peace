using brownstone_hub_api.Dtos.LeaseTemplate;

namespace brownstone_hub_api.Services.LeaseTemplateService
{
    public interface ILeaseTemplateService
    {
        Task<ServiceResponse<LoadLeaseTemplateDto>> GetDefaultTemplateAsync();
        Task<ServiceResponse<List<LoadLeaseTemplateDto>>> GetTemplatesByOrganizationAsync();
        Task<ServiceResponse<LoadLeaseTemplateDto>> GetTemplateByIdAsync(long id);
        Task<ServiceResponse<LoadLeaseTemplateDto>> CreateTemplateAsync(CreateLeaseTemplateDto dto);
        Task<ServiceResponse<LoadLeaseTemplateDto>> UpdateTemplateAsync(UpdateLeaseTemplateDto dto);
        Task<ServiceResponse<bool>> DeleteTemplateAsync(long id);
        Task<ServiceResponse<bool>> SetDefaultTemplateAsync(long id);
        Task<ServiceResponse<LoadLeaseTemplateDto>> CreateDefaultTemplateForOrganizationAsync(long organizationId, long userId);
        Task<ServiceResponse<LoadLeaseTemplateDto>> EnsureDefaultTemplateExistsAsync();
    }
}
