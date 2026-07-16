namespace brownstone_hub_api.Dtos.KPIReports
{
    public class OccupancyReportDto
    {
        public decimal OccupancyRate { get; set; }
        public decimal VacancyRate { get; set; }
        public int OccupiedUnits { get; set; }
        public int VacantUnits { get; set; }
        public int TotalUnits { get; set; }
        public List<OccupancyByPropertyDto>? OccupancyByProperty { get; set; }
        public List<OccupancyHistoryDto>? OccupancyHistory { get; set; }
    }

    public class OccupancyByPropertyDto
    {
        public long PropertyId { get; set; }
        public string PropertyName { get; set; } = string.Empty;
        public decimal OccupancyRate { get; set; }
        public int OccupiedUnits { get; set; }
        public int TotalUnits { get; set; }
    }

    public class OccupancyHistoryDto
    {
        public string Month { get; set; } = string.Empty;
        public decimal OccupancyRate { get; set; }
        public int OccupiedUnits { get; set; }
        public int TotalUnits { get; set; }
    }
}
