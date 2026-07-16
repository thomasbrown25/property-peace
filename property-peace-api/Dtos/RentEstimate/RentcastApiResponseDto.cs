using System.Text.Json.Serialization;

namespace brownstone_hub_api.Dtos.RentEstimate
{
    // Internal DTO — maps directly from Rentcast API response shape
    public class RentcastApiResponseDto
    {
        [JsonPropertyName("rent")]
        public decimal? Rent { get; set; }

        [JsonPropertyName("rentRangeLow")]
        public decimal? RentRangeLow { get; set; }

        [JsonPropertyName("rentRangeHigh")]
        public decimal? RentRangeHigh { get; set; }

        [JsonPropertyName("comparables")]
        public List<RentcastComparableDto>? Comparables { get; set; }
    }

    public class RentcastComparableDto
    {
        [JsonPropertyName("formattedAddress")]
        public string? FormattedAddress { get; set; }

        [JsonPropertyName("city")]
        public string? City { get; set; }

        [JsonPropertyName("state")]
        public string? State { get; set; }

        [JsonPropertyName("price")]
        public decimal? Price { get; set; }

        [JsonPropertyName("bedrooms")]
        public int? Bedrooms { get; set; }

        [JsonPropertyName("bathrooms")]
        public decimal? Bathrooms { get; set; }

        [JsonPropertyName("squareFootage")]
        public int? SquareFootage { get; set; }

        [JsonPropertyName("distance")]
        public double? Distance { get; set; }

        [JsonPropertyName("listedDate")]
        public string? ListedDate { get; set; }
    }
}
