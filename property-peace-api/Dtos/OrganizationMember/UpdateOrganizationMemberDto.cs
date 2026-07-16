
namespace brownstone_hub_api.Dtos.OrganizationMember
{
    public class UpdateOrganizationMemberDto
    {
        public long Id { get; set; }
        public string Role { get; set; } = string.Empty;
        public bool CanManageProperties { get; set; }
        public bool CanManageTenants { get; set; }
        public bool CanManageLeases { get; set; }
        public bool CanManageMaintenance { get; set; }
        public bool CanManageBilling { get; set; }
        public bool CanManageMembers { get; set; }
    }
}

