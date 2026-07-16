namespace brownstone_hub_api.Dtos.RentEstimate
{
    public class RentEstimateDto
    {
        public decimal? RentEstimate { get; set; }
        public decimal? RentRangeLow { get; set; }
        public decimal? RentRangeHigh { get; set; }
        public List<RentEstimateComparableDto> Comparables { get; set; } = [];
        public bool IsFromCache { get; set; }
        public DateTime? CachedAt { get; set; }
    }
}
