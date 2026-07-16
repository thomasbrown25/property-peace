namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Lease template that defines the structure and content of a lease agreement
    /// </summary>
    public class LeaseTemplate
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        
        // State and property type
        public string? State { get; set; } // State/jurisdiction (nullable for generic templates)
        public string? PropertyType { get; set; } // SFH, MFH, Any (nullable)
        
        // Template structure stored as JSON
        public string TemplateStructure { get; set; } = "{}"; // JSON structure with sections, blocks, clause settings
        
        // Default flags
        public bool IsDefault { get; set; } = false; // System default template
        public bool IsDefaultForLandlord { get; set; } = false; // Landlord's default template
        
        // Versioning
        public string Version { get; set; } = "1.0";
        
        // Soft delete
        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
        
        // Relationships
        public long? OrganizationId { get; set; }
        public Organization? Organization { get; set; }
        
        public long? LandlordId { get; set; } // Nullable for system templates
        public User? Landlord { get; set; }
        
        // Navigation
        public ICollection<LeaseTemplateSection> Sections { get; set; } = [];
        public ICollection<LeaseInstance> LeaseInstances { get; set; } = [];
        public ICollection<LeaseTemplatePolicy> Policies { get; set; } = [];
        
        // Audit fields
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; }
        public long? CreatedBy { get; set; }
        public long? UpdatedBy { get; set; }
    }
}
