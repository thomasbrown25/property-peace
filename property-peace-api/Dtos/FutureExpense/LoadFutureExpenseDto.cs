namespace brownstone_hub_api.Dtos.FutureExpense
{
    public class LoadFutureExpenseDto
    {
        public long Id { get; set; }
        public long LandlordId { get; set; }
        public long PropertyId { get; set; }
        public string? PropertyName { get; set; }
        public long? UnitId { get; set; }
        public string? UnitName { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public DateTime DueDate { get; set; }
        public string? Vendor { get; set; }
        public long? VendorId { get; set; }
        public string? PaymentMethod { get; set; }
        public string? Notes { get; set; }
        public bool IsTaxDeductible { get; set; }
        public long? MaintenanceRequestId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}
