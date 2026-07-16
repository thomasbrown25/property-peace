namespace brownstone_hub_api.Dtos.Stripe
{
    public class CreateStripeAccountResponseDto
    {
        public string AccountId { get; set; } = string.Empty;
        public string OnboardingUrl { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
    }
}

