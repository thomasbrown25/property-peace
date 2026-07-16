
namespace brownstone_hub_api.Models
{
    public class Organization
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public long? OwnerId { get; set; } // Primary owner (User FK) - nullable
        public User? Owner { get; set; }
        
        // Subscription tied to organization
        public long? SubscriptionId { get; set; }
        public Subscription? Subscription { get; set; }
        
        // Stripe customer ID for billing
        public string? StripeCustomerId { get; set; }
        
        // Agent settings
        public bool IsMaintenanceAgentEnabled { get; set; } = true;
        public bool IsCollectionsAgentEnabled { get; set; } = true;

        // Settings
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime UpdatedAt { get; set; } = DateTime.Now;
        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
        
        // Navigation properties
        public ICollection<OrganizationMember> Members { get; set; } = [];
        public ICollection<Property> Properties { get; set; } = [];
        public ICollection<OrganizationInvite> Invites { get; set; } = [];
    }
}

