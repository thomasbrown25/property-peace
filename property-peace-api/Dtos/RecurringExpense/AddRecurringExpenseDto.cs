using System.ComponentModel.DataAnnotations;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.RecurringExpense
{
    public class AddRecurringExpenseDto
    {
        [Required]
        public long LandlordId { get; set; }

        [Required]
        public long PropertyId { get; set; }

        public long? UnitId { get; set; }

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string Category { get; set; } = string.Empty;

        [Required]
        [Range(0.01, double.MaxValue, ErrorMessage = "Amount must be greater than 0")]
        public decimal Amount { get; set; }

        [Required]
        public ERecurringFrequency Frequency { get; set; } = ERecurringFrequency.Monthly;

        [Required]
        [Range(1, 31, ErrorMessage = "Day of month must be between 1 and 31")]
        public int DayOfPeriod { get; set; } = 1;

        [Required]
        public DateTime StartDate { get; set; }

        public DateTime? EndDate { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }

        [MaxLength(200)]
        public string? Vendor { get; set; }

        [MaxLength(50)]
        public string? PaymentMethod { get; set; }

        public bool IsTaxDeductible { get; set; } = false;

        public long? MaintenanceRequestId { get; set; }
    }
}
