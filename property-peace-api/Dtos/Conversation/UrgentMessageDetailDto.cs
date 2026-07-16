using brownstone_hub_api.Dtos.Message;

namespace brownstone_hub_api.Dtos.Conversation
{
    public class UrgentMessageDetailDto
    {
        public long MessageId { get; set; }
        public long ConversationId { get; set; }
        public long? PropertyId { get; set; }
        public string? PropertyName { get; set; }
        public long? LeaseId { get; set; }
        public string? UnitName { get; set; }
        public bool IsMultiUnitProperty { get; set; }
        public DateTime MessageCreatedAt { get; set; }
        public string MessageContent { get; set; } = string.Empty;
        public string? TenantName { get; set; }
        public UrgentItemDto UrgentItem { get; set; } = new UrgentItemDto();
        public string? RecommendedAction { get; set; }
    }
}
