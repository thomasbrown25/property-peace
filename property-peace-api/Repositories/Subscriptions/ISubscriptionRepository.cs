using brownstone_hub_api.Models;

namespace brownstone_hub_api.Repositories.Subscriptions
{
    public interface ISubscriptionRepository
    {
        Task<Subscription?> GetSubscriptionByOrganizationIdAsync(long organizationId);
        Task<Subscription?> GetSubscriptionByUserIdAsync(long userId);
        /// <summary>Returns the active/trial subscription owned by this landlord user, regardless of which org is active.</summary>
        Task<Subscription?> GetSubscriptionByOwnerUserIdAsync(long ownerUserId);
        Task<Subscription?> GetSubscriptionByStripeIdAsync(string stripeSubscriptionId);
        Task<Subscription?> GetSubscriptionByStripeCustomerIdAsync(string stripeCustomerId);
        Task<Subscription> CreateSubscriptionAsync(Subscription subscription);
        Task<Subscription> UpdateSubscriptionAsync(Subscription subscription);
        Task<List<Subscription>> GetActiveSubscriptionsAsync();
        Task<List<Subscription>> GetExpiringTrialsAsync(DateTime date);
        Task<List<Subscription>> GetSubscriptionsToPauseAsync();
        Task<bool> DeleteSubscriptionAsync(long subscriptionId);
        Task<List<Subscription>> GetSubscriptionsByPlanIdAsync(long planId);
        Task<List<Subscription>> GetOrphanedSubscriptionsAsync(); // Subscriptions without StripeSubscriptionId
        Task<Subscription?> GetSubscriptionByIdAsync(long subscriptionId);
    }
}

