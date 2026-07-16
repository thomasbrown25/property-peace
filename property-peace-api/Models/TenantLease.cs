
namespace brownstone_hub_api.Models
{
    public class TenantLease
    {
        public long TenantId { get; set; }
        public Tenant Tenant { get; set; } = null!;
        
        public long LeaseId { get; set; }
        public Lease Lease { get; set; } = null!;
        
        // E-Signature field - when this tenant signed this specific lease
        public DateTime? TenantSignedAt { get; set; }
        
        // When tenant was added to this lease
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}
