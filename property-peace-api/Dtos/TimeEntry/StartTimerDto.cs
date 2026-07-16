namespace brownstone_hub_api.Dtos.TimeEntry
{
    public class StartTimerDto
    {
        public long PropertyId { get; set; }
        public long? MaintenanceRequestId { get; set; }
        public long? UnitId { get; set; }
        public string Description { get; set; } = string.Empty;
    }
}
