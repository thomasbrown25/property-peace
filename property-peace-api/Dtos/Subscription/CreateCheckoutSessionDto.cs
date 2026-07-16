namespace brownstone_hub_api.Dtos.Subscription
{
    public class CreateCheckoutSessionDto
    {
        public long PlanId { get; set; }
        public string BillingCycle { get; set; } = "Monthly"; // Monthly or Annual
        public string? SuccessUrl { get; set; }
        public string? CancelUrl { get; set; }
    }
}

