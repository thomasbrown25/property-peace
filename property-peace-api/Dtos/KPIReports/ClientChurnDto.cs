namespace brownstone_hub_api.Dtos.KPIReports
{
    public class ClientChurnDto
    {
        public decimal ChurnRate { get; set; }
        public int UnitsLost { get; set; }
        public int UnitsStartedWith { get; set; }
        public List<ChurnHistoryDto>? ChurnHistory { get; set; }
        public List<ChurnReasonDto>? ChurnReasons { get; set; }
    }

    public class ChurnHistoryDto
    {
        public string Period { get; set; } = string.Empty;
        public decimal ChurnRate { get; set; }
        public int UnitsLost { get; set; }
    }

    public class ChurnReasonDto
    {
        public string Reason { get; set; } = string.Empty;
        public int Count { get; set; }
    }
}
