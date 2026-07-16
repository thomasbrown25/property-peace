namespace brownstone_hub_api.Dtos.FinancialStatements
{
    public class CashFlowDto
    {
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public OperatingActivities OperatingActivities { get; set; } = new();
        public InvestingActivities InvestingActivities { get; set; } = new();
        public FinancingActivities FinancingActivities { get; set; } = new();
        public decimal NetChangeInCash { get; set; }
        public decimal BeginningCash { get; set; }
        public decimal EndingCash { get; set; }
    }

    public class OperatingActivities
    {
        public decimal NetIncome { get; set; }
        public List<CashFlowLineItem> Adjustments { get; set; } = new();
        public decimal NetCashFromOperations { get; set; }
    }

    public class InvestingActivities
    {
        public List<CashFlowLineItem> Items { get; set; } = new();
        public decimal NetCashFromInvesting { get; set; }
    }

    public class FinancingActivities
    {
        public List<CashFlowLineItem> Items { get; set; } = new();
        public decimal NetCashFromFinancing { get; set; }
    }

    public class CashFlowLineItem
    {
        public string Description { get; set; } = string.Empty;
        public decimal Amount { get; set; }
    }
}
