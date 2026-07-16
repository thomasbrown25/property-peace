namespace brownstone_hub_api.Dtos.ExpenseReport
{
    public class PropertyProfitabilityDto
    {
        public long PropertyId { get; set; }
        public string PropertyName { get; set; } = string.Empty;
        public decimal TotalRent { get; set; }
        public decimal TotalExpenses { get; set; }
        public decimal NetIncome { get; set; }
        public decimal ProfitMargin { get; set; } // Percentage
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
    }
}

