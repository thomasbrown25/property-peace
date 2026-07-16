using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Models
{
    public class Listing
    {
        public long Id { get; set; }
        public long PropertyId { get; set; }
        public Property Property { get; set; } = null!;
        public long? UnitId { get; set; }
        public Unit? Unit { get; set; }

        public string? ListingNumber { get; set; }
        public EListingStatus Status { get; set; } = EListingStatus.Draft;

        // Property Details (nullable except set on create/update)
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
        public User? ListingContact { get; set; }
        public string? ListingContactName { get; set; }
        public string? ListingContactPhone { get; set; }
        public string? ListingContactEmail { get; set; }

        // Syndication
        public bool? SyndicateToListingWebsite { get; set; }
        public bool? SyndicateToFreeSites { get; set; }
        public bool? SyndicateToPremiumSites { get; set; }

        // URL
        public string? CustomListingUrl { get; set; }

        // Expiration
        public DateTime? ExpiresAt { get; set; }

        // Metadata (only PropertyId, Status, CreatedAt, CreatedBy are required in DB)
        public long? OrganizationId { get; set; }
        public Organization? Organization { get; set; }
        public long CreatedBy { get; set; }
        public User CreatedByUser { get; set; } = null!;
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }

        // Navigation
        public ICollection<ListingImage> Images { get; set; } = [];
        public ICollection<ListingBasicAmenity> ListingBasicAmenities { get; set; } = [];
        public ICollection<ListingAmenity> ListingAmenities { get; set; } = [];
        public ICollection<ListingFeature> ListingFeatures { get; set; } = [];
    }
}
