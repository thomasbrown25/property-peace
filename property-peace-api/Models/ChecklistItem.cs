namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Individual item in a move-in/move-out checklist
    /// </summary>
    public class ChecklistItem
    {
        public long Id { get; set; }
        
        // Item Details
        public string Name { get; set; } = string.Empty; // e.g., "Kitchen - Refrigerator", "Bathroom - Shower"
        public string? Description { get; set; } // Additional details about the item
        public string? Category { get; set; } // e.g., "Kitchen", "Bathroom", "Living Room", "Exterior"
        
        // Condition Assessment
        public string? Condition { get; set; } // "Excellent", "Good", "Fair", "Poor", "Damaged"
        public string? Notes { get; set; } // Specific notes about condition, damage, etc.
        public bool HasDamage { get; set; } = false;
        public string? DamageDescription { get; set; } // Description of any damage
        
        // Photos (multi-image, stored as JSON arrays)
        public string? PhotoBlobNames { get; set; } // JSON array of blob names
        public string? PhotoBlobUrls { get; set; } // JSON array of blob URLs (permanent, SAS generated on read)

        // Legacy single-photo fields (kept for backwards compatibility)
        public string? PhotoBlobName { get; set; }
        public string? PhotoBlobUrl { get; set; }
        
        // Completion
        public bool IsChecked { get; set; } = false; // Whether this item was inspected
        public DateTime? CheckedAt { get; set; }
        
        // Relationships
        public long ChecklistId { get; set; }
        public Checklist Checklist { get; set; } = null!;
        
        // Ordering
        public int SortOrder { get; set; } = 0; // For custom ordering of items
    }
}

