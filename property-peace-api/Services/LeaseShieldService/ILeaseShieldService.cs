using brownstone_hub_api.Dtos.LeaseShield;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Services.LeaseShieldService
{
    public interface ILeaseShieldService
    {
        Task<ServiceResponse<List<LeaseShieldConversationListItemDto>>> GetConversationsAsync(long userId, long organizationId, CancellationToken cancellationToken = default);
        Task<ServiceResponse<LeaseShieldConversationDetailDto>> GetConversationAsync(long conversationId, long userId, long organizationId, CancellationToken cancellationToken = default);
        Task<ServiceResponse<LeaseShieldConversationDetailDto>> CreateConversationAsync(long userId, CreateLeaseShieldConversationRequest request, long organizationId, CancellationToken cancellationToken = default);
        Task<ServiceResponse<bool>> UpdateConversationTitleAsync(long conversationId, long userId, long organizationId, UpdateLeaseShieldConversationRequest request, CancellationToken cancellationToken = default);
        Task<ServiceResponse<bool>> DeleteConversationAsync(long conversationId, long userId, long organizationId, CancellationToken cancellationToken = default);
        Task<ServiceResponse<LeaseShieldConversationDetailDto>> SendMessageAsync(long? conversationId, long userId, SendLeaseShieldMessageRequest request, long organizationId, CancellationToken cancellationToken = default);
    }
}
