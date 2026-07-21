namespace brownstone_hub_api.Dtos.Storage
{
    public class StorageSummaryDto
    {
        public long TotalBytes { get; set; }
        public long ActiveBytes { get; set; }
        public long DeletedBytes { get; set; }
        public int TotalFiles { get; set; }
        public int ActiveFiles { get; set; }
        public int OrganizationCount { get; set; }
        public int UserCount { get; set; }
        public long DefaultOrgLimitBytes { get; set; }
        public List<StorageCategoryUsageDto> Categories { get; set; } = new();
        public List<StorageOrganizationUsageDto> TopOrganizations { get; set; } = new();
        public List<StorageUserUsageDto> TopUsers { get; set; } = new();
        public List<StorageRecentObjectDto> RecentObjects { get; set; } = new();
    }

    public class StorageOrganizationUsageDto
    {
        public long? OrganizationId { get; set; }
        public string OrganizationName { get; set; } = "Unassigned";
        public long UsedBytes { get; set; }
        public int FileCount { get; set; }
        public long LimitBytes { get; set; }
        public decimal PercentUsed { get; set; }
        public DateTime? LastUploadAt { get; set; }
    }

    public class StorageUserUsageDto
    {
        public long? UserId { get; set; }
        public string UserName { get; set; } = "Unassigned";
        public string? Email { get; set; }
        public long UsedBytes { get; set; }
        public int FileCount { get; set; }
        public DateTime? LastUploadAt { get; set; }
        public List<StorageOrganizationUsageDto> Organizations { get; set; } = new();
    }

    public class StorageCategoryUsageDto
    {
        public string Category { get; set; } = "Other";
        public long UsedBytes { get; set; }
        public int FileCount { get; set; }
    }

    public class StorageRecentObjectDto
    {
        public long Id { get; set; }
        public string? FileName { get; set; }
        public string Category { get; set; } = "Other";
        public long SizeBytes { get; set; }
        public string? OrganizationName { get; set; }
        public string? UploadedByUserName { get; set; }
        public string? UploadedByEmail { get; set; }
        public string? EntityType { get; set; }
        public long? EntityId { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class TrackStorageObjectRequest
    {
        public long? OrganizationId { get; set; }
        public long? UploadedByUserId { get; set; }
        public long? OwnerUserId { get; set; }
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
    }
}
