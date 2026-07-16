namespace brownstone_hub_api.Dtos.KPIReports
{
    public class RevenuePerUnitDto
    {
        public decimal AverageRPU { get; set; }
        public decimal TotalRevenue { get; set; }
        public int TotalUnits { get; set; }
        public List<RPUByPropertyDto>? RPUByProperty { get; set; }
        public List<RPUHistoryDto>? RPUHistory { get; set; }
    }

    public class RPUByPropertyDto
    {
        public long PropertyId { get; set; }
        public string PropertyName { get; set; } = string.Empty;
        public decimal RPU { get; set; }
        public decimal TotalRevenue { get; set; }
        public int UnitCount { get; set; }
    }

    public class RPUHistoryDto
    {
        public string Month { get; set; } = string.Empty;
        public decimal RPU { get; set; }
        public decimal TotalRevenue { get; set; }
        public int UnitCount { get; set; }
    }
}
