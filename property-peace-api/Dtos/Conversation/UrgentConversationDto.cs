namespace brownstone_hub_api.Dtos.Conversation
{
    public class UrgentConversationDto
    {
        public long ConversationId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? TenantName { get; set; }
        public string? PropertyName { get; set; }
        public string? AiSummary { get; set; }
        public List<UrgentItemDto> UrgentItems { get; set; } = [];
        public DateTime? UrgentItemsDetectedAt { get; set; }
        public DateTime? LastMessageAt { get; set; }
    }

    public class UrgentItemDto
    {
        public string Id { get; set; } = string.Empty; // Unique identifier for this urgent item
        public string Type { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Severity { get; set; } = string.Empty;
        public string? MessageExcerpt { get; set; }
    }
}

