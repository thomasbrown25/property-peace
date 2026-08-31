using brownstone_hub_api.Services.BackgroundServices;
using brownstone_hub_api.Services.Maintenance;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace property_peace_api.Tests.Services;

public class BackgroundServiceCancellationTests
{
    [Fact]
    public async Task StateDepositLawWorker_CompletesCleanly_WhenHostStopsDuringNormalDelay()
    {
        using var services = new ServiceCollection().BuildServiceProvider();
        var worker = new StateDepositLawUpdateBackgroundService(
            services,
            NullLogger<StateDepositLawUpdateBackgroundService>.Instance);

        await AssertStopsWithoutFaultAsync(worker);
    }

    [Fact]
    public async Task SubscriptionWorker_CompletesCleanly_WhenHostStopsDuringRetryDelay()
    {
        using var services = new ServiceCollection().BuildServiceProvider();
        var worker = new SubscriptionBackgroundService(
            services,
            NullLogger<SubscriptionBackgroundService>.Instance);

        await AssertStopsWithoutFaultAsync(worker);
    }

    [Fact]
    public async Task MaintenanceProjectionWorker_CompletesCleanly_WhenHostStopsDuringIterationDelay()
    {
        using var services = new ServiceCollection().BuildServiceProvider();
        var worker = new MaintenanceTimelineProjectionWorker(
            services.GetRequiredService<IServiceScopeFactory>(),
            TimeProvider.System,
            NullLogger<MaintenanceTimelineProjectionWorker>.Instance);

        await AssertStopsWithoutFaultAsync(worker);
    }

    private static async Task AssertStopsWithoutFaultAsync(BackgroundService worker)
    {
        await worker.StartAsync(CancellationToken.None);
        await worker.StopAsync(CancellationToken.None);

        Assert.NotNull(worker.ExecuteTask);
        await worker.ExecuteTask!;
    }
}
