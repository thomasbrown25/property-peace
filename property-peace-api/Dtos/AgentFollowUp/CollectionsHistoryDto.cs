namespace brownstone_hub_api.Dtos.AgentFollowUp
{
    public class CollectionsHistoryItemDto
    {
        public long Id { get; set; }
        public long LeaseId { get; set; }
        public string TenantNames { get; set; } = string.Empty;
        public string PropertyName { get; set; } = string.Empty;
        public long? TenantId { get; set; }
        public string ActionType { get; set; } = string.Empty;
        public string? FollowUpType { get; set; }
        public string Message { get; set; } = string.Empty;
        public string? InAppMessage { get; set; }
        public string? EmailSubject { get; set; }
        public string? EmailMessage { get; set; }
        public long? ConversationId { get; set; }
        public long? MessageId { get; set; }
        public bool EmailSent { get; set; }
        public int? SuppressionDays { get; set; }
        public DateTime CreatedAt { get; set; }
        public bool IsManual { get; set; }
    }

    public class CollectionsHistoryPageDto
    {
        public List<CollectionsHistoryItemDto> Items { get; set; } = [];
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
    }
}
