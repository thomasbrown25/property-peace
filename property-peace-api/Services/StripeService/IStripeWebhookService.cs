using Stripe;

namespace brownstone_hub_api.Services.StripeService
{
    public interface IStripeWebhookService
    {
        Task HandleSubscriptionCreatedAsync(Event stripeEvent);
        Task HandleSubscriptionUpdatedAsync(Event stripeEvent);
        Task HandleSubscriptionDeletedAsync(Event stripeEvent);
        Task HandleInvoicePaymentSucceededAsync(Event stripeEvent);
        Task HandleInvoicePaymentFailedAsync(Event stripeEvent);
        Task HandleTrialWillEndAsync(Event stripeEvent);
        Task HandlePaymentIntentSucceededAsync(Event stripeEvent);
        Task HandlePaymentIntentProcessingAsync(Event stripeEvent);
        Task HandlePaymentIntentPaymentFailedAsync(Event stripeEvent);
        Task HandlePaymentIntentCanceledAsync(Event stripeEvent);
        Task HandleChargeDisputeCreatedAsync(Event stripeEvent);
        Task HandleChargeRefundedAsync(Event stripeEvent);
        Task HandleRefundCreatedAsync(Event stripeEvent);
    }
}

