namespace brownstone_hub_api.Dtos.FinancialStatements
{
    public class ProfitAndLossDto
    {
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public List<IncomeLineItem> Income { get; set; } = new();
        public decimal TotalIncome { get; set; }
        public List<ExpenseLineItem> Expenses { get; set; } = new();
        public decimal TotalExpenses { get; set; }
        public decimal NetIncome { get; set; }
    }

    public class IncomeLineItem
    {
        public string AccountCode { get; set; } = string.Empty;
        public string AccountName { get; set; } = string.Empty;
        public decimal Amount { get; set; }
    }

    public class ExpenseLineItem
    {
        public string AccountCode { get; set; } = string.Empty;
        public string AccountName { get; set; } = string.Empty;
        public decimal Amount { get; set; }
    }
}
