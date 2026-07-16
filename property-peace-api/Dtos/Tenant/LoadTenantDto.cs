
using brownstone_hub_api.Dtos.User;

namespace brownstone_hub_api.Dtos.Tenant
{
    public class LoadTenantDto
    {
        public long Id { get; set; }
        public string Firstname { get; set; }
        public string Lastname { get; set; }
        public string? Email { get; set; }
        public string? PhoneNumber { get; set; }
        public long? UserId { get; set; }
        public DateTime CreatedAt { get; set; }
        public bool IsActive { get; set; }

        // Property / Unit info
        public long? PropertyId { get; set; }
        public string? PropertyName { get; set; }
        public string? PropertyType { get; set; }
        public string? UnitName { get; set; }
        public long? UnitId { get; set; }

        // Lease info
        public long? LeaseId { get; set; }
        public DateTime? LeaseStartDate { get; set; }
        public DateTime? LeaseEndDate { get; set; }

        // User info (if tenant has an account)
        public LoadUserDto? User { get; set; }
    }
}