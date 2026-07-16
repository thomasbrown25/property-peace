namespace brownstone_hub_api.Dtos.PropertyPortfolio
{
    public class PropertyPortfolioAnalyticsDto
    {
        public decimal AverageROI { get; set; }
        public decimal VacancyRate { get; set; }
        public decimal OccupancyRate { get; set; }
        public decimal TotalMarketValue { get; set; }
        public List<PropertyROIDto> PropertyROI { get; set; } = new();
        public List<OccupancyHistoryDto> OccupancyHistory { get; set; } = new();
        public List<PropertyPerformanceDto> PropertyPerformance { get; set; } = new();
        public List<MarketValueHistoryDto> MarketValueHistory { get; set; } = new();
    }

    public class PropertyROIDto
    {
        public long PropertyId { get; set; }
        public string PropertyName { get; set; } = string.Empty;
        public decimal ROI { get; set; }
    }

    public class OccupancyHistoryDto
    {
        public string Month { get; set; } = string.Empty;
        public decimal OccupancyRate { get; set; }
    }

    public class PropertyPerformanceDto
    {
        public long PropertyId { get; set; }
        public string PropertyName { get; set; } = string.Empty;
        public decimal Income { get; set; }
        public decimal Expenses { get; set; }
        public decimal ROI { get; set; }
    }

    public class MarketValueHistoryDto
    {
        public string Date { get; set; } = string.Empty;
        public decimal MarketValue { get; set; }
    }
}

