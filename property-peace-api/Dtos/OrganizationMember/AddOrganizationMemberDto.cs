
namespace brownstone_hub_api.Dtos.OrganizationMember
{
    public class AddOrganizationMemberDto
    {
        public long OrganizationId { get; set; }
        public long UserId { get; set; }
        public string Role { get; set; } = "Viewer";
        public long? InvitedBy { get; set; }
        public bool CanManageProperties { get; set; } = false;
        public bool CanManageTenants { get; set; } = false;
        public bool CanManageLeases { get; set; } = false;
        public bool CanManageMaintenance { get; set; } = false;
        public bool CanManageBilling { get; set; } = false;
        public bool CanManageMembers { get; set; } = false;
    }
}

