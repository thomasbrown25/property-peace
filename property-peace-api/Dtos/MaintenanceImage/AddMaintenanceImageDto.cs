
namespace brownstone_hub_api.Dtos.MaintenanceImage
{
    public class AddMaintenanceImageDto
    {
        public long MaintenanceRequestId { get; set; }
        public string BlobName { get; set; }
        public string BlobUrl { get; set; }
    }
}