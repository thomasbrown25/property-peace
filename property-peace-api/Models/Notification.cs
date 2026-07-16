
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Models
{
    public class Notification
    {
        public long Id { get; set; }
        public long UserId { get; set; }
        public long? OrganizationId { get; set; } // FK to Organization (nullable - some notifications may not be organization-specific)
        public ENotificationType Type { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public bool IsRead { get; set; } = false;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public long? RelatedId { get; set; } // Optional: ID for navigation (e.g., leaseId, paymentId, etc.)
        
        // Activity tracking fields
        public long? PerformedByUserId { get; set; } // User ID who performed the action
        public string? PerformedByName { get; set; } // Display name: user name, "System", or "Tenant Payment"
        
        // Navigation property
        public Organization? Organization { get; set; }
    }
}

