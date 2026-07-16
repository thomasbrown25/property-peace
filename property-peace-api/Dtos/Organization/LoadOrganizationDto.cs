
namespace brownstone_hub_api.Dtos.Organization
{
    public class LoadOrganizationDto
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public long? OwnerId { get; set; }
        public string OwnerName { get; set; } = string.Empty;
        public string OwnerEmail { get; set; } = string.Empty;
        public long? SubscriptionId { get; set; }
        public string? StripeCustomerId { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public int MemberCount { get; set; }
        public int PropertyCount { get; set; }
        public string? UserRole { get; set; } // Current user's role in this organization
        public bool IsMaintenanceAgentEnabled { get; set; }
        public bool IsCollectionsAgentEnabled { get; set; }
    }
}

