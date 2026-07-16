namespace brownstone_hub_api.Dtos.Property
{
    public class PropertyRecordPrefillDto
    {
        public int? Bedrooms { get; set; }
        public decimal? Bathrooms { get; set; }
        public int? SquareFootage { get; set; }
        public int? YearBuilt { get; set; }
        public string? PropertyType { get; set; }
        public string? FormattedAddress { get; set; }
        public string Source { get; set; } = "Rentcast";
    }
}
