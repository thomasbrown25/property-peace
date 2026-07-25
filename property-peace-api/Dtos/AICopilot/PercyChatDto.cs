namespace brownstone_hub_api.Dtos.AICopilot
{
    public class PercyChatRequestDto
    {
        public long? ConversationId { get; set; }
        public string Message { get; set; } = string.Empty;
        // Retained for backwards-compatible request binding. The server never trusts this history.
        public List<PercyChatMessageDto> History { get; set; } = [];
    }

    public class PercyChatMessageDto
    {
        public string Role { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
    }

    public class PercyChatResponseDto
    {
        public long ConversationId { get; set; }
        public string ConversationTitle { get; set; } = string.Empty;
        public long UserMessageId { get; set; }
        public long AssistantMessageId { get; set; }
        public string Content { get; set; } = string.Empty;
        public string? ActivityLabel { get; set; }
        public string? ActivityStatus { get; set; }
        public List<PercyMetricDto> Metrics { get; set; } = [];
        public List<PercyResultItemDto> Items { get; set; } = [];
        public PercyPendingConfirmationDto? PendingConfirmation { get; set; }
    }

    public class PercyMetricDto
    {
        public string Label { get; set; } = string.Empty;
        public string Value { get; set; } = string.Empty;
        public bool Money { get; set; }
    }

    public class PercyResultItemDto
    {
        public string Title { get; set; } = string.Empty;
        public string Detail { get; set; } = string.Empty;
        public string? Value { get; set; }
    }

    public class PercyConversationSummaryDto
    {
        public long Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public bool IsArchived { get; set; }
        public string? LastMessagePreview { get; set; }
    }

    public class PercyConversationDto : PercyConversationSummaryDto
    {
        public List<PercyStoredMessageDto> Messages { get; set; } = [];
    }

    public class PercyStoredMessageDto
    {
        public long Id { get; set; }
        public string Role { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public string? ActivityLabel { get; set; }
        public string? ActivityStatus { get; set; }
        public List<PercyMetricDto> Metrics { get; set; } = [];
        public List<PercyResultItemDto> Items { get; set; } = [];
        public PercyPendingConfirmationDto? PendingConfirmation { get; set; }
    }

    public class PercyPendingConfirmationDto
    {
        public long Id { get; set; }
        public string ActionLabel { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; }
        public string Prompt { get; set; } = string.Empty;
    }

    public class PercyConfirmationResultDto
    {
        public long Id { get; set; }
        public string ActionLabel { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }
}
