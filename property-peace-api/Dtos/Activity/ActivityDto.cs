using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Activity
{
    public class ActivityDto
    {
        public long Id { get; set; }
        public string ActivityType { get; set; } = string.Empty; // Payment, Maintenance, Lease, Property, Tenant, Expense, File, Message, Application, System, Notification
        public ENotificationType? NotificationType { get; set; } // For compatibility with existing notifications
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public long? RelatedId { get; set; }
        public string? RelatedEntityType { get; set; } // Payment, Maintenance, Lease, Property, Tenant, Expense, File, Message, Application
        public long? PerformedByUserId { get; set; }
        public string? PerformedByName { get; set; }
        public string? PerformedByEmail { get; set; }
        public long? OrganizationId { get; set; }
        public long? PropertyId { get; set; } // Direct property ID for easier filtering
        public long? LeaseId { get; set; } // Lease ID for payments and leases
        public long? ConversationId { get; set; } // Conversation ID for messages
        public string? IconType { get; set; } // For frontend icon mapping
        public string? Color { get; set; } // For frontend color mapping
        public bool IsRead { get; set; } // For notifications only
    }

    public class ActivityListResponseDto
    {
        public List<ActivityDto> Activities { get; set; } = new();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public bool HasMore { get; set; }
    }

    public class ActivityFilterDto
    {
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public List<string>? ActivityTypes { get; set; } // Payment, Maintenance, Lease, Property, Tenant, Expense, File, Message, Application, System
        public long? PropertyId { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 50;
    }
}

