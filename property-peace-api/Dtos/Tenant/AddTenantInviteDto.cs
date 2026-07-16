
namespace brownstone_hub_api.Dtos.Tenant
{
    public class AddTenantInviteDto
    {
        public long TenantId { get; set; }
        public string Email { get; set; } = string.Empty;
    }
}

