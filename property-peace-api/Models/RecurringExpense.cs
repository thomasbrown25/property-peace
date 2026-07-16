using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Models
{
    public class RecurringExpense
    {
        [Key]
        public long Id { get; set; }

        [Required]
        public long LandlordId { get; set; }

        [Required]
        public long PropertyId { get; set; }
        
        // Organization ownership
        public long? OrganizationId { get; set; }
        
        [ForeignKey(nameof(OrganizationId))]
        public Organization? Organization { get; set; }

        [ForeignKey(nameof(PropertyId))]
        public Property Property { get; set; } = null!;

        // Optional unit association
        public long? UnitId { get; set; }

        [ForeignKey(nameof(UnitId))]
        public Unit? Unit { get; set; }

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty; // Template name (e.g., "Monthly Water Bill")

        [Required]
        [MaxLength(100)]
        public string Category { get; set; } = string.Empty; // Repairs, Maintenance, Utilities, etc.

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        [Required]
        public ERecurringFrequency Frequency { get; set; } = ERecurringFrequency.Monthly;

        // Day of month for all frequencies
        // For monthly: 1-31 (day of month)
        // For quarterly: 1-31 (day of month in the quarter's first month)
        // For yearly: 1-31 (day of month in the specified month)
        [Required]
        [Range(1, 31)]
        public int DayOfPeriod { get; set; } = 1;

        // Start date for the recurring expense
        [Required]
        public DateTime StartDate { get; set; }

        // Optional end date (null = no end date)
        public DateTime? EndDate { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }

        // Vendor/Supplier information
        [MaxLength(200)]
        public string? Vendor { get; set; }

        // Payment method
        [MaxLength(50)]
        public string? PaymentMethod { get; set; }

        // Tax deductible flag
        public bool IsTaxDeductible { get; set; } = false;

        // Optional maintenance request link
        public long? MaintenanceRequestId { get; set; }

        [ForeignKey(nameof(MaintenanceRequestId))]
        public MaintenanceRequest? MaintenanceRequest { get; set; }

        // Pause/resume functionality
        public bool IsPaused { get; set; } = false;

        // Last generated expense date (to track what's been generated)
        public DateTime? LastGeneratedDate { get; set; }

        // Next occurrence date (for quick lookup)
        public DateTime? NextOccurrenceDate { get; set; }

        // Standard audit fields
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; }
    }
}
