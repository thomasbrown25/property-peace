using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Other deposits (e.g. key deposit, cleaning deposit) required by the lease.
    /// Pet deposit is stored on Lease.PetDepositAmount.
    /// </summary>
    public class LeaseDeposit
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
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        [Required]
        public DateTime DueDate { get; set; }

        public int SortOrder { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
