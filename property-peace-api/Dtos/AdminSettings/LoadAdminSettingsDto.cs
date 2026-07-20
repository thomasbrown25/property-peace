namespace brownstone_hub_api.Dtos.AdminSettings
{
    public class LoadAdminSettingsDto
    {
        public long Id { get; set; }
        public string NotificationEmail { get; set; } = string.Empty;
        public bool AllPremiumFeaturesOnFreePlan { get; set; }
        public bool MaintenanceModeEnabled { get; set; }
        public string MaintenanceTitle { get; set; } = string.Empty;
        public string MaintenanceMessage { get; set; } = string.Empty;
        public string MaintenanceSupportEmail { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}

