using brownstone_hub_api.Data;
using brownstone_hub_api.Security;
using brownstone_hub_api.Services.ShortStay.Ical;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Units;

public sealed class AirbnbIcalHostedServiceTests
{
    private sealed class Counter
    {
        public int Calls;
        public int Disposals;
        public readonly TaskCompletionSource<bool> First = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public readonly TaskCompletionSource<bool> Sixteenth = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public bool Block;
        public bool NoDue;
    }

    private sealed class FakeRunner(Counter counter) : IAirbnbIcalDueRunner, IDisposable
    {
        public async Task<bool> RunOneDueAsync(CancellationToken cancellationToken)
        {
            var n = Interlocked.Increment(ref counter.Calls);
            counter.First.TrySetResult(true);
            if (n == 16) counter.Sixteenth.TrySetResult(true);
            if (counter.Block) await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
            return !counter.NoDue;
        }
        public void Dispose() => Interlocked.Increment(ref counter.Disposals);
    }

    private static IHost MakeHost(IConfiguration configuration, Counter counter, TimeProvider? clock = null,
        ILogger<AirbnbIcalHostedService>? logger = null) =>
        new HostBuilder().ConfigureServices(services =>
        {
            services.AddSingleton(configuration);
            services.AddSingleton(clock ?? TimeProvider.System);
            if (logger is not null) services.AddSingleton(logger);
            services.AddDbContext<DataContext>(options => options.UseSqlite("Data Source=:memory:"));
            services.AddAirbnbIcalSync();
            // Override only the scoped runner, leaving real DI registrations and hosted worker intact.
            services.AddSingleton(counter);
            services.AddScoped<IAirbnbIcalDueRunner, FakeRunner>();
        }).Build();

