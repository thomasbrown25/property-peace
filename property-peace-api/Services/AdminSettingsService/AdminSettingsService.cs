using brownstone_hub_api.Dtos.AdminSettings;
using brownstone_hub_api.Repositories.AdminSettings;
using Models = brownstone_hub_api.Models;

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
                response.Data = ToLoadDto(settings);
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

        public async Task<ServiceResponse<AppStatusDto>> GetAppStatus()
        {
            var response = new ServiceResponse<AppStatusDto>();

            try
            {
                var settings = await _adminSettingsRepository.GetAdminSettings();
                response.Data = ToAppStatusDto(settings);
                response.Success = true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting app status");
                response.Success = false;
                response.Message = ex.Message;
                response.Data = ToAppStatusDto(null);
            }

            return response;
        }

        public async Task<ServiceResponse<LoadAdminSettingsDto>> UpdateAdminSettings(
            string notificationEmail,
            bool allPremiumFeaturesOnFreePlan,
            bool maintenanceModeEnabled,
            string maintenanceTitle,
            string maintenanceMessage,
            string maintenanceSupportEmail)
        {
            var response = new ServiceResponse<LoadAdminSettingsDto>();

            try
            {
                var settings = await _adminSettingsRepository.UpdateAdminSettings(
                    notificationEmail,
                    allPremiumFeaturesOnFreePlan,
                    maintenanceModeEnabled,
                    maintenanceTitle,
                    maintenanceMessage,
                    maintenanceSupportEmail);

                response.Data = ToLoadDto(settings);
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

        public async Task<ServiceResponse<AppStatusDto>> UpdateMaintenanceSettings(
            bool maintenanceModeEnabled,
            string maintenanceTitle,
            string maintenanceMessage,
            string maintenanceSupportEmail)
        {
            var response = new ServiceResponse<AppStatusDto>();

            try
            {
                var settings = await _adminSettingsRepository.UpdateMaintenanceSettings(
                    maintenanceModeEnabled,
                    maintenanceTitle,
                    maintenanceMessage,
                    maintenanceSupportEmail);

                response.Data = ToAppStatusDto(settings);
                response.Success = true;
                response.Message = "Maintenance settings updated successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating maintenance settings");
                response.Success = false;
                response.Message = ex.Message;
            }

            return response;
        }

        private static LoadAdminSettingsDto ToLoadDto(Models.AdminSettings? settings)
        {
            if (settings == null)
            {
                return new LoadAdminSettingsDto
                {
                    Id = 0,
                    NotificationEmail = string.Empty,
                    AllPremiumFeaturesOnFreePlan = false,
                    MaintenanceModeEnabled = false,
                    MaintenanceTitle = "Property Peace is getting a quick tune-up",
                    MaintenanceMessage = "We’re making updates to improve reliability and performance. Please check back shortly.",
                    MaintenanceSupportEmail = "support@propertypeace.io",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
            }

            return new LoadAdminSettingsDto
            {
                Id = settings.Id,
                NotificationEmail = settings.NotificationEmail,
                AllPremiumFeaturesOnFreePlan = settings.AllPremiumFeaturesOnFreePlan,
                MaintenanceModeEnabled = settings.MaintenanceModeEnabled,
                MaintenanceTitle = settings.MaintenanceTitle,
                MaintenanceMessage = settings.MaintenanceMessage,
                MaintenanceSupportEmail = settings.MaintenanceSupportEmail,
                CreatedAt = settings.CreatedAt,
                UpdatedAt = settings.UpdatedAt
            };
        }

        private static AppStatusDto ToAppStatusDto(Models.AdminSettings? settings)
        {
            return new AppStatusDto
            {
                MaintenanceModeEnabled = settings?.MaintenanceModeEnabled ?? false,
                MaintenanceTitle = string.IsNullOrWhiteSpace(settings?.MaintenanceTitle)
                    ? "Property Peace is getting a quick tune-up"
                    : settings.MaintenanceTitle,
                MaintenanceMessage = string.IsNullOrWhiteSpace(settings?.MaintenanceMessage)
                    ? "We’re making updates to improve reliability and performance. Please check back shortly."
                    : settings.MaintenanceMessage,
                MaintenanceSupportEmail = string.IsNullOrWhiteSpace(settings?.MaintenanceSupportEmail)
                    ? "support@propertypeace.io"
                    : settings.MaintenanceSupportEmail
            };
        }
    }
}
