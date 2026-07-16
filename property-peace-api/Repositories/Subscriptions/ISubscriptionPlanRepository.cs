using brownstone_hub_api.Models;

namespace brownstone_hub_api.Repositories.Subscriptions
{
    public interface ISubscriptionPlanRepository
    {
        Task<List<SubscriptionPlan>> GetAllPlansAsync();
        Task<SubscriptionPlan?> GetPlanByIdAsync(long planId);
        Task<SubscriptionPlan?> GetPlanByNameAsync(string name);
        Task<SubscriptionPlan?> GetPlanByStripePriceIdAsync(string stripePriceId);
        Task<SubscriptionPlan> CreatePlanAsync(SubscriptionPlan plan);
        Task<SubscriptionPlan> UpdatePlanAsync(SubscriptionPlan plan);
        Task<bool> DeletePlanAsync(long planId);
    }
}

