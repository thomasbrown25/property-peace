namespace brownstone_hub_api.Services.AgentFollowUpService
{
    /// <summary>
    /// Runs the AI overdue-rent follow-up sweep once daily at 9:00 AM.
    /// </summary>
    public class AgentFollowUpBackgroundService(
        IServiceProvider serviceProvider,
        ILogger<AgentFollowUpBackgroundService> logger) : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider = serviceProvider;
        private readonly ILogger<AgentFollowUpBackgroundService> _logger = logger;

        private DateTime _lastRunDate = DateTime.MinValue;

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("AI Follow-Up Background Service started. Will run daily at 9:00 AM.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var now = DateTime.Now;

                    if (now.Hour == 9 && now.Minute < 5 && _lastRunDate.Date != now.Date)
                    {
                        _logger.LogInformation("Starting AI follow-up agent sweep at {Time}", now);

                        using var scope = _serviceProvider.CreateScope();
                        var agentService = scope.ServiceProvider.GetRequiredService<IAgentFollowUpService>();
                        await agentService.RunOverdueRentSweepAsync(stoppingToken);

                        _lastRunDate = now.Date;
                        _logger.LogInformation("AI follow-up agent sweep completed at {Time}", DateTime.Now);
                    }

                    await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in AI follow-up background service");
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

            _logger.LogInformation("AI Follow-Up Background Service stopped.");
        }
    }
}
