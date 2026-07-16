namespace brownstone_hub_api.Dtos.ExpenseReport
{
    public class ExpenseTrendDto
    {
        public DateTime Period { get; set; } // Month/Year for grouping
        public string PeriodLabel { get; set; } = string.Empty; // "Jan 2024", "Q1 2024", etc.
        public decimal TotalAmount { get; set; }
        public int Count { get; set; }
        public Dictionary<string, decimal>? ByCategory { get; set; } // Optional category breakdown per period
    }
}

