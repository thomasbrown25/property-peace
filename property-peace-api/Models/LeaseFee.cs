using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace brownstone_hub_api.Models
{
    public class LeaseFee
    {
        [Key]
        public long Id { get; set; }

        [Required]
        public long LeaseId { get; set; }

        [ForeignKey(nameof(LeaseId))]
        public Lease Lease { get; set; } = null!;

        // Organization ownership
        public long? OrganizationId { get; set; }

        [ForeignKey(nameof(OrganizationId))]
        public Organization? Organization { get; set; }

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty; // e.g., "Pet Fee", "Application Fee", etc.

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        [Required]
        public DateTime DueDate { get; set; }

        // Late Fee Configuration Fields
        public bool IsLateFee { get; set; } = false; // Flag to identify late fees vs other fees

        [MaxLength(20)]
        public string? LateFeeType { get; set; } // "OneTime" or "Daily"

        [MaxLength(20)]
        public string? FeeType { get; set; } // "Flat", "PercentRent", "PercentUnpaid"

        [Column(TypeName = "decimal(18,2)")]
        public decimal? PercentValue { get; set; } // Percentage if FeeType is percentage-based

        public int? AppliedAfterDays { get; set; } // Days after rent due date (for one-time)

        public int? StartingAfterDays { get; set; } // Days after rent due date (for daily)

        [MaxLength(20)]
        public string? LimitType { get; set; } // "NoLimit", "StopAfterDays", "MaxTotal"

        public int? LimitDays { get; set; } // Stop daily fees after X days

        [Column(TypeName = "decimal(18,2)")]
        public decimal? LimitAmount { get; set; } // Maximum total late fees

        [MaxLength(20)]
        public string? LimitAmountType { get; set; } // "Flat" or "PercentRent" for limit

        // Standard audit fields
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
