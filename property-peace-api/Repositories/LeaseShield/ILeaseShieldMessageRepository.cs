using brownstone_hub_api.Models;

namespace brownstone_hub_api.Repositories.LeaseShield
{
    public interface ILeaseShieldMessageRepository
    {
        Task<List<LeaseShieldMessage>> GetByConversationIdAsync(long conversationId, long userId, CancellationToken cancellationToken = default);
        Task<LeaseShieldMessage> AddAsync(long conversationId, string role, string content, string? sourceCitationsJson, string? state = null, CancellationToken cancellationToken = default);
        Task<bool> UpdateConversationUpdatedAtAsync(long conversationId, CancellationToken cancellationToken = default);
    }
}
