namespace brownstone_hub_api.Models
{
    public class Subscription
    {
        public long Id { get; set; }
        public long? OrganizationId { get; set; } // FK to Organization — the primary org for this subscription
        public long? UserId { get; set; } // FK to User (tenant subscriptions - one subscription per user)
        /// <summary>
        /// The landlord user who owns and pays for this subscription.
        /// All organizations created by this user share one subscription.
        /// Null for tenant subscriptions (those use UserId instead).
        /// </summary>
        public long? OwnerUserId { get; set; }
        public long SubscriptionPlanId { get; set; }
        public string? StripeSubscriptionId { get; set; } // Stripe subscription ID
        public string? StripeCustomerId { get; set; } // Stripe customer ID
        public string Status { get; set; } = "Trial"; // Active, Trial, Cancelled, PastDue, Unpaid, etc.
        public DateTime? CurrentPeriodStart { get; set; }
        public DateTime? CurrentPeriodEnd { get; set; }
        public DateTime? TrialStart { get; set; }
        public DateTime? TrialEnd { get; set; }
        public string BillingCycle { get; set; } = "Monthly"; // Monthly or Annual
        public DateTime? CancelledAt { get; set; }
        public bool CancelAtPeriodEnd { get; set; } = false; // If true, cancel at end of period
        public DateTime? PausedAt { get; set; }
        public bool PausedAtPeriodEnd { get; set; } = false; // If true, pause at end of period
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime UpdatedAt { get; set; } = DateTime.Now;

        // Navigation properties
        public Organization? Organization { get; set; }
        public User? User { get; set; }
        public SubscriptionPlan SubscriptionPlan { get; set; } = null!;
        public ICollection<SubscriptionHistory> History { get; set; } = [];
    }
}

