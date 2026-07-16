namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Represents an invitation for a prospective tenant to fill out a rental application
    /// </summary>
    public class ApplicationInvite
    {
        public long Id { get; set; }
        
        // Property/Unit Information (invite is for a specific property/unit)
        public long PropertyId { get; set; }
        public Property Property { get; set; } = null!;
        public long? UnitId { get; set; } // Optional - may apply to property or specific unit
        public Unit? Unit { get; set; }
        
        // Organization ownership
        public long? OrganizationId { get; set; }
        public Organization? Organization { get; set; }
        
        // Invite Details
        public string InviteToken { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? ApplicantName { get; set; } // Optional - pre-filled name for email personalization
        
        // Invite Status
        public DateTime ExpiresAt { get; set; }
        public bool IsUsed { get; set; } = false;
        public DateTime? UsedAt { get; set; }
        public long? ApplicationId { get; set; } // If invite was used, link to the created application
        public RentalApplication? Application { get; set; }
        
        // Relationships
        public long CreatedBy { get; set; } // Landlord UserId
        public User CreatedByUser { get; set; } = null!;
        
        // Audit fields
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}

