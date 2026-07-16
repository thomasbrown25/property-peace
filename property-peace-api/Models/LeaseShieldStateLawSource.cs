using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace brownstone_hub_api.Models
{
    /// <summary>
    /// State law source (base .gov URL) for LeaseShield AI - schema lease_shield.
    /// </summary>
    public class LeaseShieldStateLawSource
    {
        [Key]
        public long Id { get; set; }

        [Required]
        [MaxLength(2)]
        public string State { get; set; } = string.Empty;

        [Column(TypeName = "nvarchar(max)")]
        public string? BaseUrl { get; set; }

        /// <summary>
        /// Optional URL to fetch for AI context. When set, we fetch this page's text and inject it into the prompt
        /// so the AI can answer from actual statute text. Use for section-level pages (e.g. G.S. 42-46) when the
        /// BaseUrl is only an index (e.g. Chapter 42 TOC). Leave null to use only BaseUrl + Description.
        /// </summary>
        [Column(TypeName = "nvarchar(max)")]
        public string? ContentUrl { get; set; }

        [MaxLength(500)]
        public string? Description { get; set; }

        public DateTime? UpdatedAt { get; set; }
    }
}
