namespace brownstone_hub_api.Dtos.Deposit
{
    public class DepositDto
    {
        public long Id { get; set; }
        public decimal Amount { get; set; }
        public DateTime? ReceivedDate { get; set; }
        public decimal? RefundAmount { get; set; }
        public DateTime? RefundedDate { get; set; }
        public string? Notes { get; set; }
        public bool HeldInEscrow { get; set; }
    }

}