    private sealed class RecordingLogger : ILogger<AirbnbIcalHostedService>
    {
        public readonly List<(LogLevel Level, string Message, Exception? Exception)> Entries = [];
        public IDisposable BeginScope<TState>(TState state) where TState : notnull => NullScope.Instance;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel level, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            lock (Entries) Entries.Add((level, formatter(state, exception), exception));
        }
        public int Count { get { lock (Entries) return Entries.Count; } }
        private sealed class NullScope : IDisposable
        {
            public static readonly NullScope Instance = new();
            public void Dispose() { }
        }
    }

    private sealed class ManualClock : TimeProvider
    {
        private DateTimeOffset now = new(2026, 10, 20, 0, 0, 0, TimeSpan.Zero);
        private readonly List<ManualTimer> timers = [];
        public override DateTimeOffset GetUtcNow() { lock (timers) return now; }
        public int TimerCount { get { lock (timers) return timers.Count; } }
        public override ITimer CreateTimer(TimerCallback callback, object? state, TimeSpan dueTime, TimeSpan period)
        {
            lock (timers)
            {
                var timer = new ManualTimer(callback, state, now + dueTime);
                timers.Add(timer);
                return timer;
            }
        }
        public void Advance(TimeSpan duration)
        {
            List<ManualTimer> expired;
            lock (timers)
            {
                now += duration;
                expired = timers.Where(t => t.Due <= now).ToList();
                foreach (var timer in expired) timers.Remove(timer);
            }
            foreach (var timer in expired) timer.Fire();
        }
        private sealed class ManualTimer(TimerCallback callback, object? state, DateTimeOffset due) : ITimer
        {
            private bool disposed;
            public DateTimeOffset Due { get; } = due;
            public void Fire() { if (!disposed) callback(state); }
            public bool Change(TimeSpan dueTime, TimeSpan period) => throw new NotSupportedException();
            public void Dispose() => disposed = true;
            public ValueTask DisposeAsync() { Dispose(); return ValueTask.CompletedTask; }
        }
    }

    private static async Task Until(Func<bool> condition)
    {
        var timeout = DateTime.UtcNow.AddSeconds(10);
        while (!condition())
        {
            if (DateTime.UtcNow > timeout) throw new TimeoutException("Worker did not reach the expected tick");
            await Task.Delay(1);
        }
    }

    [Theory]
    [InlineData(null)]
    [InlineData("not-base64-sensitive-secret")]
    [InlineData("YWJjZA==")]
    public async Task Unavailable_key_warns_immediately_then_at_most_every_thirty_minutes_without_secret(string? key)
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            { ["ShortStayIcal:EncryptionKey"] = key }).Build();
        var clock = new ManualClock();
        var logger = new RecordingLogger();
        var counter = new Counter();
        using var host = MakeHost(config, counter, clock, logger);
        await host.StartAsync();
        await Until(() => clock.TimerCount == 1);
        Assert.Equal(1, logger.Count);
        clock.Advance(TimeSpan.FromMinutes(29));
        await Until(() => clock.TimerCount == 1);
        Assert.Equal(1, logger.Count);
        clock.Advance(TimeSpan.FromMinutes(1));
        await Until(() => logger.Count == 2 && clock.TimerCount == 1);
        Assert.Equal(0, counter.Calls);
        foreach (var entry in logger.Entries)
        {
            Assert.Equal(LogLevel.Warning, entry.Level);
            Assert.Null(entry.Exception);
            Assert.Contains("ShortStayIcal:EncryptionKey", entry.Message);
            if (key is not null) Assert.DoesNotContain(key, entry.Message);
        }
        await host.StopAsync();
    }

    [Fact]
    public async Task Key_recovery_resumes_polling_and_new_outage_warns_immediately()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            { ["ShortStayIcal:EncryptionKey"] = null }).Build();
        var clock = new ManualClock();
        var logger = new RecordingLogger();
        var counter = new Counter { NoDue = true };
        using var host = MakeHost(config, counter, clock, logger);
        await host.StartAsync();
        await Until(() => clock.TimerCount == 1 && logger.Count == 1);
        config["ShortStayIcal:EncryptionKey"] = Convert.ToBase64String(new byte[32]);
        clock.Advance(TimeSpan.FromSeconds(30));
        await counter.First.Task.WaitAsync(TimeSpan.FromSeconds(10));
        await Until(() => clock.TimerCount == 1);
        config["ShortStayIcal:EncryptionKey"] = null;
        clock.Advance(TimeSpan.FromSeconds(30));
        await Until(() => logger.Count == 2 && clock.TimerCount == 1);
        Assert.Equal(1, counter.Calls);
        await host.StopAsync();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("bad-secret")]
    [InlineData("YWJjZA==")]
    public async Task Unconfigured_host_starts_without_attempt_or_protector_resolution(string? key)
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            { ["ShortStayIcal:EncryptionKey"] = key }).Build();
        var counter = new Counter();
        using var host = MakeHost(config, counter);
        await host.StartAsync();
        // No invalid-key protector is ever constructed by the worker.
        await host.StopAsync();
        Assert.Equal(0, counter.Calls);
    }

    [Fact]
    public async Task Valid_key_drains_at_most_sixteen_each_tick_with_fresh_scopes_and_cancels()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            { ["ShortStayIcal:EncryptionKey"] = Convert.ToBase64String(new byte[32]) }).Build();
        var counter = new Counter();
        using var host = MakeHost(config, counter);
        await host.StartAsync();
        await counter.Sixteenth.Task.WaitAsync(TimeSpan.FromSeconds(10));
        Assert.Equal(16, counter.Calls);
        Assert.Equal(16, counter.Disposals);
        await host.StopAsync();
    }

    [Fact]
    public async Task Stop_cancels_in_flight_attempt()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            { ["ShortStayIcal:EncryptionKey"] = Convert.ToBase64String(new byte[32]) }).Build();
        var counter = new Counter { Block = true };
        using var host = MakeHost(config, counter);
        await host.StartAsync();
        await counter.First.Task.WaitAsync(TimeSpan.FromSeconds(10));
        await host.StopAsync().WaitAsync(TimeSpan.FromSeconds(10));
        Assert.Equal(1, counter.Calls);
        Assert.Equal(1, counter.Disposals);
    }

    [Fact]
    public async Task No_due_work_stops_current_tick_and_real_scoped_dependencies_resolve()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            { ["ShortStayIcal:EncryptionKey"] = Convert.ToBase64String(new byte[32]) }).Build();
        var counter = new Counter { NoDue = true };
        using var host = MakeHost(config, counter);
        using (var scope = host.Services.CreateScope())
        {
            var provider = scope.ServiceProvider;
            Assert.NotNull(provider.GetRequiredService<AirbnbIcalSyncService>());
            Assert.NotNull(provider.GetRequiredService<ShortStayIcalSecretProtector>());
            var makeContext = provider.GetRequiredService<Func<DataContext>>();
            using var first = makeContext();
            using var second = makeContext();
            Assert.NotSame(first, second);
            Assert.NotSame(first, provider.GetRequiredService<DataContext>());
        }
        await host.StartAsync();
        await counter.First.Task.WaitAsync(TimeSpan.FromSeconds(10));
        await host.StopAsync();
        Assert.Equal(1, counter.Calls);
    }
}
