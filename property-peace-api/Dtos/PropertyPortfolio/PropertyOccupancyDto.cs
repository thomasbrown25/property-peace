namespace brownstone_hub_api.Dtos.PropertyPortfolio
{
    public class PropertyOccupancyDto
    {
        public decimal TotalVacancyCost { get; set; }
        public decimal AverageDaysVacant { get; set; }
        public decimal AverageTurnoverRate { get; set; }
        public int TotalTurnovers { get; set; }
        public List<VacancyCostByPropertyDto> VacancyCostByProperty { get; set; } = new();
        public List<TurnoverByPropertyDto> TurnoverByProperty { get; set; } = new();
        public List<RentPricingSuggestionDto> RentPricingSuggestions { get; set; } = new();
    }

    public class VacancyCostByPropertyDto
    {
        public long PropertyId { get; set; }
        public string PropertyName { get; set; } = string.Empty;
        public decimal VacancyCost { get; set; }
    }

    public class TurnoverByPropertyDto
    {
        public long PropertyId { get; set; }
        public string PropertyName { get; set; } = string.Empty;
        public int Turnovers { get; set; }
    }

    public class RentPricingSuggestionDto
    {
        public long PropertyId { get; set; }
        public string PropertyName { get; set; } = string.Empty;
        public long UnitId { get; set; }
        public string UnitName { get; set; } = string.Empty;
        public decimal CurrentRent { get; set; }
        public decimal SuggestedRent { get; set; }
        public string Reason { get; set; } = string.Empty;
    }
}

