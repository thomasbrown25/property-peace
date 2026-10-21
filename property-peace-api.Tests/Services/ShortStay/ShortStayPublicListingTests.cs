using System.Text.Json;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.ShortStay;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace brownstone_hub_api.Tests.Services.ShortStay;

public sealed class ShortStayPublicListingTests
{
    [Fact]
    public async Task Public_request_discovery_requires_both_switches_and_configured_owner_without_exposing_account()
    {
        await using var f = await Fixture.Create();
        var property = await f.Db.Properties.SingleAsync();
        property.LandlordId = 42;
        var owner = new User { Id = 42, StripeAccountId = "acct_private" };
        f.Db.Users.Add(owner);
        await f.Db.SaveChangesAsync();
        foreach (var (booking, payments, expected) in new[] { (false, false, false), (true, false, false),
            (false, true, false), (true, true, true) })
        {
            var service = f.WithSwitches(booking, payments);
            var listing = (await service.Get(10, default)).Listing!;
            Assert.Equal(expected, listing.BookingRequestsEnabled);
            Assert.False(listing.BookingAvailable);
            Assert.DoesNotContain("acct_private", JsonSerializer.Serialize(listing));
        }
        owner.StripeAccountId = null;
        await f.Db.SaveChangesAsync();
        Assert.False((await f.WithSwitches(true, true).Get(10, default)).Listing!.BookingRequestsEnabled);
    }
    [Fact]
    public async Task Published_guest_get_only_uses_safe_curated_copy_and_legacy_fallback()
    {
        await using var f = await Fixture.Create();
        var row = await f.Db.ShortStayListings.SingleAsync();
        var legacy = (await f.Service.Get(10, default)).Listing!;
        Assert.Equal("Short-stay accommodation", legacy.Title);
        Assert.Null(legacy.Description);
        row.PublicTitle = "  Sunny <b>loft</b>\u0001 ";
        row.PublicSummary = "  Walk to the park <img src=x onerror=alert(1)>  ";
        await f.Db.SaveChangesAsync();
        var safe = (await f.Service.Get(10, default)).Listing!;
        Assert.Equal("Sunny loft", safe.Title);
        Assert.Equal("Walk to the park", safe.Description);
        var json = JsonSerializer.Serialize(safe);
        Assert.DoesNotContain("<", json);
        Assert.DoesNotContain("private", json, StringComparison.OrdinalIgnoreCase);
        row.PublicTitle = "<script></script>";
        row.PublicSummary = "\u0001 <b></b> ";
        await f.Db.SaveChangesAsync();
        var empty = (await f.Service.Get(10, default)).Listing!;
        Assert.Equal("Short-stay accommodation", empty.Title);
        Assert.Null(empty.Description);
        row.PublicTitle = "A &lt;em&gt;bright&lt;/em&gt; space <img";
        row.PublicSummary = "Plain &lt;b&gt;summary&lt;/b&gt;";
        await f.Db.SaveChangesAsync();
        var encoded = (await f.Service.Get(10, default)).Listing!;
        Assert.Equal("A bright space img", encoded.Title);
        Assert.Equal("Plain summary", encoded.Description);
        Assert.DoesNotContain("<", JsonSerializer.Serialize(encoded));
    }
    [Fact]
    public async Task Anonymous_publication_is_allowlisted_and_unpublished_or_inactive_resources_are_invisible()
    {
        await using var f = await Fixture.Create();
        var (status, listing) = await f.Service.Get(10, default);
        Assert.Equal(200, status);
        var json = JsonSerializer.Serialize(listing);
        Assert.DoesNotContain("private", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("secret", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("StreetAddress", json);
        Assert.DoesNotContain("Landlord", json);
        Assert.DoesNotContain("Photos", json);
        Assert.Contains("America/New_York", json);
        Assert.False(listing!.BookingAvailable);
        var row = await f.Db.ShortStayListings.SingleAsync();
        row.Status = ShortStayListingStatus.Draft;
        await f.Db.SaveChangesAsync();
        Assert.Equal(404, (await f.Service.Get(10, default)).StatusCode);
        Assert.Equal(404, (await f.Service.Quote(10, new(new(2026, 3, 7), new(2026, 3, 9), 1), default)).StatusCode);
        row.Status = ShortStayListingStatus.Published;
        var property = await f.Db.Properties.SingleAsync();
        property.IsDeleted = true;
        await f.Db.SaveChangesAsync();
        Assert.Equal(404, (await f.Service.Get(10, default)).StatusCode);
        property.IsDeleted = false;
        var org = await f.Db.Organizations.SingleAsync();
        org.IsActive = false;
        await f.Db.SaveChangesAsync();
        Assert.Equal(404, (await f.Service.Get(10, default)).StatusCode);
        org.IsActive = true;
        org.IsDeleted = true;
        await f.Db.SaveChangesAsync();
        Assert.Equal(404, (await f.Service.Get(10, default)).StatusCode);
        org.IsDeleted = false;
        var unit = await f.Db.Units.SingleAsync();
        unit.OrganizationId = 21;
        await f.Db.SaveChangesAsync();
        Assert.Equal(404, (await f.Service.Get(10, default)).StatusCode);
    }

    [Fact]
    public async Task Anonymous_quote_uses_server_rates_and_reports_blocked_nights_without_inventory_sources()
    {
        await using var f = await Fixture.Create();
        var start = new DateOnly(2026, 3, 7);
        f.Db.ShortStayNightlyRateOverrides.Add(new() { UnitId = 10, Date = start.AddDays(1), NightlyRate = 100 });
        f.Db.ShortStayBlocks.Add(new() { UnitId = 10, StartDate = start, EndDate = start.AddDays(1) });
        f.Db.ShortStayIcalSubscriptions.Add(new() { UnitId = 10, OrgId = 20, Enabled = true, EncryptedUrl = "secret_feed_url", UrlFingerprint = "secret", LastSuccessAtUtc = new DateTime(2026, 3, 6, 12, 0, 0, DateTimeKind.Utc) });
        await f.Db.SaveChangesAsync();
        var (status, quote) = await f.Service.Quote(10, new(start, start.AddDays(2), 1), default);
        Assert.Equal(200, status);
        Assert.Equal("unavailable_nights", quote!.Reason);
        Assert.Equal(17500, quote.NightlySubtotalCents);
        Assert.Null(quote.TotalCents);
        Assert.DoesNotContain("secret", JsonSerializer.Serialize(quote));
        Assert.DoesNotContain("OwnerBlock", JsonSerializer.Serialize(quote));
        Assert.Equal(400, (await f.Service.Quote(10, new(start.AddDays(-1), start, 1), default)).StatusCode);
        Assert.Equal(400, (await f.Service.Quote(10, new(start, start.AddDays(31), 1), default)).StatusCode);
        Assert.Equal(400, (await f.Service.Quote(10, new(start, start.AddDays(2), 3), default)).StatusCode);
        var controller = new ShortStayPublicController(f.Service) { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };
        controller.HttpContext.Request.Query = new QueryCollection(new Dictionary<string, Microsoft.Extensions.Primitives.StringValues> { ["nightlyPrice"] = "1" });
        Assert.IsType<BadRequestObjectResult>(await controller.Quote(10, "2026-03-07", "2026-03-09", 1, default));
    }

    [Fact]
    public async Task Quote_requires_fresh_feed_and_attested_tax_but_never_claims_checkout()
    {
        await using var f = await Fixture.Create();
        var start = new DateOnly(2026, 3, 7);
        var request = new ShortStayQuoteRequest(start, start.AddDays(2), 2);
        Assert.Equal("calendar_feed_missing", (await f.Service.Quote(10, request, default)).Quote!.Reason);
        var subscription = new ShortStayIcalSubscription { UnitId = 10, OrgId = 20, Enabled = true,
            EncryptedUrl = "secret", UrlFingerprint = "secret" };
        f.Db.ShortStayIcalSubscriptions.Add(subscription);
        await f.Db.SaveChangesAsync();
        Assert.Equal("calendar_unverified", (await f.Service.Quote(10, request, default)).Quote!.Reason);
        subscription.LastSuccessAtUtc = new DateTime(2026, 3, 6, 12, 0, 0, DateTimeKind.Utc);
        await f.Db.SaveChangesAsync();
        Assert.Equal("tax_configuration_required", (await f.Service.Quote(10, request, default)).Quote!.Reason);
        var listing = await f.Db.ShortStayListings.SingleAsync();
        listing.LodgingTaxRatePercent = 10m;
        listing.TaxPolicyAttestedByUserId = 42;
        listing.TaxPolicyAttestedAtUtc = new DateTime(2026, 3, 5, 12, 0, 0, DateTimeKind.Utc);
        await f.Db.SaveChangesAsync();
        var quote = (await f.Service.Quote(10, request, default)).Quote!;
        Assert.Equal("preflight_available", quote.Status);
        Assert.Null(quote.Reason);
        Assert.Equal(15000, quote.NightlySubtotalCents);
        Assert.Equal(1500, quote.CleaningFeeCents);
        Assert.Equal(1650, quote.TaxCents);
        Assert.Equal(18150, quote.EstimatedTotalCents);
        Assert.Null(quote.TotalCents);
    }

    private sealed class FixedClock : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => new(2026, 3, 6, 12, 0, 0, TimeSpan.Zero);
    }
    private sealed class Fixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection;
        public SlimContext Db { get; }
        public ShortStayPublicService Service { get; }
        public ShortStayPublicService WithSwitches(bool booking, bool payments) => new(Db,
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
                ["ShortStayBooking:Enabled"] = booking.ToString(),
                ["ShortStayBooking:PaymentsEnabled"] = payments.ToString() }).Build(), new FixedClock());
        private Fixture(SqliteConnection connection, SlimContext db)
        {
            this.connection = connection; Db = db;
            Service = new(db, new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["ShortStayBooking:Enabled"] = "true" }).Build(), new FixedClock());
        }
        public static async Task<Fixture> Create()
        {
            var connection = new SqliteConnection("Data Source=:memory:;Foreign Keys=False");
            await connection.OpenAsync();
            var db = new SlimContext(new DbContextOptionsBuilder<DataContext>().UseSqlite(connection).Options);
            await db.Database.EnsureCreatedAsync();
            db.Organizations.Add(new Organization { Id = 20, IsActive = true });
            db.Properties.Add(new Property { Id = 7, OrganizationId = 20, TimeZoneId = "America/New_York", Name = "private address 12 Main St", Description = "private door code", StreetAddress = "private street", ContactEmail = "private@example.org", City = "Albany", State = "NY" });
            db.Units.Add(new Unit { Id = 10, PropertyId = 7, OrganizationId = 20, Name = "private suite", RentalMode = ERentalMode.ShortTerm });
            db.ShortStayListings.Add(new ShortStayListing { UnitId = 10, Status = ShortStayListingStatus.Published, NightlyBasePrice = 75, CleaningFee = 15, MinimumNights = 2, Capacity = 2, HouseRules = "private access", Amenities = "private wifi" });
            await db.SaveChangesAsync();
            return new(connection, db);
        }
        public async ValueTask DisposeAsync() { await Db.DisposeAsync(); await connection.DisposeAsync(); }
    }
    private sealed class SlimContext(DbContextOptions<DataContext> options) : DataContext(options)
    {
        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);
            var keep = new[] { typeof(Property), typeof(Unit), typeof(Organization), typeof(User), typeof(ShortStayListing), typeof(ShortStayBlock), typeof(ShortStayNightlyRateOverride), typeof(ShortStayIcalSubscription), typeof(ShortStayIcalOccurrence), typeof(ShortStayReservation), typeof(ShortStayReservationNight), typeof(ShortStayOccupancyClaim) };
            foreach (var entity in builder.Model.GetEntityTypes().ToList())
                if (!keep.Contains(entity.ClrType)) builder.Ignore(entity.ClrType);
            foreach (var entity in builder.Model.GetEntityTypes())
                foreach (var property in entity.GetProperties())
                    if (property.GetColumnType()?.Contains("(max)", StringComparison.OrdinalIgnoreCase) == true) property.SetColumnType("TEXT");
        }
    }
}
