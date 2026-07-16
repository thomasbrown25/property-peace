
namespace brownstone_hub_api.Models
{
    public class OrganizationMember
    {
        public long Id { get; set; }
        public long OrganizationId { get; set; }
        public Organization Organization { get; set; } = null!;
        
        public long? UserId { get; set; } // Nullable - user account created when invite is accepted
        public User? User { get; set; }
        
        public string? Email { get; set; } // Email from invite (before user account is created)
        
        public string Role { get; set; } = "Viewer"; // "Owner", "Manager", "Viewer"
        public bool IsActive { get; set; } = true;
        
        public DateTime JoinedAt { get; set; } = DateTime.Now;
        public long? InvitedBy { get; set; } // UserId who invited
        public User? InvitedByUser { get; set; }
        
        // Permissions (can be extended)
        public bool CanManageProperties { get; set; } = false;
        public bool CanManageTenants { get; set; } = false;
        public bool CanManageLeases { get; set; } = false;
        public bool CanManageMaintenance { get; set; } = false;
        public bool CanManageBilling { get; set; } = false;
        public bool CanManageMembers { get; set; } = false;
    }
}

