namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Organization-level checklist item templates that can be reused for move-in/move-out checklists
    /// </summary>
    public class OrganizationChecklistItem
    {
        public long Id { get; set; }
        
        // Item Details
        public string Name { get; set; } = string.Empty; // e.g., "Kitchen - Refrigerator", "Bathroom - Shower"
        public string? Description { get; set; } // Additional details about the item
        public string? Category { get; set; } // e.g., "Kitchen", "Bathroom", "Living Room", "Exterior"
        
        // Template metadata
        public bool IsDefault { get; set; } = false; // Whether this is a default system item
        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
        
        // Ordering
        public int SortOrder { get; set; } = 0; // For custom ordering of items
        
        // Relationships
        public long OrganizationId { get; set; }
        public Organization Organization { get; set; } = null!;
        
        // Audit fields
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; }
    }
}

