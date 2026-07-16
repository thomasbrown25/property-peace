namespace brownstone_hub_api.Dtos.Deposit
{
    public class CreateDepositDto
    {
        public long LeaseId { get; set; }
        public decimal Amount { get; set; }
        public DateTime? ReceivedDate { get; set; }
        public string? Notes { get; set; }
    }
}

