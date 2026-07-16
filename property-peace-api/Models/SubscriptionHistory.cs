namespace brownstone_hub_api.Models
{
    public class SubscriptionHistory
    {
        public long Id { get; set; }
        public long SubscriptionId { get; set; }
        public string EventType { get; set; } = string.Empty; // Created, Upgraded, Downgraded, Cancelled, Renewed, TrialStarted, TrialEnded, etc.
        public long? OldPlanId { get; set; } // Previous plan ID (for upgrades/downgrades)
        public long? NewPlanId { get; set; } // New plan ID (for upgrades/downgrades)
        public DateTime Timestamp { get; set; } = DateTime.Now;
        public string? Metadata { get; set; } // JSON string for additional event data

        // Navigation property
        public Subscription Subscription { get; set; } = null!;
    }
}

