using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.RecurringExpense
{
    public class LoadRecurringExpenseDto
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
        public ERecurringFrequency Frequency { get; set; }
        public int DayOfPeriod { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public string? Notes { get; set; }
        public string? Vendor { get; set; }
        public string? PaymentMethod { get; set; }
        public bool IsTaxDeductible { get; set; }
        public long? MaintenanceRequestId { get; set; }
        public bool IsPaused { get; set; }
        public DateTime? LastGeneratedDate { get; set; }
        public DateTime? NextOccurrenceDate { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}
