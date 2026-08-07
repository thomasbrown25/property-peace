using brownstone_hub_api.Data;
using brownstone_hub_api.Domain.Screening;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace brownstone_hub_api.Services.Screening;

/// <summary>
/// Fail-closed controls for screening maintenance workers. <see cref="Enabled"/> must be explicitly
/// true before any worker creates a scope; schema readiness is then derived from EF migration history.
/// </summary>
public sealed class ScreeningHostedWorkerOptions
{
    public const string SectionName = "Screening:HostedWorkers";

    public bool Enabled { get; set; }
    [Obsolete("Schema readiness is derived from applied EF migrations; retained only for configuration compatibility.")]
    public bool DatabaseSchemaAvailable { get; set; }
    public bool WebhookInboxEnabled { get; set; }
    public bool ProviderPollingEnabled { get; set; }
    public bool AdverseActionDeliveryEnabled { get; set; }
    public bool RetentionEnabled { get; set; }
    public bool CancellationRecoveryEnabled { get; set; }
    public bool DisputeRecoveryEnabled { get; set; }
    public bool ReportAccessRecoveryEnabled { get; set; }
    public int BatchSize { get; set; } = 25;
    public TimeSpan CycleInterval { get; set; } = TimeSpan.FromMinutes(1);
    public TimeSpan WebhookLeaseDuration { get; set; } = TimeSpan.FromMinutes(2);
    public TimeSpan CancellationLeaseDuration { get; set; } = TimeSpan.FromMinutes(2);
    public TimeSpan DisputeLeaseDuration { get; set; } = TimeSpan.FromMinutes(2);
    public TimeSpan AdverseActionLeaseDuration { get; set; } = TimeSpan.FromMinutes(2);
    public TimeSpan AdverseActionRetryAge { get; set; } = TimeSpan.FromMinutes(5);
    public int CancellationMaximumAttempts { get; set; } = 5;
    public int DisputeMaximumAttempts { get; set; } = 5;
    public int AdverseActionMaximumAttempts { get; set; } = 5;
    public TimeSpan RetryBaseDelay { get; set; } = TimeSpan.FromMinutes(1);
    public TimeSpan RetryMaximumDelay { get; set; } = TimeSpan.FromHours(1);
    public TimeSpan ReportAccessStaleAge { get; set; } = TimeSpan.FromMinutes(5);
    public TimeSpan FailureBackoff { get; set; } = TimeSpan.FromSeconds(30);
    public TimeSpan MaximumFailureBackoff { get; set; } = TimeSpan.FromMinutes(15);

    [Obsolete("Use Enabled; schema readiness is checked against applied EF migrations at worker startup.")]
    public bool CanRun => Enabled;

