using System.Text;
using System.Security.Claims;
using brownstone_hub_api.Data;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Security;
using brownstone_hub_api.Services.ShortStay;
using brownstone_hub_api.Services.ShortStay.Ical;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Units;

public sealed class AirbnbIcalSyncServiceTests
{
    private const string Url = "https://www.airbnb.com/calendar/ical/123.ics?s=private";
    private static readonly DateTime Now = new(2026, 10, 20, 12, 0, 0, DateTimeKind.Utc);
    private static byte[] Feed(params (string Uid, string Start, string End)[] events) => Encoding.UTF8.GetBytes(
        "BEGIN:VCALENDAR\r\n" + string.Concat(events.Select(e => $"BEGIN:VEVENT\r\nUID:{e.Uid}\r\nDTSTART;VALUE=DATE:{e.Start}\r\nDTEND;VALUE=DATE:{e.End}\r\nEND:VEVENT\r\n")) + "END:VCALENDAR\r\n");
    private sealed class FakeFetcher(Func<string, CancellationToken, Task<byte[]>> fetch) : IAirbnbIcalFetcher
    {
        public int Calls { get; private set; }
        public Task<byte[]> FetchAsync(string url, CancellationToken ct = default) { Assert.Equal(Url, url); Calls++; return fetch(url, ct); }
    }
    private sealed class Clock : TimeProvider
    {
        public DateTimeOffset Current = new(2026, 10, 20, 12, 0, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => Current;
    }
    [Fact]
    public async Task Reconciles_idempotently_moves_and_deletes_only_missing_events()
    {
        await using var f = await Fixture.Create();
        var bytes = Feed(("a", "20261101", "20261103"), ("b", "20261105", "20261106"));
        var fetch = new FakeFetcher((_, _) => Task.FromResult(bytes));
        Assert.True(await f.Worker(fetch).RunOneDueAsync());
        var initial = await f.Db.ShortStayIcalOccurrences.AsNoTracking().OrderBy(x => x.StartDate).ToListAsync();
        Assert.Equal(2, initial.Count);
        Assert.All(initial, x => { Assert.Equal(64, x.UidKey.Length); Assert.Equal(64, x.RecurrenceKey.Length); Assert.NotEqual("a", x.UidKey); Assert.NotEqual("b", x.UidKey); });
        var sub = await f.Db.ShortStayIcalSubscriptions.AsNoTracking().SingleAsync();
        Assert.Equal(Now, sub.LastAttemptAtUtc);
        Assert.Equal(Now, sub.LastSuccessAtUtc);
        Assert.Equal(Now.AddHours(3), sub.NextAttemptAtUtc);
        Assert.Null(sub.LeaseToken);
        Assert.False(await f.Worker(fetch).RunOneDueAsync());
        Assert.Equal(1, fetch.Calls);
        f.Clock.Current = f.Clock.Current.AddHours(3);
        Assert.True(await f.Worker(fetch).RunOneDueAsync());
        Assert.Equal(initial.Select(x => x.Id), (await f.Db.ShortStayIcalOccurrences.AsNoTracking().OrderBy(x => x.StartDate).ToListAsync()).Select(x => x.Id));
        bytes = Feed(("a", "20261102", "20261104"), ("c", "20261107", "20261108"));
        f.Clock.Current = f.Clock.Current.AddHours(3);
        Assert.True(await f.Worker(fetch).RunOneDueAsync());
        var updated = await f.Db.ShortStayIcalOccurrences.AsNoTracking().OrderBy(x => x.StartDate).ToListAsync();
        Assert.Equal(2, updated.Count);
        Assert.Equal(initial[0].Id, updated[0].Id);
        Assert.Equal(new DateOnly(2026, 11, 2), updated[0].StartDate);
        Assert.DoesNotContain(updated, x => x.Id == initial[1].Id);
        Assert.Equal(new DateOnly(2026, 11, 9), (await f.Db.ShortStayBlocks.AsNoTracking().SingleAsync()).StartDate);
    }
    [Fact]
    public async Task Failures_and_suspicious_empty_preserve_old_data_and_last_success()
    {
        await using var f = await Fixture.Create();
        Assert.True(await f.Worker(new FakeFetcher((_, _) => Task.FromResult(Feed(("a", "20261101", "20261103"))))).RunOneDueAsync());
        var old = await f.Db.ShortStayIcalOccurrences.AsNoTracking().SingleAsync();
        f.Clock.Current = f.Clock.Current.AddHours(3);
        Assert.True(await f.Worker(new FakeFetcher((_, _) => Task.FromResult(Feed()))).RunOneDueAsync());
        var sub = await f.Db.ShortStayIcalSubscriptions.AsNoTracking().SingleAsync();
        Assert.Equal("empty_feed_review", sub.FailureCode);
        Assert.Equal(1, sub.ConsecutiveFailures);
        Assert.Equal(Now, sub.LastSuccessAtUtc);
        Assert.Equal(old.Id, (await f.Db.ShortStayIcalOccurrences.AsNoTracking().SingleAsync()).Id);
        f.Clock.Current = new DateTimeOffset(sub.NextAttemptAtUtc!.Value);
        Assert.True(await f.Worker(new FakeFetcher((_, _) => throw new Exception(Url))).RunOneDueAsync());
        sub = await f.Db.ShortStayIcalSubscriptions.AsNoTracking().SingleAsync();
        Assert.Equal("fetch_failed", sub.FailureCode);
        Assert.Equal(2, sub.ConsecutiveFailures);
        Assert.True(sub.NextAttemptAtUtc > sub.LastAttemptAtUtc);
        Assert.DoesNotContain("private", sub.FailureCode);
        Assert.Equal(old.Id, (await f.Db.ShortStayIcalOccurrences.AsNoTracking().SingleAsync()).Id);
    }
    [Fact]
    public async Task Stale_feed_outside_import_horizon_does_not_clear_previous_entries()
    {
        await using var f = await Fixture.Create();
        Assert.True(await f.Worker(new FakeFetcher((_, _) => Task.FromResult(Feed(("a", "20261101", "20261103"))))).RunOneDueAsync());
        f.Clock.Current = f.Clock.Current.AddHours(3);
        Assert.True(await f.Worker(new FakeFetcher((_, _) => Task.FromResult(Feed(("past", "20250101", "20250102"))))).RunOneDueAsync());
        Assert.Equal("empty_feed_review", (await f.Db.ShortStayIcalSubscriptions.AsNoTracking().SingleAsync()).FailureCode);
        Assert.Single(await f.Db.ShortStayIcalOccurrences.AsNoTracking().ToListAsync());
    }
    [Fact]
    public async Task Genuine_empty_first_feed_succeeds_and_invalid_feed_does_not_clear()
    {
        await using var f = await Fixture.Create();
        Assert.True(await f.Worker(new FakeFetcher((_, _) => Task.FromResult(Feed()))).RunOneDueAsync());
        Assert.Empty(await f.Db.ShortStayIcalOccurrences.ToListAsync());
        Assert.Equal(Now, (await f.Db.ShortStayIcalSubscriptions.AsNoTracking().SingleAsync()).LastSuccessAtUtc);
        f.Clock.Current = f.Clock.Current.AddHours(3);
        Assert.True(await f.Worker(new FakeFetcher((_, _) => Task.FromResult(Encoding.UTF8.GetBytes("invalid")))).RunOneDueAsync());
        Assert.Equal("invalid_feed", (await f.Db.ShortStayIcalSubscriptions.AsNoTracking().SingleAsync()).FailureCode);
    }
    [Theory]
    [InlineData("replace")]
    [InlineData("disable")]
    [InlineData("takeover")]
    [InlineData("mode")]
    [InlineData("ownership")]
    public async Task Deferred_old_fetch_cannot_mutate_changed_subscription(string change)
    {
        await using var f = await Fixture.Create();
        var pending = new TaskCompletionSource<byte[]>(TaskCreationOptions.RunContinuationsAsynchronously);
        var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var worker = f.Worker(new FakeFetcher((_, _) => { entered.SetResult(); return pending.Task; }));
        var running = worker.RunOneDueAsync();
        await entered.Task;
        var sub = await f.Db.ShortStayIcalSubscriptions.SingleAsync();
        var original = sub.LastAttemptAtUtc;
        switch (change)
        {
            case "replace": sub.Generation++; sub.EncryptedUrl = f.Protector.EncryptUrl("https://www.airbnb.com/calendar/ical/456.ics"); break;
            case "disable": sub.Enabled = false; sub.Generation++; break;
            case "takeover": sub.LeaseToken = Guid.NewGuid(); break;
            case "mode": (await f.Db.Units.SingleAsync()).RentalMode = ERentalMode.LongTerm; break;
            case "ownership": (await f.Db.Properties.SingleAsync()).OrganizationId = 21; break;
        }
        await f.Db.SaveChangesAsync(); f.Db.ChangeTracker.Clear();
        pending.SetResult(Feed(("old", "20261101", "20261103")));
        Assert.True(await running);
        Assert.Empty(await f.Db.ShortStayIcalOccurrences.AsNoTracking().ToListAsync());
        sub = await f.Db.ShortStayIcalSubscriptions.AsNoTracking().SingleAsync();
        Assert.Null(sub.LastSuccessAtUtc);
        Assert.Equal(original, sub.LastAttemptAtUtc);
        Assert.Null(sub.FailureCode);
    }
    [Fact]
    public async Task Expired_lease_is_reclaimed_and_old_fetch_cannot_release_new_claim()
    {
        await using var f = await Fixture.Create();
        var first = new TaskCompletionSource<byte[]>(TaskCreationOptions.RunContinuationsAsynchronously);
        var second = new TaskCompletionSource<byte[]>(TaskCreationOptions.RunContinuationsAsynchronously);
        var firstEntered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var secondEntered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var runningFirst = f.Worker(new FakeFetcher((_, _) => { firstEntered.SetResult(); return first.Task; })).RunOneDueAsync();
        await firstEntered.Task;
        var oldToken = (await f.Db.ShortStayIcalSubscriptions.AsNoTracking().SingleAsync()).LeaseToken;
        f.Clock.Current = f.Clock.Current.AddSeconds(61);
        var runningSecond = f.Worker(new FakeFetcher((_, _) => { secondEntered.SetResult(); return second.Task; })).RunOneDueAsync();
        await secondEntered.Task;
        var newToken = (await f.Db.ShortStayIcalSubscriptions.AsNoTracking().SingleAsync()).LeaseToken;
        Assert.NotEqual(oldToken, newToken);
        first.SetResult(Feed(("stale", "20261101", "20261102")));
        Assert.True(await runningFirst);
        Assert.Equal(newToken, (await f.Db.ShortStayIcalSubscriptions.AsNoTracking().SingleAsync()).LeaseToken);
        Assert.Empty(await f.Db.ShortStayIcalOccurrences.ToListAsync());
        second.SetResult(Feed(("current", "20261103", "20261104")));
        Assert.True(await runningSecond);
        Assert.Equal(new DateOnly(2026, 11, 3), (await f.Db.ShortStayIcalOccurrences.AsNoTracking().SingleAsync()).StartDate);
    }
    [Fact]
    public async Task Manual_refresh_during_fetch_queues_new_claim_without_committing_old_feed_or_losing_last_good()
    {
        await using var f = await Fixture.Create();
        Assert.True(await f.Worker(new FakeFetcher((_, _) => Task.FromResult(Feed(("good", "20261101", "20261103"))))).RunOneDueAsync());
        var good = await f.Db.ShortStayIcalOccurrences.AsNoTracking().SingleAsync();
        f.Clock.Current = DateTimeOffset.UtcNow.AddHours(3);
        var pending = new TaskCompletionSource<byte[]>(TaskCreationOptions.RunContinuationsAsynchronously);
        var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var oldRun = f.Worker(new FakeFetcher((_, _) => { entered.SetResult(); return pending.Task; })).RunOneDueAsync();
        await entered.Task;
        var claimed = await f.Db.ShortStayIcalSubscriptions.AsNoTracking().SingleAsync();
        Assert.NotNull(claimed.LeaseToken);
        Assert.Empty(f.Db.ChangeTracker.Entries<ShortStayIcalSubscription>());

        var refreshed = await f.Service().Refresh(10);
        Assert.Equal(200, refreshed.StatusCode);
        Assert.Null(f.Db.ChangeTracker.Entries<ShortStayIcalSubscription>().Single().Entity.LeaseToken);
        Assert.Equal(claimed.Generation + 1, refreshed.Data!.Generation);
        var queued = await f.Db.ShortStayIcalSubscriptions.AsNoTracking().SingleAsync();
        Assert.Equal(claimed.Generation + 1, queued.Generation);
        Assert.Null(queued.LeaseToken);
        Assert.NotNull(queued.NextAttemptAtUtc);
        Assert.True(queued.NextAttemptAtUtc <= f.Clock.GetUtcNow().UtcDateTime);
        Assert.Equal(good.Id, (await f.Db.ShortStayIcalOccurrences.AsNoTracking().SingleAsync()).Id);

        var freshPending = new TaskCompletionSource<byte[]>(TaskCreationOptions.RunContinuationsAsynchronously);
        var freshEntered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var freshRun = f.Worker(new FakeFetcher((_, _) => { freshEntered.SetResult(); return freshPending.Task; })).RunOneDueAsync();
        await freshEntered.Task;
        var newToken = (await f.Db.ShortStayIcalSubscriptions.AsNoTracking().SingleAsync()).LeaseToken;
        Assert.NotNull(newToken);
        Assert.NotEqual(claimed.LeaseToken, newToken);
        pending.SetResult(Feed(("stale", "20261104", "20261105")));
        Assert.True(await oldRun);
        queued = await f.Db.ShortStayIcalSubscriptions.AsNoTracking().SingleAsync();
        Assert.Equal(newToken, queued.LeaseToken);
        Assert.Equal(refreshed.Data!.NextAttemptAtUtc, queued.NextAttemptAtUtc);
        Assert.Equal(Now, queued.LastSuccessAtUtc);
        Assert.Equal(good.Id, (await f.Db.ShortStayIcalOccurrences.AsNoTracking().SingleAsync()).Id);
        freshPending.SetResult(Feed(("fresh", "20261106", "20261107")));
        Assert.True(await freshRun);
        Assert.Equal(new DateOnly(2026, 11, 6), (await f.Db.ShortStayIcalOccurrences.AsNoTracking().SingleAsync()).StartDate);
        Assert.Null((await f.Db.ShortStayIcalSubscriptions.AsNoTracking().SingleAsync()).LeaseToken);
    }

