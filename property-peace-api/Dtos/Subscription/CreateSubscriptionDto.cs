namespace brownstone_hub_api.Dtos.Subscription
{
    public class CreateSubscriptionDto
    {
        public long PlanId { get; set; }
        public string BillingCycle { get; set; } = "Monthly"; // Monthly or Annual
        public string? PaymentMethodId { get; set; } // Stripe Payment Method ID (optional for trial)
    }
}

