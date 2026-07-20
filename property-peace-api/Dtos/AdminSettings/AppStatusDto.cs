namespace brownstone_hub_api.Dtos.AdminSettings
{
    public class AppStatusDto
    {
        public bool MaintenanceModeEnabled { get; set; }
        public string MaintenanceTitle { get; set; } = string.Empty;
        public string MaintenanceMessage { get; set; } = string.Empty;
        public string MaintenanceSupportEmail { get; set; } = string.Empty;
    }
}
