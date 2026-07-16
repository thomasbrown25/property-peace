namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Library of pre-written legal clauses that can be used in lease templates
    /// </summary>
    public class ClauseLibrary
    {
        public long Id { get; set; }
        public string ClauseKey { get; set; } = string.Empty; // Unique identifier (e.g., "parties-intro", "late-fee-standard")
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty; // Pre-written legal clause text
        
        public string Category { get; set; } = string.Empty; // Rent, Deposit, Pets, Smoking, Termination, etc.
        
        // Versioning
        public string Version { get; set; } = "1.0";
        
        // System vs custom
        public bool IsSystemClause { get; set; } = false; // System clause vs landlord custom
        
        // State-specific (nullable for generic clauses)
        public string? State { get; set; }
        
        // Relationships
        public long? OrganizationId { get; set; }
        public Organization? Organization { get; set; }
        
        public long? LandlordId { get; set; } // Nullable for system clauses
        public User? Landlord { get; set; }
        
        // Audit fields
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; }
        public long? CreatedBy { get; set; }
        public long? UpdatedBy { get; set; }
    }
}
