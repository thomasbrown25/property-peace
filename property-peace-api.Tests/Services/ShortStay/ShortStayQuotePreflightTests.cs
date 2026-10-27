using System.Security.Claims;
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

public sealed class ShortStayQuotePreflightTests
{
    [Fact]
    public async Task Owner_preview_uses_database_prices_and_blocks_unverified_feed()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:;Foreign Keys=False");
        await connection.OpenAsync();
        await using var db = new SlimContext(new DbContextOptionsBuilder<DataContext>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();
        db.Organizations.Add(new Organization { Id = 20, IsActive = true });
        db.Properties.Add(new Property { Id = 7, OrganizationId = 20, TimeZoneId = "America/New_York" });
        db.Units.Add(new Unit { Id = 10, PropertyId = 7, OrganizationId = 20, Name = "Suite", RentalMode = ERentalMode.ShortTerm });
        db.OrganizationMembers.Add(new OrganizationMember { OrganizationId = 20, UserId = 42, Role = "Owner", IsActive = true });
        db.ShortStayListings.Add(new ShortStayListing { UnitId = 10, Status = ShortStayListingStatus.Published, NightlyBasePrice = 75m, CleaningFee = 15m, MinimumNights = 2, Capacity = 2 });
        var start = new DateOnly(2026, 3, 7);
        db.ShortStayNightlyRateOverrides.Add(new ShortStayNightlyRateOverride { UnitId = 10, Date = start.AddDays(1), NightlyRate = 100m });
        await db.SaveChangesAsync();
        var http = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "42")], "test")) };
        http.Items["UserId"] = 42L; http.Items["OrganizationId"] = 20L;
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ShortStayBooking:Enabled"] = "true", ["ShortStayBooking:TaxFeePolicy:LegallyReviewed"] = "true",
            ["ShortStayBooking:TaxFeePolicy:Tax"] = "0", ["ShortStayBooking:TaxFeePolicy:GuestFee"] = "0",
            ["ShortStayBooking:TaxFeePolicy:PlatformFee"] = "0"
        }).Build();
        var now = new DateTimeOffset(2026, 3, 6, 12, 0, 0, TimeSpan.Zero);
        var service = new ShortStayQuoteService(db, new HttpContextAccessor { HttpContext = http }, config, new FixedClock(now));
        var request = new ShortStayQuoteRequest(start, start.AddDays(2), 1);
        var (code, quote) = await service.Get(10, request, default);
        Assert.Equal(200, code); Assert.Equal("calendar_feed_missing", quote!.Reason);
        Assert.Null(quote.TotalCents);
        Assert.Equal(17500, quote.NightlySubtotalCents);
        Assert.Equal(new[] { 7500L, 10000L }, quote.Nights.Select(n => n.AmountCents));
        db.ShortStayIcalSubscriptions.Add(new ShortStayIcalSubscription { UnitId = 10, OrgId = 20, Enabled = true, EncryptedUrl = "secret", UrlFingerprint = "secret" });
        await db.SaveChangesAsync();
        Assert.Equal("calendar_unverified", (await service.Get(10, request, default)).Quote!.Reason);
        var subscription = await db.ShortStayIcalSubscriptions.SingleAsync();
        subscription.LastSuccessAtUtc = now.UtcDateTime;
        subscription.Occurrences.Add(new ShortStayIcalOccurrence { UidKey = "key", RecurrenceKey = "key", StartDate = start.AddDays(1), EndDate = start.AddDays(2) });
        await db.SaveChangesAsync();
        Assert.Equal("unavailable_nights", (await service.Get(10, request, default)).Quote!.Reason);
        subscription.LastSuccessAtUtc = now.AddDays(-2).UtcDateTime;
        await db.SaveChangesAsync();
        Assert.Equal("calendar_unverified", (await service.Get(10, request, default)).Quote!.Reason);
        subscription.LastSuccessAtUtc = now.UtcDateTime;
        subscription.ConsecutiveFailures = 1;
        await db.SaveChangesAsync();
        Assert.Equal("calendar_unverified", (await service.Get(10, request, default)).Quote!.Reason);
        subscription.ConsecutiveFailures = 0;
        subscription.FailureCode = "fetch_failed";
        subscription.LastAttemptAtUtc = now.AddMinutes(1).UtcDateTime;
        await db.SaveChangesAsync();
        Assert.Equal("calendar_unverified", (await service.Get(10, request, default)).Quote!.Reason);
        subscription.FailureCode = null;
        subscription.LastAttemptAtUtc = null;
        await db.SaveChangesAsync();
        var occurrence = await db.ShortStayIcalOccurrences.SingleAsync();
        db.ShortStayIcalOccurrences.Remove(occurrence);
        await db.SaveChangesAsync();
        Assert.Equal("tax_configuration_required", (await service.Get(10, request, default)).Quote!.Reason);
        var listing = await db.ShortStayListings.SingleAsync();
        listing.LodgingTaxRatePercent = 10m;
        listing.TaxPolicyAttestedAtUtc = now.AddDays(-1).UtcDateTime;
        listing.TaxPolicyAttestedByUserId = 42;
        await db.SaveChangesAsync();
        var configured = (await service.Get(10, request, default)).Quote!;
        Assert.Equal("preflight_available", configured.Status);
        Assert.Null(configured.Reason);
        Assert.Equal(1900, configured.TaxCents); // (175.00 lodging + 15.00 cleaning) * 10%
        Assert.Equal(20900, configured.EstimatedTotalCents);
        Assert.Null(configured.TotalCents);
        db.ShortStayReservations.Add(ShortStayReservation.CreateHold(10, 7, 20, 77, 42,
            "acct_private", start, start.AddDays(2), 1, [7500, 10000], now.AddHours(1), now));
        await db.SaveChangesAsync();
        Assert.Equal("unavailable_nights", (await service.Get(10, request, default)).Quote!.Reason);
        Assert.Equal(400, (await service.Get(10, new ShortStayQuoteRequest(start.AddDays(-2), start.AddDays(-1), 1), default)).StatusCode);
        // UTC date has changed to March 7, but New York is still on March 6.
        var boundaryService = new ShortStayQuoteService(db, new HttpContextAccessor { HttpContext = http }, config,
            new FixedClock(new DateTimeOffset(2026, 3, 7, 2, 0, 0, TimeSpan.Zero)));
        Assert.Equal(200, (await boundaryService.Get(10, new ShortStayQuoteRequest(start.AddDays(-1), start.AddDays(1), 1), default)).StatusCode);
        Assert.Equal(400, (await boundaryService.Get(10, new ShortStayQuoteRequest(start.AddDays(-2), start, 1), default)).StatusCode);
        http.Items["OrganizationId"] = 21L;
        Assert.Equal(403, (await service.Get(10, request, default)).StatusCode);
        http.Items["OrganizationId"] = 20L;
        var controller = new ShortStayQuoteController(service) { ControllerContext = new ControllerContext { HttpContext = http } };
        http.Request.Query = new QueryCollection(new Dictionary<string, Microsoft.Extensions.Primitives.StringValues>
        {
            ["checkIn"] = "2026-03-07", ["checkOut"] = "2026-03-09", ["guests"] = "1", ["nightlyPrice"] = "1"
        });
        Assert.IsType<BadRequestObjectResult>(await controller.Get(10, "2026-03-07", "2026-03-09", 1, default));
    }

    private sealed class FixedClock(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    private sealed class SlimContext(DbContextOptions<DataContext> options) : DataContext(options)
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            var keep = new[] { typeof(Property), typeof(Unit), typeof(Organization), typeof(OrganizationMember), typeof(ShortStayListing), typeof(ShortStayBlock), typeof(ShortStayNightlyRateOverride), typeof(ShortStayIcalSubscription), typeof(ShortStayIcalOccurrence), typeof(ShortStayReservation), typeof(ShortStayReservationNight), typeof(ShortStayOccupancyClaim) };
            foreach (var entity in modelBuilder.Model.GetEntityTypes().ToList())
                if (!keep.Contains(entity.ClrType)) modelBuilder.Ignore(entity.ClrType);
            foreach (var entity in modelBuilder.Model.GetEntityTypes())
                foreach (var property in entity.GetProperties())
                    if (property.GetColumnType()?.Contains("(max)", StringComparison.OrdinalIgnoreCase) == true) property.SetColumnType("TEXT");
        }
    }
}
