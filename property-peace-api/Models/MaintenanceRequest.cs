using System.ComponentModel.DataAnnotations;

namespace brownstone_hub_api.Models
{
    public class MaintenanceRequest
    {
        public long Id { get; set; }
        public byte[] RowVersion { get; set; } = [];
        public long PropertyId { get; set; }
        public Property Property { get; set; }
        public long? UnitId { get; set; }
        public Unit Unit { get; set; }
        
        // Organization ownership
        public long? OrganizationId { get; set; }
        // Immutable submitter identity keeps tenant access bound to the originating renter,
        // rather than granting a future occupant access merely because they share a unit.
        public long? SubmittedByUserId { get; set; }
        public long? SubmittedByTenantId { get; set; }
        public long? SubmittedUnderLeaseId { get; set; }
        public Organization? Organization { get; set; }
        // public long CategoryId { get; set; }
        // public MaintenanceCategory Category { get; set; }

        public string UnitName { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public EMaintenanceStatus Status { get; set; } = EMaintenanceStatus.Reported;
        public EMaintenancePriority Priority { get; set; } = EMaintenancePriority.Medium;
        public MaintenanceUrgency Urgency { get; set; } = MaintenanceUrgency.Routine;
        public string ImageUrl { get; set; } = string.Empty;

        // Structured intake and deterministic triage (Milestone 8). These remain nullable/defaulted
        // so existing requests and legacy API clients continue to work unchanged.
        public string? LocationDetails { get; set; }
        public string? StructuredIntakeJson { get; set; }
        public string? TriagePolicyVersion { get; set; }
        public string? LandlordSummary { get; set; }
        public string? MissingInformationJson { get; set; }
        public bool StopTroubleshooting { get; set; }
        public DateTimeOffset? TriagedAtUtc { get; set; }
        public DateTimeOffset? AcknowledgeByUtc { get; set; }
        public DateTimeOffset? ActionByUtc { get; set; }
        public bool EstimateRequired { get; set; }
        public int ResolutionCycle { get; set; } = 1;
        
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
        public ICollection<MaintenancePreferredWindow> PreferredWindows { get; set; } = [];
        public ICollection<MaintenanceEstimate> Estimates { get; set; } = [];
        public ICollection<MaintenanceWorkOrder> WorkOrders { get; set; } = [];
        public ICollection<MaintenanceAppointment> Appointments { get; set; } = [];
        public ICollection<MaintenanceCompletion> Completions { get; set; } = [];
        public ICollection<MaintenanceTroubleshootingStep> TroubleshootingSteps { get; set; } = [];
        public ICollection<MaintenanceActivityEvent> ActivityEvents { get; set; } = [];
        public ICollection<MaintenanceAttachment> Attachments { get; set; } = [];
    }

    public enum EMaintenanceStatus
    {
        Reported,
        Acknowledged,
        Scheduled,
        InProgress,
        Resolved,
        // Canonical workflow additions. Values 0-4 above are intentionally unchanged for legacy data.
        AwaitingTenant = 5,
        AwaitingApproval = 6,
        Assigned = 7,
        Cancelled = 8
    }

    public enum EMaintenancePriority { Low, Medium, High }

    public enum MaintenanceUrgency
    {
        Routine = 1,
        Urgent = 2,
        Emergency = 3
    }

    public enum EAssignedToType
    {
        Unassigned,
        Self,
        Vendor,
        OneTimeContact,
        OrganizationMember
    }
}