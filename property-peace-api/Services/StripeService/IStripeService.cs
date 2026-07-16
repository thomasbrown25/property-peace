using brownstone_hub_api.Dtos.Stripe;

namespace brownstone_hub_api.Services.StripeService
{
    public interface IStripeService
    {
        Task<ServiceResponse<CreateStripeAccountResponseDto>> CreateConnectAccountAsync(long userId, string email, string returnUrl);
        Task<ServiceResponse<StripeAccountStatusDto>> GetAccountStatusAsync(string accountId);
        Task<ServiceResponse<string>> CreateAccountLinkAsync(string accountId, string returnUrl, string refreshUrl, string type = "account_onboarding");
        Task<ServiceResponse<string>> CreateLoginLinkAsync(string accountId);
        Task<ServiceResponse<AccountSessionDto>> CreateAccountSessionAsync(string accountId);
        Task<ServiceResponse<bool>> UpdateUserStripeAccountAsync(long userId, string accountId, string status);
        Task<ServiceResponse<bool>> LinkExistingAccountAsync(long userId, string accountId);
        Task<ServiceResponse<CreatePaymentIntentResponseDto>> CreatePaymentIntentAsync(long leaseId, decimal amount, string? description);
        Task<ServiceResponse<CreatePaymentIntentResponseDto>> UpdatePaymentIntentAsync(string paymentIntentId, long leaseId, decimal amount, string? description);
        Task<ServiceResponse<bool>> ConfirmPaymentAsync(string paymentIntentId, long leaseId, decimal amount, DateTime paymentDate, bool recordAsProcessing = true);
        Task<ServiceResponse<bool>> ConfirmPaymentAllocatedAsync(string paymentIntentId, long leaseId, decimal amount, DateTime paymentDate, bool recordAsProcessing = true);
        string GetPublishableKey();

        // Subscription methods
        Task<ServiceResponse<Stripe.Customer>> CreateCustomerAsync(string email, string name, Dictionary<string, string>? metadata = null);
        Task<ServiceResponse<Stripe.Subscription>> CreateSubscriptionAsync(string customerId, string priceId, int? trialDays = null, string? paymentMethodId = null, DateTime? billingCycleAnchor = null);
        Task<ServiceResponse<Stripe.Subscription>> UpdateSubscriptionAsync(string subscriptionId, string newPriceId, bool prorate = true);
        Task<ServiceResponse<Stripe.Subscription>> CancelSubscriptionAsync(string subscriptionId, bool cancelAtPeriodEnd = true);
        Task<ServiceResponse<Stripe.Subscription>> ResumeSubscriptionAsync(string subscriptionId);
        Task<ServiceResponse<Stripe.Subscription>> PauseSubscriptionAsync(string subscriptionId, DateTime? resumesAt = null);
        Task<ServiceResponse<Stripe.Subscription>> UnpauseSubscriptionAsync(string subscriptionId);
        Task<ServiceResponse<Stripe.Subscription>> GetSubscriptionAsync(string subscriptionId);
        Task<ServiceResponse<Stripe.Customer>> GetCustomerAsync(string customerId);
        Task<ServiceResponse<string>> CreateCheckoutSessionAsync(string customerId, string priceId, string successUrl, string cancelUrl, int? trialDays = null);
        
        // Product and Price management
        Task<ServiceResponse<Stripe.Product>> UpdateProductAsync(string productId, string name, string? description = null);
        Task<ServiceResponse<Stripe.Price>> CreatePriceAsync(string productId, decimal amount, string currency, string interval, int intervalCount = 1);
        Task<ServiceResponse<Stripe.Subscription>> UpdateSubscriptionPlanAsync(string subscriptionId, string newPriceId, bool prorate = true);
    }
}

