using System.ComponentModel.DataAnnotations;

namespace brownstone_hub_api.Models
{
    public class MaintenanceRequest
    {
        public long Id { get; set; }
        public long PropertyId { get; set; }
        public Property Property { get; set; }
        public long? UnitId { get; set; }
        public Unit Unit { get; set; }
        
        // Organization ownership
        public long? OrganizationId { get; set; }
        public Organization? Organization { get; set; }
        // public long CategoryId { get; set; }
        // public MaintenanceCategory Category { get; set; }

        public string UnitName { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public EMaintenanceStatus Status { get; set; } = EMaintenanceStatus.Reported;
        public EMaintenancePriority Priority { get; set; } = EMaintenancePriority.Medium;
        public string ImageUrl { get; set; } = string.Empty;
        
        // Order number for tracking and communication (e.g., MR-2024-0001)
        [MaxLength(50)]
        public string? OrderNumber { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime UpdatedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public DateTime? ScheduledDate { get; set; }

        // Linked conversation (created when tenant submits via AI agent)
        public long? ConversationId { get; set; }
        public Conversation? Conversation { get; set; }

        // Vendor assignment
        public long? VendorId { get; set; }
        public Vendor? VendorEntity { get; set; }

        // Assignment
        public EAssignedToType AssignedToType { get; set; } = EAssignedToType.Unassigned;
        public long? AssignedToUserId { get; set; }
        public string? AssignedContactName { get; set; }
        public string? AssignedContactPhone { get; set; }
        public string? AssignedContactEmail { get; set; }
        public DateTime? AssignedAt { get; set; }
        public long? AssignedByUserId { get; set; }

        public ICollection<MaintenanceEvent> Events { get; set; } = [];
        public ICollection<MaintenanceImage> Images { get; set; } = [];
    }

    public enum EMaintenanceStatus
    {
        Reported,
        Acknowledged,
        Scheduled,
        InProgress,
        Resolved
    }

    public enum EMaintenancePriority { Low, Medium, High }

    public enum EAssignedToType
    {
        Unassigned,
        Self,
        Vendor,
        OneTimeContact,
        OrganizationMember
    }
}