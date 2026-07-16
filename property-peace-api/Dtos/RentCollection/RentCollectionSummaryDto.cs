namespace brownstone_hub_api.Dtos.RentCollection
{
    public class RentCollectionSummaryDto
    {
        public long? PropertyId { get; set; }
        public decimal TotalMonthlyRent { get; set; } // Sum of all lease rent amounts (not prorated)
        public decimal CollectedThisMonth { get; set; }
        public decimal ExpectedThisMonth { get; set; } // Prorated expected rent for current month
        public decimal RemainingThisMonth { get; set; }
        public decimal Outstanding { get; set; }
        public decimal Overdue { get; set; }
        public decimal CollectedLifetime { get; set; }
        public DateTime LastUpdated { get; set; }
    }
}