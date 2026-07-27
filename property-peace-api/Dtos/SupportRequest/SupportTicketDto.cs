using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.SupportRequest
{
    public class SupportTicketSummaryDto
    {
        public long Id { get; set; }
        public string TicketNumber { get; set; } = string.Empty;
        public ESupportAndFeedbackType Type { get; set; }
        public string SubType { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime LastActivityAt { get; set; }
        public DateTime? ResolvedAt { get; set; }
        public bool IsResolved { get; set; }
        public bool IsFavorite { get; set; }
        public long? ConversationId { get; set; }
        public long? LastMessageBy { get; set; }
        public int MessageCount { get; set; }
        public int UnreadCount { get; set; }
        public bool CanReply { get; set; }
        public long UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string? UserEmail { get; set; }
    }

    public class SupportTicketDetailDto : SupportTicketSummaryDto
    {
        public List<SupportTicketMessageDto> Messages { get; set; } = [];
    }

    public class SupportTicketMessageDto
    {
        public long Id { get; set; }
        public long SenderId { get; set; }
        public string SenderName { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public bool IsFromSupport { get; set; }
        public bool IsRead { get; set; }
    }

    public class ReplyToSupportTicketDto
    {
        public string Message { get; set; } = string.Empty;
    }

    public class UpdateSupportTicketStatusDto
    {
        public bool IsResolved { get; set; }
    }
}
