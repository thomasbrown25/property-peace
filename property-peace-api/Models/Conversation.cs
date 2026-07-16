namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Represents a conversation/chat thread between users
    /// </summary>
    public class Conversation
    {
        public long Id { get; set; }
        
        // Conversation metadata
        public string Title { get; set; } = string.Empty; // Optional: for group chats or named conversations
        public string? Description { get; set; }
        public bool IsGroupChat { get; set; } = false; // True for group conversations, false for 1-on-1
        
        // Participants
        public long LandlordId { get; set; } // Owner of the conversation (landlord)
        public User Landlord { get; set; } = null!;
        
        // Organization ownership
        public long? OrganizationId { get; set; }
        public Organization? Organization { get; set; }
        
        // Related entities (optional - conversations can be about specific properties, leases, etc.)
        public long? PropertyId { get; set; }
        public Property? Property { get; set; }
        public long? LeaseId { get; set; }
        public Lease? Lease { get; set; }
        public long? TenantId { get; set; }
        public Tenant? Tenant { get; set; }
        
        // Conversation status
        public bool IsArchived { get; set; } = false;
        public bool IsPinned { get; set; } = false;
        
        // Last message info (for quick access)
        public DateTime? LastMessageAt { get; set; }
        public string? LastMessagePreview { get; set; }
        public long? LastMessageBy { get; set; } // UserId
        
        // AI Analysis fields
        public string? AiSummary { get; set; } // AI-generated summary of the conversation
        public DateTime? AiSummaryUpdatedAt { get; set; } // When the summary was last updated
        public bool HasUrgentItems { get; set; } // Flag indicating if conversation contains urgent items
        public string? UrgentItemsJson { get; set; } // JSON array of urgent items detected
        public DateTime? UrgentItemsDetectedAt { get; set; } // When urgent items were last detected
        
        // Linked maintenance request (if this conversation led to a ticket)
        public long? MaintenanceRequestId { get; set; }

        // Messages in this conversation
        public ICollection<Message> Messages { get; set; } = [];
        
        // Participants (for group chats)
        public ICollection<ConversationParticipant> Participants { get; set; } = [];
        
        // Audit fields
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public long? CreatedBy { get; set; }
    }
}

