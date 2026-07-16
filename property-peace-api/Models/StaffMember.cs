namespace brownstone_hub_api.Models
{
    public class StaffMember
    {
        public long Id { get; set; }
        
        // User reference (nullable for placeholder staff members before invite is accepted)
        public long? UserId { get; set; }
        public User? User { get; set; }
        
        // Organization reference
        public long OrganizationId { get; set; }
        public Organization Organization { get; set; } = null!;
        
        // Staff information
        public string Role { get; set; } = string.Empty; // "Maintenance", "Supervisor", etc.
        public decimal? HourlyRate { get; set; } // For billing calculations
        
        // Placeholder fields (for staff members before invite is accepted)
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? Email { get; set; }
        
        // Status
        public bool IsActive { get; set; } = true;
        
        // Timestamps
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        
        // Navigation properties
        public ICollection<TimeEntry> TimeEntries { get; set; } = [];
        public ICollection<StaffMemberInvite> Invites { get; set; } = [];
    }
}
