

namespace brownstone_hub_api.Models
{
    public class LoggingTrace
    {
        public long Id { get; set; }
        public DateTime LogDate { get; set; } = DateTime.Now.ToLocalTime();
        public string? Message { get; set; }
    }
}