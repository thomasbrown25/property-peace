using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Tax
{
    public class TaxCategorySummaryDto
    {
        public ETaxCategory TaxCategory { get; set; }
        public string CategoryName { get; set; } = string.Empty;
        public decimal TotalAmount { get; set; }
        public int ExpenseCount { get; set; }
        public bool IsFullyDeductible { get; set; }
    }
}

