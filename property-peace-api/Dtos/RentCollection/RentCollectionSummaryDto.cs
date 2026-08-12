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
        public decimal SettlementProcessing { get; set; }
        public int SettlementProcessingCount { get; set; }
        public decimal SettlementHeld { get; set; }
        public int SettlementHeldCount { get; set; }
        public decimal SettlementAvailable { get; set; }
        public int SettlementAvailableCount { get; set; }
        public decimal SettlementTransferred { get; set; }
        public int SettlementTransferredCount { get; set; }
        public decimal SettlementBlocked { get; set; }
        public int SettlementBlockedCount { get; set; }
        public decimal SettlementReturned { get; set; }
        public int SettlementReturnedCount { get; set; }
        public decimal SettlementReconciliationPending { get; set; }
        public int SettlementReconciliationPendingCount { get; set; }
        public decimal SettlementRecoveryFailed { get; set; }
        public int SettlementRecoveryFailedCount { get; set; }
        // Compatibility aggregate for older clients. New UI uses distinct operational states.
        public decimal SettlementNeedsReview { get; set; }
        public int SettlementNeedsReviewCount { get; set; }
        public DateTime LastUpdated { get; set; }
    }
}