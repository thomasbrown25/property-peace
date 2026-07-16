using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.TimeEntry
{
    public class UpdateTimeEntryDto
    {
        public long Id { get; set; }
        public long PropertyId { get; set; }
        public long? MaintenanceRequestId { get; set; }
        public long? UnitId { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime? EndTime { get; set; }
        public decimal? HoursWorked { get; set; }
        public bool IsBillable { get; set; } = true;
        public string Description { get; set; } = string.Empty;
        public string? Notes { get; set; }
        public ETimeEntryStatus Status { get; set; }
    }
}
