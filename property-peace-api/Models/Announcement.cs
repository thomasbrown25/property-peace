namespace brownstone_hub_api.Models
{
    public class Announcement
    {
        public long Id { get; set; }
        public long OrganizationId { get; set; }
        public Organization Organization { get; set; } = null!;
        
        public long CreatedByUserId { get; set; }
        public User CreatedBy { get; set; } = null!;
        
        public string Title { get; set; } = string.Empty; // AI-generated title
        public string Message { get; set; } = string.Empty;
        public string? FormattedMessage { get; set; } // AI-formatted version if used
        
        // Delivery methods
        public bool SendAsNotification { get; set; } = true;
        public bool SendAsEmail { get; set; } = false;
        
        // Recipients (stored as JSON arrays or separate table)
        // For now, we'll store JSON arrays and can normalize later if needed
        public string? OrganizationIds { get; set; } // JSON array of organization IDs
        public string? PropertyIds { get; set; } // JSON array of property IDs
        public string? UnitIds { get; set; } // JSON array of unit IDs
        
        // Status
        public int SentCount { get; set; } = 0;
        public int FailedCount { get; set; } = 0;
        public bool IsCompleted { get; set; } = false;
        public DateTime? CompletedAt { get; set; }
        public DateTime? ScheduledAt { get; set; } // When the announcement should be sent
        
        // Audit
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        
        // Navigation
        public ICollection<AnnouncementRecipient> Recipients { get; set; } = [];
    }
}
