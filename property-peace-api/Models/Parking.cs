using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Parking configuration for a lease. One record per lease.
    /// </summary>
    public class Parking
    {
        [Key]
        public long Id { get; set; }

        [Required]
        public long LeaseId { get; set; }

        [ForeignKey(nameof(LeaseId))]
        public Lease Lease { get; set; } = null!;

        public long? OrganizationId { get; set; }

        [ForeignKey(nameof(OrganizationId))]
        public Organization? Organization { get; set; }

        /// <summary>Whether to include parking rules in the lease.</summary>
        public bool IncludeParkingRules { get; set; } = false;

        /// <summary>JSON array of parking types: garage, driveway, street, carport, designatedSpace, other</summary>
        [MaxLength(500)]
        public string? ParkingTypes { get; set; }

        /// <summary>Custom or default parking rules text for the lease.</summary>
        [Column(TypeName = "nvarchar(max)")]
        public string? CustomRules { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
