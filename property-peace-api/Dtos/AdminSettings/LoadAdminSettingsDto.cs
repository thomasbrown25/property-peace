namespace brownstone_hub_api.Dtos.AdminSettings
{
    public class LoadAdminSettingsDto
    {
        public long Id { get; set; }
        public string NotificationEmail { get; set; } = string.Empty;
        public bool AllPremiumFeaturesOnFreePlan { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}

