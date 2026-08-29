namespace brownstone_hub_api.Dtos.Stripe
{
    public class StripePayoutBankDto
    {
        public string? BankName { get; set; }
        public string? AccountType { get; set; }
        public string? Currency { get; set; }
        public string? Last4 { get; set; }
    }

    public class StripeAccountStatusDto
    {
        public string? AccountId { get; set; }
        public string? Status { get; set; }
        public bool IsEnabled { get; set; }
        public bool ChargesEnabled { get; set; }
        public bool PayoutsEnabled { get; set; }
        public bool DetailsSubmitted { get; set; }
        public string? OnboardingUrl { get; set; }
        public string InternalReviewStatus { get; set; } = "Onboarding";
        public bool IsInternallyPayoutApproved { get; set; }
        /// <summary>
        /// True only when the connected account currently passes account-level transfer controls.
        /// A specific rent payment can still be held by payment-specific pre-transfer controls.
        /// </summary>
        public bool IsAccountReadyForRentTransfers { get; set; }
        public string? AccountReadinessReason { get; set; }
        public StripePayoutBankDto? PayoutBank { get; set; }
        public bool CanManageAccount { get; set; }
    }
}

