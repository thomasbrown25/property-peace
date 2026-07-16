namespace brownstone_hub_api.Dtos.GeneralLedger
{
    public class LoadGeneralLedgerEntryDto
    {
        public long Id { get; set; }
        public long OrganizationId { get; set; }
        public long AccountId { get; set; }
        public string AccountCode { get; set; } = string.Empty;
        public string AccountName { get; set; } = string.Empty;
        public long? TransactionId { get; set; }
        public string TransactionType { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public decimal? DebitAmount { get; set; }
        public decimal? CreditAmount { get; set; }
        public DateTime TransactionDate { get; set; }
        public string? Description { get; set; }
        public string? Reference { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}
