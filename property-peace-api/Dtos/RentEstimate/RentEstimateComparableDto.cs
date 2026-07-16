namespace brownstone_hub_api.Dtos.RentEstimate
{
    public class RentEstimateComparableDto
    {
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public decimal? Price { get; set; }
        public string? Bedrooms { get; set; }
        public string? Bathrooms { get; set; }
        public int? SquareFeet { get; set; }
        public double? DistanceMiles { get; set; }
        public string? ListedDate { get; set; }
    }
}
