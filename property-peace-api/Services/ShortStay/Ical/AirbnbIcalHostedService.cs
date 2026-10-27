using brownstone_hub_api.Data;
using brownstone_hub_api.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;

namespace brownstone_hub_api.Services.ShortStay.Ical;

// The scoped adapter keeps the scheduler testable without changing the durable sync service.
public interface IAirbnbIcalDueRunner
{
    Task<bool> RunOneDueAsync(CancellationToken cancellationToken);
}

internal sealed class AirbnbIcalDueRunner(AirbnbIcalSyncService sync) : IAirbnbIcalDueRunner
{
    public Task<bool> RunOneDueAsync(CancellationToken cancellationToken) => sync.RunOneDueAsync(cancellationToken);
}

public static class AirbnbIcalServiceRegistration
{
    public static IServiceCollection AddAirbnbIcalSync(this IServiceCollection services)
    {
        services.AddSingleton<IAirbnbIcalFetcher, AirbnbIcalFetcher>();
        services.AddScoped(sp => new ShortStayIcalSecretProtector(
            sp.GetRequiredService<IConfiguration>()["ShortStayIcal:EncryptionKey"]));
        // Each claim and commit owns a separate context, independent of the scope's request context.
        services.AddScoped<Func<DataContext>>(sp =>
        {
            var options = sp.GetRequiredService<DbContextOptions<DataContext>>();
            return () => new DataContext(options);
        });
        services.AddScoped<AirbnbIcalSyncService>();
        services.AddScoped<IAirbnbIcalDueRunner, AirbnbIcalDueRunner>();
        services.AddHostedService<AirbnbIcalHostedService>();
        return services;
    }
}

public sealed class AirbnbIcalHostedService(
    IServiceScopeFactory scopes, IConfiguration configuration, TimeProvider clock,
    ILogger<AirbnbIcalHostedService> logger) : BackgroundService
{
    internal const int MaxPerTick = 16;
    internal static readonly TimeSpan IdleDelay = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan KeyWarningInterval = TimeSpan.FromMinutes(30);
    private DateTimeOffset? nextKeyWarningAt;

    private void WarnIfKeyUnavailable()
    {
        var now = clock.GetUtcNow();
        if (nextKeyWarningAt.HasValue && now < nextKeyWarningAt.Value) return;
        nextKeyWarningAt = now + KeyWarningInterval;
        // Do not log the invalid key or an exception: either may contain credentials.
        logger.LogWarning("Airbnb iCal polling paused: ShortStayIcal:EncryptionKey is missing or invalid.");
    }

    private bool HasValidKey()
    {
        var key = configuration["ShortStayIcal:EncryptionKey"];
        if (string.IsNullOrWhiteSpace(key)) return false;
        try { return Convert.FromBase64String(key).Length == 32; }
        catch (FormatException) { return false; }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (HasValidKey())
                {
                    nextKeyWarningAt = null;
                    // A fresh scope per attempt: no shared DbContext or secret protector across claims.
                    for (var i = 0; i < MaxPerTick && !stoppingToken.IsCancellationRequested; i++)
                    {
                        if (!HasValidKey()) { WarnIfKeyUnavailable(); break; }
                        await using var scope = scopes.CreateAsyncScope();
                        if (!await scope.ServiceProvider.GetRequiredService<IAirbnbIcalDueRunner>()
                                .RunOneDueAsync(stoppingToken)) break;
                    }
                }
                else WarnIfKeyUnavailable();
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception)
            {
                // Exception text/stack may contain a connection string or a credential-bearing URL.
                logger.LogWarning("Airbnb iCal poll failed; retrying after idle interval.");
            }

            try { await Task.Delay(IdleDelay, clock, stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
}
