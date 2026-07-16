
namespace brownstone_hub_api.Dtos.Tenant
{
    public class ValidateInviteTokenDto
    {
        public bool IsValid { get; set; }
        public string? Email { get; set; }
        public long? TenantId { get; set; }
        public string? Message { get; set; }
        public LoadTenantDto? Tenant { get; set; }
        public string? PropertyName { get; set; }
        public string? PropertyAddress { get; set; }
        public string? LandlordName { get; set; }
    }
}

