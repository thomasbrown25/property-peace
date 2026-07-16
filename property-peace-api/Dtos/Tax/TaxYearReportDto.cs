namespace brownstone_hub_api.Dtos.Tax
{
    public class TaxYearReportDto
    {
        public int Year { get; set; }
        public decimal TotalIncome { get; set; }
        public decimal RentIncome { get; set; }
        public decimal FeeIncome { get; set; }
        public decimal DepositIncome { get; set; }
        public decimal DepositsNeedingReview { get; set; }
        public decimal TotalExpenses { get; set; }
        public decimal NetIncome { get; set; }
        public List<TaxCategorySummaryDto> CategorySummaries { get; set; } = new();
        public List<TaxDeductibleExpenseDto> DeductibleExpenses { get; set; } = new();
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
    }
}

