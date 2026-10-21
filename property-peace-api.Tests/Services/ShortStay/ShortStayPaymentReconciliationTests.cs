using System.Text.RegularExpressions;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.ShortStay;
using brownstone_hub_api.Services.ShortStayStripe;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace brownstone_hub_api.Tests.Services.ShortStay;

public sealed class ShortStayPaymentReconciliationTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 20, 12, 0, 0, TimeSpan.Zero);
    private const string Account = "acct_1234567890123456";
    private const string Intent = "pi_1234567890123456";

    [Fact]
    public async Task Success_is_authoritative_and_replay_is_idempotent()
    {
        await using var f = await Fixture.Create();
        var r = await f.Hold();
        var gateway = new Gateway { Snapshot = Snapshot(r) };
        var service = new ShortStayPaymentReconciliationService(f.Db, gateway, new FixedClock());
        var e = Event(r, VerifiedShortStayPaymentKind.Succeeded);
        Assert.Equal(200, (await service.ReconcileAsync(e)).StatusCode);
        Assert.Equal(200, (await service.ReconcileAsync(e)).StatusCode);
        f.Db.ChangeTracker.Clear();
        var current = await f.Db.ShortStayReservations.SingleAsync();
        Assert.Equal(ShortStayReservationStatus.Confirmed, current.Status);
        Assert.Equal(3, current.RowVersion);
        Assert.Equal(2, await f.Db.ShortStayOccupancyClaims.CountAsync());
        Assert.Equal(2, gateway.Retrievals);
    }

    [Fact]
    public async Task Success_retrieved_before_expiry_confirms_and_late_replay_keeps_confirmation()
    {
        await using var f = await Fixture.Create();
        var r = await f.Hold();
        var clock = new FixedClock { UtcNow = r.HoldExpiresAtUtc.AddTicks(-1) };
        var gateway = new Gateway { Snapshot = Snapshot(r) };
        var service = new ShortStayPaymentReconciliationService(f.Db, gateway, clock);
        var e = Event(r, VerifiedShortStayPaymentKind.Succeeded);
        Assert.Equal(new ShortStayReconciliationOutcome(200, "confirmed"), await service.ReconcileAsync(e));
        clock.UtcNow = r.HoldExpiresAtUtc.AddMinutes(1);
        Assert.Equal(new ShortStayReconciliationOutcome(200, "confirmed"), await service.ReconcileAsync(e));
        f.Db.ChangeTracker.Clear();
        var current = await f.Db.ShortStayReservations.SingleAsync();
        Assert.Equal(ShortStayReservationStatus.Confirmed, current.Status);
        Assert.Equal(r.HoldExpiresAtUtc.AddTicks(-1), current.PaymentConfirmedAtUtc);
        Assert.Equal(3, current.RowVersion);
        Assert.Equal(2, await f.Db.ShortStayOccupancyClaims.CountAsync());
    }

    [Theory]
    [InlineData(ShortStayReservationStatus.PendingPayment)]
    [InlineData(ShortStayReservationStatus.Processing)]
    public async Task Success_retrieved_at_or_after_expiry_requires_refund_even_with_intact_claims(
        ShortStayReservationStatus initialStatus)
    {
        await using var f = await Fixture.Create();
        var r = await f.Hold();
        var clock = new FixedClock();
        var gateway = new Gateway { Snapshot = Snapshot(r) };
        var service = new ShortStayPaymentReconciliationService(f.Db, gateway, clock);
        if (initialStatus == ShortStayReservationStatus.Processing)
        {
            gateway.Snapshot = Snapshot(r) with { Status = "processing" };
            Assert.Equal(200, (await service.ReconcileAsync(Event(r, VerifiedShortStayPaymentKind.Processing))).StatusCode);
        }
        clock.UtcNow = r.HoldExpiresAtUtc; // No authoritative paid-at timestamp: fail closed even at the boundary.
        gateway.Snapshot = Snapshot(r);
        var e = Event(r, VerifiedShortStayPaymentKind.Succeeded);
        Assert.Equal(new ShortStayReconciliationOutcome(202, "refund_required"), await service.ReconcileAsync(e));
        Assert.Equal(new ShortStayReconciliationOutcome(202, "refund_required"), await service.ReconcileAsync(e));
        f.Db.ChangeTracker.Clear();
        var current = await f.Db.ShortStayReservations.SingleAsync();
        Assert.Equal(ShortStayReservationStatus.RefundRequired, current.Status);
        Assert.Null(current.PaymentConfirmedAtUtc);
        Assert.Equal(initialStatus == ShortStayReservationStatus.Processing ? 4 : 3, current.RowVersion);
        Assert.Equal(2, await f.Db.ShortStayOccupancyClaims.CountAsync());
        Assert.Equal(0, gateway.Refunds);
    }

    [Fact]
    public async Task Out_of_order_processing_then_delayed_success_does_not_confirm_or_release_claims()
    {
        await using var f = await Fixture.Create();
        var r = await f.Hold();
        var clock = new FixedClock { UtcNow = r.HoldExpiresAtUtc.AddSeconds(1) };
        var gateway = new Gateway { Snapshot = Snapshot(r) with { Status = "processing" } };
        var service = new ShortStayPaymentReconciliationService(f.Db, gateway, clock);
        // A delayed processing event after expiry must not expire PendingPayment before provider retrieval.
        Assert.Equal(new ShortStayReconciliationOutcome(200, "retryable"),
            await service.ReconcileAsync(Event(r, VerifiedShortStayPaymentKind.Processing)));
        gateway.Snapshot = Snapshot(r);
        Assert.Equal(new ShortStayReconciliationOutcome(202, "refund_required"),
            await service.ReconcileAsync(Event(r, VerifiedShortStayPaymentKind.Succeeded)));
        gateway.Snapshot = Snapshot(r) with { Status = "processing" };
        Assert.Equal(409, (await service.ReconcileAsync(Event(r, VerifiedShortStayPaymentKind.Processing))).StatusCode);
        f.Db.ChangeTracker.Clear();
        var current = await f.Db.ShortStayReservations.SingleAsync();
        Assert.Equal(ShortStayReservationStatus.RefundRequired, current.Status);
        Assert.Equal(2, await f.Db.ShortStayOccupancyClaims.CountAsync());
    }

    [Fact]
    public async Task Missing_intent_binding_only_recovers_pending_reservation_with_exact_metadata()
    {
        await using var f = await Fixture.Create();
        var r = await f.Hold();
        r.StripePaymentIntentId = null;
        await f.Db.SaveChangesAsync();
        f.Db.ChangeTracker.Clear();
        var gateway = new Gateway { Snapshot = Snapshot(r) };
        Assert.Equal(200, (await new ShortStayPaymentReconciliationService(f.Db, gateway, new FixedClock())
            .ReconcileAsync(Event(r, VerifiedShortStayPaymentKind.Succeeded))).StatusCode);
        f.Db.ChangeTracker.Clear();
        var current = await f.Db.ShortStayReservations.SingleAsync();
        Assert.Equal(Intent, current.StripePaymentIntentId);
        Assert.Equal(ShortStayReservationStatus.Confirmed, current.Status);
    }

    [Fact]
    public async Task Claim_conflict_does_not_confirm_and_marks_refund_required()
    {
        await using var f = await Fixture.Create();
        var r = await f.Hold();
        await f.Db.Database.ExecuteSqlRawAsync("DELETE FROM ShortStayOccupancyClaims WHERE Date = '2026-11-01'");
        f.Db.ChangeTracker.Clear();
        Assert.Equal(202, (await new ShortStayPaymentReconciliationService(f.Db,
            new Gateway { Snapshot = Snapshot(r) }, new FixedClock())
            .ReconcileAsync(Event(r, VerifiedShortStayPaymentKind.Succeeded))).StatusCode);
        f.Db.ChangeTracker.Clear();
        Assert.Equal(ShortStayReservationStatus.RefundRequired, (await f.Db.ShortStayReservations.SingleAsync()).Status);
        Assert.Single(await f.Db.ShortStayOccupancyClaims.ToListAsync());
    }

    [Fact]
    public async Task Stale_failure_event_cannot_reverse_provider_success()
    {
        await using var f = await Fixture.Create();
        var r = await f.Hold();
        Assert.Equal(409, (await new ShortStayPaymentReconciliationService(f.Db,
            new Gateway { Snapshot = Snapshot(r) }, new FixedClock())
            .ReconcileAsync(Event(r, VerifiedShortStayPaymentKind.Canceled))).StatusCode);
        f.Db.ChangeTracker.Clear();
        Assert.Equal(ShortStayReservationStatus.PendingPayment, (await f.Db.ShortStayReservations.SingleAsync()).Status);
    }

    [Theory]
    [InlineData("account")]
    [InlineData("amount")]
    [InlineData("currency")]
    [InlineData("metadata")]
    [InlineData("status")]
    [InlineData("id")]
    public async Task Untrusted_or_mismatching_snapshot_never_mutates(string mismatch)
    {
        await using var f = await Fixture.Create();
        var r = await f.Hold();
        var gateway = new Gateway { Snapshot = mismatch switch
        {
            "account" => Snapshot(r) with { AccountId = "acct_other" },
            "amount" => Snapshot(r) with { AmountCents = 1 },
            "currency" => Snapshot(r) with { Currency = "eur" },
            "metadata" => Snapshot(r) with { ReservationCode = "other" },
            "status" => Snapshot(r) with { Status = "processing" },
            _ => Snapshot(r) with { PaymentIntentId = "pi_other" }
        } };
        Assert.Equal(409, (await new ShortStayPaymentReconciliationService(f.Db, gateway, new FixedClock())
            .ReconcileAsync(Event(r, VerifiedShortStayPaymentKind.Succeeded))).StatusCode);
        f.Db.ChangeTracker.Clear();
        Assert.Equal(ShortStayReservationStatus.PendingPayment, (await f.Db.ShortStayReservations.SingleAsync()).Status);
    }

    [Fact]
    public async Task Event_account_mismatch_does_not_even_retrieve()
    {
        await using var f = await Fixture.Create();
        var r = await f.Hold();
        var gateway = new Gateway { Snapshot = Snapshot(r) };
        Assert.Equal(409, (await new ShortStayPaymentReconciliationService(f.Db, gateway, new FixedClock())
            .ReconcileAsync(Event(r, VerifiedShortStayPaymentKind.Succeeded) with { AccountId = "acct_other" })).StatusCode);
        Assert.Equal(0, gateway.Retrievals);
    }

    [Fact]
    public async Task Late_success_after_release_is_flagged_for_manual_refund_without_reclaiming()
    {
        await using var f = await Fixture.Create();
        var r = await f.Hold();
        r.Reconcile(ShortStayReservationStatus.Failed, Now);
        f.Db.ShortStayOccupancyClaims.RemoveRange(await f.Db.ShortStayOccupancyClaims.ToListAsync());
        await f.Db.SaveChangesAsync();
        f.Db.ChangeTracker.Clear();
        var gateway = new Gateway { Snapshot = Snapshot(r) };
        Assert.Equal(202, (await new ShortStayPaymentReconciliationService(f.Db, gateway, new FixedClock())
            .ReconcileAsync(Event(r, VerifiedShortStayPaymentKind.Succeeded))).StatusCode);
        f.Db.ChangeTracker.Clear();
        Assert.Equal(ShortStayReservationStatus.RefundRequired, (await f.Db.ShortStayReservations.SingleAsync()).Status);
        Assert.Empty(await f.Db.ShortStayOccupancyClaims.ToListAsync());
        Assert.Equal(0, gateway.Refunds);
    }

    [Fact]
    public async Task Provider_failure_and_unverified_dispute_fail_closed()
    {
        await using var f = await Fixture.Create();
        var r = await f.Hold();
        var gateway = new Gateway { Snapshot = Snapshot(r), FailRetrieve = true };
        var service = new ShortStayPaymentReconciliationService(f.Db, gateway, new FixedClock());
        Assert.Equal(503, (await service.ReconcileAsync(Event(r, VerifiedShortStayPaymentKind.Succeeded))).StatusCode);
        gateway.FailRetrieve = false;
        Assert.Equal(409, (await service.ReconcileAsync(Event(r, VerifiedShortStayPaymentKind.Disputed))).StatusCode);
        f.Db.ChangeTracker.Clear();
        Assert.Equal(ShortStayReservationStatus.PendingPayment, (await f.Db.ShortStayReservations.SingleAsync()).Status);
        Assert.Equal(2, await f.Db.ShortStayOccupancyClaims.CountAsync());
    }

    [Theory]
    [InlineData(VerifiedShortStayPaymentKind.PaymentFailed, "requires_payment_method", ShortStayReservationStatus.PendingPayment, 2)]
    [InlineData(VerifiedShortStayPaymentKind.Canceled, "canceled", ShortStayReservationStatus.Failed, 0)]
    public async Task Retryable_failure_keeps_claims_but_cancellation_releases(VerifiedShortStayPaymentKind type, string status, ShortStayReservationStatus expected, int claims)
    {
        await using var f = await Fixture.Create();
        var r = await f.Hold();
        var gateway = new Gateway { Snapshot = Snapshot(r) with { Status = status } };
        var service = new ShortStayPaymentReconciliationService(f.Db, gateway, new FixedClock());
        Assert.Equal(200, (await service.ReconcileAsync(Event(r, type))).StatusCode);
        Assert.Equal(200, (await service.ReconcileAsync(Event(r, type))).StatusCode);
        f.Db.ChangeTracker.Clear();
        Assert.Equal(expected, (await f.Db.ShortStayReservations.SingleAsync()).Status);
        Assert.Equal(claims, await f.Db.ShortStayOccupancyClaims.CountAsync());
    }

    [Fact]
    public async Task Recovery_refunds_late_success_once_and_releases_claims_only_on_authoritative_success()
    {
        await using var f = await Fixture.Create();
        var r = await f.Hold();
        var gateway = new Gateway { Snapshot = Snapshot(r) };
        var clock = new FixedClock { UtcNow = r.HoldExpiresAtUtc };
        Assert.Equal(202, (await new ShortStayPaymentReconciliationService(f.Db, gateway, clock)
            .ReconcileAsync(Event(r, VerifiedShortStayPaymentKind.Succeeded))).StatusCode);
        gateway.RefundSnapshot = new ShortStayRefund("re_123", "pending", r.TotalCents, Account);
        var recovery = new ShortStayRefundRecoveryService(f.Db, gateway, clock);
        Assert.Equal(1, await recovery.RunBatchAsync(10));
        f.Db.ChangeTracker.Clear();
        Assert.Equal(ShortStayReservationStatus.RefundRequired, (await f.Db.ShortStayReservations.SingleAsync()).Status);
        Assert.Equal(2, await f.Db.ShortStayOccupancyClaims.CountAsync());
        gateway.RefundSnapshot = gateway.RefundSnapshot with { Status = "succeeded" };
        Assert.Equal(1, await recovery.RunBatchAsync(10));
        f.Db.ChangeTracker.Clear();
        Assert.Equal(ShortStayReservationStatus.Refunded, (await f.Db.ShortStayReservations.SingleAsync()).Status);
        Assert.Empty(await f.Db.ShortStayOccupancyClaims.ToListAsync());
        Assert.Equal(1, gateway.Refunds);
    }

    [Fact]
    public async Task Ambiguous_refund_exception_holds_claims_and_reuses_operation_key()
    {
        await using var f = await Fixture.Create();
        var r = await f.Hold();
        var gateway = new Gateway { Snapshot = Snapshot(r), FailRefund = true };
        var clock = new FixedClock { UtcNow = r.HoldExpiresAtUtc };
        await new ShortStayPaymentReconciliationService(f.Db, gateway, clock)
            .ReconcileAsync(Event(r, VerifiedShortStayPaymentKind.Succeeded));
        var recovery = new ShortStayRefundRecoveryService(f.Db, gateway, clock);
        Assert.Equal(0, await recovery.RunBatchAsync());
        f.Db.ChangeTracker.Clear();
        Assert.Equal(2, await f.Db.ShortStayOccupancyClaims.CountAsync());
        Assert.Equal(ShortStayReservationStatus.RefundRequired, (await f.Db.ShortStayReservations.SingleAsync()).Status);
        Assert.Equal($"shortstay:{r.OperationId}:refund:v1", gateway.LastRefundKey);
        gateway.FailRefund = false;
        gateway.RefundSnapshot = new ShortStayRefund("re_123", "succeeded", r.TotalCents, Account);
        Assert.Equal(1, await recovery.RunBatchAsync());
        Assert.Equal(1, gateway.Refunds);
        Assert.Equal($"shortstay:{r.OperationId}:refund:v1", gateway.LastRefundKey);
    }

    [Theory]
    [InlineData("pending")]
    [InlineData("failed")]
    [InlineData("canceled")]
    [InlineData("partial")]
    public async Task Existing_refund_never_creates_second_or_releases_claims(string status)
    {
        await using var f = await Fixture.Create();
        var r = await f.Hold();
        var gateway = new Gateway { Snapshot = Snapshot(r), ExistingRefund = new ShortStayRefund(
            "re_existing", status == "partial" ? "succeeded" : status,
            status == "partial" ? 100 : r.TotalCents, Account, Intent) };
        var clock = new FixedClock { UtcNow = r.HoldExpiresAtUtc };
        await new ShortStayPaymentReconciliationService(f.Db, gateway, clock)
            .ReconcileAsync(Event(r, VerifiedShortStayPaymentKind.Succeeded));
        await new ShortStayRefundRecoveryService(f.Db, gateway, clock).RunBatchAsync();
        f.Db.ChangeTracker.Clear();
        Assert.Equal(0, gateway.Refunds);
        Assert.Equal(ShortStayReservationStatus.RefundRequired, (await f.Db.ShortStayReservations.SingleAsync()).Status);
        Assert.Equal(2, await f.Db.ShortStayOccupancyClaims.CountAsync());
    }

    private static VerifiedShortStayPaymentEvent Event(ShortStayReservation r, VerifiedShortStayPaymentKind type) =>
        new(type, Account, Intent, r.PublicCode);
    private static ShortStayIntent Snapshot(ShortStayReservation r) =>
        new(Intent, null, r.TotalCents, "usd", "succeeded", Account, r.PublicCode);

    private sealed class Gateway : IShortStayDirectChargeGateway
    {
        public ShortStayIntent Snapshot { get; set; } = null!;
        public int Retrievals { get; private set; }
        public int Refunds { get; private set; }
        public ShortStayRefund? RefundSnapshot { get; set; }
        public ShortStayRefund? ExistingRefund { get; set; }
        public bool FailRefund { get; set; }
        public string? LastRefundKey { get; private set; }
        public Task<IReadOnlyList<ShortStayRefund>> ListRefundsAsync(string a, string b, CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyList<ShortStayRefund>>(ExistingRefund is not null ? [ExistingRefund] : Refunds == 0 || RefundSnapshot is null ? [] :
                [RefundSnapshot with { PaymentIntentId = b }]);
        public bool FailRetrieve { get; set; }
        public Task<ShortStayIntent> RetrieveAsync(string accountId, string paymentIntentId, CancellationToken ct = default)
        { Retrievals++; if (FailRetrieve) throw new HttpRequestException("offline"); return Task.FromResult(Snapshot); }
        public Task<ShortStayIntent> CreatePaymentIntentAsync(string a, long b, string c, string d, string e, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<ShortStayIntent> CancelAsync(string a, string b, string c, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<ShortStayRefund> RefundAsync(string a, string b, long c, string d, CancellationToken ct = default)
        { Refunds++; LastRefundKey = d; if (FailRefund) throw new HttpRequestException("ambiguous"); return Task.FromResult(RefundSnapshot!); }
    }
    private sealed class FixedClock : TimeProvider
    {
        public DateTimeOffset UtcNow { get; set; } = Now;
        public override DateTimeOffset GetUtcNow() => UtcNow;
    }
    private sealed class Fixture : IAsyncDisposable
    {
        private readonly SqliteConnection _connection;
        public DataContext Db { get; }
        private Fixture(SqliteConnection connection)
        { _connection = connection; Db = new DataContext(new DbContextOptionsBuilder<DataContext>().UseSqlite(connection).Options); }
        public static async Task<Fixture> Create()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var f = new Fixture(connection);
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
            return f;
        }
        public async Task<ShortStayReservation> Hold()
        {
            var r = ShortStayReservation.CreateHold(1, 2, 3, 4, 5, Account, new DateOnly(2026, 11, 1),
                new DateOnly(2026, 11, 3), 1, [12000, 13000], Now.AddMinutes(10), Now);
            Db.ShortStayReservations.Add(r);
            await Db.SaveChangesAsync();
            r.BeginPayment(Now);
            r.AttachPaymentIntent(Intent, Now);
            await Db.SaveChangesAsync();
            Db.ChangeTracker.Clear();
            return await Db.ShortStayReservations.SingleAsync();
        }
        public async ValueTask DisposeAsync() { await Db.DisposeAsync(); await _connection.DisposeAsync(); }
    }
}
