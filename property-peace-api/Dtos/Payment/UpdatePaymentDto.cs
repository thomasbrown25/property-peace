namespace brownstone_hub_api.Dtos.Payment
{
    public class UpdatePaymentDto
    {
        public decimal? Amount { get; set; }
        public DateTime? PaymentDate { get; set; }
        public string? Method { get; set; }
        public string? Reference { get; set; }
        public string? Status { get; set; } // e.g., "Completed", "Pending", "Cancelled"
    }
}

