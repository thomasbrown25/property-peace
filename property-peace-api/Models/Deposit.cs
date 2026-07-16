namespace brownstone_hub_api.Models
{
    public class Deposit
    {
        public long Id { get; set; }
        public long LeaseId { get; set; }
        public decimal Amount { get; set; }
        public DateTime ReceivedDate { get; set; }
        public DateTime? RefundedDate { get; set; }
        public decimal? RefundAmount { get; set; }
        public string Notes { get; set; }
        
        public bool HeldInEscrow { get; set; } = false;

        // Organization ownership
        public long? OrganizationId { get; set; }
        public Organization? Organization { get; set; }

        // Navigation
        public Lease Lease { get; set; }
    }
}