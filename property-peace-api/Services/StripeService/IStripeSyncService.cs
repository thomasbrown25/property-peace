using brownstone_hub_api.Dtos.Stripe;

namespace brownstone_hub_api.Services.StripeService
{
    public interface IStripeSyncService
    {
        /// <summary>
        /// Syncs Stripe products and prices to database subscription plans
        /// Matches by product name (e.g., "Starter Plan" matches "Starter")
        /// </summary>
        Task<ServiceResponse<StripeSyncResultDto>> SyncPlansFromStripeAsync();

        /// <summary>
        /// Gets all Stripe products with their prices for review
        /// </summary>
        Task<ServiceResponse<List<StripeProductInfoDto>>> GetStripeProductsAsync();

        /// <summary>
        /// Syncs all subscriptions from database to Stripe (updates Stripe subscriptions to match DB)
        /// </summary>
        Task<ServiceResponse<SubscriptionSyncResultDto>> SyncSubscriptionsToStripeAsync();

        /// <summary>
        /// Deletes unused Stripe prices that are not referenced in the database
        /// </summary>
        Task<ServiceResponse<PriceCleanupResultDto>> DeleteUnusedStripePricesAsync();

        /// <summary>
        /// Creates Stripe products and prices for any active paid plans that are missing them,
        /// then syncs the resulting IDs back to the database.
        /// Safe to run multiple times — skips plans that already have a StripeProductId.
        /// </summary>
        Task<ServiceResponse<StripeSyncResultDto>> ProvisionMissingStripeProductsAsync();
    }
}

