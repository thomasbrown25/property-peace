namespace brownstone_hub_api.Dtos.AdminSettings
{
    public class UpdateAdminSettingsDto
    {
        public string NotificationEmail { get; set; } = string.Empty;
        public bool AllPremiumFeaturesOnFreePlan { get; set; }
        public bool MaintenanceModeEnabled { get; set; }
        public string MaintenanceTitle { get; set; } = string.Empty;
        public string MaintenanceMessage { get; set; } = string.Empty;
        public string MaintenanceSupportEmail { get; set; } = string.Empty;
    }
}

