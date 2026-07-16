using brownstone_hub_api.Data;
using brownstone_hub_api.Services.LoggingService;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace brownstone_hub_api.Services.HealthService
{
    public class HealthService(ILoggingService loggingService, IConfiguration configuration) : IHealthCheck
    {
        private readonly ILoggingService _loggingService = loggingService;
        private readonly IConfiguration _configuration = configuration;

        public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
        {
            _loggingService.LogTrace("Health Check Succeeded");

            return Task.FromResult(HealthCheckResult.Healthy("A healthy result."));
        }

    }
}