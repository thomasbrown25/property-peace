namespace brownstone_hub_api.Dtos.KPIReports
{
    public class UnitsPerClientDto
    {
        public decimal AverageUnitsPerClient { get; set; }
        public int TotalClients { get; set; }
        public int TotalUnits { get; set; }
        public List<ClientDistributionDto>? ClientDistribution { get; set; }
        public List<TopClientDto>? TopClients { get; set; }
    }

    public class ClientDistributionDto
    {
        public string ClientName { get; set; } = string.Empty;
        public int Units { get; set; }
    }

    public class TopClientDto
    {
        public string ClientName { get; set; } = string.Empty;
        public int UnitCount { get; set; }
    }
}
