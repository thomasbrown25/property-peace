namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Represents a file category for organizing files within an organization
    /// </summary>
    public class FileCategory
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        
        // Organization ownership
        public long OrganizationId { get; set; }
        public Organization Organization { get; set; } = null!;
        
        // Audit fields
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; }
        public long? CreatedBy { get; set; }
        public long? UpdatedBy { get; set; }
        
        // Soft delete
        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
        
        // Navigation properties
        public ICollection<File> Files { get; set; } = [];
    }
}

