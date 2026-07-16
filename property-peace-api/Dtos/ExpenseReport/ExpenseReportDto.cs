namespace brownstone_hub_api.Dtos.ExpenseReport
{
    public class ExpenseReportDto
    {
        public long Id { get; set; }
        public long PropertyId { get; set; }
        public string? PropertyName { get; set; }
        public long? UnitId { get; set; }
        public string? UnitName { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public DateTime ExpenseDate { get; set; }
        public string? Vendor { get; set; } // Legacy field
        public long? VendorId { get; set; }
        public string? VendorName { get; set; }
        public string? PaymentMethod { get; set; }
        public bool IsTaxDeductible { get; set; }
        public bool IsRecurring { get; set; }
    }
}