    public static string? Validate(ScreeningHostedWorkerOptions options)
    {
        if (options.BatchSize is < 1 or > 500) return "BatchSize must be between 1 and 500.";
        if (!InRange(options.CycleInterval, TimeSpan.FromSeconds(1), TimeSpan.FromDays(1))) return "CycleInterval must be between one second and one day.";
        if (!InRange(options.WebhookLeaseDuration, TimeSpan.FromSeconds(1), TimeSpan.FromHours(1))) return "WebhookLeaseDuration must be between one second and one hour.";
        if (!InRange(options.CancellationLeaseDuration, TimeSpan.FromSeconds(1), TimeSpan.FromHours(1))) return "CancellationLeaseDuration must be between one second and one hour.";
        if (!InRange(options.DisputeLeaseDuration, TimeSpan.FromSeconds(1), TimeSpan.FromHours(1))) return "DisputeLeaseDuration must be between one second and one hour.";
        if (!InRange(options.AdverseActionLeaseDuration, TimeSpan.FromSeconds(1), TimeSpan.FromHours(1))) return "AdverseActionLeaseDuration must be between one second and one hour.";
        if (options.CancellationMaximumAttempts is < 1 or > 100 || options.DisputeMaximumAttempts is < 1 or > 100 ||
            options.AdverseActionMaximumAttempts is < 1 or > 100) return "Screening retry maximum attempts must be between 1 and 100.";
        if (!InRange(options.RetryBaseDelay, TimeSpan.FromSeconds(1), TimeSpan.FromDays(1))) return "RetryBaseDelay must be between one second and one day.";
        if (!InRange(options.RetryMaximumDelay, options.RetryBaseDelay, TimeSpan.FromDays(7))) return "RetryMaximumDelay must be at least RetryBaseDelay and no more than seven days.";
        if (!InRange(options.AdverseActionRetryAge, TimeSpan.FromSeconds(1), TimeSpan.FromDays(7))) return "AdverseActionRetryAge must be between one second and seven days.";
        if (!InRange(options.ReportAccessStaleAge, TimeSpan.FromMinutes(1), TimeSpan.FromDays(1))) return "ReportAccessStaleAge must be between one minute and one day.";
        if (!InRange(options.FailureBackoff, TimeSpan.FromSeconds(1), TimeSpan.FromDays(1))) return "FailureBackoff must be between one second and one day.";
        if (!InRange(options.MaximumFailureBackoff, options.FailureBackoff, TimeSpan.FromDays(1))) return "MaximumFailureBackoff must be at least FailureBackoff and no more than one day.";
        return null;
    }

    private static bool InRange(TimeSpan value, TimeSpan minimum, TimeSpan maximum) => value >= minimum && value <= maximum;

    internal TimeSpan RetryDelay(int attempts)
    {
        var exponent = Math.Clamp(attempts - 1, 0, 30);
        var ticks = RetryBaseDelay.Ticks;
        for (var i = 0; i < exponent && ticks < RetryMaximumDelay.Ticks; i++)
            ticks = Math.Min(RetryMaximumDelay.Ticks, ticks > long.MaxValue / 2 ? long.MaxValue : ticks * 2);
        return TimeSpan.FromTicks(Math.Min(ticks, RetryMaximumDelay.Ticks));
    }
}

internal interface IScreeningSchemaReadiness
{
    Task<bool> IsReadyAsync(CancellationToken cancellationToken);
}

internal sealed class ScreeningSchemaReadiness(DataContext db) : IScreeningSchemaReadiness
{
    internal const string RequiredMigration = "20260807120109_Milestone3TenantScreeningProductionization";

    public async Task<bool> IsReadyAsync(CancellationToken cancellationToken)
    {
        if (!db.Database.IsRelational()) return true;
        try
        {
            var applied = await db.Database.GetAppliedMigrationsAsync(cancellationToken);
            return applied.Contains(RequiredMigration, StringComparer.Ordinal);
        }
        catch when (!cancellationToken.IsCancellationRequested) { return false; }
    }
}

internal interface IScreeningWorkerCycle
{
    Task RunAsync(int batchSize, CancellationToken cancellationToken);
}

