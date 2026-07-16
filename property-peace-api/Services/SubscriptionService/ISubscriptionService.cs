using brownstone_hub_api.Dtos.Subscription;

namespace brownstone_hub_api.Services.SubscriptionService
{
    public interface ISubscriptionService
    {
        Task<ServiceResponse<List<SubscriptionPlanDto>>> GetAvailablePlansAsync();
        Task<ServiceResponse<SubscriptionDto>> GetUserSubscriptionAsync();
        Task<ServiceResponse<SubscriptionDto>> GetUserSubscriptionAsync(long userId);
        /// <summary>Ensures a tenant user has a Free plan subscription (idempotent).</summary>
        Task EnsureTenantFreeSubscriptionAsync(long userId);
        Task<ServiceResponse<SubscriptionDto>> SubscribeAsync(CreateSubscriptionDto createDto);
        Task<ServiceResponse<SubscriptionDto>> SubscribeAsync(long userId, CreateSubscriptionDto createDto);
        Task<ServiceResponse<SubscriptionDto>> UpgradeSubscriptionAsync(UpdateSubscriptionDto updateDto);
        Task<ServiceResponse<SubscriptionDto>> DowngradeSubscriptionAsync(UpdateSubscriptionDto updateDto);
        Task<ServiceResponse<bool>> CancelSubscriptionAsync(bool cancelAtPeriodEnd = true);
        Task<ServiceResponse<SubscriptionDto>> ResumeSubscriptionAsync();
        Task<ServiceResponse<bool>> PauseSubscriptionAsync(bool pauseAtPeriodEnd = true);
        Task<ServiceResponse<SubscriptionDto>> ResumePausedSubscriptionAsync();
        Task<ServiceResponse<bool>> CheckTrialEligibilityAsync();
        Task<ServiceResponse<SubscriptionDto>> StartTrialAsync();
        Task<ServiceResponse<bool>> ValidatePropertyLimitAsync();
        Task<ServiceResponse<SubscriptionStatusDto>> GetSubscriptionStatusAsync();
        Task<ServiceResponse<List<InvoiceDto>>> GetPaymentHistoryAsync();
        Task<ServiceResponse<string>> CreateCustomerPortalSessionAsync(string returnUrl);
        Task<ServiceResponse<string>> CreateCheckoutSessionAsync(CreateCheckoutSessionDto createDto);
        Task<ServiceResponse<SubscriptionDto>> SyncSubscriptionFromStripeAsync(string stripeSubscriptionId);
        
        // Admin methods
        Task<ServiceResponse<List<SubscriptionDto>>> GetAllUserSubscriptionsAsync();
        Task<ServiceResponse<SubscriptionDto>> AssignLifetimePlanAsync(AdminAssignLifetimePlanDto assignDto);
        Task<ServiceResponse<SubscriptionDto>> ExtendTrialAsync(long userId, int additionalDays);
        Task<ServiceResponse<MigrationResultDto>> MigrateSubscriptionsToNewPriceAsync(long planId, bool prorate = true);
        Task<ServiceResponse<List<OrphanedSubscriptionDto>>> GetOrphanedSubscriptionsAsync();
        Task<ServiceResponse<FixOrphanedSubscriptionResponseDto>> FixOrphanedSubscriptionAsync(long subscriptionId);
        Task<ServiceResponse<FixOrphanedSubscriptionsResultDto>> FixAllOrphanedSubscriptionsAsync();
    }

    public class MigrationResultDto
    {
        public int TotalSubscriptions { get; set; }
        public int SuccessfullyMigrated { get; set; }
        public int Failed { get; set; }
        public List<string> Errors { get; set; } = new List<string>();
        public List<string> SuccessMessages { get; set; } = new List<string>();
    }
}

