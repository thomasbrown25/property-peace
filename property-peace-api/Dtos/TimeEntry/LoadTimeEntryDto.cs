using brownstone_hub_api.Dtos.TimeBreak;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.TimeEntry
{
    public class LoadTimeEntryDto
    {
        public long Id { get; set; }
        public long StaffMemberId { get; set; }
        public string StaffMemberName { get; set; } = string.Empty;
        public string StaffMemberEmail { get; set; } = string.Empty;
        public long PropertyId { get; set; }
        public string PropertyName { get; set; } = string.Empty;
        public long? MaintenanceRequestId { get; set; }
        public string? MaintenanceRequestTitle { get; set; }
        public long? UnitId { get; set; }
        public string? UnitName { get; set; }
        public long OrganizationId { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime? EndTime { get; set; }
        public decimal? HoursWorked { get; set; }
        public decimal? BreakHours { get; set; }
        public bool IsBillable { get; set; }
        public string Description { get; set; } = string.Empty;
        public string? Notes { get; set; }
        public ETimeEntryStatus Status { get; set; }
        public long? ApprovedById { get; set; }
        public string? ApprovedByName { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public string? RejectionReason { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public List<LoadTimeBreakDto> Breaks { get; set; } = [];
    }
}
