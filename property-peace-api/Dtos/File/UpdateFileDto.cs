namespace brownstone_hub_api.Dtos.File
{
    public class UpdateFileDto
    {
        public string? Title { get; set; }
        public long? CategoryId { get; set; }
        public long? PropertyId { get; set; }
        public long? UnitId { get; set; }
        public long? LeaseId { get; set; }
        public string? SharingInfo { get; set; }
    }
}

