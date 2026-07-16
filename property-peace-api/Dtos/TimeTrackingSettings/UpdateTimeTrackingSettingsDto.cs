using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.TimeTrackingSettings
{
    public class UpdateTimeTrackingSettingsDto
    {
        public int RoundingIncrementMinutes { get; set; }
        public ETimeRoundingMethod RoundingMethod { get; set; }
    }
}
