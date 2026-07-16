namespace brownstone_hub_api.Models
{
    /// <summary>Links a listing to a property amenity (default or custom). Basic amenities (Parking, Laundry, AC) are in listing.ListingBasicAmenities.</summary>
    public class ListingAmenity
    {
        public long Id { get; set; }
        public long ListingId { get; set; }
        public Listing Listing { get; set; } = null!;

        public long? DefaultAmenityId { get; set; }
        public DefaultAmenity? DefaultAmenity { get; set; }
        
        public long? CustomAmenityId { get; set; }
        public CustomAmenity? CustomAmenity { get; set; }

        /// <summary>True when this amenity is selected for the listing; false when deselected or not selected.</summary>
        public bool IsAcquired { get; set; } = true;
    }
}
