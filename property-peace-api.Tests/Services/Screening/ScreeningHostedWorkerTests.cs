using brownstone_hub_api.Data;
using brownstone_hub_api.Services.Screening;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Screening;

public sealed class ScreeningHostedWorkerTests
{
    [Fact]
    public void Fail_closed_graph_registers_all_workers_but_defaults_to_no_database_access()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDbContext<DataContext>(options => options.UseInMemoryDatabase(Guid.NewGuid().ToString()));
        services.AddFailClosedTenantScreening();

        using var provider = services.BuildServiceProvider(new ServiceProviderOptions { ValidateOnBuild = true, ValidateScopes = true });
        var workers = provider.GetServices<IHostedService>().ToArray();
        var options = provider.GetRequiredService<IOptions<ScreeningHostedWorkerOptions>>().Value;

        workers.Should().ContainSingle(x => x is ScreeningWebhookInboxBackgroundService);
        workers.Should().ContainSingle(x => x is ScreeningProviderPollingBackgroundService);
        workers.Should().ContainSingle(x => x is ScreeningAdverseActionDeliveryBackgroundService);
        workers.Should().ContainSingle(x => x is ScreeningRetentionBackgroundService);
        workers.Should().ContainSingle(x => x is ScreeningCancellationRecoveryBackgroundService);
        workers.Should().ContainSingle(x => x is ScreeningReportAccessRecoveryBackgroundService);
        options.Enabled.Should().BeFalse();
        options.DatabaseSchemaAvailable.Should().BeFalse();
        options.CanRun.Should().BeFalse("pre-migration startup must not query screening tables");
    }

    [Fact]
    public async Task Default_disabled_workers_start_and_stop_without_resolving_a_DataContext()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddScoped<DataContext>(_ => throw new InvalidOperationException("screening tables must not be touched"));
        services.AddFailClosedTenantScreening();
        using var provider = services.BuildServiceProvider();

        foreach (var worker in provider.GetServices<IHostedService>())
        {
            await worker.StartAsync(CancellationToken.None);
            await worker.StopAsync(CancellationToken.None);
        }
    }

    [Theory]
    [InlineData(0, 30, 60, 300)]
    [InlineData(501, 30, 60, 300)]
    [InlineData(25, 0, 60, 300)]
    [InlineData(25, 30, 0, 300)]
    [InlineData(25, 30, 60, 0)]
    public void Options_validation_rejects_unbounded_or_nonpositive_values(
        int batchSize, int cycleSeconds, int leaseSeconds, int maximumBackoffSeconds)
    {
        var options = new ScreeningHostedWorkerOptions
        {
            BatchSize = batchSize,
            CycleInterval = TimeSpan.FromSeconds(cycleSeconds),
            WebhookLeaseDuration = TimeSpan.FromSeconds(leaseSeconds),
            MaximumFailureBackoff = TimeSpan.FromSeconds(maximumBackoffSeconds)
        };

        ScreeningHostedWorkerOptions.Validate(options).Should().NotBeNullOrEmpty();
    }

    [Fact]
    public void Obsolete_schema_flag_is_ignored_because_startup_checks_EF_migration_history()
    {
        new ScreeningHostedWorkerOptions { Enabled = true, WebhookInboxEnabled = true }
            .CanRun.Should().BeTrue();
        new ScreeningHostedWorkerOptions
        {
            Enabled = true,
            DatabaseSchemaAvailable = true,
            WebhookInboxEnabled = true
        }.CanRun.Should().BeTrue();
    }

    [Fact]
    public async Task Stale_report_access_worker_uses_the_service_contract_and_never_directly_mutates_audits()
    {
        var screening = new Mock<ITenantScreeningDecisionService>(MockBehavior.Strict);
        screening.Setup(x => x.RecoverStaleReportAccessAttemptsAsync(7, TimeSpan.FromMinutes(9), default))
            .ReturnsAsync(1);
        var cycle = new ScreeningReportAccessRecoveryCycle(screening.Object,
            Options.Create(new ScreeningHostedWorkerOptions { ReportAccessStaleAge = TimeSpan.FromMinutes(9) }));

        await cycle.RunAsync(7, default);

        screening.VerifyAll();
    }
}
