namespace brownstone_hub_api.Dtos.Stripe
{
    public sealed class StripePaymentTransactionDto
    {
        public string PaymentIntentId { get; set; } = string.Empty;
        public long LeaseId { get; set; }
        public long PropertyId { get; set; }
        public string PropertyName { get; set; } = string.Empty;
        public string? UnitName { get; set; }
        public string TenantName { get; set; } = string.Empty;
        public long AmountCents { get; set; }
        public string Currency { get; set; } = "usd";
        public string Status { get; set; } = string.Empty;
        public DateTimeOffset PaidAt { get; set; }
        public DateTimeOffset? ProcessedAt { get; set; }
        public string? PaymentMethodType { get; set; }
        public string? PaymentMethodBrand { get; set; }
        public string? PaymentMethodLast4 { get; set; }
        public string? PaymentMethodBankName { get; set; }
        public string? PaymentMethodWalletType { get; set; }
    }
}
