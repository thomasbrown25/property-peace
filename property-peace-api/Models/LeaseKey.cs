using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Key(s) tenant receives (type + number of copies).
    /// </summary>
    public class LeaseKey
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
        [MaxLength(50)]
        public string KeyType { get; set; } = "Property";

        public int Copies { get; set; } = 1;
    }
}
