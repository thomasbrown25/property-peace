using System.Text.RegularExpressions;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.ShortStay;
using brownstone_hub_api.Services.ShortStayStripe;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace brownstone_hub_api.Tests.Services.ShortStay;

public sealed class ShortStayRefundAttemptTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 21, 4, 0, 0, TimeSpan.Zero);
    private const string Account = "acct_test", Intent = "pi_test";

    [Fact]
    public async Task Ambiguous_first_post_commits_key_and_retry_reuses_it()
    {
        await using var f = await Fixture.Create();
        var gateway = new Fake { ThrowOnce = true };
        await Assert.ThrowsAsync<IOException>(() => f.Service(gateway).RecoverAsync(f.Id));
        f.Db.ChangeTracker.Clear();
        var attempt = await f.Db.ShortStayRefundAttempts.SingleAsync();
        Assert.Equal(1, attempt.AttemptCount);
        Assert.Equal(Now, attempt.FirstAttemptAtUtc);
        Assert.Equal(attempt.IdempotencyKey, gateway.Keys.Single());
        Assert.Equal(ShortStayReservationStatus.RefundRequired, (await f.Db.ShortStayReservations.SingleAsync()).Status);
        await f.Service(gateway).RecoverAsync(f.Id);
        Assert.Equal(new[] { attempt.IdempotencyKey, attempt.IdempotencyKey }, gateway.Keys);
        Assert.Equal(2, (await f.Db.ShortStayRefundAttempts.SingleAsync()).AttemptCount);
    }

    [Fact]
    public async Task Empty_inventory_after_window_never_posts_and_requires_review()
    {
        await using var f = await Fixture.Create();
        var gateway = new Fake { ThrowOnce = true };
        await Assert.ThrowsAsync<IOException>(() => f.Service(gateway).RecoverAsync(f.Id));
        f.Clock.UtcNow = Now.AddHours(12);
        f.Db.ChangeTracker.Clear();
        await f.Service(gateway).RecoverAsync(f.Id);
        var a = await f.Db.ShortStayRefundAttempts.SingleAsync();
        Assert.Equal(ShortStayRefundAttemptStatus.ManualReview, a.Status);
        Assert.Equal(1, gateway.Keys.Count);
        Assert.NotNull(a.ManualReviewAtUtc);
        Assert.Equal(2, await f.Db.ShortStayOccupancyClaims.CountAsync());
    }

    [Fact]
    public async Task Exact_provider_success_releases_claims_and_never_reposts()
    {
        await using var f = await Fixture.Create();
        var gateway = new Fake { Refunds = [new("re_1", "succeeded", 25000, Account, Intent)] };
        await f.Service(gateway).RecoverAsync(f.Id);
        Assert.Empty(gateway.Keys);
        Assert.Equal(ShortStayReservationStatus.Refunded, (await f.Db.ShortStayReservations.SingleAsync()).Status);
        Assert.Equal(ShortStayRefundAttemptStatus.Succeeded, (await f.Db.ShortStayRefundAttempts.SingleAsync()).Status);
        Assert.Empty(await f.Db.ShortStayOccupancyClaims.ToListAsync());
    }

    [Fact]
    public async Task Conflicting_or_partial_refunds_fail_closed()
    {
        await using var f = await Fixture.Create();
        var gateway = new Fake { Refunds = [new("re_1", "succeeded", 100, Account, Intent)] };
        await f.Service(gateway).RecoverAsync(f.Id);
        Assert.Empty(gateway.Keys);
        Assert.Equal(ShortStayRefundAttemptStatus.ManualReview, (await f.Db.ShortStayRefundAttempts.SingleAsync()).Status);
        Assert.Equal(2, await f.Db.ShortStayOccupancyClaims.CountAsync());
    }

    [Fact]
    public async Task Manual_review_never_reopens_post_but_late_authoritative_success_can_release_claims()
    {
        await using var f = await Fixture.Create();
        var gateway = new Fake { Refunds = [new("re_partial", "succeeded", 100, Account, Intent)] };
        await f.Service(gateway).RecoverAsync(f.Id);
        gateway.Refunds = [];
        f.Db.ChangeTracker.Clear();
        await f.Service(gateway).RecoverAsync(f.Id);
        Assert.Empty(gateway.Keys);
        gateway.Refunds = [new("re_full", "succeeded", 25000, Account, Intent)];
        f.Db.ChangeTracker.Clear();
        await f.Service(gateway).RecoverAsync(f.Id);
        Assert.Equal(ShortStayRefundAttemptStatus.Succeeded, (await f.Db.ShortStayRefundAttempts.SingleAsync()).Status);
        Assert.Empty(await f.Db.ShortStayOccupancyClaims.ToListAsync());
    }

    [Fact]
    public async Task Duplicate_workers_observe_same_durable_key()
    {
        await using var f = await Fixture.Create();
        var gateway = new Fake { ThrowOnce = true };
        await Assert.ThrowsAsync<IOException>(() => f.Service(gateway).RecoverAsync(f.Id));
        f.Db.ChangeTracker.Clear();
        await f.Service(gateway).RecoverAsync(f.Id);
        f.Db.ChangeTracker.Clear();
        await f.Service(gateway).RecoverAsync(f.Id);
        Assert.Single(await f.Db.ShortStayRefundAttempts.ToListAsync());
        Assert.Single(gateway.Keys.Distinct());
    }

    private sealed class Clock : TimeProvider
    {
        public DateTimeOffset UtcNow { get; set; } = Now;
        public override DateTimeOffset GetUtcNow() => UtcNow;
    }
    private sealed class Fake : IShortStayDirectChargeGateway
    {
        public List<string> Keys { get; } = [];
        public bool ThrowOnce { get; set; }
        public IReadOnlyList<ShortStayRefund> Refunds { get; set; } = [];
        public Task<ShortStayIntent> RetrieveAsync(string accountId, string id, CancellationToken ct = default) =>
            Task.FromResult(new ShortStayIntent(Intent, null, 25000, "usd", "succeeded", Account, Code));
        public Task<IReadOnlyList<ShortStayRefund>> ListRefundsAsync(string accountId, string id, CancellationToken ct = default) => Task.FromResult(Refunds);
        public Task<ShortStayRefund> RefundAsync(string accountId, string id, long cents, string key, CancellationToken ct = default)
        {
            Keys.Add(key);
            if (ThrowOnce) { ThrowOnce = false; throw new IOException("ambiguous transport failure"); }
            return Task.FromResult(new ShortStayRefund("re_new", "pending", cents, accountId, id));
        }
        public Task<ShortStayIntent> CreatePaymentIntentAsync(string accountId, long cents, string currency, string code, string key, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<ShortStayIntent> CancelAsync(string accountId, string id, string key, CancellationToken ct = default) => throw new NotSupportedException();
    }
    private static string Code = string.Empty;
    private sealed class Fixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection = new("Data Source=:memory:");
        public DataContext Db { get; private set; } = null!;
        public Clock Clock { get; } = new();
        public long Id { get; private set; }
        public ShortStayRefundRecoveryService Service(Fake gateway) => new(Db, gateway, Clock);
        public static async Task<Fixture> Create()
        {
            var f = new Fixture();
            await f.connection.OpenAsync();
            f.Db = new DataContext(new DbContextOptionsBuilder<DataContext>().UseSqlite(f.connection).Options);
            foreach (var table in new[] { "Units", "Properties", "Organizations", "Users" })
                await f.Db.Database.ExecuteSqlRawAsync($"CREATE TABLE {table} (Id INTEGER PRIMARY KEY)");
            foreach (var (table, id) in new[] { ("Units", 1), ("Properties", 2), ("Organizations", 3), ("Users", 4), ("Users", 5) })
                await f.Db.Database.ExecuteSqlRawAsync($"INSERT INTO {table} (Id) VALUES ({id})");
            var ddl = f.Db.Database.GenerateCreateScript();
            foreach (var table in new[] { "ShortStayReservations", "ShortStayReservationNights", "ShortStayOccupancyClaims", "ShortStayRefundAttempts" })
            {
                var create = Regex.Match(ddl, $"CREATE TABLE [^;]*\\\"{table}\\\"[^;]*;", RegexOptions.Singleline);
                await f.Db.Database.ExecuteSqlRawAsync(create.Value);
                foreach (Match index in Regex.Matches(ddl, $"CREATE (?:UNIQUE )?INDEX [^;]* ON \\\"{table}\\\"[^;]*;", RegexOptions.Singleline))
                    await f.Db.Database.ExecuteSqlRawAsync(index.Value);
            }
            var r = ShortStayReservation.CreateHold(1, 2, 3, 4, 5, Account, new DateOnly(2026, 11, 1),
                new DateOnly(2026, 11, 3), 1, [12000, 13000], Now.AddMinutes(10), Now);
            f.Db.ShortStayReservations.Add(r);
            await f.Db.SaveChangesAsync();
            r.BeginPayment(Now); r.AttachPaymentIntent(Intent, Now);
            await f.Db.SaveChangesAsync();
            r.Reconcile(ShortStayReservationStatus.RefundRequired, Now);
            await f.Db.SaveChangesAsync();
            f.Id = r.Id;
            Code = r.PublicCode;
            f.Db.ChangeTracker.Clear();
            return f;
        }
        public async ValueTask DisposeAsync() { await Db.DisposeAsync(); await connection.DisposeAsync(); }
    }
}
