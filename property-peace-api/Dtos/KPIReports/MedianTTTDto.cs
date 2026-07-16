namespace brownstone_hub_api.Dtos.KPIReports
{
    public class MedianTTTDto
    {
        public int MedianTTT { get; set; }
        public decimal AverageTTT { get; set; }
        public int TotalTurnovers { get; set; }
        public List<TTTByPropertyDto>? TTTByProperty { get; set; }
    }

    public class TTTByPropertyDto
    {
        public long PropertyId { get; set; }
        public string PropertyName { get; set; } = string.Empty;
        public int TTT { get; set; }
        public int Turnovers { get; set; }
    }
}
