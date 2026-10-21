using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace brownstone_hub_api.Services.ShortStay;

// Intentionally opt-in only after connected-account sandbox acceptance.
public sealed class ShortStayPendingRecoveryWorker(IServiceScopeFactory scopes, IConfiguration config,
    ILogger<ShortStayPendingRecoveryWorker> logger) : BackgroundService
{
    public static bool Enabled(IConfiguration configuration) =>
        string.Equals(configuration["ShortStayBooking:PendingRecoveryEnabled"], "true", StringComparison.OrdinalIgnoreCase);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!Enabled(config)) return;
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<ShortStayPendingRecoveryService>()
                    .RunBatchAsync(10, stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogWarning("Short-stay pending recovery batch deferred ({ErrorType})", ex.GetType().Name);
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
