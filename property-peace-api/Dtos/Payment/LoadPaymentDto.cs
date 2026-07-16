namespace brownstone_hub_api.Dtos.Payment
{
    public class LoadPaymentDto
    {
        public long Id { get; set; }
        public long LeaseId { get; set; }
        public long PropertyId { get; set; }
        public decimal Amount { get; set; }
        public DateTime PaymentDate { get; set; }
        public string? Reference { get; set; }
        public string? Method { get; set; }
        public string Status { get; set; }
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
        public DateTime? StripeStatusChangedAt { get; set; }

        // convenience data for UI
        public string? TenantName { get; set; }
        public string? UnitName { get; set; }
        public long? UnitId { get; set; }
        public string? PropertyName { get; set; }

        public bool IsSingleUnitProperty { get; set; }

        // Track who created the payment (for deletion restrictions)
        public long? CreatedByUserId { get; set; }

        // Deposit tracking for tax reporting
        public long? DepositId { get; set; }
        public DateTime? DepositRefundedDate { get; set; }

        // Fee tracking for partial payment and payment history display
        public long? FeeId { get; set; }
        public string? FeeName { get; set; }
    }
}
