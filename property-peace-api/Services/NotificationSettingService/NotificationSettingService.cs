using brownstone_hub_api.Dtos.NotificationSetting;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.NotificationSettings;
using brownstone_hub_api.Repositories.Users;

namespace brownstone_hub_api.Services.NotificationSettingService
{
    public class NotificationSettingService(
        INotificationSettingRepository notificationSettingRepository,
        IUserRepository userRepository,
        ILogger<NotificationSettingService> logger) : INotificationSettingService
    {
        private readonly INotificationSettingRepository _notificationSettingRepository = notificationSettingRepository;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly ILogger<NotificationSettingService> _logger = logger;

        public async Task<ServiceResponse<NotificationSettingDto>> GetNotificationSettings()
        {
            var response = new ServiceResponse<NotificationSettingDto>();

            try
            {
                var user = await _userRepository.GetCurrentUser();

                if (user == null)
                {
                    response.Success = false;
                    response.Message = "User not found.";
                    response.StatusCode = 401;
                    return response;
                }

                var settings = await _notificationSettingRepository.GetNotificationSettings(user.Id);

                if (settings == null)
                {
                    // Create default settings if they don't exist
                    settings = await _notificationSettingRepository.AddNotificationSettings(user.Id);
                }

                await _userRepository.UpdateNotificationPreferencesConfigured(user.Id, true);

                response.Data = settings;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred in NotificationSetting Service");
                response.Success = false;
                response.Message = ex.Message;
                response.StatusCode = 500;
                return response;
            }

            return response;
        }

        public async Task<ServiceResponse<NotificationSettingDto>> SaveNotificationSettings(NotificationSettingDto notificationSettingDto)
        {
            var response = new ServiceResponse<NotificationSettingDto>();

            try
            {
                var user = await _userRepository.GetCurrentUser();

                if (user == null)
                {
                    response.Success = false;
                    response.Message = "User not found.";
                    response.StatusCode = 401;
                    return response;
                }

                // Ensure UserId matches current user
                notificationSettingDto.UserId = user.Id;

                // Check if settings exist, if not create them
                var existingSettings = await _notificationSettingRepository.GetNotificationSettings(user.Id);
                if (existingSettings == null)
                {
                    await _notificationSettingRepository.AddNotificationSettings(user.Id);
                }

                var updatedSettings = await _notificationSettingRepository.UpdateNotificationSettings(notificationSettingDto);
                await _userRepository.UpdateNotificationPreferencesConfigured(user.Id, true);

                response.Data = updatedSettings;
                response.Message = "Notification settings saved successfully.";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred in NotificationSetting Service");
                response.Success = false;
                response.Message = ex.Message;
                response.StatusCode = 500;
                return response;
            }

            return response;
        }
    }
}

