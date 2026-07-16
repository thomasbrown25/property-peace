using brownstone_hub_api.Dtos.Image;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Listing
{
    public class PublicListingDto
    {
        /// <summary>Listing ID for linking to landlord portal (e.g. Owner Dashboard).</summary>
        public long? ListingId { get; set; }
        /// <summary>True when the current user is the listing owner (landlord) so the UI can show Owner Dashboard tab.</summary>
        public bool ShowOwnerDashboard { get; set; }

        public string ListingNumber { get; set; } = "";
        /// <summary>URL path segment for the published listing (e.g. 1317-shannon-house-drive-charlotte-nc-28215).</summary>
        public string Slug { get; set; } = "";
        public string PropertyName { get; set; } = "";
        public string PropertyAddress { get; set; } = "";
        public string? UnitName { get; set; }
        
        // Property Details
        public int? SquareFeet { get; set; }
        public decimal MonthlyRent { get; set; }
        public decimal? SecurityDeposit { get; set; }
        public int? YearBuilt { get; set; }
        public string? Bedrooms { get; set; }
        public string? Baths { get; set; }
        
        // Lease Details
        public DateTime? DateAvailable { get; set; }
        public string? MinLeaseDuration { get; set; }
        public string? MaxLeaseDuration { get; set; }
        
        // Pet Policy
        public bool PetsAllowed { get; set; }
        
        // Marketing
        public string MarketingDescription { get; set; } = "";
        public string? VideoTourUrl { get; set; }
        
        // Application Settings
        public bool AcceptOnlineApplications { get; set; }
        public bool ApplicationFeeRequired { get; set; }
        public decimal ApplicationFee { get; set; }
        
        // Listing Contact
        public string? ListingContactName { get; set; }
        public string? ListingContactPhone { get; set; }
        public string? ListingContactEmail { get; set; }
        
        // Images
        public List<LoadImageDto> Images { get; set; } = [];
        public LoadImageDto? CoverPhoto { get; set; }
        
        // Amenities
        public List<AmenityDto> BasicAmenities { get; set; } = [];
        public List<AmenityDto> PropertyAmenities { get; set; } = [];
        public List<AmenityDto> PropertyFeatures { get; set; } = [];
    }
}
