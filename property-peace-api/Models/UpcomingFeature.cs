using System.ComponentModel.DataAnnotations;

namespace brownstone_hub_api.Models
{
    public class UpcomingFeature
    {
        [Key]
        public long Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? Description { get; set; }

        [MaxLength(500)]
        public string? Icon { get; set; } // Icon name or URL

        public int DisplayOrder { get; set; } = 0; // For ordering features

        public bool IsActive { get; set; } = true; // To show/hide features

        public DateTime? ExpectedDate { get; set; } // Optional expected release date

        // Standard audit fields
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; }
    }
}

