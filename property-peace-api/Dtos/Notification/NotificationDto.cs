using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Notification
{
    public class NotificationDto
    {
        public long Id { get; set; }
        public ENotificationType Type { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public bool IsRead { get; set; }
        public DateTime CreatedAt { get; set; }
        public long? RelatedId { get; set; }
        public long? PerformedByUserId { get; set; }
        public string? PerformedByName { get; set; }
    }

    public class NotificationListResponseDto
    {
        public List<NotificationDto> Notifications { get; set; } = new();
        public int UnreadCount { get; set; }
    }
}

