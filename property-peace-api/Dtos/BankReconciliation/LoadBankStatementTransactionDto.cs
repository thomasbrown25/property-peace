namespace brownstone_hub_api.Dtos.BankReconciliation
{
    public class LoadBankStatementTransactionDto
    {
        public long Id { get; set; }
        public long BankStatementId { get; set; }
        public DateTime TransactionDate { get; set; }
        public string? Description { get; set; }
        public decimal Amount { get; set; }
        public string? Reference { get; set; }
        public string? CheckNumber { get; set; }
        public bool IsMatched { get; set; }
        public long? MatchedLedgerEntryId { get; set; }
        public string? MatchedLedgerEntryDescription { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
