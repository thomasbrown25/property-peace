namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Collection of house rules/policies that can be attached to lease templates
    /// </summary>
    public class PolicyPack
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        
        public bool IsDefault { get; set; } = false; // System default policy pack
        
        // Relationships
        public long? OrganizationId { get; set; }
        public Organization? Organization { get; set; }
        
        public long? LandlordId { get; set; } // Nullable for system packs
        public User? Landlord { get; set; }
        
        // Navigation
        public ICollection<PolicyPackItem> Items { get; set; } = [];
        
        // Audit fields
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; }
        public long? CreatedBy { get; set; }
        public long? UpdatedBy { get; set; }
    }
}
