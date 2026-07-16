namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Represents a file uploaded to the system
    /// </summary>
    public class File
    {
        public long Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty; // Original filename
        public string BlobName { get; set; } = string.Empty; // Azure blob storage name
        public string BlobUrl { get; set; } = string.Empty; // Azure blob storage URL
        
        // Category
        public long? CategoryId { get; set; }
        public FileCategory? Category { get; set; }
        
        // Location (property/unit/lease reference)
        public long? PropertyId { get; set; }
        public Property? Property { get; set; }
        public long? UnitId { get; set; }
        public Unit? Unit { get; set; }
        public long? LeaseId { get; set; }
        public Lease? Lease { get; set; }
        
        // Sharing information (stored as JSON or separate table - using string for simplicity)
        public string? SharingInfo { get; set; } // JSON string with sharing details
        
        // Organization ownership
        public long OrganizationId { get; set; }
        public Organization Organization { get; set; } = null!;
        
        // Audit fields
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; }
        public long? CreatedBy { get; set; } // UserId who uploaded
        public User? CreatedByUser { get; set; }
        public long? UpdatedBy { get; set; } // UserId who last modified
        public User? UpdatedByUser { get; set; }
        
        // Soft delete
        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
    }
}

