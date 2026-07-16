using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.TimeTrackingSettings
{
    public class LoadTimeTrackingSettingsDto
    {
        public long Id { get; set; }
        public long OrganizationId { get; set; }
        public int RoundingIncrementMinutes { get; set; }
        public ETimeRoundingMethod RoundingMethod { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
