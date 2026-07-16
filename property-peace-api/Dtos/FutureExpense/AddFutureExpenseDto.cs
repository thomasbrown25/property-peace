using System.ComponentModel.DataAnnotations;

namespace brownstone_hub_api.Dtos.FutureExpense
{
    public class AddFutureExpenseDto
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
        public DateTime DueDate { get; set; }

        [MaxLength(200)]
        public string? Vendor { get; set; }

        public long? VendorId { get; set; }

        [MaxLength(50)]
        public string? PaymentMethod { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }

        public bool IsTaxDeductible { get; set; } = false;

        public long? MaintenanceRequestId { get; set; }
    }
}
