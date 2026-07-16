using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Models
{
    public class TimeEntry
    {
        public long Id { get; set; }
        
        // Staff member (internal employee) - different from Vendor
        public long StaffMemberId { get; set; }
        public StaffMember StaffMember { get; set; } = null!;
        
        // Property where work was done
        public long PropertyId { get; set; }
        public Property Property { get; set; } = null!;
        
        // Optional: Link to specific maintenance request
        public long? MaintenanceRequestId { get; set; }
        public MaintenanceRequest? MaintenanceRequest { get; set; }
        
        // Optional: Link to specific unit
        public long? UnitId { get; set; }
        public Unit? Unit { get; set; }
        
        // Organization context
        public long OrganizationId { get; set; }
        public Organization Organization { get; set; } = null!;
        
        // Time tracking
        public DateTime StartTime { get; set; }
        public DateTime? EndTime { get; set; }
        public decimal? HoursWorked { get; set; } // Calculated or manually entered (rounded)
        public decimal? BreakHours { get; set; } // Total break time in hours
        public bool IsBillable { get; set; } = true;
        
        // Description of work performed
        public string Description { get; set; } = string.Empty;
        public string? Notes { get; set; }
        
        // Status
        public ETimeEntryStatus Status { get; set; } = ETimeEntryStatus.Draft;
        
        // Approval workflow
        public long? ApprovedById { get; set; }
        public User? ApprovedBy { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public string? RejectionReason { get; set; }
        
        // Timestamps
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        
        // Navigation properties
        public ICollection<TimeBreak> Breaks { get; set; } = [];
    }
}