    [Fact]
    public async Task Refresh_followed_by_disable_cannot_start_or_commit_queued_work()
    {
        await using var f = await Fixture.Create();
        var pending = new TaskCompletionSource<byte[]>(TaskCreationOptions.RunContinuationsAsynchronously);
        var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var running = f.Worker(new FakeFetcher((_, _) => { entered.SetResult(); return pending.Task; })).RunOneDueAsync();
        await entered.Task;
        Assert.Equal(200, (await f.Service().Refresh(10)).StatusCode);
        Assert.Equal(200, (await f.Service().Disable(10)).StatusCode);
        var disconnected = await f.Db.ShortStayIcalSubscriptions.AsNoTracking().SingleAsync();
        Assert.False(disconnected.Enabled);
        Assert.Equal(string.Empty, disconnected.EncryptedUrl);
        Assert.Equal(string.Empty, disconnected.UrlFingerprint);
        Assert.Null(disconnected.LeaseToken);
        Assert.Null(disconnected.LeaseExpiresAtUtc);
        pending.SetResult(Feed(("old", "20261101", "20261103")));
        Assert.True(await running);
        Assert.False(await f.Worker(new FakeFetcher((_, _) => throw new Exception("unexpected fetch"))).RunOneDueAsync());
        var sub = await f.Db.ShortStayIcalSubscriptions.AsNoTracking().SingleAsync();
        Assert.Equal(disconnected.Generation, sub.Generation);
        Assert.Equal(string.Empty, sub.EncryptedUrl);
        Assert.Equal(string.Empty, sub.UrlFingerprint);
        Assert.Null(sub.LeaseToken);
        Assert.False(sub.Enabled);
        Assert.Null(sub.NextAttemptAtUtc);
        Assert.Null(sub.LastSuccessAtUtc);
        Assert.Empty(await f.Db.ShortStayIcalOccurrences.AsNoTracking().ToListAsync());
    }

