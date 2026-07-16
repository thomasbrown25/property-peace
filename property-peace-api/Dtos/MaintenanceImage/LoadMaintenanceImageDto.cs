

namespace brownstone_hub_api.Dtos.MaintenanceImage
{
    public class LoadMaintenanceImageDto
    {
        public long Id { get; set; }
        public long MaintenanceRequestId { get; set; }
        public string BlobName { get; set; }
        public string BlobUrl { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}