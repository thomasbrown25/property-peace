using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace brownstone_hub_api.Services.Maintenance;

public sealed class MaintenanceTimelineProjectionWorker(
    IServiceScopeFactory scopes,
    TimeProvider clock,
    ILogger<MaintenanceTimelineProjectionWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopes.CreateScope();
                var projector = scope.ServiceProvider.GetRequiredService<IMaintenanceActivityService>();
                var attachments = scope.ServiceProvider.GetRequiredService<IMaintenanceAttachmentService>();
                await projector.ProjectPendingAsync(50, stoppingToken);
                await attachments.ProcessPendingLifecycleAsync(50, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Maintenance timeline outbox processing failed.");
            }

            try
            {
                await Task.Delay(TimeSpan.FromMinutes(1), clock, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }
}
