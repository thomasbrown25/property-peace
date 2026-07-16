using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace brownstone_hub_api.Models
{
    public class StateDepositLaw
    {
        [Key]
        public long Id { get; set; }

        [Required]
        [MaxLength(2)]
        public string State { get; set; } = string.Empty; // State abbreviation (e.g., "NC", "CA")

        [Column(TypeName = "nvarchar(max)")]
        public string? BulletPointsText { get; set; } // Newline-separated bullet points (AI-generated or manual)

        [Required]
        public DateTime LastUpdated { get; set; } = DateTime.UtcNow;

        [MaxLength(50)]
        public string? LastUpdatedBy { get; set; } // "AI" or manual update source

        // Standard audit fields
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
