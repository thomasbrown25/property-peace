using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Listing
{
    public class CreateListingDto
    {
        public long PropertyId { get; set; }
        public long? UnitId { get; set; }

        // Property Details (all optional)
        public int? SquareFeet { get; set; }
        public decimal? MonthlyRent { get; set; }
        public decimal? SecurityDeposit { get; set; }
        public int? YearBuilt { get; set; }

        // Lease Details
        public DateTime? DateAvailable { get; set; }
        public string? MinLeaseDuration { get; set; }
        public string? MaxLeaseDuration { get; set; }
        public string? AdditionalLeaseTermsNotes { get; set; }

        // Pet Policy
        public bool? PetsAllowed { get; set; }

        // Marketing
        public string? MarketingDescription { get; set; }
        public string? VideoTourUrl { get; set; }

        // Application Settings
        public bool? AcceptOnlineApplications { get; set; }
        public bool? ApplicationFeeRequired { get; set; }
        public decimal? ApplicationFee { get; set; }

        // Screening & Verification
        public bool? RequireScreening { get; set; }
        public EScreeningType? ScreeningType { get; set; }
        public bool? RequireIncomeVerification { get; set; }
        public decimal? IncomeVerificationCost { get; set; }

        // Listing Contact
        public long? ListingContactId { get; set; }
        public string? ListingContactName { get; set; }
        public string? ListingContactPhone { get; set; }
        public string? ListingContactEmail { get; set; }

        // Syndication
        public bool? SyndicateToListingWebsite { get; set; }
        public bool? SyndicateToFreeSites { get; set; }
        public bool? SyndicateToPremiumSites { get; set; }

        // Amenities and Features
        public List<long>? BasicAmenityIds { get; set; }
        public List<long>? DefaultAmenityIds { get; set; }
        public List<long>? CustomAmenityIds { get; set; }
        public List<long>? DefaultFeatureIds { get; set; }
        public List<long>? CustomFeatureIds { get; set; }
    }
}
