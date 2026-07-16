using brownstone_hub_api.Models;

namespace brownstone_hub_api.Repositories.AdminSettings
{
    public interface IAdminSettingsRepository
    {
        Task<Models.AdminSettings?> GetAdminSettings();
        Task<Models.AdminSettings> UpdateAdminSettings(string notificationEmail, bool allPremiumFeaturesOnFreePlan);
    }
}

