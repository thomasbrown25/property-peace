namespace brownstone_hub_api.Models
{
    /// <summary>Links a listing to selected basic amenity options (Parking, Laundry, Air Conditioning). One row per selected option.</summary>
    public class ListingBasicAmenity
    {
        public long Id { get; set; }
        public long ListingId { get; set; }
        public Listing Listing { get; set; } = null!;
        public long BasicAmenityId { get; set; }
        public BasicAmenity BasicAmenity { get; set; } = null!;
    }
}
