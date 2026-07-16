using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Utility or service responsibility for a lease (e.g. Electricity = Tenant).
    /// </summary>
    public class UtilityServiceResponsibility
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
        public string Name { get; set; } = string.Empty;

        /// <summary>Tenant or Landlord</summary>
        [Required]
        [MaxLength(20)]
        public string Responsibility { get; set; } = "Tenant";

        /// <summary>When true, row cannot be deleted (core five: Electricity, Gas, Sewer/Septic, Trash, Water).</summary>
        public bool IsRequired { get; set; } = false;
    }
}
