using brownstone_hub_api.Dtos.Subscription;

namespace brownstone_hub_api.Services.SubscriptionService
{
    public interface ISubscriptionPlanService
    {
        Task<ServiceResponse<List<SubscriptionPlanDto>>> GetAllPlansAsync();
        Task<ServiceResponse<SubscriptionPlanDto>> GetPlanByIdAsync(long planId);
        Task<ServiceResponse<SubscriptionPlanDto>> CreatePlanAsync(SubscriptionPlanDto planDto);
        Task<ServiceResponse<SubscriptionPlanDto>> UpdatePlanAsync(long planId, SubscriptionPlanDto planDto);
        Task<ServiceResponse<bool>> DeactivatePlanAsync(long planId);
    }
}

