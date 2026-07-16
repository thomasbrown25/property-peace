using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Notification
{
    public class CreateNotificationDto
    {
        public long UserId { get; set; }
        public long? OrganizationId { get; set; } // Optional: Organization ID for filtering notifications by organization
        public ENotificationType Type { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public long? RelatedId { get; set; } // Optional: leaseId, propertyId, maintenanceId, etc.
        public bool SendEmail { get; set; } = false; // Optional: defaults to false
        public bool SendSMS { get; set; } = false; // Optional: defaults to false
        public bool SendInApp { get; set; } = true; // Optional: defaults to true
        public long? PerformedByUserId { get; set; } // Optional: User ID who performed the action
        public string? PerformedByName { get; set; } // Optional: Display name for who performed the action
    }
}

