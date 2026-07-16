namespace brownstone_hub_api.Dtos.File
{
    public class LoadFileDto
    {
        public long Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        public string BlobName { get; set; } = string.Empty;
        public string BlobUrl { get; set; } = string.Empty;
        public long? CategoryId { get; set; }
        public string? CategoryName { get; set; }
        public long? PropertyId { get; set; }
        public string? PropertyName { get; set; }
        public long? UnitId { get; set; }
        public string? UnitName { get; set; }
        public long? LeaseId { get; set; }
        public string? Location { get; set; } // Formatted location string
        public string? SharingInfo { get; set; }
        public long OrganizationId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public long? CreatedBy { get; set; }
        public string? CreatedByName { get; set; }
        public long? UpdatedBy { get; set; }
        public string? UpdatedByName { get; set; }
    }
}

