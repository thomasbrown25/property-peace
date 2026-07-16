namespace brownstone_hub_api.Dtos.TimeEntry
{
    public class AddTimeEntryDto
    {
        public long StaffMemberId { get; set; }
        public long PropertyId { get; set; }
        public long? MaintenanceRequestId { get; set; }
        public long? UnitId { get; set; }
        public long OrganizationId { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime? EndTime { get; set; }
        public decimal? HoursWorked { get; set; }
        public bool IsBillable { get; set; } = true;
        public string Description { get; set; } = string.Empty;
        public string? Notes { get; set; }
    }
}
