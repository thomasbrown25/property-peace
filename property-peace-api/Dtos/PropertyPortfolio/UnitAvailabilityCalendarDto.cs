namespace brownstone_hub_api.Dtos.PropertyPortfolio
{
    public class UnitAvailabilityCalendarDto
    {
        public List<UnitAvailabilityDto> Units { get; set; } = new();
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
    }

    public class UnitAvailabilityDto
    {
        public long UnitId { get; set; }
        public string UnitName { get; set; } = string.Empty;
        public long PropertyId { get; set; }
        public string PropertyName { get; set; } = string.Empty;
        public List<AvailabilityPeriodDto> AvailabilityPeriods { get; set; } = new();
        public List<LeasePeriodDto> LeasePeriods { get; set; } = new();
    }

    public class AvailabilityPeriodDto
    {
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public bool IsVacant { get; set; }
        public string Status { get; set; } = string.Empty; // "Vacant", "Occupied", "Upcoming"
    }

    public class LeasePeriodDto
    {
        public long LeaseId { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public bool IsActive { get; set; }
        public decimal RentAmount { get; set; }
        public string TenantNames { get; set; } = string.Empty;
        /// <summary>Day of month rent is due (1-31), or null if not set.</summary>
        public int? RentDueDay { get; set; }
    }
}

