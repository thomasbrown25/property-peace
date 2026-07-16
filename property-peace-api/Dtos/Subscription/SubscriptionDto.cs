namespace brownstone_hub_api.Dtos.Subscription
{
    public class SubscriptionDto
    {
        public long Id { get; set; }
        public long? OrganizationId { get; set; } // Landlord: org. Tenant: null (subscription keyed by user).
        public SubscriptionPlanDto Plan { get; set; } = null!;
        public string Status { get; set; } = string.Empty;
        public DateTime? CurrentPeriodStart { get; set; }
        public DateTime? CurrentPeriodEnd { get; set; }
        public DateTime? TrialStart { get; set; }
        public DateTime? TrialEnd { get; set; }
        public string BillingCycle { get; set; } = string.Empty;
        public DateTime? CancelledAt { get; set; }
        public bool CancelAtPeriodEnd { get; set; }
        public DateTime? PausedAt { get; set; }
        public bool PausedAtPeriodEnd { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        // User property removed - subscriptions are organization-only
        // Organization owner information for admin dashboard
        public SubscriptionUserDto? OrganizationOwner { get; set; }
        public string? OrganizationName { get; set; }
        // Flag indicating if subscription exists but doesn't have Stripe IDs (orphaned)
        public bool IsOrphaned { get; set; }
    }

    public class SubscriptionUserDto
    {
        public long Id { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
    }
}

