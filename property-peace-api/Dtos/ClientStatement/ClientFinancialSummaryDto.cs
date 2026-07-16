
namespace brownstone_hub_api.Dtos.ClientStatement
{
    public class ClientFinancialSummaryDto
    {
        public long ClientId { get; set; }
        public string ClientName { get; set; } = string.Empty;
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        
        // Totals across all properties
        public decimal TotalIncome { get; set; }
        public decimal TotalExpenses { get; set; }
        public decimal TotalManagementFees { get; set; }
        public decimal NetIncome { get; set; }
        
        // Property breakdown
        public List<ClientPropertySummary> Properties { get; set; } = [];
    }

    public class ClientPropertySummary
    {
        public long PropertyId { get; set; }
        public string PropertyName { get; set; } = string.Empty;
        public decimal Income { get; set; }
        public decimal Expenses { get; set; }
        public decimal ManagementFee { get; set; }
        public decimal NetIncome { get; set; }
    }
}
