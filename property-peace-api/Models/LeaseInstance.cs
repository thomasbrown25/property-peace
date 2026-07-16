namespace brownstone_hub_api.Models
{
    /// <summary>
    /// A specific lease instance generated from a template with resolved variables
    /// </summary>
    public class LeaseInstance
    {
        public long Id { get; set; }
        public long LeaseId { get; set; } // FK to existing Lease
        public Lease Lease { get; set; } = null!;
        
        public long LeaseTemplateId { get; set; }
        public LeaseTemplate LeaseTemplate { get; set; } = null!;
        public string TemplateVersion { get; set; } = string.Empty; // Frozen at generation time
        
        // Status
        public bool IsDraft { get; set; } = true;
        public bool IsFinalized { get; set; } = false; // Finalized = immutable
        public DateTime? FinalizedAt { get; set; }
        
        // Warnings (stored as JSON)
        public string? Warnings { get; set; } // JSON array of warning messages
        
        // Navigation
        public ICollection<LeaseVariable> Variables { get; set; } = [];
        public ICollection<LeaseDocument> Documents { get; set; } = [];
        public LeasePolicySection? PolicySection { get; set; }
        
        // Audit fields
        public DateTime GeneratedAt { get; set; } = DateTime.Now;
        public long GeneratedBy { get; set; } // UserId
        public User? GeneratedByUser { get; set; }
    }
}
