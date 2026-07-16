using brownstone_hub_api.Dtos.AdminSettings;

namespace brownstone_hub_api.Services.AdminSettingsService
{
    public interface IAdminSettingsService
    {
        Task<ServiceResponse<LoadAdminSettingsDto>> GetAdminSettings();
        Task<ServiceResponse<LoadAdminSettingsDto>> UpdateAdminSettings(string notificationEmail, bool allPremiumFeaturesOnFreePlan);
    }
}

