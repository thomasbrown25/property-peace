namespace brownstone_hub_api.Dtos.GeneralLedger
{
    public class AccountBalanceDto
    {
        public long AccountId { get; set; }
        public string AccountCode { get; set; } = string.Empty;
        public string AccountName { get; set; } = string.Empty;
        public decimal Balance { get; set; }
        public DateTime? LastTransactionDate { get; set; }
    }
}
