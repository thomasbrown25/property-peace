namespace brownstone_hub_api.Models
{
    public class AnnouncementRecipient
    {
        public long Id { get; set; }
        public long AnnouncementId { get; set; }
        public Announcement Announcement { get; set; } = null!;
        
        // Recipient information
        public long? OrganizationId { get; set; }
        public long? PropertyId { get; set; }
        public long? UnitId { get; set; }
        public long? TenantId { get; set; } // Specific tenant if unit was selected
        
        // Delivery status
        public bool NotificationSent { get; set; } = false;
        public bool EmailSent { get; set; } = false;
        public DateTime? NotificationSentAt { get; set; }
        public DateTime? EmailSentAt { get; set; }
        
        public string? ErrorMessage { get; set; } // If delivery failed
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
