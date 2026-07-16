using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.TimeBreak
{
    public class UpdateTimeBreakDto
    {
        public long Id { get; set; }
        public ETimeBreakType BreakType { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime? EndTime { get; set; }
        public string? Notes { get; set; }
    }
}
