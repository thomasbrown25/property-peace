namespace brownstone_hub_api.Dtos.ExpenseReport
{
    public class YearOverYearComparisonDto
    {
        public int Year { get; set; }
        public decimal TotalAmount { get; set; }
        public int Count { get; set; }
        public decimal AverageAmount { get; set; }
        public List<ExpenseReportByCategoryDto>? ByCategory { get; set; }
        public Dictionary<string, decimal>? MonthlyBreakdown { get; set; } // "Jan" -> amount, "Feb" -> amount, etc.
    }
}

