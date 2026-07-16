using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Models
{
    /// <summary>Stores custom amenity/feature definitions (name, category) only. No IsAcquired—selection is tracked per listing via ListingAmenities and ListingFeatures.</summary>
    public class CustomAmenity
    {
        public long Id { get; set; }
        public string Name { get; set; } = "";
        public EAmenityCategory Category { get; set; } // PropertyAmenity or PropertyFeature
        public long OrganizationId { get; set; }
        public Organization Organization { get; set; } = null!;
        public long CreatedBy { get; set; }
        public User CreatedByUser { get; set; } = null!;
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}
