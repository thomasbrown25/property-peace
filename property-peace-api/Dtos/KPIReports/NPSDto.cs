namespace brownstone_hub_api.Dtos.KPIReports
{
    public class NPSDto
    {
        public int NPSScore { get; set; }
        public int Promoters { get; set; }
        public int Detractors { get; set; }
        public int Passives { get; set; }
        public int TotalResponses { get; set; }
        public List<NPSHistoryDto>? NPSHistory { get; set; }
    }

    public class NPSHistoryDto
    {
        public string Period { get; set; } = string.Empty;
        public int NPSScore { get; set; }
        public int Promoters { get; set; }
        public int Detractors { get; set; }
    }

    public class PromoterBreakdownDto
    {
        public string Category { get; set; } = string.Empty;
        public int Promoters { get; set; }
        public int Detractors { get; set; }
    }

    public class SatisfactionBreakdownDto
    {
        public string Category { get; set; } = string.Empty;
        public int Promoters { get; set; }
        public int Detractors { get; set; }
    }
}
