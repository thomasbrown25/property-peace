using brownstone_hub_api.Dtos.Notification;

namespace brownstone_hub_api.Services.NotificationService
{
    public interface INotificationService
    {
        Task<ServiceResponse<NotificationListResponseDto>> GetNotifications(long userId);
        Task<ServiceResponse<int>> GetUnreadCount(long userId);
        Task<ServiceResponse<bool>> MarkNotificationAsRead(long notificationId);
        Task<ServiceResponse<int>> MarkAllNotificationsAsRead(long userId);
        Task<ServiceResponse<NotificationDto>> CreateNotification(CreateNotificationDto createNotificationDto);
    }
}

