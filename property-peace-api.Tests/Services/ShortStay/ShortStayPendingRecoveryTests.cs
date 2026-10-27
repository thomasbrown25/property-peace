using System.Text.RegularExpressions;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.ShortStay;
using brownstone_hub_api.Services.ShortStayStripe;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace brownstone_hub_api.Tests.Services.ShortStay;

public sealed class ShortStayPendingRecoveryTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 20, 12, 11, 0, TimeSpan.Zero);
    private const string Account = "acct_1234567890123456";
    private const string IntentId = "pi_1234567890123456";

    [Fact]
    public void Worker_is_disabled_by_default()
    {
        Assert.False(ShortStayPendingRecoveryWorker.Enabled(new ConfigurationBuilder().AddInMemoryCollection().Build()));
        Assert.False(ShortStayPendingRecoveryWorker.Enabled(new ConfigurationBuilder().AddInMemoryCollection(
            new Dictionary<string, string?> { ["ShortStayBooking:PendingRecoveryEnabled"] = "no" }).Build()));
    }

    [Theory]
    [InlineData("requires_payment_method", "Failed", 0)]
    [InlineData("requires_confirmation", "Failed", 0)]
    [InlineData("succeeded", "RefundRequired", 2)]
    [InlineData("processing", "PendingPayment", 2)]
    public async Task Attached_intent_is_only_released_after_authoritative_cancellation(string status, string expected, int claims)
    {
        await using var f = await Fixture.Create();
        var r = await f.Hold();
        var gateway = new Fake { Intent = Snapshot(r, status) };
        Assert.Equal(status == "processing" ? 0 : 1, await f.Service(gateway).RunBatchAsync());
        f.Db.ChangeTracker.Clear();
        Assert.Equal(expected, (await f.Db.ShortStayReservations.SingleAsync()).Status.ToString());
        Assert.Equal(claims, await f.Db.ShortStayOccupancyClaims.CountAsync());
        Assert.Equal(status is "requires_payment_method" or "requires_confirmation" ? 1 : 0, gateway.Cancels);
        Assert.Equal(0, gateway.Creates);
    }

    [Theory]
    [InlineData("zero")]
    [InlineData("many")]
    [InlineData("mismatch")]
    public async Task Missing_id_search_uncertain_never_releases(string scenario)
    {
        await using var f = await Fixture.Create();
        var r = await f.Hold(false);
        var match = Snapshot(r, "requires_payment_method");
        var gateway = new Fake { Intent = match, SearchResults = scenario switch {
            "zero" => [], "many" => [match, match with { PaymentIntentId = "pi_2222222222222222" }],
            _ => [match with { AmountCents = 1 }] } };
        Assert.Equal(0, await f.Service(gateway).RunBatchAsync());
        f.Db.ChangeTracker.Clear();
        Assert.Null((await f.Db.ShortStayReservations.SingleAsync()).StripePaymentIntentId);
        Assert.Equal(2, await f.Db.ShortStayOccupancyClaims.CountAsync());
        Assert.Equal(0, gateway.Cancels);
    }

    [Fact]
    public async Task Missing_id_unique_search_recovers_and_cancels_without_creating()
    {
        await using var f = await Fixture.Create();
        var r = await f.Hold(false);
        var gateway = new Fake { Intent = Snapshot(r, "requires_payment_method"), SearchResults = [Snapshot(r, "requires_payment_method")] };
        Assert.Equal(1, await f.Service(gateway).RunBatchAsync());
        f.Db.ChangeTracker.Clear();
        var current = await f.Db.ShortStayReservations.SingleAsync();
        Assert.Equal(IntentId, current.StripePaymentIntentId);
        Assert.Equal(ShortStayReservationStatus.Failed, current.Status);
        Assert.Empty(await f.Db.ShortStayOccupancyClaims.ToListAsync());
        Assert.Equal(0, gateway.Creates);
    }

    [Fact]
    public async Task Missing_id_unique_success_is_late_refund_required_and_keeps_claims()
    {
        await using var f = await Fixture.Create();
        var r = await f.Hold(false);
        var succeeded = Snapshot(r, "succeeded");
        var gateway = new Fake { Intent = succeeded, SearchResults = [succeeded] };
        Assert.Equal(1, await f.Service(gateway).RunBatchAsync());
        f.Db.ChangeTracker.Clear();
        var current = await f.Db.ShortStayReservations.SingleAsync();
        Assert.Equal(IntentId, current.StripePaymentIntentId);
        Assert.Equal(ShortStayReservationStatus.RefundRequired, current.Status);
        Assert.Equal(2, await f.Db.ShortStayOccupancyClaims.CountAsync());
        Assert.Equal(0, gateway.Cancels);
    }

    [Fact]
    public async Task Cancel_racing_success_reconciles_refund_required_without_releasing()
    {
        await using var f = await Fixture.Create();
        var r = await f.Hold();
        var gateway = new Fake { Intent = Snapshot(r, "requires_payment_method"), AfterCancel = "succeeded" };
        Assert.Equal(1, await f.Service(gateway).RunBatchAsync());
        f.Db.ChangeTracker.Clear();
        Assert.Equal(ShortStayReservationStatus.RefundRequired, (await f.Db.ShortStayReservations.SingleAsync()).Status);
        Assert.Equal(2, await f.Db.ShortStayOccupancyClaims.CountAsync());
    }

    [Fact]
    public async Task Duplicate_pass_does_not_cancel_twice_or_release_other_claims()
    {
        await using var f = await Fixture.Create();
        var r = await f.Hold();
        var gateway = new Fake { Intent = Snapshot(r, "requires_payment_method") };
        Assert.Equal(1, await f.Service(gateway).RunBatchAsync());
        Assert.Equal(0, await f.Service(gateway).RunBatchAsync());
        Assert.Equal(1, gateway.Cancels);
    }

    [Fact]
    public async Task Ambiguous_cancel_retries_and_keeps_claims_until_provider_confirms_canceled()
    {
        await using var f = await Fixture.Create();
        var r = await f.Hold();
        var gateway = new Fake { Intent = Snapshot(r, "requires_payment_method"), CancelUncertain = true };
        Assert.Equal(0, await f.Service(gateway).RunBatchAsync());
        f.Db.ChangeTracker.Clear();
        Assert.Equal(2, await f.Db.ShortStayOccupancyClaims.CountAsync());
        gateway.CancelUncertain = false;
        Assert.Equal(1, await f.Service(gateway).RunBatchAsync());
        Assert.Equal(2, gateway.Cancels);
        Assert.Single(gateway.Keys.Distinct());
    }

    [Fact]
    public async Task Corrupt_claim_set_is_never_released_even_when_provider_is_canceled()
    {
        await using var f = await Fixture.Create();
        var r = await f.Hold();
        await f.Db.Database.ExecuteSqlRawAsync("DELETE FROM ShortStayOccupancyClaims WHERE Date = '2026-11-01'");
        var gateway = new Fake { Intent = Snapshot(r, "requires_payment_method") };
        Assert.Equal(0, await f.Service(gateway).RunBatchAsync());
        Assert.Equal(0, gateway.Cancels);
        f.Db.ChangeTracker.Clear();
        Assert.Equal(ShortStayReservationStatus.PendingPayment, (await f.Db.ShortStayReservations.SingleAsync()).Status);
    }

    private static ShortStayIntent Snapshot(ShortStayReservation r, string status) =>
        new(IntentId, null, r.TotalCents, "usd", status, Account, r.PublicCode);
    private sealed class Clock : TimeProvider { public override DateTimeOffset GetUtcNow() => Now; }
    private sealed class Fake : IShortStayDirectChargeGateway
    {
        public ShortStayIntent Intent = null!;
        public IReadOnlyList<ShortStayIntent> SearchResults = [];
        public string? AfterCancel;
        public int Cancels, Creates;
        public bool CancelUncertain;
        public List<string> Keys = [];
        public Task<IReadOnlyList<ShortStayIntent>> SearchByReservationCodeAsync(string account, string code, CancellationToken ct = default)
            => Task.FromResult(SearchResults);
        public Task<ShortStayIntent> RetrieveAsync(string account, string id, CancellationToken ct = default) => Task.FromResult(Intent);
        public Task<ShortStayIntent> CancelAsync(string account, string id, string key, CancellationToken ct = default)
        { Cancels++; Keys.Add(key); if (CancelUncertain) throw new HttpRequestException("uncertain");
          Intent = Intent with { Status = AfterCancel ?? "canceled" }; return Task.FromResult(Intent); }
        public Task<ShortStayIntent> CreatePaymentIntentAsync(string a, long b, string c, string d, string e, CancellationToken ct = default)
        { Creates++; throw new InvalidOperationException(); }
        public Task<ShortStayRefund> RefundAsync(string a, string b, long c, string d, CancellationToken ct = default) => throw new InvalidOperationException();
    }
    private sealed class Fixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection;
        public DataContext Db { get; }
        private Fixture(SqliteConnection c) { connection = c; Db = new DataContext(new DbContextOptionsBuilder<DataContext>().UseSqlite(c).Options); }
        public ShortStayPendingRecoveryService Service(Fake g) => new(Db, g, new Clock(),
            new ShortStayPaymentReconciliationService(Db, g, new Clock()),
            Microsoft.Extensions.Logging.Abstractions.NullLogger<ShortStayPendingRecoveryService>.Instance);
        public static async Task<Fixture> Create()
        {
            var c = new SqliteConnection("Data Source=:memory:"); await c.OpenAsync();
            var f = new Fixture(c);
            foreach (var table in new[] { "Units", "Properties", "Organizations", "Users" })
                await f.Db.Database.ExecuteSqlRawAsync($"CREATE TABLE {table} (Id INTEGER PRIMARY KEY)");
            foreach (var (table, id) in new[] { ("Units", 1), ("Properties", 2), ("Organizations", 3), ("Users", 4), ("Users", 5) })
                await f.Db.Database.ExecuteSqlRawAsync($"INSERT INTO {table} (Id) VALUES ({id})");
            var ddl = f.Db.Database.GenerateCreateScript();
            foreach (var table in new[] { "ShortStayReservations", "ShortStayReservationNights", "ShortStayOccupancyClaims" })
            {
                var create = Regex.Match(ddl, $"CREATE TABLE [^;]*\\\"{table}\\\"[^;]*;", RegexOptions.Singleline);
                await f.Db.Database.ExecuteSqlRawAsync(create.Value);
                foreach (Match index in Regex.Matches(ddl, $"CREATE (?:UNIQUE )?INDEX [^;]* ON \\\"{table}\\\"[^;]*;", RegexOptions.Singleline))
                    await f.Db.Database.ExecuteSqlRawAsync(index.Value);
            }
            return f;
        }
        public async Task<ShortStayReservation> Hold(bool attached = true)
        {
            var r = ShortStayReservation.CreateHold(1, 2, 3, 4, 5, Account, new DateOnly(2026, 11, 1),
                new DateOnly(2026, 11, 3), 1, [12000, 13000], Now.AddMinutes(-1), Now.AddMinutes(-11));
            Db.ShortStayReservations.Add(r); await Db.SaveChangesAsync();
            r.BeginPayment(Now.AddMinutes(-10));
            if (attached) r.AttachPaymentIntent(IntentId, Now.AddMinutes(-10));
            await Db.SaveChangesAsync(); Db.ChangeTracker.Clear();
            return await Db.ShortStayReservations.SingleAsync();
        }
        public async ValueTask DisposeAsync() { await Db.DisposeAsync(); await connection.DisposeAsync(); }
    }
}
