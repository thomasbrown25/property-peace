

namespace brownstone_hub_api.Dtos.Image
{
    public class LoadImageDto
    {
        public long Id { get; set; }
        public long RefId { get; set; }
        public string BlobName { get; set; }
        public string BlobUrl { get; set; }
        public DateTime CreatedAt { get; set; }
        /// <summary>True when this image is the listing's cover photo (used only for ListingImage).</summary>
        public bool IsCoverPhoto { get; set; }
    }
}