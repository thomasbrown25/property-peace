namespace brownstone_hub_api.Dtos.Stripe
{
    public class StripeAccountStatusDto
    {
        public string? AccountId { get; set; }
        public string? Status { get; set; }
        public bool IsEnabled { get; set; }
        public bool ChargesEnabled { get; set; }
        public bool PayoutsEnabled { get; set; }
        public bool DetailsSubmitted { get; set; }
        public string? OnboardingUrl { get; set; }
    }
}

