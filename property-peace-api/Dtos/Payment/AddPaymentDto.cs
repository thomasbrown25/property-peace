
namespace brownstone_hub_api.Dtos.Payment
{
    public class AddPaymentDto
    {
        public long LeaseId { get; set; }
        public DateTime PaymentDate { get; set; }
        public string Reference { get; set; } = "";
        public decimal Amount { get; set; }
        public string? Method { get; set; } // e.g., Credit Card, Bank Transfer
        public string? Status { get; set; } // Completed, Processing, Failed
        public string? StripePaymentIntentId { get; set; }
        public string? StripePaymentMethodId { get; set; }
        public long? CreatedByUserId { get; set; } // Track who created the payment (for manual landlord entries)
        public long? FeeId { get; set; } // Link to LeaseFee if this payment is for a specific fee
        public long? DepositId { get; set; } // Link to Deposit if this payment is for a specific deposit
    }
}