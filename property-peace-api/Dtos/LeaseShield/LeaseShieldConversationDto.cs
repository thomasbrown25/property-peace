namespace brownstone_hub_api.Dtos.LeaseShield
{
    public class LeaseShieldConversationListItemDto
    {
        public long Id { get; set; }
        public string State { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class LeaseShieldConversationDetailDto
    {
        public long Id { get; set; }
        public string State { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public List<LeaseShieldMessageDto> Messages { get; set; } = [];
    }

    public class LeaseShieldMessageDto
    {
        public long Id { get; set; }
        public string Role { get; set; } = "user"; // "user" | "assistant"
        public string? State { get; set; } // 2-letter code; set on assistant messages for the state chip
        public string? SourceUrl { get; set; } // State law source URL for assistant messages; open on "View source"
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    public class CreateLeaseShieldConversationRequest
    {
        public string State { get; set; } = string.Empty; // 2-letter code
        public string? Title { get; set; }
    }

    public class UpdateLeaseShieldConversationRequest
    {
        public string Title { get; set; } = string.Empty;
    }

    public class SendLeaseShieldMessageRequest
    {
        public string Content { get; set; } = string.Empty;
        public string State { get; set; } = string.Empty; // 2-letter code
    }
}
