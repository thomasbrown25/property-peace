using brownstone_hub_api.Models;

namespace brownstone_hub_api.Repositories.AdminSettings
{
    public interface IAdminSettingsRepository
    {
        Task<Models.AdminSettings?> GetAdminSettings();
        Task<Models.AdminSettings> UpdateAdminSettings(string notificationEmail, bool allPremiumFeaturesOnFreePlan, bool maintenanceModeEnabled, string maintenanceTitle, string maintenanceMessage, string maintenanceSupportEmail);
        Task<Models.AdminSettings> UpdateMaintenanceSettings(bool maintenanceModeEnabled, string maintenanceTitle, string maintenanceMessage, string maintenanceSupportEmail);
    }
}

