

namespace brownstone_hub_api.Dtos.Image
{
    public class AddImageDto
    {
        public long RefId { get; set; }
        public string BlobName { get; set; }
        public string BlobUrl { get; set; }
    }
}