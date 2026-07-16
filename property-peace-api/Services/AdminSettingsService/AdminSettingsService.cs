using brownstone_hub_api.Dtos.AdminSettings;
using brownstone_hub_api.Repositories.AdminSettings;

namespace brownstone_hub_api.Services.AdminSettingsService
{
    public class AdminSettingsService(
        IAdminSettingsRepository adminSettingsRepository,
        ILogger<AdminSettingsService> logger) : IAdminSettingsService
    {
        private readonly IAdminSettingsRepository _adminSettingsRepository = adminSettingsRepository;
        private readonly ILogger<AdminSettingsService> _logger = logger;

        public async Task<ServiceResponse<LoadAdminSettingsDto>> GetAdminSettings()
        {
            var response = new ServiceResponse<LoadAdminSettingsDto>();

            try
            {
                var settings = await _adminSettingsRepository.GetAdminSettings();

                if (settings == null)
                {
                    response.Data = new LoadAdminSettingsDto
                    {
                        Id = 0,
                        NotificationEmail = string.Empty,
                        AllPremiumFeaturesOnFreePlan = false,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                }
                else
                {
                    response.Data = new LoadAdminSettingsDto
                    {
                        Id = settings.Id,
                        NotificationEmail = settings.NotificationEmail,
                        AllPremiumFeaturesOnFreePlan = settings.AllPremiumFeaturesOnFreePlan,
                        CreatedAt = settings.CreatedAt,
                        UpdatedAt = settings.UpdatedAt
                    };
                }

                response.Success = true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting admin settings");
                response.Success = false;
                response.Message = ex.Message;
            }

            return response;
        }

        public async Task<ServiceResponse<LoadAdminSettingsDto>> UpdateAdminSettings(string notificationEmail, bool allPremiumFeaturesOnFreePlan)
        {
            var response = new ServiceResponse<LoadAdminSettingsDto>();

            try
            {
                var settings = await _adminSettingsRepository.UpdateAdminSettings(notificationEmail, allPremiumFeaturesOnFreePlan);

                response.Data = new LoadAdminSettingsDto
                {
                    Id = settings.Id,
                    NotificationEmail = settings.NotificationEmail,
                    AllPremiumFeaturesOnFreePlan = settings.AllPremiumFeaturesOnFreePlan,
                    CreatedAt = settings.CreatedAt,
                    UpdatedAt = settings.UpdatedAt
                };

                response.Success = true;
                response.Message = "Admin settings updated successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating admin settings");
                response.Success = false;
                response.Message = ex.Message;
            }

            return response;
        }
    }
}
