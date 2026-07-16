

namespace brownstone_hub_api.Models
{
    public class LoggingException
    {
        public long Id { get; set; }
        public DateTime LogDate { get; set; } = DateTime.Now.ToLocalTime();
        public string? ExceptionMessage { get; set; }
        public string? ExceptionStackTrace { get; set; }
        public string? InnerExceptionMessage { get; set; }
        public string? InnerExceptionStackTrace { get; set; }
        public string? ExceptionType { get; set; }
        public string? CallingMethod { get; set; }
        public string? CallingAssemblyInfo { get; set; }
    }
}