using System.ComponentModel.DataAnnotations;

namespace brownstone_hub_api.Dtos.UpcomingFeature
{
    public class AddUpcomingFeatureDto
    {
        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? Description { get; set; }

        [MaxLength(500)]
        public string? Icon { get; set; }

        public int DisplayOrder { get; set; } = 0;

        public bool IsActive { get; set; } = true;

        public DateTime? ExpectedDate { get; set; }
    }
}

