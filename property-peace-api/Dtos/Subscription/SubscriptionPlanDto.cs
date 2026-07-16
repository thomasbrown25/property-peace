namespace brownstone_hub_api.Dtos.Subscription
{
    public class SubscriptionPlanDto
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int? MaxProperties { get; set; }
        public int? MaxTotalUnits { get; set; }
        public decimal MonthlyPrice { get; set; }
        public decimal AnnualPrice { get; set; }
        public string? Features { get; set; }
        public bool IsActive { get; set; }
        public bool IsTrial { get; set; }
        public int? TrialDays { get; set; } // Number of trial days (null = no trial, 0 = no trial, 7 = 7-day trial, etc.)
        public decimal? AnnualDiscount { get; set; } // Calculated discount percentage
        
        // Stripe Integration Fields
        public string? StripeProductId { get; set; } // Stripe Product ID
        public string? StripePriceIdMonthly { get; set; } // Stripe Price ID for monthly billing
        public string? StripePriceIdAnnual { get; set; } // Stripe Price ID for annual billing
    }
}

