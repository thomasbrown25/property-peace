using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Tax
{
    public class TaxDeductibleExpenseDto
    {
        public long ExpenseId { get; set; }
        public long PropertyId { get; set; }
        public string PropertyName { get; set; } = string.Empty;
        public string? UnitName { get; set; }
        public string Description { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public decimal DeductibleAmount { get; set; }
        public DateTime ExpenseDate { get; set; }
        public ETaxCategory? TaxCategory { get; set; }
        public string? TaxCategoryName { get; set; }
        public string? Vendor { get; set; }
        public string? PaymentMethod { get; set; }
        public bool IsFullyDeductible { get; set; }
        public bool IsLoanPayment { get; set; }
        public decimal? LoanPrincipalAmount { get; set; }
        public decimal? LoanInterestAmount { get; set; }
        public bool HasReceipt { get; set; }
        public bool NeedsReview { get; set; }
        public List<string> ReviewReasons { get; set; } = new();
    }
}

