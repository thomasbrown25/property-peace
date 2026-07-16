using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Repositories.Notifications
{
    public interface INotificationRepository
    {
        Task<List<NotificationDto>> GetNotificationsByUserId(long userId, long? organizationId = null);
        Task<int> GetUnreadCountByUserId(long userId, long? organizationId = null);
        Task<bool> MarkNotificationAsRead(long notificationId, long userId);
        Task<int> MarkAllNotificationsAsRead(long userId, long? organizationId = null);
        Task<NotificationDto> CreateNotification(CreateNotificationDto createNotificationDto);
        Task<bool> NotificationExistsToday(long userId, ENotificationType type, long? relatedId, string title);
        Task<bool> NotificationExistsInLast24Hours(long userId, ENotificationType type, long? relatedId, string title);
        Task<bool> NotificationOfTypeExistsSince(long userId, ENotificationType type, DateTime since);
        Task<bool> NotificationExistsSinceForLease(long userId, ENotificationType type, long leaseId, string title, DateTime since);
    }
}

