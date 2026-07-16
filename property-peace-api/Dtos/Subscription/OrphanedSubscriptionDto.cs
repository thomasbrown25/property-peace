namespace brownstone_hub_api.Dtos.Subscription
{
    public class OrphanedSubscriptionDto
    {
        public long SubscriptionId { get; set; }
        public long OrganizationId { get; set; }
        public string OrganizationName { get; set; } = string.Empty;
        public string OwnerEmail { get; set; } = string.Empty;
        public long PlanId { get; set; }
        public string PlanName { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime? CreatedAt { get; set; }
        public DateTime? TrialEnd { get; set; }
        public string? StripeCustomerId { get; set; }
        public string? StripeSubscriptionId { get; set; }
    }

    public class FixOrphanedSubscriptionResponseDto
    {
        public long SubscriptionId { get; set; }
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public string? StripeCustomerId { get; set; }
        public string? StripeSubscriptionId { get; set; }
    }

    public class FixOrphanedSubscriptionsResultDto
    {
        public int TotalFound { get; set; }
        public int SuccessfullyFixed { get; set; }
        public int Failed { get; set; }
        public List<FixOrphanedSubscriptionResponseDto> Results { get; set; } = new List<FixOrphanedSubscriptionResponseDto>();
    }
}
