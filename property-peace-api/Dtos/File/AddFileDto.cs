namespace brownstone_hub_api.Dtos.File
{
    public class AddFileDto
    {
        public string Title { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        public string BlobName { get; set; } = string.Empty;
        public string BlobUrl { get; set; } = string.Empty;
        public long? CategoryId { get; set; }
        public long? PropertyId { get; set; }
        public long? UnitId { get; set; }
        public long? LeaseId { get; set; }
        public string? SharingInfo { get; set; }
    }
}

