namespace brownstone_hub_api.Dtos.KPIReports
{
    public class MedianDOMDto
    {
        public int MedianDOM { get; set; }
        public decimal AverageDOM { get; set; }
        public int TotalUnitsLeased { get; set; }
        public List<DOMByPropertyDto>? DOMByProperty { get; set; }
    }

    public class DOMByPropertyDto
    {
        public long PropertyId { get; set; }
        public string PropertyName { get; set; } = string.Empty;
        public int DOM { get; set; }
        public int UnitsLeased { get; set; }
    }
}
