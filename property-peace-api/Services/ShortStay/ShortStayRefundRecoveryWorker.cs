using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace brownstone_hub_api.Services.ShortStay;

// Opt-in only after sandbox acceptance; missing/malformed configuration is closed.
public sealed class ShortStayRefundRecoveryWorker(IServiceScopeFactory scopes, IConfiguration configuration,
    ILogger<ShortStayRefundRecoveryWorker> logger) : BackgroundService
{
    public static bool Enabled(IConfiguration config) =>
        string.Equals(config["ShortStayBooking:RefundRecoveryEnabled"], "true", StringComparison.OrdinalIgnoreCase);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!Enabled(configuration)) return;
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<ShortStayRefundRecoveryService>()
                    .RunBatchAsync(10, stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogWarning("Short-stay refund recovery batch deferred ({ErrorType})", ex.GetType().Name);
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
