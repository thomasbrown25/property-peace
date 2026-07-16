using brownstone_hub_api.Services.DailySummaryEmailService;

namespace brownstone_hub_api.Services.BackgroundServices
{
    public class DailySummaryEmailBackgroundService(
        IServiceProvider serviceProvider,
        ILogger<DailySummaryEmailBackgroundService> logger) : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider = serviceProvider;
        private readonly ILogger<DailySummaryEmailBackgroundService> _logger = logger;
        private readonly TimeSpan _checkInterval = TimeSpan.FromMinutes(15);

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("DailySummaryEmailBackgroundService started");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _serviceProvider.CreateScope();
                    var service = scope.ServiceProvider.GetRequiredService<IDailySummaryEmailService>();
                    await service.RunDueDailySummariesAsync(stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in DailySummaryEmailBackgroundService");
                }

                await Task.Delay(_checkInterval, stoppingToken);
            }
        }
    }
}
