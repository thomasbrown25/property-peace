namespace brownstone_hub_api.Dtos.Listing
{
    public class PublicListingSummaryDto
    {
        public string ListingNumber { get; set; } = "";
        /// <summary>URL path segment for the published listing page (e.g. 1317-shannon-house-drive-charlotte-nc-28215).</summary>
        public string Slug { get; set; } = "";
        public string PropertyName { get; set; } = "";
        public string PropertyAddress { get; set; } = "";
        public string? UnitName { get; set; }
        public decimal MonthlyRent { get; set; }
        public int? SquareFeet { get; set; }
        public string? Bedrooms { get; set; }
        public string? Baths { get; set; }
        public DateTime? DateAvailable { get; set; }
        public string? CoverPhotoUrl { get; set; }
    }
}
