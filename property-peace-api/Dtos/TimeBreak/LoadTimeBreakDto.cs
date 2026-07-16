using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.TimeBreak
{
    public class LoadTimeBreakDto
    {
        public long Id { get; set; }
        public long TimeEntryId { get; set; }
        public ETimeBreakType BreakType { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime? EndTime { get; set; }
        public decimal? DurationHours { get; set; }
        public string? Notes { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
