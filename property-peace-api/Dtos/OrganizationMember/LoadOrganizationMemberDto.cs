
namespace brownstone_hub_api.Dtos.OrganizationMember
{
    public class LoadOrganizationMemberDto
    {
        public long Id { get; set; }
        public long OrganizationId { get; set; }
        public string OrganizationName { get; set; } = string.Empty;
        public long? UserId { get; set; } // Nullable - null means account not created yet
        public string UserName { get; set; } = string.Empty;
        public string UserEmail { get; set; } = string.Empty;
        public string? Email { get; set; } // Email from invite (if UserId is null)
        public bool HasAccount { get; set; } // True if UserId is not null
        public string Role { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public DateTime JoinedAt { get; set; }
        public long? InvitedBy { get; set; }
        public string? InvitedByName { get; set; }
        public bool CanManageProperties { get; set; }
        public bool CanManageTenants { get; set; }
        public bool CanManageLeases { get; set; }
        public bool CanManageMaintenance { get; set; }
        public bool CanManageBilling { get; set; }
        public bool CanManageMembers { get; set; }
    }
}

