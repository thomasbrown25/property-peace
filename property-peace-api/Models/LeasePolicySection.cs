namespace brownstone_hub_api.Models
{
    /// <summary>
    /// AI-formatted policy section for a lease instance
    /// </summary>
    public class LeasePolicySection
    {
        public long Id { get; set; }
        public long LeaseInstanceId { get; set; }
        public LeaseInstance LeaseInstance { get; set; } = null!;
        
        // Original landlord input (stored as JSON array of strings)
        public string? OriginalPolicies { get; set; } // JSON: ["policy 1", "policy 2", ...]
        
        // AI-processed output (structured)
        public string? AiFormattedPolicies { get; set; } // JSON: {policies: [{title, body, category}], markdown: "..."}
        
        // Rendered markdown for document
        public string? AiFormattedMarkdown { get; set; } // Formatted policy section text
        
        public string Tone { get; set; } = "Neutral"; // Strict, Neutral, Friendly
        
        // AI processing metadata
        public DateTime? AiModifiedAt { get; set; }
        public long? AiModifiedBy { get; set; } // UserId who triggered AI formatting
        public User? AiModifiedByUser { get; set; }
        
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; }
    }
}
