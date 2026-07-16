namespace brownstone_hub_api.Dtos.ExpenseReport
{
    public class ExpenseReportSummaryDto
    {
        public decimal TotalAmount { get; set; }
        public int TotalCount { get; set; }
        public decimal AverageAmount { get; set; }
        public decimal? MinAmount { get; set; }
        public decimal? MaxAmount { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public List<ExpenseReportByCategoryDto>? ByCategory { get; set; }
        public List<ExpenseReportByVendorDto>? ByVendor { get; set; }
    }
}