internal abstract class ScreeningBackgroundService<TCycle> : BackgroundService where TCycle : class, IScreeningWorkerCycle
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ScreeningHostedWorkerOptions _options;
    private readonly ILogger _logger;

    protected ScreeningBackgroundService(IServiceScopeFactory scopeFactory, IOptions<ScreeningHostedWorkerOptions> options, ILogger logger)
    {
        _scopeFactory = scopeFactory;
        _options = options.Value;
        _logger = logger;
    }

    protected abstract bool WorkerEnabled(ScreeningHostedWorkerOptions options);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Deliberately return before creating a scope: this protects pre-migration deployments.
        if (!_options.Enabled || !WorkerEnabled(_options)) return;

        await using (var readinessScope = _scopeFactory.CreateAsyncScope())
        {
            var readiness = readinessScope.ServiceProvider.GetRequiredService<IScreeningSchemaReadiness>();
            if (!await readiness.IsReadyAsync(stoppingToken))
            {
                _logger.LogWarning("Screening worker disabled because the required database migration is not applied.");
                return;
            }
        }

        var failureDelay = _options.FailureBackoff;
        while (!stoppingToken.IsCancellationRequested)
        {
            var delay = _options.CycleInterval;
            try
            {
                await using var scope = _scopeFactory.CreateAsyncScope();
                var cycle = scope.ServiceProvider.GetRequiredService<TCycle>();
                await cycle.RunAsync(_options.BatchSize, stoppingToken);
                failureDelay = _options.FailureBackoff;
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                // Exception type is sufficient operational evidence; messages, IDs, and payloads are not logged.
                _logger.LogError("Screening worker cycle failed with sanitized failure type {FailureType}.", exception.GetType().Name);
                delay = failureDelay;
                failureDelay = TimeSpan.FromTicks(Math.Min(_options.MaximumFailureBackoff.Ticks, checked(failureDelay.Ticks * 2)));
            }

            try
            {
                await Task.Delay(delay, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }
}

internal sealed class ScreeningWebhookInboxBackgroundService(
    IServiceScopeFactory scopeFactory,
    IOptions<ScreeningHostedWorkerOptions> options,
    ILogger<ScreeningWebhookInboxBackgroundService> logger)
    : ScreeningBackgroundService<ScreeningWebhookInboxCycle>(scopeFactory, options, logger)
{
    protected override bool WorkerEnabled(ScreeningHostedWorkerOptions value) => value.WebhookInboxEnabled;
}

internal sealed class ScreeningProviderPollingBackgroundService(
    IServiceScopeFactory scopeFactory,
    IOptions<ScreeningHostedWorkerOptions> options,
    ILogger<ScreeningProviderPollingBackgroundService> logger)
    : ScreeningBackgroundService<ScreeningProviderPollingCycle>(scopeFactory, options, logger)
{
    protected override bool WorkerEnabled(ScreeningHostedWorkerOptions value) => value.ProviderPollingEnabled;
}

internal sealed class ScreeningAdverseActionDeliveryBackgroundService(
    IServiceScopeFactory scopeFactory,
    IOptions<ScreeningHostedWorkerOptions> options,
    ILogger<ScreeningAdverseActionDeliveryBackgroundService> logger)
    : ScreeningBackgroundService<ScreeningAdverseActionDeliveryCycle>(scopeFactory, options, logger)
{
    protected override bool WorkerEnabled(ScreeningHostedWorkerOptions value) => value.AdverseActionDeliveryEnabled;
}

internal sealed class ScreeningRetentionBackgroundService(
    IServiceScopeFactory scopeFactory,
    IOptions<ScreeningHostedWorkerOptions> options,
    ILogger<ScreeningRetentionBackgroundService> logger)
    : ScreeningBackgroundService<ScreeningRetentionCycle>(scopeFactory, options, logger)
{
    protected override bool WorkerEnabled(ScreeningHostedWorkerOptions value) => value.RetentionEnabled;
}

internal sealed class ScreeningCancellationRecoveryBackgroundService(
    IServiceScopeFactory scopeFactory,
    IOptions<ScreeningHostedWorkerOptions> options,
    ILogger<ScreeningCancellationRecoveryBackgroundService> logger)
    : ScreeningBackgroundService<ScreeningCancellationRecoveryCycle>(scopeFactory, options, logger)
{
    protected override bool WorkerEnabled(ScreeningHostedWorkerOptions value) => value.CancellationRecoveryEnabled;
}

internal sealed class ScreeningDisputeRecoveryBackgroundService(
    IServiceScopeFactory scopeFactory,
    IOptions<ScreeningHostedWorkerOptions> options,
    ILogger<ScreeningDisputeRecoveryBackgroundService> logger)
    : ScreeningBackgroundService<ScreeningDisputeRecoveryCycle>(scopeFactory, options, logger)
{
    protected override bool WorkerEnabled(ScreeningHostedWorkerOptions value) => value.DisputeRecoveryEnabled;
}

internal sealed class ScreeningReportAccessRecoveryBackgroundService(
    IServiceScopeFactory scopeFactory,
    IOptions<ScreeningHostedWorkerOptions> options,
    ILogger<ScreeningReportAccessRecoveryBackgroundService> logger)
    : ScreeningBackgroundService<ScreeningReportAccessRecoveryCycle>(scopeFactory, options, logger)
{
    protected override bool WorkerEnabled(ScreeningHostedWorkerOptions value) => value.ReportAccessRecoveryEnabled;
}

internal sealed class ScreeningWebhookInboxCycle(
    ITenantScreeningService screening,
    IOptions<ScreeningHostedWorkerOptions> options) : IScreeningWorkerCycle
{
    public async Task RunAsync(int batchSize, CancellationToken cancellationToken) =>
        _ = await screening.ProcessPendingWebhookInboxAsync(batchSize, options.Value.WebhookLeaseDuration, cancellationToken);
}

internal sealed class ScreeningCancellationRecoveryCycle(
    ITenantScreeningDecisionService screening,
    IOptions<ScreeningHostedWorkerOptions> options) : IScreeningWorkerCycle
{
    public async Task RunAsync(int batchSize, CancellationToken cancellationToken) =>
        _ = await screening.ProcessPendingCancellationIntentsAsync(batchSize,
            options.Value.CancellationLeaseDuration, cancellationToken);
}

internal sealed class ScreeningDisputeRecoveryCycle(
    ITenantScreeningDecisionService screening,
    IOptions<ScreeningHostedWorkerOptions> options) : IScreeningWorkerCycle
{
    public async Task RunAsync(int batchSize, CancellationToken cancellationToken) =>
        _ = await screening.ProcessPendingDisputeIntentsAsync(batchSize,
            options.Value.DisputeLeaseDuration, cancellationToken);
}

/// <summary>
/// Delegates recovery to the screening service boundary. The cycle intentionally never loads or
/// mutates access-audit rows: provider grant introspection/revocation and terminal classification
/// remain one provider-neutral, idempotent service operation.
/// </summary>
internal sealed class ScreeningReportAccessRecoveryCycle(
    ITenantScreeningDecisionService screening,
    IOptions<ScreeningHostedWorkerOptions> options) : IScreeningWorkerCycle
{
    public async Task RunAsync(int batchSize, CancellationToken cancellationToken) =>
        _ = await screening.RecoverStaleReportAccessAttemptsAsync(batchSize,
            options.Value.ReportAccessStaleAge, cancellationToken);
}

internal sealed class ScreeningProviderPollingCycle(
    DataContext db,
    IServiceScopeFactory scopeFactory,
    ILogger<ScreeningProviderPollingCycle> logger) : IScreeningWorkerCycle
{
    public async Task RunAsync(int batchSize, CancellationToken cancellationToken)
    {
        var candidates = await db.TenantScreeningOrders.AsNoTracking()
            .Where(x => x.ProviderOrderId != null && x.Status != ScreeningStatus.Complete &&
                        x.Status != ScreeningStatus.Expired && x.Status != ScreeningStatus.Failed)
            .OrderBy(x => x.UpdatedAt)
            .Select(x => new { x.OrganizationId, OrderId = x.Id })
            .Take(batchSize).ToListAsync(cancellationToken);

        foreach (var candidate in candidates)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                await using var itemScope = scopeFactory.CreateAsyncScope();
                await itemScope.ServiceProvider.GetRequiredService<TenantScreeningService>()
                    .ReconcileOrderFromSystemIntentAsync(candidate.OrganizationId, candidate.OrderId, cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
            catch (Exception exception)
            {
                logger.LogWarning("Screening polling item failed with sanitized failure type {FailureType}; remaining items will continue.", exception.GetType().Name);
            }
        }
    }
}

internal sealed class ScreeningAdverseActionDeliveryCycle(
    DataContext db,
    IServiceScopeFactory scopeFactory,
    TimeProvider clock,
    IOptions<ScreeningHostedWorkerOptions> options,
    ILogger<ScreeningAdverseActionDeliveryCycle> logger) : IScreeningWorkerCycle
{
    public async Task RunAsync(int batchSize, CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        var retryBefore = now - options.Value.AdverseActionRetryAge;
        var candidates = await db.ScreeningAdverseActionDeliveryAttempts.AsNoTracking()
            .Where(x => (x.Status == ScreeningDeliveryAttemptStatus.Requested || x.Status == ScreeningDeliveryAttemptStatus.Failed) &&
                        x.AttemptNumber <= options.Value.AdverseActionMaximumAttempts &&
                        (x.NextAttemptAt == null ? x.AttemptedAt <= retryBefore : x.NextAttemptAt <= now) &&
                        (x.ProcessingLeaseUntil == null || x.ProcessingLeaseUntil <= now) &&
                        !db.ScreeningAdverseActionDeliveryAttempts.Any(newer =>
                            newer.ScreeningAdverseActionId == x.ScreeningAdverseActionId && newer.Channel == x.Channel &&
                            newer.AttemptNumber > x.AttemptNumber))
            .Join(db.ScreeningAdverseActions.AsNoTracking(), attempt => attempt.ScreeningAdverseActionId, adverse => adverse.Id,
                (attempt, adverse) => new { adverse.OrganizationId, AdverseActionId = adverse.Id, attempt.Id, attempt.Channel, attempt.AttemptedAt })
            .OrderBy(x => x.AttemptedAt).Take(batchSize).ToListAsync(cancellationToken);

        foreach (var candidate in candidates)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                var leaseId = Guid.NewGuid();
                var tracked = await db.ScreeningAdverseActionDeliveryAttempts.SingleAsync(x => x.Id == candidate.Id,
                    cancellationToken);
                if (!tracked.TryAcquireRecoveryLease(leaseId, now, now.Add(options.Value.AdverseActionLeaseDuration)))
                    continue;
                try { await db.SaveChangesAsync(cancellationToken); }
                catch (DbUpdateConcurrencyException) { db.Entry(tracked).State = EntityState.Detached; continue; }
                await using var itemScope = scopeFactory.CreateAsyncScope();
                await itemScope.ServiceProvider.GetRequiredService<TenantScreeningAdverseActionService>()
                    .RetryDeliveryFromSystemIntentAsync(candidate.OrganizationId, candidate.AdverseActionId,
                        candidate.Channel, leaseId, cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
            catch (Exception exception)
            {
                logger.LogWarning("Screening adverse-action item failed with sanitized failure type {FailureType}; remaining items will continue.", exception.GetType().Name);
            }
        }
    }
}

internal sealed class ScreeningRetentionCycle(
    DataContext db,
    IServiceScopeFactory scopeFactory,
    TimeProvider clock,
    ILogger<ScreeningRetentionCycle> logger) : IScreeningWorkerCycle
{
    public async Task RunAsync(int batchSize, CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        var organizations = await db.ScreeningReportRevisions.AsNoTracking()
            .Where(x => x.DeletedAt == null && x.RetentionExpiresAt <= now && !x.IsUnderLegalHold)
            .OrderBy(x => x.RetentionExpiresAt).Select(x => x.OrganizationId).Distinct()
            .Take(batchSize).ToListAsync(cancellationToken);

        foreach (var organizationId in organizations)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                await using var itemScope = scopeFactory.CreateAsyncScope();
                await itemScope.ServiceProvider.GetRequiredService<ITenantScreeningRetentionService>()
                    .DeleteDueReportsAsync(organizationId, cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
            catch (Exception exception)
            {
                logger.LogWarning("Screening retention item failed with sanitized failure type {FailureType}; remaining items will continue.", exception.GetType().Name);
            }
        }
    }
}
