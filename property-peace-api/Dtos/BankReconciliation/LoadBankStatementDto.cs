namespace brownstone_hub_api.Dtos.BankReconciliation
{
    public class LoadBankStatementDto
    {
        public long Id { get; set; }
        public long OrganizationId { get; set; }
        public long? BankAccountId { get; set; }
        public string? BankAccountName { get; set; }
        public DateTime? StatementDate { get; set; }
        public decimal? StartingBalance { get; set; }
        public decimal? EndingBalance { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
