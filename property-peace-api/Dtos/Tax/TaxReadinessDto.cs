using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Tax
{
    public class TaxReadinessDto
    {
        public int Year { get; set; }
        public int OverallScore { get; set; }
        public int TotalExpenseCount { get; set; }
        public int DeductibleExpenseCount { get; set; }
        public int CategorizedDeductibleExpenseCount { get; set; }
        public int MissingCategoryCount { get; set; }
        public int MissingReceiptCount { get; set; }
        public int LoanSplitIssueCount { get; set; }
        public int DepositReviewCount { get; set; }
        public int Vendor1099Count { get; set; }
        public int Vendor1099MissingInfoCount { get; set; }
        public int PropertyPackageCount { get; set; }
        public bool IsReadyForAccountant { get; set; }
        public List<TaxReadinessItemDto> Items { get; set; } = new();
        public List<TaxReviewExpenseDto> ExpenseReviewQueue { get; set; } = new();
        public List<TaxDepositReviewDto> DepositReviewQueue { get; set; } = new();
        public List<TaxPropertyPackageDto> PropertyPackages { get; set; } = new();
    }

    public class TaxReadinessItemDto
    {
        public string Key { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public string Status { get; set; } = "ready"; // ready, warning, action
        public int Count { get; set; }
        public string Description { get; set; } = string.Empty;
    }

    public class TaxReviewExpenseDto
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
        public bool IsTaxDeductible { get; set; }
        public bool IsLoanPayment { get; set; }
        public bool HasReceipt { get; set; }
        public List<string> Issues { get; set; } = new();
    }

    public class TaxDepositReviewDto
    {
        public long PaymentId { get; set; }
        public long? DepositId { get; set; }
        public long PropertyId { get; set; }
        public string? PropertyName { get; set; }
        public string? UnitName { get; set; }
        public decimal Amount { get; set; }
        public DateTime PaymentDate { get; set; }
        public string? TenantName { get; set; }
        public string Status { get; set; } = "Needs classification";
        public string Recommendation { get; set; } = "Confirm whether this security deposit is still held, refunded, applied, or forfeited before treating it as income.";
    }

    public class TaxPropertyPackageDto
    {
        public long PropertyId { get; set; }
        public string PropertyName { get; set; } = string.Empty;
        public decimal Income { get; set; }
        public decimal DeductibleExpenses { get; set; }
        public decimal NetIncome { get; set; }
        public int ExpenseCount { get; set; }
        public int MissingReceiptCount { get; set; }
        public int ReviewItemCount { get; set; }
    }
}
