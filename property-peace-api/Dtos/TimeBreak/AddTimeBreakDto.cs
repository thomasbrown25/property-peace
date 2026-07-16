using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.TimeBreak
{
    public class AddTimeBreakDto
    {
        public long TimeEntryId { get; set; }
        public ETimeBreakType BreakType { get; set; } = ETimeBreakType.Other;
        public DateTime StartTime { get; set; }
        public DateTime? EndTime { get; set; }
        public string? Notes { get; set; }
    }
}
