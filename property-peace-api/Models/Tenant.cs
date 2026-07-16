
namespace brownstone_hub_api.Models
{
    public class Tenant
    {
        public long Id { get; set; }
        public string Firstname { get; set; }
        public string Lastname { get; set; }
        public string? Email { get; set; }
        public string? PhoneNumber { get; set; }
        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
        public long? UnitId { get; set; }
        public Unit? Unit { get; set; }
        public long? UserId { get; set; }
        public User? User { get; set; }
        
        // Many-to-many relationship with leases via TenantLease join entity
        public ICollection<TenantLease> TenantLeases { get; set; } = [];
        
        // Organization ownership
        public long? OrganizationId { get; set; }
        public Organization? Organization { get; set; }
        
        public DateTime CreatedAt { get; set; } = DateTime.Now;

        // Seeded data flag
        public bool IsSeeded { get; set; } = false;
    }
}