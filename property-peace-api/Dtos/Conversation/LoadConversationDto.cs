using brownstone_hub_api.Dtos.Message;

namespace brownstone_hub_api.Dtos.Conversation
{
    public class LoadConversationDto
    {
        public long Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public bool IsGroupChat { get; set; }
        public long LandlordId { get; set; }
        public string LandlordName { get; set; } = string.Empty;
        public string? LandlordEmail { get; set; }
        public string? LandlordSmsNumber { get; set; }
        public bool HasLandlordSmsNumber => !string.IsNullOrWhiteSpace(LandlordSmsNumber);
        
        // Related entities
        public long? PropertyId { get; set; }
        public string? PropertyName { get; set; }
        public long? LeaseId { get; set; }
        public long? TenantId { get; set; }
        public string? TenantName { get; set; }
        public string? TenantEmail { get; set; }
        public string? TenantPhoneNumber { get; set; }
        
        // Status
        public bool IsArchived { get; set; }
        public bool IsPinned { get; set; }
        
        // Last message info
        public DateTime? LastMessageAt { get; set; }
        public string? LastMessagePreview { get; set; }
        public long? LastMessageBy { get; set; }
        public string? LastMessageByName { get; set; }
        
        // Unread count (for current user)
        public int UnreadCount { get; set; }
        
        // Participants (for group chats)
        public List<ConversationParticipantDto> Participants { get; set; } = [];
        
        // Recent messages (optional - loaded separately)
        public List<LoadMessageDto>? Messages { get; set; }
        
        // AI Analysis fields
        public string? AiSummary { get; set; }
        public DateTime? AiSummaryUpdatedAt { get; set; }
        public bool HasUrgentItems { get; set; }
        public string? UrgentItemsJson { get; set; }
        public DateTime? UrgentItemsDetectedAt { get; set; }
        
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
    
    public class ConversationParticipantDto
    {
        public long UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string? UserEmail { get; set; }
        public bool IsAdmin { get; set; }
        public DateTime JoinedAt { get; set; }
        public bool IsActive { get; set; }
    }
}

