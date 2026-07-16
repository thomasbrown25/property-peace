namespace brownstone_hub_api.Dtos.Payment
{
    public class TenantPaymentHistoryItemDto
    {
        public long Id { get; set; }
        public long LeaseId { get; set; }
        public decimal Amount { get; set; }
        public DateTime PaymentDate { get; set; }
        public DateTime? DueDate { get; set; }
        public bool IsOnTime { get; set; }
        public string PaymentType { get; set; } = string.Empty; // "Rent" | "Fee" | "Deposit"
        public string Status { get; set; } = "Completed";
        public bool CanRetry => Status.Equals("Failed", StringComparison.OrdinalIgnoreCase)
            || Status.Equals("Canceled", StringComparison.OrdinalIgnoreCase)
            || Status.Equals("Cancelled", StringComparison.OrdinalIgnoreCase)
            || Status.Equals("Disputed", StringComparison.OrdinalIgnoreCase);
        public string? StripePaymentIntentId { get; set; }
        public string? StripePaymentMethodId { get; set; }
        public string? StripePaymentMethodType { get; set; }
        public string? StripePaymentMethodBrand { get; set; }
        public string? StripePaymentMethodLast4 { get; set; }
        public string? StripePaymentMethodBankName { get; set; }
        public string? StripePaymentMethodWalletType { get; set; }
        public string? StripeChargeId { get; set; }
        public string? StripeDisputeId { get; set; }
        public DateTime? SubmittedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public DateTime? FailedAt { get; set; }
        public DateTime? CanceledAt { get; set; }
        public DateTime? DisputedAt { get; set; }
        public string? FeeName { get; set; }
        public string? UnitName { get; set; }
        public string? PropertyName { get; set; }
    }
}
