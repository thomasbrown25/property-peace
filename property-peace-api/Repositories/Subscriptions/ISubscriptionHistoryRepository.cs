using brownstone_hub_api.Models;

namespace brownstone_hub_api.Repositories.Subscriptions
{
    public interface ISubscriptionHistoryRepository
    {
        Task<SubscriptionHistory> AddHistoryAsync(SubscriptionHistory history);
        Task<List<SubscriptionHistory>> GetHistoryBySubscriptionIdAsync(long subscriptionId);
    }
}

