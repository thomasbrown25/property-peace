namespace brownstone_hub_api.Models
{
    public class StorageObject
    {
        public long Id { get; set; }
        public long? OrganizationId { get; set; }
        public Organization? Organization { get; set; }
        public long? UploadedByUserId { get; set; }
        public User? UploadedByUser { get; set; }
        public long? OwnerUserId { get; set; }
        public User? OwnerUser { get; set; }
        public string Category { get; set; } = "Other";
        public string? EntityType { get; set; }
        public long? EntityId { get; set; }
        public string? FileName { get; set; }
        public string? BlobContainer { get; set; }
        public string BlobName { get; set; } = string.Empty;
        public string? BlobUrl { get; set; }
        public string? ContentType { get; set; }
        public long SizeBytes { get; set; }
        public string Source { get; set; } = "Upload";
        public string? MetadataJson { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
    }
}
