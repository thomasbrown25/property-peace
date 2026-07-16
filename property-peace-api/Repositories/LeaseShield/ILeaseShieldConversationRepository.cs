using brownstone_hub_api.Models;

namespace brownstone_hub_api.Repositories.LeaseShield
{
    public interface ILeaseShieldConversationRepository
    {
        Task<List<LeaseShieldConversation>> GetByUserIdAsync(long userId, CancellationToken cancellationToken = default);
        Task<LeaseShieldConversation?> GetByIdAsync(long conversationId, long userId, CancellationToken cancellationToken = default);
        Task<LeaseShieldConversation> CreateAsync(long userId, long? organizationId, string state, string title, CancellationToken cancellationToken = default);
        Task<bool> UpdateTitleAsync(long conversationId, long userId, string title, CancellationToken cancellationToken = default);
        Task<bool> DeleteAsync(long conversationId, long userId, CancellationToken cancellationToken = default);
    }
}
