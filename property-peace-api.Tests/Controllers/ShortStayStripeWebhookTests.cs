using System.Security.Cryptography;
using System.Text;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Services.ShortStay;
using brownstone_hub_api.Services.ShortStayStripe;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class ShortStayStripeWebhookTests
{
    private const string Secret = "whsec_shortstay_test";
    private const string Account = "acct_1234567890123456";
    private const string Intent = "pi_1234567890123456";
    private static string Payload(string account = Account, string type = "payment_intent.succeeded", string id = Intent) =>
        System.Text.Json.JsonSerializer.Serialize(new Dictionary<string, object?>
        {
            ["id"] = "evt_123", ["object"] = "event", ["api_version"] = "2025-02-24.acacia",
            ["livemode"] = false, ["account"] = account, ["type"] = type,
            ["created"] = 1750000000, ["pending_webhooks"] = 1,
            ["request"] = new { id = (string?)null, idempotency_key = (string?)null },
            ["data"] = new { @object = new { id, @object = "payment_intent", amount = 25000,
                currency = "usd", metadata = new Dictionary<string, string> { ["reservation_code"] = "ABCD1234" } } }
        });
    private static string Sign(string body, string secret = Secret, long? at = null)
    {
        var stamp = at ?? DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        return $"t={stamp},v1={Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes($"{stamp}.{body}"))).ToLowerInvariant()}";
    }
    private static (ShortStayStripeWebhookController Controller, DataContext Db) Setup(string body, string? signingSecret = Secret,
        string? configuredSecret = Secret, long? timestamp = null, string? key = "sk_test_fake", long? length = null)
    {
        var db = new DataContext(new DbContextOptionsBuilder<DataContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ShortStayBooking:ConnectWebhookSecret"] = configuredSecret, ["Stripe:SecretKey"] = key
        }).Build();
        var controller = new ShortStayStripeWebhookController(config,
            new ShortStayPaymentReconciliationService(db, new NoNetworkGateway(), TimeProvider.System))
        { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };
        controller.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(body));
        controller.Request.ContentLength = length;
        if (signingSecret != null) controller.Request.Headers["Stripe-Signature"] = Sign(body, signingSecret, timestamp);
        return (controller, db);
    }
    [Fact]
    public void Route_is_anonymous_and_dedicated()
    {
        Assert.Equal("api/short-stay/stripe/webhook", Assert.Single(typeof(ShortStayStripeWebhookController).GetCustomAttributes(typeof(RouteAttribute), false).Cast<RouteAttribute>()).Template);
        Assert.NotNull(Assert.Single(typeof(ShortStayStripeWebhookController).GetCustomAttributes(typeof(AllowAnonymousAttribute), false)));
    }
    [Theory]
    [InlineData("missing")]
    [InlineData("wrong")]
    [InlineData("tampered")]
    [InlineData("stale")]
    [InlineData("future")]
    public async Task Invalid_signatures_never_reconcile(string failure)
    {
        var body = Payload();
        var (controller, db) = Setup(failure == "tampered" ? Payload(id: "pi_9999999999999999") : body,
            failure == "missing" ? null : failure == "wrong" ? "whsec_wrong" : Secret,
            timestamp: failure == "stale" ? DateTimeOffset.UtcNow.AddMinutes(-6).ToUnixTimeSeconds() :
                failure == "future" ? DateTimeOffset.UtcNow.AddMinutes(6).ToUnixTimeSeconds() : null);
        if (failure == "tampered") controller.Request.Headers["Stripe-Signature"] = Sign(body);
        Assert.Equal(400, (await controller.Post()).StatusCode());
        Assert.Empty(db.ChangeTracker.Entries());
        await db.DisposeAsync();
    }
    [Fact]
    public async Task Signed_incompatible_api_version_is_rejected()
    {
        var (c, db) = Setup(Payload().Replace("2025-02-24.acacia", "2020-08-27"));
        Assert.Equal(400, (await c.Post()).StatusCode());
        await db.DisposeAsync();
    }
    [Theory]
    [InlineData("pi_invalid")]
    [InlineData("")]
    public async Task Signed_invalid_intent_id_is_rejected(string id)
    {
        var (c, db) = Setup(Payload(id: id));
        Assert.Equal(400, (await c.Post()).StatusCode());
        await db.DisposeAsync();
    }
    [Fact]
    public async Task Missing_configuration_is_unavailable()
    {
        var (c, db) = Setup(Payload(), configuredSecret: null);
        Assert.Equal(503, (await c.Post()).StatusCode());
        await db.DisposeAsync();
    }
    [Theory]
    [InlineData(262145L)]
    [InlineData(null)]
    public async Task Oversized_body_is_rejected_with_and_without_content_length(long? claimed)
    {
        var body = Payload() + new string(' ', 262145);
        var (c, db) = Setup(body, length: claimed);
        Assert.Equal(413, (await c.Post()).StatusCode());
        await db.DisposeAsync();
    }
    [Fact]
    public async Task Signed_missing_account_is_rejected()
    {
        var (c, db) = Setup(Payload(account: ""));
        Assert.Equal(400, (await c.Post()).StatusCode());
        await db.DisposeAsync();
    }
    [Fact]
    public async Task Signed_unsupported_event_is_safely_skipped()
    {
        var (c, db) = Setup(Payload(type: "charge.dispute.created"));
        Assert.Equal(200, (await c.Post()).StatusCode());
        await db.DisposeAsync();
    }
    [Fact]
    public async Task Signed_valid_intent_reaches_authoritative_reconciler_and_mismatch_retries()
    {
        var payload = Payload();
        var parsed = Stripe.EventUtility.ConstructEvent(payload, Sign(payload), Secret, tolerance: 300, throwOnApiVersionMismatch: true);
        Assert.NotNull(parsed.Data?.Object);
        var (c, db) = Setup(payload);
        Assert.Equal(409, (await c.Post()).StatusCode()); // No persisted reservation; cannot trust signed payload alone.
        await db.DisposeAsync();
    }
    [Fact]
    public async Task Wrong_key_mode_rejected()
    {
        var (c, db) = Setup(Payload(), key: "sk_live_fake");
        Assert.Equal(400, (await c.Post()).StatusCode());
        await db.DisposeAsync();
    }
    [Fact]
    public async Task Signed_duplicate_success_acknowledged_without_duplicate_booking()
    {
        await using var connection = new Microsoft.Data.Sqlite.SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new DataContext(new DbContextOptionsBuilder<DataContext>().UseSqlite(connection).Options);
        foreach (var table in new[] { "Units", "Properties", "Organizations", "Users" })
            await db.Database.ExecuteSqlRawAsync($"CREATE TABLE {table} (Id INTEGER PRIMARY KEY)");
        foreach (var (table, id) in new[] { ("Units", 1), ("Properties", 2), ("Organizations", 3), ("Users", 4), ("Users", 5) })
            await db.Database.ExecuteSqlRawAsync($"INSERT INTO {table} (Id) VALUES ({id})");
        var ddl = db.Database.GenerateCreateScript();
        foreach (var table in new[] { "ShortStayReservations", "ShortStayReservationNights", "ShortStayOccupancyClaims" })
        {
            var create = System.Text.RegularExpressions.Regex.Match(ddl, $"CREATE TABLE [^;]*\\\"{table}\\\"[^;]*;", System.Text.RegularExpressions.RegexOptions.Singleline);
            await db.Database.ExecuteSqlRawAsync(create.Value);
            foreach (System.Text.RegularExpressions.Match index in System.Text.RegularExpressions.Regex.Matches(ddl,
                         $"CREATE (?:UNIQUE )?INDEX [^;]* ON \\\"{table}\\\"[^;]*;", System.Text.RegularExpressions.RegexOptions.Singleline))
                await db.Database.ExecuteSqlRawAsync(index.Value);
        }
        var now = DateTimeOffset.UtcNow;
        var reservation = brownstone_hub_api.Models.ShortStayReservation.CreateHold(1, 2, 3, 4, 5, Account,
            new DateOnly(2026, 11, 1), new DateOnly(2026, 11, 3), 1, [12000, 13000], now.AddMinutes(10), now);
        db.ShortStayReservations.Add(reservation);
        await db.SaveChangesAsync();
        reservation.BeginPayment(now);
        reservation.AttachPaymentIntent(Intent, now);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var body = Payload().Replace("ABCD1234", reservation.PublicCode);
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            { ["ShortStayBooking:ConnectWebhookSecret"] = Secret, ["Stripe:SecretKey"] = "sk_test_fake" }).Build();
        var reconciler = new ShortStayPaymentReconciliationService(db,
            new SnapshotGateway(new ShortStayIntent(Intent, null, reservation.TotalCents, "usd", "succeeded", Account, reservation.PublicCode)),
            TimeProvider.System);
        async Task<int> Deliver()
        {
            var c = new ShortStayStripeWebhookController(config, reconciler)
                { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };
            c.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(body));
            c.Request.Headers["Stripe-Signature"] = Sign(body);
            return (await c.Post()).StatusCode();
        }
        Assert.Equal(200, await Deliver());
        Assert.Equal(200, await Deliver());
        db.ChangeTracker.Clear();
        Assert.Single(await db.ShortStayReservations.ToListAsync());
        Assert.Equal(brownstone_hub_api.Models.ShortStayReservationStatus.Confirmed,
            (await db.ShortStayReservations.SingleAsync()).Status);
    }
    private sealed class SnapshotGateway(ShortStayIntent snapshot) : IShortStayDirectChargeGateway
    {
        public Task<ShortStayIntent> RetrieveAsync(string a, string b, CancellationToken ct = default) => Task.FromResult(snapshot);
        public Task<ShortStayIntent> CreatePaymentIntentAsync(string a, long b, string c, string d, string e, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<ShortStayIntent> CancelAsync(string a, string b, string c, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<ShortStayRefund> RefundAsync(string a, string b, long c, string d, CancellationToken ct = default) => throw new NotSupportedException();
    }
    private sealed class NoNetworkGateway : IShortStayDirectChargeGateway
    {
        public Task<ShortStayIntent> RetrieveAsync(string a, string b, CancellationToken ct = default) => throw new Exception("unexpected provider call");
        public Task<ShortStayIntent> CreatePaymentIntentAsync(string a, long b, string c, string d, string e, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<ShortStayIntent> CancelAsync(string a, string b, string c, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<ShortStayRefund> RefundAsync(string a, string b, long c, string d, CancellationToken ct = default) => throw new NotSupportedException();
    }
}
internal static class WebhookResultTestExtensions
{
    public static int StatusCode(this IActionResult result) => result switch
    {
        StatusCodeResult s => s.StatusCode,
        ObjectResult o => o.StatusCode ?? 200,
        _ => 200
    };
}
