using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace brownstone_hub_api.Models
{
    /// <summary>
    /// One statute section per state for LeaseShield (schema lease_shield).
    /// Used for section-based context and future RAG; populated by crawl or admin.
    /// </summary>
    public class LeaseShieldStateLawSection
    {
        [Key]
        public long Id { get; set; }

        [Required]
        [MaxLength(2)]
        public string State { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string SectionCode { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? SectionTitle { get; set; }

        [Column(TypeName = "nvarchar(max)")]
        public string? SourceUrl { get; set; }

        [Column(TypeName = "nvarchar(max)")]
        public string? ContentText { get; set; }

        public DateTime? LastFetchedAt { get; set; }

        public int? DisplayOrder { get; set; }
    }
}
