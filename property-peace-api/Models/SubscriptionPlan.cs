namespace brownstone_hub_api.Models
{
    public class SubscriptionPlan
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty; // e.g., "Starter", "Growth", "Pro"
        public string Description { get; set; } = string.Empty;
        public int? MaxProperties { get; set; } // Nullable for Business tier (unlimited)
        public int? MaxTotalUnits { get; set; } // Total units across all properties. Nullable for Business tier (unlimited)
        public decimal MonthlyPrice { get; set; }
        public decimal AnnualPrice { get; set; }
        public string? Features { get; set; } // JSON string of features
        public bool IsActive { get; set; } = true;
        public bool IsTrial { get; set; } = false; // True for Free Trial plan
        public int? TrialDays { get; set; } = null; // Number of trial days (null = no trial, 0 = no trial, 7 = 7-day trial, etc.)
        public string? StripePriceIdMonthly { get; set; } // Stripe Price ID for monthly billing
        public string? StripePriceIdAnnual { get; set; } // Stripe Price ID for annual billing
        public string? StripeProductId { get; set; } // Stripe Product ID
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime UpdatedAt { get; set; } = DateTime.Now;

        // Navigation property
        public ICollection<Subscription> Subscriptions { get; set; } = [];
    }
}

