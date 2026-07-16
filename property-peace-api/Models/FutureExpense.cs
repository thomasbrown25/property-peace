using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace brownstone_hub_api.Models
{
    public class FutureExpense
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
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string Category { get; set; } = string.Empty;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        [Required]
        public DateTime DueDate { get; set; } // When the expense is due (future date)

        [MaxLength(200)]
        public string? Vendor { get; set; }

        public long? VendorId { get; set; }

        [ForeignKey(nameof(VendorId))]
        public Vendor? VendorEntity { get; set; }

        [MaxLength(50)]
        public string? PaymentMethod { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }

        public bool IsTaxDeductible { get; set; } = false;

        public long? MaintenanceRequestId { get; set; }

        [ForeignKey(nameof(MaintenanceRequestId))]
        public MaintenanceRequest? MaintenanceRequest { get; set; }

        // Standard audit fields
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; }
    }
}
