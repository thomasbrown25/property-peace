using brownstone_hub_api.Shared;

namespace brownstone_hub_api.Models
{
    public class ListingImage : IImageEntity
    {
        public long Id { get; set; }
        public string BlobName { get; set; } = "";
        public string BlobUrl { get; set; } = "";
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        
        public long RefId { get; set; } // ListingId
        public Listing Listing { get; set; } = null!;
        
        public bool IsCoverPhoto { get; set; } = false;
        public int DisplayOrder { get; set; } = 0;
    }
}
