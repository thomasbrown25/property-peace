using brownstone_hub_api.Data;

namespace brownstone_hub_api.Services.LoggingService
{
    public class LoggingService(DataContext context, IConfiguration configuration) : ILoggingService
    {
        private readonly DataContext _context = context;
        private readonly IConfiguration _configuration = configuration;

        public void LogTrace(string message)
        {
            bool.TryParse(_configuration["Logging.TraceLogs.Enabled"], out bool loggingEnabled);

            if (loggingEnabled)
            {
                LoggingTrace log = new()
                {
                    Message = message
                };

                _context.LoggingTrace.Add(log);
                _context.SaveChanges();
            }
        }

        public void LogException(Exception? exception)
        {
            bool.TryParse(_configuration["Logging.ExceptionLogs.Enabled"], out bool loggingEnabled);

            if (loggingEnabled)
            {
                LoggingException log = new()
                {
                    ExceptionMessage = exception?.Message,
                    ExceptionStackTrace = exception?.StackTrace,
                    InnerExceptionMessage = exception?.InnerException?.Message,
                    InnerExceptionStackTrace = exception?.InnerException?.StackTrace
                };

                _context.LoggingException.Add(log);
                _context.SaveChanges();
            }
        }

        public void LogDataExchange(string messageSource, string messageTarget, string methodCall, string messagePayload)
        {
            bool.TryParse(_configuration["Logging.DataExchangeLogs.Enabled"], out bool loggingEnabled);

            if (loggingEnabled)
            {
                LoggingDataExchange log = new()
                {
                    MessageSource = messageSource,
                    MessageTarget = messageTarget,
                    MethodCall = methodCall,
                    MessagePayload = messagePayload
                };

                _context.LoggingDataExchange.Add(log);
                _context.SaveChanges();
            }
        }
    }
}