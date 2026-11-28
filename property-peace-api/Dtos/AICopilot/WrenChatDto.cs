namespace brownstone_hub_api.Dtos.AICopilot
{
    public class WrenChatRequestDto
    {
        public string ClientRequestId { get; set; } = string.Empty;
        public long? ConversationId { get; set; }
        public long? PropertyId { get; set; }
        public string Message { get; set; } = string.Empty;
        // Retained for backwards-compatible request binding. The server never trusts this history.
        public List<WrenChatMessageDto> History { get; set; } = [];
    }

    public class WrenChatMessageDto
    {
        public string Role { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
    }

    public class WrenChatResponseDto
    {
        public long ConversationId { get; set; }
        public string ConversationTitle { get; set; } = string.Empty;
        public long UserMessageId { get; set; }
        public long AssistantMessageId { get; set; }
        public string Content { get; set; } = string.Empty;
        public string? ActivityLabel { get; set; }
        public string? ActivityStatus { get; set; }
        public List<WrenMetricDto> Metrics { get; set; } = [];
        public List<WrenResultItemDto> Items { get; set; } = [];
        public List<WrenSourceDto> Sources { get; set; } = [];
        public WrenPendingConfirmationDto? PendingConfirmation { get; set; }
    }

    public class WrenMetricDto
    {
        public string Label { get; set; } = string.Empty;
        public string Value { get; set; } = string.Empty;
        public bool Money { get; set; }
    }

    public class WrenResultItemDto
    {
        public string Title { get; set; } = string.Empty;
        public string Detail { get; set; } = string.Empty;
        public string? Value { get; set; }
    }

    public class WrenSourceDto
    {
        public string Kind { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public string WorkflowRoute { get; set; } = string.Empty;
        public string? RecordReference { get; set; }
        public DateTime RetrievedAtUtc { get; set; }
    }

    public class WrenConversationSummaryDto
    {
        public long Id { get; set; }
        public long? PropertyId { get; set; }
        public string Title { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public bool IsArchived { get; set; }
        public string? LastMessagePreview { get; set; }
    }

    public class WrenConversationDto : WrenConversationSummaryDto
    {
        public List<WrenStoredMessageDto> Messages { get; set; } = [];
    }

    public class WrenStoredMessageDto
    {
        public long Id { get; set; }
        public string Role { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public string? ActivityLabel { get; set; }
        public string? ActivityStatus { get; set; }
        public List<WrenMetricDto> Metrics { get; set; } = [];
        public List<WrenResultItemDto> Items { get; set; } = [];
        public List<WrenSourceDto> Sources { get; set; } = [];
        public WrenPendingConfirmationDto? PendingConfirmation { get; set; }
    }

    public class WrenPendingConfirmationDto
    {
        public long Id { get; set; }
        public string ActionLabel { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; }
        public string Prompt { get; set; } = string.Empty;
    }

    public class WrenConfirmationResultDto
    {
        public long Id { get; set; }
        public string ActionLabel { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }
}
