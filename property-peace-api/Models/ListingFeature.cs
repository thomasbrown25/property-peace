namespace brownstone_hub_api.Models
{
    /// <summary>Links a listing to a feature (default or custom). Stored in listing.ListingFeatures. Only listing-level—not property-level.</summary>
    public class ListingFeature
    {
        public long Id { get; set; }
        public long ListingId { get; set; }
        public Listing Listing { get; set; } = null!;

        public long? DefaultFeatureId { get; set; }
        public DefaultFeature? DefaultFeature { get; set; }

        public long? CustomFeatureId { get; set; }
        public CustomFeature? CustomFeature { get; set; }

        /// <summary>True when this feature is selected for the listing; false when deselected or not selected.</summary>
        public bool IsAcquired { get; set; } = true;
    }
}
