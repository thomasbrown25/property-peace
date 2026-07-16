using brownstone_hub_api.Dtos.NotificationSetting;

namespace brownstone_hub_api.Services.NotificationSettingService
{
    public interface INotificationSettingService
    {
        Task<ServiceResponse<NotificationSettingDto>> GetNotificationSettings();
        Task<ServiceResponse<NotificationSettingDto>> SaveNotificationSettings(NotificationSettingDto notificationSettingDto);
    }
}

