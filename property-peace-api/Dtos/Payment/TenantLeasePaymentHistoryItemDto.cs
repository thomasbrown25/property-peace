namespace brownstone_hub_api.Dtos.Payment
{
    /// <summary>
    /// Tenant-safe lease payment lifecycle projection. Provider identifiers and internal
    /// settlement/risk details are intentionally excluded.
    /// </summary>
    public sealed class TenantLeasePaymentHistoryItemDto
    {
        public string Id { get; set; } = string.Empty;
        public long LeaseId { get; set; }
        public decimal Amount { get; set; }
        public string Currency { get; set; } = "USD";
        public DateTime PaymentDate { get; set; }
        public string Status { get; set; } = "NeedsReview";
        public bool CreditsRent { get; set; }
        public bool CanRetry { get; set; }
        public string PaymentType { get; set; } = "Rent";
        public string? Method { get; set; }
    }
}
