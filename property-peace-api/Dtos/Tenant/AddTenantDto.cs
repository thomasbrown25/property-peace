

namespace brownstone_hub_api.Dtos.Tenant
{
    public class AddTenantDto
    {
        public long? Id { get; set; }
        public string? Firstname { get; set; }
        public string? Lastname { get; set; }
        public string? Email { get; set; }
        public string? PhoneNumber { get; set; }
        public long? UserId { get; set; }
        public long? LeaseId { get; set; }
        public long? UnitId { get; set; }
        public bool IsActive { get; set; } = true;
        public long? OrganizationId { get; set; } // Organization that owns this tenant
    }
}