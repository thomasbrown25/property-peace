
namespace brownstone_hub_api.Dtos.ClientStatement
{
    public class ClientStatementDto
    {
        public long Id { get; set; } // Statement ID (if stored) or property ID
        public long PropertyId { get; set; }
        public string PropertyName { get; set; } = string.Empty;
        public string PropertyAddress { get; set; } = string.Empty;
        public long ClientId { get; set; }
        public string ClientName { get; set; } = string.Empty;
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        
        // Income
        public decimal TotalIncome { get; set; }
        public List<ClientStatementIncomeItem> IncomeItems { get; set; } = [];
        
        // Expenses
        public decimal TotalExpenses { get; set; }
        public List<ClientStatementExpenseItem> ExpenseItems { get; set; } = [];
        
        // Management Fees
        public decimal ManagementFee { get; set; }
        public string? ManagementFeeType { get; set; } // "Percentage" or "Flat"
        
        // Net Income
        public decimal NetIncome { get; set; }
        
        // Reserve Fund
        public decimal ReserveFundBalance { get; set; }
        
        public DateTime GeneratedAt { get; set; } = DateTime.Now;
    }

    public class ClientStatementIncomeItem
    {
        public DateTime Date { get; set; }
        public string Description { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string? UnitName { get; set; }
    }

    public class ClientStatementExpenseItem
    {
        public DateTime Date { get; set; }
        public string Description { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string? Vendor { get; set; }
    }
}
