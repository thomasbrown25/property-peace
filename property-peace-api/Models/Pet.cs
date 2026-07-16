using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Pet(s) on a lease.
    /// </summary>
    public class Pet
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

        [Required]
        [MaxLength(100)]
        public string Type { get; set; } = string.Empty; // e.g. Dog, Cat, etc.

        [MaxLength(100)]
        public string? Breed { get; set; }

        [Column(TypeName = "decimal(10,2)")]
        public decimal? Weight { get; set; } // in pounds

        public int? Age { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
