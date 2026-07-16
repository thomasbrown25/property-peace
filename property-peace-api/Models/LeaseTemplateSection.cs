namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Sections within a lease template (e.g., Parties, Term, Rent, Policies)
    /// </summary>
    public class LeaseTemplateSection
    {
        public long Id { get; set; }
        public long LeaseTemplateId { get; set; }
        public LeaseTemplate LeaseTemplate { get; set; } = null!;
        
        public string SectionName { get; set; } = string.Empty; // e.g., "Parties", "Term", "Rent", "Policies"
        public int SectionOrder { get; set; } // Order within template
        public bool IsEnabled { get; set; } = true;
        
        // Content stored as JSON (clause blocks + variables)
        public string? Content { get; set; } // JSON array of blocks: [{"type": "clause", "clauseKey": "..."}, {"type": "variable", "placeholder": "{{...}}"}]
        
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; }
    }
}
