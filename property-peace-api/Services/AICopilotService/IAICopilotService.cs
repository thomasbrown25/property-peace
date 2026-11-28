using brownstone_hub_api.Dtos.AICopilot;

namespace brownstone_hub_api.Services.AICopilotService
{
    public interface IAICopilotService
    {
        Task<ServiceResponse<OrganizationSummaryDto>> GetOrganizationSummary(long organizationId);
        Task<ServiceResponse<List<WrenConversationSummaryDto>>> ListConversationsAsync(long organizationId, long userId, bool includeArchived = false, CancellationToken cancellationToken = default);
        Task<ServiceResponse<WrenConversationDto>> GetConversationAsync(long organizationId, long userId, long conversationId, CancellationToken cancellationToken = default);
        Task<ServiceResponse<bool>> DeleteConversationAsync(long organizationId, long userId, long conversationId, CancellationToken cancellationToken = default);
        Task<ServiceResponse<bool>> ArchiveConversationAsync(long organizationId, long userId, long conversationId, CancellationToken cancellationToken = default);
        Task<ServiceResponse<WrenChatResponseDto>> ChatAsync(long organizationId, long userId, WrenChatRequestDto request, CancellationToken cancellationToken = default);
        Task<ServiceResponse<WrenConfirmationResultDto>> ConfirmActionAsync(long organizationId, long userId, long confirmationId, CancellationToken cancellationToken = default);
        Task<ServiceResponse<WrenConfirmationResultDto>> DeclineConfirmationAsync(long organizationId, long userId, long confirmationId, CancellationToken cancellationToken = default);
    }
}
