using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Models
{
    public class TimeBreak
    {
        public long Id { get; set; }
        
        // Time entry this break belongs to
        public long TimeEntryId { get; set; }
        public TimeEntry TimeEntry { get; set; } = null!;
        
        // Break information
        public ETimeBreakType BreakType { get; set; } = ETimeBreakType.Other;
        public DateTime StartTime { get; set; }
        public DateTime? EndTime { get; set; }
        public decimal? DurationHours { get; set; } // Calculated duration in hours
        public string? Notes { get; set; }
        
        // Timestamps
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
