namespace brownstone_hub_api.Dtos.Conversation
{
    public class AddConversationDto
    {
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public bool IsGroupChat { get; set; } = false;
        public bool ForceNewConversation { get; set; } = false;
        public List<long> ParticipantUserIds { get; set; } = []; // User IDs to add as participants
        
        // Optional: Link to related entities
        public long? PropertyId { get; set; }
        public long? LeaseId { get; set; }
        public long? TenantId { get; set; }
    }
}

