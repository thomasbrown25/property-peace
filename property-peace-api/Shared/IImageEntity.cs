
namespace brownstone_hub_api.Shared
{
    public interface IImageEntity
    {
        public long Id { get; set; }
        public string BlobName { get; set; }
        public string BlobUrl { get; set; }
        public long RefId { get; set; }
    }
}