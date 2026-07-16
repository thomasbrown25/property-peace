namespace brownstone_hub_api.Dtos.KPIReports
{
    public class ClosingRateDto
    {
        public decimal ClosingRate { get; set; }
        public int WonCustomers { get; set; }
        public int TotalLeads { get; set; }
        public List<ClosingRateHistoryDto>? ClosingRateHistory { get; set; }
        public List<ConversionBySourceDto>? ConversionBySource { get; set; }
    }

    public class ClosingRateHistoryDto
    {
        public string Period { get; set; } = string.Empty;
        public decimal ClosingRate { get; set; }
        public int WonCustomers { get; set; }
        public int TotalLeads { get; set; }
    }

    public class ConversionBySourceDto
    {
        public string Source { get; set; } = string.Empty;
        public decimal ConversionRate { get; set; }
        public int WonCustomers { get; set; }
        public int TotalLeads { get; set; }
    }
}
