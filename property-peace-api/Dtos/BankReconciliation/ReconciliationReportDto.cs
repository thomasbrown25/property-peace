namespace brownstone_hub_api.Dtos.BankReconciliation
{
    public class ReconciliationReportDto
    {
        public long BankStatementId { get; set; }
        public DateTime? StatementDate { get; set; }
        public decimal? StartingBalance { get; set; }
        public decimal? EndingBalance { get; set; }
        public List<LoadBankStatementTransactionDto> Transactions { get; set; } = new();
        public int TotalTransactions { get; set; }
        public int MatchedTransactions { get; set; }
        public int UnmatchedTransactions { get; set; }
        public decimal MatchedAmount { get; set; }
        public decimal UnmatchedAmount { get; set; }
        public string Status { get; set; } = "Pending";
        public DateTime? ReconciledDate { get; set; }
        public string? ReconciledByUserName { get; set; }
    }
}
