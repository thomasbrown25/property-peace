using brownstone_hub_api.Dtos.Image;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Listing
{
    public class LoadListingDto
    {
        public long Id { get; set; }
        public long PropertyId { get; set; }
        public string PropertyName { get; set; } = "";
        public string PropertyAddress { get; set; } = "";
        public long? UnitId { get; set; }
        public string? UnitName { get; set; }
        
        public string ListingNumber { get; set; } = "";
        public EListingStatus Status { get; set; }
        
        // Property Details
        public int? SquareFeet { get; set; }
        public decimal MonthlyRent { get; set; }
        public decimal? SecurityDeposit { get; set; }
        public int? YearBuilt { get; set; }
        
        // Lease Details
        public DateTime? DateAvailable { get; set; }
        public string? MinLeaseDuration { get; set; }
        public string? MaxLeaseDuration { get; set; }
        public string? AdditionalLeaseTermsNotes { get; set; }
        
        // Pet Policy
        public bool PetsAllowed { get; set; }
        
        // Marketing
        public string MarketingDescription { get; set; } = "";
        public string? VideoTourUrl { get; set; }
        
        // Application Settings
        public bool AcceptOnlineApplications { get; set; }
        public bool ApplicationFeeRequired { get; set; }
        public decimal ApplicationFee { get; set; }
        
        // Screening & Verification
        public bool RequireScreening { get; set; }
        public EScreeningType ScreeningType { get; set; }
        public bool RequireIncomeVerification { get; set; }
        public decimal IncomeVerificationCost { get; set; }
        
        // Listing Contact
        public long? ListingContactId { get; set; }
        public string? ListingContactName { get; set; }
        public string? ListingContactPhone { get; set; }
        public string? ListingContactEmail { get; set; }
        
        // Syndication
        public bool SyndicateToListingWebsite { get; set; }
        public bool SyndicateToFreeSites { get; set; }
        public bool SyndicateToPremiumSites { get; set; }
        
        // URL
        public string CustomListingUrl { get; set; } = "";
        
        // Expiration
        public DateTime ExpiresAt { get; set; }
        
        // Metadata
        public long OrganizationId { get; set; }
        public long CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? PublishedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        
        // Related Data
        public List<LoadImageDto> Images { get; set; } = [];
        /// <summary>URL of the cover image for listing cards (first image with IsCoverPhoto, or first image).</summary>
        public string? CoverImageUrl { get; set; }
        public List<AmenityDto> BasicAmenities { get; set; } = [];
        public List<AmenityDto> PropertyAmenities { get; set; } = [];
        public List<AmenityDto> PropertyFeatures { get; set; } = [];
    }
    
    public class AmenityDto
    {
        public long Id { get; set; }
        public string Name { get; set; } = "";
        public EAmenityCategory Category { get; set; }
        public bool IsCustom { get; set; }
    }
}