    [Fact]
    public async Task Overlapping_import_conflicts_without_replacing_last_good_feed_or_claim()
    {
        await using var f = await Fixture.Create();
        Assert.True(await f.Worker(new FakeFetcher((_, _) => Task.FromResult(Feed(("good", "20261101", "20261102"))))).RunOneDueAsync());
        var old = await f.Db.ShortStayIcalOccurrences.AsNoTracking().SingleAsync();
        var now = f.Clock.GetUtcNow();
        f.Db.ShortStayReservations.Add(ShortStayReservation.CreateHold(10, 7, 20, 77, 42,
            "acct_private", new DateOnly(2026, 11, 4), new DateOnly(2026, 11, 5), 1,
            [12000], now.AddHours(1), now));
        await f.Db.SaveChangesAsync();
        f.Db.ChangeTracker.Clear();
        f.Clock.Current = f.Clock.Current.AddHours(3);
        Assert.True(await f.Worker(new FakeFetcher((_, _) => Task.FromResult(Feed(("conflict", "20261104", "20261105"))))).RunOneDueAsync());
        var sub = await f.Db.ShortStayIcalSubscriptions.AsNoTracking().SingleAsync();
        Assert.Equal("reservation_conflict", sub.FailureCode);
        Assert.Equal(Now, sub.LastSuccessAtUtc);
        Assert.Equal(old.Id, (await f.Db.ShortStayIcalOccurrences.AsNoTracking().SingleAsync()).Id);
        Assert.Single(await f.Db.ShortStayOccupancyClaims.AsNoTracking().ToListAsync());
    }

