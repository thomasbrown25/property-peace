using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Models
{
    public class TimeTrackingSettings
    {
        public long Id { get; set; }
        
        // Organization reference (one settings per organization)
        public long OrganizationId { get; set; }
        public Organization Organization { get; set; } = null!;
        
        // Time rounding settings
        public int RoundingIncrementMinutes { get; set; } = 15; // Default 15 minutes
        public ETimeRoundingMethod RoundingMethod { get; set; } = ETimeRoundingMethod.RoundNearest;
        
        // Timestamps
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
