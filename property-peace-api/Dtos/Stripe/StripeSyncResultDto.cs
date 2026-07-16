namespace brownstone_hub_api.Dtos.Stripe
{
    public class StripeSyncResultDto
    {
        public int TotalPlansFound { get; set; }
        public int PlansMatched { get; set; }
        public int PlansUpdated { get; set; }
        public List<PlanSyncDetailDto> Details { get; set; } = new();
        public List<string> Warnings { get; set; } = new();
        public List<string> Errors { get; set; } = new();
    }

    public class PlanSyncDetailDto
    {
        public string PlanName { get; set; } = string.Empty;
        public string? StripeProductName { get; set; }
        public string? StripeProductId { get; set; }
        public string? StripePriceIdMonthly { get; set; }
        public string? StripePriceIdAnnual { get; set; }
        public bool Matched { get; set; }
        public bool Updated { get; set; }
        public string? Message { get; set; }
    }

    public class StripeProductInfoDto
    {
        public string ProductId { get; set; } = string.Empty;
        public string ProductName { get; set; } = string.Empty;
        public string? Description { get; set; }
        public bool Active { get; set; }
        public List<StripePriceInfoDto> Prices { get; set; } = new();
    }

    public class StripePriceInfoDto
    {
        public string PriceId { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string Currency { get; set; } = "usd";
        public string Interval { get; set; } = string.Empty; // month, year
        public bool Active { get; set; }
    }

    public class SubscriptionSyncResultDto
    {
        public int TotalSubscriptions { get; set; }
        public int SuccessfullySynced { get; set; }
        public int Failed { get; set; }
        public int Skipped { get; set; }
        public List<string> SuccessMessages { get; set; } = new();
        public List<string> Errors { get; set; } = new();
        public List<string> SkippedReasons { get; set; } = new();
    }

    public class PriceCleanupResultDto
    {
        public int TotalPricesChecked { get; set; }
        public int PricesDeleted { get; set; }
        public int PricesKept { get; set; }
        public List<string> DeletedPriceIds { get; set; } = new();
        public List<string> Errors { get; set; } = new();
        public List<string> Warnings { get; set; } = new();
    }
}

