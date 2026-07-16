using brownstone_hub_api.Dtos.Organization;

namespace brownstone_hub_api.Services.OrganizationService
{
    public interface IOrganizationService
    {
        Task<ServiceResponse<LoadOrganizationDto>> CreateOrganizationAsync(CreateOrganizationDto dto, long userId);
        Task<ServiceResponse<LoadOrganizationDto>> GetOrganizationByIdAsync(long organizationId);
        Task<ServiceResponse<LoadOrganizationDto>> GetCurrentUserOrganizationAsync(long userId);
        Task<ServiceResponse<List<LoadOrganizationDto>>> GetUserOrganizationsAsync(long userId);
        Task<ServiceResponse<LoadOrganizationDto>> UpdateOrganizationAsync(UpdateOrganizationDto dto, long userId);
        Task<ServiceResponse<bool>> DeleteOrganizationAsync(long organizationId, long userId);
        Task<ServiceResponse<bool>> SwitchOrganizationAsync(long organizationId, long userId);
        Task<ServiceResponse<LoadOrganizationDto>> UpdateAgentSettingsAsync(UpdateAgentSettingsDto dto, long userId);
    }
}

