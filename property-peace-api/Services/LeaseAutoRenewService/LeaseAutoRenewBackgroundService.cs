using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace brownstone_hub_api.Services.LeaseAutoRenewService
{
    /// <summary>
    /// Runs lease auto-renew processing once daily (e.g. 1:00 AM).
    /// </summary>
    public class LeaseAutoRenewBackgroundService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<LeaseAutoRenewBackgroundService> _logger;

        public LeaseAutoRenewBackgroundService(
            IServiceProvider serviceProvider,
            ILogger<LeaseAutoRenewBackgroundService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Lease Auto-Renew Background Service started. Will run daily at 1:00 AM.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var now = DateTime.Now;
                    if (now.Hour == 1 && now.Minute < 5)
                    {
                        _logger.LogInformation("Starting lease auto-renew processing at {Time}", now);
                        using (var scope = _serviceProvider.CreateScope())
                        {
                            var autoRenewService = scope.ServiceProvider.GetRequiredService<ILeaseAutoRenewService>();
                            await autoRenewService.ProcessAutoRenewalsAsync();
                        }
                        await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
                    }
                    await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in lease auto-renew background service");
                    try
                    {
                        await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
                    }
                    catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                    {
                        break;
                    }
                }
            }

            _logger.LogInformation("Lease Auto-Renew Background Service stopped");
        }
    }
}
