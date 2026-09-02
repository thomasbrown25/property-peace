using brownstone_hub_api.Dtos.AICopilot;

namespace brownstone_hub_api.Services.AICopilotService
{
    public interface IAICopilotService
    {
        Task<ServiceResponse<OrganizationSummaryDto>> GetOrganizationSummary(long organizationId);
        Task<ServiceResponse<List<PercyConversationSummaryDto>>> ListConversationsAsync(long organizationId, long userId, bool includeArchived = false, CancellationToken cancellationToken = default);
        Task<ServiceResponse<PercyConversationDto>> GetConversationAsync(long organizationId, long userId, long conversationId, CancellationToken cancellationToken = default);
        Task<ServiceResponse<bool>> DeleteConversationAsync(long organizationId, long userId, long conversationId, CancellationToken cancellationToken = default);
        Task<ServiceResponse<PercyChatResponseDto>> ChatAsync(long organizationId, long userId, PercyChatRequestDto request, CancellationToken cancellationToken = default);
        Task<ServiceResponse<PercyConfirmationResultDto>> ConfirmActionAsync(long organizationId, long userId, long confirmationId, CancellationToken cancellationToken = default);
        Task<ServiceResponse<PercyConfirmationResultDto>> DeclineConfirmationAsync(long organizationId, long userId, long confirmationId, CancellationToken cancellationToken = default);
    }
}
