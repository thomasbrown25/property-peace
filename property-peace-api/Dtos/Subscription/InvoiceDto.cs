namespace brownstone_hub_api.Dtos.Subscription
{
    public class InvoiceDto
    {
        public string Id { get; set; } = string.Empty;
        public string InvoiceNumber { get; set; } = string.Empty;
        public long Amount { get; set; } // Amount in cents
        public string Currency { get; set; } = "usd";
        public DateTime Created { get; set; } // Unix timestamp
        public DateTime? PaidAt { get; set; }
        public string Status { get; set; } = string.Empty; // paid, open, void, uncollectible
        public string? InvoicePdf { get; set; }
        public string? HostedInvoiceUrl { get; set; }
        public string? Description { get; set; }
        public string? SubscriptionId { get; set; }
    }
}

