using brownstone_hub_api.Dtos.AICopilot;

namespace brownstone_hub_api.Services.AICopilotService
{
    public interface IAICopilotService
    {
        Task<ServiceResponse<OrganizationSummaryDto>> GetOrganizationSummary(long organizationId);
    }
}

