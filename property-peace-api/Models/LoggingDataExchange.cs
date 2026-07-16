

namespace brownstone_hub_api.Models
{
    public class LoggingDataExchange
    {
        public long Id { get; set; }
        public DateTime LogDate { get; set; } = DateTime.Now.ToLocalTime();
        public string? MessageSource { get; set; }
        public string? MessageTarget { get; set; }
        public string? MethodCall { get; set; }
        public string? MessagePayload { get; set; }
    }
}