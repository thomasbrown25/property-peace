namespace brownstone_hub_api.Dtos.ExpenseReport
{
    public class ExpenseReportByCategoryDto
    {
        public string Category { get; set; } = string.Empty;
        public decimal TotalAmount { get; set; }
        public int Count { get; set; }
        public decimal Percentage { get; set; }
    }
}

