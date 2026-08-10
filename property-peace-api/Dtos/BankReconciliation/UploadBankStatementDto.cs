namespace brownstone_hub_api.Dtos.BankReconciliation
{
    public class UploadBankStatementDto
    {
        public long? BankAccountId { get; set; }
        public DateTime? StatementDate { get; set; } // Optional, will use latest transaction date if not provided
        public decimal? StartingBalance { get; set; } // Required for a truthful reconciliation difference
        public decimal? EndingBalance { get; set; } // Required for a truthful reconciliation difference
        public List<BankStatementTransactionDto> Transactions { get; set; } = new();
    }

    public class BankStatementTransactionDto
    {
        public DateTime TransactionDate { get; set; }
        public string? Description { get; set; }
        public decimal Amount { get; set; }
        public string? Reference { get; set; }
        public string? CheckNumber { get; set; }
    }
}
