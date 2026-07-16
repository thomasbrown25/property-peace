namespace brownstone_hub_api.Dtos.AdminSettings
{
    public class UpdateAdminSettingsDto
    {
        public string NotificationEmail { get; set; } = string.Empty;
        public bool AllPremiumFeaturesOnFreePlan { get; set; }
    }
}

