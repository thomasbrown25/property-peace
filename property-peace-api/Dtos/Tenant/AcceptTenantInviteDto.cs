
namespace brownstone_hub_api.Dtos.Tenant
{
    public class AcceptTenantInviteDto
    {
        public string InviteToken { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
    }
}