    private sealed class Fixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection;
        private readonly DbContextOptions<DataContext> options;
        public DataContext Db { get; }
        public Clock Clock { get; } = new();
        public ShortStayIcalSecretProtector Protector { get; } = new(Convert.ToBase64String(Enumerable.Range(1, 32).Select(x => (byte)x).ToArray()));
        private Fixture(SqliteConnection connection)
        {
            this.connection = connection;
            options = new DbContextOptionsBuilder<DataContext>().UseSqlite(connection).Options;
            Db = new SlimContext(options);
        }
        public static async Task<Fixture> Create()
        {
            var connection = new SqliteConnection("Data Source=:memory:;Foreign Keys=False"); await connection.OpenAsync();
            var f = new Fixture(connection);
            await f.Db.Database.EnsureCreatedAsync();
            f.Db.Organizations.AddRange(new Organization { Id = 20, IsActive = true }, new Organization { Id = 21, IsActive = true });
            f.Db.OrganizationMembers.Add(new OrganizationMember { OrganizationId = 20, UserId = 42, Role = "Owner", IsActive = true });
            f.Db.Properties.Add(new Property { Id = 7, OrganizationId = 20, TimeZoneId = "America/New_York" });
            f.Db.Units.Add(new Unit { Id = 10, PropertyId = 7, OrganizationId = 20, RentalMode = ERentalMode.ShortTerm });
            f.Db.ShortStayBlocks.Add(new ShortStayBlock { UnitId = 10, StartDate = new DateOnly(2026, 11, 9), EndDate = new DateOnly(2026, 11, 10) });
            f.Db.ShortStayIcalSubscriptions.Add(new ShortStayIcalSubscription { UnitId = 10, OrgId = 20, EncryptedUrl = f.Protector.EncryptUrl(Url), UrlFingerprint = f.Protector.FingerprintUrl(Url), NextAttemptAtUtc = Now });
            await f.Db.SaveChangesAsync(); f.Db.ChangeTracker.Clear();
            return f;
        }
        public AirbnbIcalSyncService Worker(IAirbnbIcalFetcher fetcher) => new(() => new SlimContext(options), fetcher, Protector, Clock);
        public AirbnbCalendarService Service()
        {
            var http = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity([
                new Claim(ClaimTypes.NameIdentifier, "42"), new Claim(ClaimTypes.Role, "Landlord")], "test")) };
            http.Items["OrganizationId"] = 20L;
            http.Items["UserId"] = 42L;
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
                ["ShortStayIcal:EncryptionKey"] = Convert.ToBase64String(Enumerable.Range(1, 32).Select(x => (byte)x).ToArray()) }).Build();
            return new AirbnbCalendarService(Db, new HttpContextAccessor { HttpContext = http }, config);
        }
        public async ValueTask DisposeAsync() { await Db.DisposeAsync(); await connection.DisposeAsync(); }
    }
    private sealed class SlimContext(DbContextOptions<DataContext> options) : DataContext(options)
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            var keep = new[] { typeof(Property), typeof(Unit), typeof(Organization), typeof(OrganizationMember), typeof(ShortStayIcalSubscription), typeof(ShortStayIcalOccurrence), typeof(ShortStayBlock), typeof(ShortStayReservation), typeof(ShortStayReservationNight), typeof(ShortStayOccupancyClaim) };
            foreach (var entity in modelBuilder.Model.GetEntityTypes().ToList()) if (!keep.Contains(entity.ClrType)) modelBuilder.Ignore(entity.ClrType);
            foreach (var entity in modelBuilder.Model.GetEntityTypes())
                foreach (var property in entity.GetProperties())
                    if (property.GetColumnType()?.Contains("(max)", StringComparison.OrdinalIgnoreCase) == true) property.SetColumnType("TEXT");
        }
    }
}
