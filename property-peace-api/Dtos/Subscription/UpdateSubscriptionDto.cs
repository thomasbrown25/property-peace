namespace brownstone_hub_api.Dtos.Subscription
{
    public class UpdateSubscriptionDto
    {
        public long NewPlanId { get; set; }
        public bool Prorate { get; set; } = true; // Whether to prorate the change
        public string? BillingCycle { get; set; } // Optional: "Monthly" or "Annual". If null, keeps current billing cycle
    }
}

