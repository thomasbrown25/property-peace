namespace brownstone_hub_api.Dtos.Lease
{
    public class LeaseFeeDto
    {
        public long Id { get; set; }
        public long LeaseId { get; set; }
        public string Name { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public DateTime DueDate { get; set; }
        
        // Late Fee Configuration Fields
        public bool IsLateFee { get; set; } = false;
        public string? LateFeeType { get; set; } // "OneTime" or "Daily"
        public string? FeeType { get; set; } // "Flat", "PercentRent", "PercentUnpaid"
        public decimal? PercentValue { get; set; }
        public int? AppliedAfterDays { get; set; } // For one-time fees
        public int? StartingAfterDays { get; set; } // For daily fees
        public string? LimitType { get; set; } // "NoLimit", "StopAfterDays", "MaxTotal"
        public int? LimitDays { get; set; }
        public decimal? LimitAmount { get; set; }
        public string? LimitAmountType { get; set; } // "Flat" or "PercentRent"
    }
}
