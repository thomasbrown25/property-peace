using brownstone_hub_api.Dtos.NotificationSetting;

namespace brownstone_hub_api.Repositories.NotificationSettings
{
    public interface INotificationSettingRepository
    {
        Task<NotificationSettingDto?> GetNotificationSettings(long userId);
        Task<NotificationSettingDto> AddNotificationSettings(long userId);
        Task<NotificationSettingDto> UpdateNotificationSettings(NotificationSettingDto notificationSettingDto);
        Task<long?> GetUserIdByPhoneNumber(string phoneNumber);
    }
}

