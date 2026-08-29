namespace brownstone_hub_api.Services.LeaseChecklistSchedulingService
{
    /// <summary>Runs lease start-date checklist processing once daily.</summary>
    public class LeaseChecklistSchedulingBackgroundService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<LeaseChecklistSchedulingBackgroundService> _logger;

        public LeaseChecklistSchedulingBackgroundService(
            IServiceProvider serviceProvider,
            ILogger<LeaseChecklistSchedulingBackgroundService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation(
                "Lease Checklist Scheduling Background Service started. Will run daily at 1:05 AM.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var now = DateTime.Now;
                    if (now.Hour == 1 && now.Minute >= 5 && now.Minute < 10)
                    {
                        using var scope = _serviceProvider.CreateScope();
                        var service = scope.ServiceProvider
                            .GetRequiredService<ILeaseChecklistSchedulingService>();
                        await service.ProcessDueChecklistsAsync();
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
                    _logger.LogError(ex, "Error in lease checklist scheduling background service");
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

            _logger.LogInformation("Lease Checklist Scheduling Background Service stopped");
        }
    }
}
