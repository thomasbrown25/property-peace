namespace brownstone_hub_api.Dtos.Stripe
{
    public class CreatePaymentIntentDto
    {
        public long LeaseId { get; set; }
        public decimal Amount { get; set; }
        public string? Description { get; set; }
    }

    public class CreatePaymentIntentResponseDto
    {
        public string ClientSecret { get; set; } = string.Empty;
        public string PaymentIntentId { get; set; } = string.Empty;
    }

    public class CreateSetupIntentResponseDto
    {
        public string ClientSecret { get; set; } = string.Empty;
        public string SetupIntentId { get; set; } = string.Empty;
        public string CustomerId { get; set; } = string.Empty;
    }

    public class UpdatePaymentIntentDto
    {
        public string PaymentIntentId { get; set; } = string.Empty;
        public long LeaseId { get; set; }
        public decimal Amount { get; set; }
        public string? Description { get; set; }
    }

    public class ConfirmPaymentDto
    {
        public string PaymentIntentId { get; set; } = string.Empty;
        public long LeaseId { get; set; }
        public decimal Amount { get; set; }
        public DateTime PaymentDate { get; set; }
    }
}

