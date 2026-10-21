using System.Security.Claims;
using System.Text.Json;
using brownstone_hub_api.Attributes;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.ShortStay;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.ShortStay;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Units;

public sealed class ShortStayCalendarApiTests
{
    private static readonly DateOnly Spring = new(2026, 3, 8);
    private static readonly DateOnly Fall = new(2026, 11, 1);

    [Fact]
    public async Task Range_rate_upsert_is_half_open_atomic_and_authorized()
    {
        await using var f = await Fixture.Create(); var svc = f.Service(20);
        Assert.Equal(400, (await svc.PutRateRange(10, new(Spring, Spring, 125m))).StatusCode);
        Assert.Equal(400, (await svc.PutRateRange(10, new(Spring, Spring.AddDays(367), 125m))).StatusCode);
        Assert.Equal(400, (await svc.PutRateRange(10, new(Spring, Spring.AddDays(2), 0.001m))).StatusCode);
        Assert.NotEqual(200, (await f.Service(21).PutRateRange(10, new(Spring, Spring.AddDays(2), 125m))).StatusCode);
        Assert.Empty(await f.Db.ShortStayNightlyRateOverrides.ToListAsync());
        // HttpContextAccessor uses a shared AsyncLocal holder: creating another request accessor
        // replaces the ambient context, so restore the owner request before testing its writes.
        svc = f.Service(20);
        var first = await svc.PutRateRange(10, new(Spring, Spring.AddDays(2), 125m));
        Assert.True(first.StatusCode == 200, $"Expected 200, got {first.StatusCode}: {first.Message}");
        Assert.Equal(200, (await svc.PutRateRange(10, new(Spring.AddDays(1), Spring.AddDays(3), 140m))).StatusCode);
        var rows = await f.Db.ShortStayNightlyRateOverrides.OrderBy(r => r.Date).ToListAsync();
        Assert.Equal(new[] { Spring, Spring.AddDays(1), Spring.AddDays(2) }, rows.Select(r => r.Date));
        Assert.Equal(new[] { 125m, 140m, 140m }, rows.Select(r => r.NightlyRate));
    }

    [Fact]
    public async Task Calendar_exposes_effective_weekend_source_and_override_priority()
    {
        await using var f = await Fixture.Create(); var svc = f.Service(20);
        var friday = new DateOnly(2026, 3, 13);
        f.Db.ShortStayListings.Add(new ShortStayListing { UnitId = 10, NightlyBasePrice = 100m, WeekendNightlyRate = 150m });
        await f.Db.SaveChangesAsync();
        await svc.PutRate(10, friday.AddDays(1), new(175m));
        var nights = (await svc.Get(10, friday, friday.AddDays(3))).Data!.Nights;
        Assert.Equal(new[] { "Weekend", "Override", "Base" }, nights.Select(n => n.PriceSource));
        Assert.Equal(new decimal?[] { 150m, 175m, 100m }, nights.Select(n => n.EffectiveRate));
    }

    [Fact]
    public void Routes_are_owner_manager_only_and_separate_from_lease_calendar()
    {
        var type = typeof(ShortStayCalendarController);
        Assert.Equal("api/short-stay/units/{unitId:long}/calendar", Assert.Single(type.GetCustomAttributes(typeof(Microsoft.AspNetCore.Mvc.RouteAttribute), true).Cast<Microsoft.AspNetCore.Mvc.RouteAttribute>()).Template);
        Assert.NotNull(Assert.Single(type.GetCustomAttributes(typeof(AuthorizeAttribute), true)));
        foreach (var method in new[] { "Get", "PostBlock", "DeleteBlock", "PutRate", "DeleteRate" })
        {
            var roles = Assert.Single(type.GetMethod(method)!.GetCustomAttributes(typeof(RequireOrganizationRoleAttribute), true).Cast<RequireOrganizationRoleAttribute>()).AllowedRoles;
            Assert.Contains("Owner", roles); Assert.Contains("Manager", roles); Assert.DoesNotContain("Viewer", roles);
        }
    }

    [Fact]
    public async Task Controller_rejects_non_iso_dates_before_read_or_write()
    {
        await using var f = await Fixture.Create();
        var controller = new ShortStayCalendarController(f.Service(20));
        Assert.IsType<BadRequestObjectResult>(await controller.Get(10, "03/08/2026", "2026-03-09", default));
        Assert.IsType<BadRequestObjectResult>(await controller.Get(10, "2026-03-08T00:00:00Z", "2026-03-09", default));
        Assert.IsType<BadRequestObjectResult>(await controller.PutRate(10, "2026-3-8", new(100), default));
        Assert.IsType<BadRequestObjectResult>(await controller.DeleteRate(10, "2026-03-08T00:00Z", default));
        Assert.Empty(await f.Db.ShortStayNightlyRateOverrides.ToListAsync());
    }

    [Fact]
    public async Task Half_open_blocks_allow_adjacent_but_not_overlap_and_preserve_DST_local_dates()
    {
        await using var f = await Fixture.Create();
        var svc = f.Service(20);
        Assert.Equal(201, (await svc.PostBlock(10, new(Spring, Spring.AddDays(2), "Owner use"))).StatusCode);
        Assert.Equal(201, (await svc.PostBlock(10, new(Spring.AddDays(2), Spring.AddDays(3), null))).StatusCode);
        Assert.Equal(409, (await svc.PostBlock(10, new(Spring.AddDays(1), Spring.AddDays(3), null))).StatusCode);
        Assert.Equal(409, (await svc.PostBlock(10, new(Spring.AddDays(-1), Spring.AddDays(4), null))).StatusCode);
        Assert.Equal(201, (await svc.PostBlock(10, new(Fall, Fall.AddDays(1), null))).StatusCode);
        var calendar = (await svc.Get(10, Spring, Spring.AddDays(3))).Data!;
        Assert.Equal("America/New_York", calendar.TimeZoneId);
        Assert.Equal(2, calendar.Blocks.Count);
        Assert.All(calendar.Blocks, b => Assert.Equal("OwnerBlock", b.Source));
        Assert.Equal(Spring.AddDays(2), calendar.Blocks[0].EndDate);
        Assert.DoesNotContain(calendar.Blocks, b => b.StartDate == Fall);
        Assert.Equal(3, await f.Db.ShortStayBlocks.CountAsync());
    }

    [Fact]
    public async Task Imported_blocks_are_scoped_half_open_sourced_and_read_only_without_exposing_feed_identity()
    {
        await using var f = await Fixture.Create(); var svc = f.Service(20);
        var manual = (await svc.PostBlock(10, new(Spring, Spring.AddDays(2), "Owner use"))).Data!;
        var feed = new ShortStayIcalSubscription
        {
            UnitId = 10, OrgId = 20, Enabled = true, EncryptedUrl = "secret-url", UrlFingerprint = "secret-fingerprint",
            Occurrences = new List<ShortStayIcalOccurrence>
            {
                new() { UidKey = "secret-uid", RecurrenceKey = "secret-recurrence", StartDate = Spring.AddDays(-1), EndDate = Spring.AddDays(1) },
                new() { UidKey = "next-uid", RecurrenceKey = "next-recurrence", StartDate = Spring.AddDays(2), EndDate = Spring.AddDays(4) },
                new() { UidKey = "outside-uid", RecurrenceKey = "outside-recurrence", StartDate = Spring.AddDays(3), EndDate = Spring.AddDays(4) },
                new() { UidKey = "before-uid", RecurrenceKey = "before-recurrence", StartDate = Spring.AddDays(-2), EndDate = Spring }
            }
        };
        f.Db.ShortStayIcalSubscriptions.Add(feed);
        f.Db.ShortStayIcalSubscriptions.Add(new ShortStayIcalSubscription
        {
            UnitId = 11, OrgId = 20, Enabled = true, EncryptedUrl = "other-secret", UrlFingerprint = "other-fingerprint",
            Occurrences = new List<ShortStayIcalOccurrence> { new() { UidKey = "sibling", RecurrenceKey = "sibling", StartDate = Spring, EndDate = Spring.AddDays(1) } }
        });
        await f.Db.SaveChangesAsync();

        var calendar = (await svc.Get(10, Spring, Spring.AddDays(3))).Data!;
        Assert.Equal(3, calendar.Blocks.Count);
        Assert.Contains(calendar.Blocks, b => b.Id == manual.Id && b.Source == "OwnerBlock" && b.Reason == "Owner use");
        var imported = calendar.Blocks.Where(b => b.Source == "Airbnb").ToArray();
        Assert.Equal(2, imported.Length);
        Assert.Equal(new[] { Spring.AddDays(-1), Spring.AddDays(2) }, imported.Select(b => b.StartDate));
        Assert.All(imported, b => { Assert.True(b.Id < 0); Assert.Null(b.Reason); });
        Assert.Equal(400, (await svc.DeleteBlock(10, imported[0].Id)).StatusCode);
        Assert.Equal(imported[0].Id, (await svc.Get(10, Spring, Spring.AddDays(3))).Data!.Blocks.Single(b => b.StartDate == Spring.AddDays(-1)).Id);
        var json = JsonSerializer.Serialize(calendar);
        foreach (var secret in new[] { "secret-url", "secret-fingerprint", "secret-uid", "secret-recurrence", "next-uid", "next-recurrence", "sibling" })
            Assert.DoesNotContain(secret, json);
        Assert.Single(await f.Db.ShortStayBlocks.ToListAsync());
        Assert.Equal(5, await f.Db.ShortStayIcalOccurrences.CountAsync());
        // Imported occupancy does not change the owner-block overlap writer.
        Assert.Equal(201, (await svc.PostBlock(10, new(Spring.AddDays(2), Spring.AddDays(3), "Owner too"))).StatusCode);
        Assert.Equal(2, await f.Db.ShortStayBlocks.CountAsync());
        Assert.Equal(4, (await svc.Get(10, Spring, Spring.AddDays(3))).Data!.Blocks.Count);

        feed.Enabled = false; await f.Db.SaveChangesAsync();
        Assert.Equal(2, (await svc.Get(10, Spring, Spring.AddDays(3))).Data!.Blocks.Count);
        Assert.Single((await svc.Get(11, Spring, Spring.AddDays(3))).Data!.Blocks);
        Assert.Equal(404, (await f.Service(21).Get(10, Spring, Spring.AddDays(3))).StatusCode);
    }

    [Fact]
    public async Task Subscription_with_wrong_org_never_exposes_import_even_for_correct_unit()
    {
        await using var f = await Fixture.Create();
        f.Db.ShortStayIcalSubscriptions.Add(new ShortStayIcalSubscription
        {
            UnitId = 10, OrgId = 21, Enabled = true, EncryptedUrl = "secret", UrlFingerprint = "fingerprint",
            Occurrences = new List<ShortStayIcalOccurrence> { new() { UidKey = "uid", RecurrenceKey = "recurrence", StartDate = Spring, EndDate = Spring.AddDays(1) } }
        });
        await f.Db.SaveChangesAsync();
        Assert.Empty((await f.Service(20).Get(10, Spring, Spring.AddDays(1))).Data!.Blocks);
    }

    [Fact]
    public async Task Rates_are_upserted_per_local_date_and_effective_base_is_optional()
    {
        await using var f = await Fixture.Create(); var svc = f.Service(20);
        Assert.Null((await svc.Get(10, Spring, Spring.AddDays(2))).Data!.Nights[0].EffectiveRate);
        f.Db.ShortStayListings.Add(new ShortStayListing { UnitId = 10, NightlyBasePrice = 125 });
        await f.Db.SaveChangesAsync();
        Assert.Equal(201, (await svc.PutRate(10, Spring, new(129.50m))).StatusCode);
        Assert.Equal(200, (await svc.PutRate(10, Spring, new(130.25m))).StatusCode);
        var nights = (await svc.Get(10, Spring, Spring.AddDays(2))).Data!.Nights;
        Assert.Equal(130.25m, nights[0].EffectiveRate); Assert.Equal(130.25m, nights[0].OverrideRate);
        Assert.Equal(125m, nights[1].EffectiveRate); Assert.Null(nights[1].OverrideRate);
        Assert.Equal(1, await f.Db.ShortStayNightlyRateOverrides.CountAsync());
        Assert.Equal(200, (await svc.DeleteRate(10, Spring)).StatusCode);
        Assert.Equal(125m, (await svc.Get(10, Spring, Spring.AddDays(1))).Data!.Nights[0].EffectiveRate);
    }

    [Fact]
    public async Task Scope_membership_siblings_and_delete_ownership_are_enforced()
    {
        await using var f = await Fixture.Create(); var owner = f.Service(20);
        var block = (await owner.PostBlock(10, new(Spring, Spring.AddDays(1), null))).Data!;
        await owner.PutRate(10, Spring, new(140));
        foreach (var svc in new[] { f.Service(null), f.Service(20, 99), f.Service(21) })
        {
            Assert.NotEqual(200, (await svc.Get(10, Spring, Spring.AddDays(1))).StatusCode);
            Assert.NotEqual(201, (await svc.PostBlock(10, new(Fall, Fall.AddDays(1), null))).StatusCode);
            Assert.NotEqual(200, (await svc.DeleteBlock(10, block.Id)).StatusCode);
            Assert.NotEqual(200, (await svc.DeleteRate(10, Spring)).StatusCode);
        }
        var member = await f.Db.OrganizationMembers.SingleAsync(m => m.OrganizationId == 20); member.Role = "Viewer"; await f.Db.SaveChangesAsync();
        owner = f.Service(20);
        Assert.Equal(403, (await owner.Get(10, Spring, Spring.AddDays(1))).StatusCode);
        Assert.Equal(403, (await owner.PutRate(10, Fall, new(100))).StatusCode);
        member.Role = "Manager"; member.CanManageProperties = false; await f.Db.SaveChangesAsync();
        Assert.Equal(403, (await owner.DeleteBlock(10, block.Id)).StatusCode);
        member.CanManageProperties = true; await f.Db.SaveChangesAsync();
        Assert.Equal(201, (await owner.PostBlock(11, new(Spring, Spring.AddDays(1), null))).StatusCode);
        Assert.Single((await owner.Get(10, Spring, Spring.AddDays(1))).Data!.Blocks);
        Assert.Single((await owner.Get(11, Spring, Spring.AddDays(1))).Data!.Blocks);
        Assert.Null((await owner.Get(11, Spring, Spring.AddDays(1))).Data!.Nights[0].OverrideRate);
        Assert.Equal(404, (await owner.DeleteBlock(11, block.Id)).StatusCode);
        Assert.Equal(200, (await owner.DeleteBlock(10, block.Id)).StatusCode);
        Assert.Equal(404, (await owner.DeleteBlock(10, block.Id)).StatusCode);
        Assert.Equal(404, (await owner.DeleteRate(11, Spring)).StatusCode);
    }

    [Fact]
    public async Task Invalid_ranges_prices_modes_and_zones_fail_closed()
    {
        await using var f = await Fixture.Create(); var svc = f.Service(20);
        Assert.Equal(400, (await svc.Get(10, Spring, Spring)).StatusCode);
        Assert.Equal(400, (await svc.Get(10, Spring, Spring.AddDays(367))).StatusCode);
        Assert.Equal(400, (await svc.PostBlock(10, new(Spring, Spring, null))).StatusCode);
        Assert.Equal(400, (await svc.PostBlock(10, new(Spring, Spring.AddDays(367), null))).StatusCode);
        Assert.Equal(400, (await svc.PostBlock(10, new(Spring, Spring.AddDays(1), new string('x', 501)))).StatusCode);
        foreach (var rate in new[] { 0m, -1m, 1.001m, 1000000m })
            Assert.Equal(400, (await svc.PutRate(10, Spring, new(rate))).StatusCode);
        Assert.Empty(await f.Db.ShortStayBlocks.ToListAsync());
        Assert.Empty(await f.Db.ShortStayNightlyRateOverrides.ToListAsync());
        var unit = await f.Db.Units.SingleAsync(u => u.Id == 10); unit.RentalMode = ERentalMode.LongTerm; await f.Db.SaveChangesAsync();
        Assert.Equal(409, (await svc.PostBlock(10, new(Spring, Spring.AddDays(1), null))).StatusCode);
        Assert.Equal(409, (await svc.PutRate(10, Spring, new(100))).StatusCode);
        Assert.Equal(409, (await svc.Get(10, Spring, Spring.AddDays(1))).StatusCode);
        Assert.Equal(409, (await svc.DeleteRate(10, Spring)).StatusCode);
        unit.RentalMode = ERentalMode.ShortTerm;
        var property = await f.Db.Properties.SingleAsync(); property.TimeZoneId = "Mars/Olympus"; await f.Db.SaveChangesAsync();
        Assert.Equal(409, (await svc.Get(10, Spring, Spring.AddDays(1))).StatusCode);
        Assert.Equal(409, (await svc.PostBlock(10, new(Spring, Spring.AddDays(1), null))).StatusCode);
    }

    [Fact]
    public async Task Claims_remain_visible_without_feed_and_owner_blocks_cannot_overlap()
    {
        await using var f = await Fixture.Create();
        var now = DateTimeOffset.UtcNow;
        f.Db.ShortStayReservations.Add(ShortStayReservation.CreateHold(10, 7, 20, 77, 42, "acct_private",
            Spring, Spring.AddDays(2), 1, [12000, 12000], now.AddHours(1), now));
        await f.Db.SaveChangesAsync();
        var calendar = (await f.Service(20).Get(10, Spring, Spring.AddDays(3))).Data!;
        Assert.Equal(new[] { "Held", "Held" }, calendar.Blocks.Select(b => b.Source));
        Assert.All(calendar.Blocks, b => { Assert.True(b.Id < 0); Assert.Null(b.Reason); });
        Assert.Equal(400, (await f.Service(20).DeleteBlock(10, calendar.Blocks[0].Id)).StatusCode);
        Assert.Equal(409, (await f.Service(20).PostBlock(10, new(Spring, Spring.AddDays(1), null))).StatusCode);
        Assert.Equal(201, (await f.Service(20).PostBlock(10, new(Spring.AddDays(2), Spring.AddDays(3), null))).StatusCode);
        Assert.DoesNotContain("acct_private", JsonSerializer.Serialize(calendar));
        Assert.Equal(201, (await f.Service(20).PutRate(10, Spring, new(90))).StatusCode);
        Assert.Equal(12000, (await f.Db.ShortStayReservationNights.AsNoTracking().SingleAsync(n => n.Date == Spring)).PriceCents);
        Assert.Equal(2, (await f.Service(20).Get(10, Spring, Spring.AddDays(2))).Data!.Blocks.Count);
        await f.Db.Database.ExecuteSqlRawAsync("UPDATE ShortStayReservations SET Status = 'Confirmed', StripePaymentIntentId = 'pi_test', PaymentConfirmedAtUtc = CreatedAtUtc");
        Assert.All((await f.Service(20).Get(10, Spring, Spring.AddDays(2))).Data!.Blocks,
            b => Assert.Equal("Confirmed", b.Source));
    }

    private sealed class Fixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection;
        public DataContext Db { get; }
        private Fixture(SqliteConnection connection, DataContext db) { this.connection = connection; Db = db; }
        public static async Task<Fixture> Create()
        {
            var connection = new SqliteConnection("Data Source=:memory:;Foreign Keys=False"); await connection.OpenAsync();
            var db = new SlimContext(new DbContextOptionsBuilder<DataContext>().UseSqlite(connection).Options);
            await db.Database.EnsureCreatedAsync();
            db.Organizations.AddRange(new Organization { Id = 20, IsActive = true }, new Organization { Id = 21, IsActive = true });
            db.Properties.Add(new Property { Id = 7, OrganizationId = 20, TimeZoneId = "America/New_York" });
            db.Units.AddRange(new Unit { Id = 10, PropertyId = 7, OrganizationId = 20, Name = "Suite", RentalMode = ERentalMode.ShortTerm }, new Unit { Id = 11, PropertyId = 7, OrganizationId = 20, Name = "Sibling", RentalMode = ERentalMode.ShortTerm });
            db.OrganizationMembers.AddRange(new OrganizationMember { OrganizationId = 20, UserId = 42, Role = "Owner", IsActive = true }, new OrganizationMember { OrganizationId = 21, UserId = 42, Role = "Owner", IsActive = true });
            await db.SaveChangesAsync(); return new(connection, db);
        }
        public ShortStayCalendarService Service(long? org, long subject = 42)
        {
            var http = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, subject.ToString())], "test")) };
            if (org.HasValue) http.Items["OrganizationId"] = org.Value;
            http.Items["UserId"] = 42L;
            return new ShortStayCalendarService(Db, new HttpContextAccessor { HttpContext = http }, NullLogger<ShortStayCalendarService>.Instance);
        }
        public async ValueTask DisposeAsync() { await Db.DisposeAsync(); await connection.DisposeAsync(); }
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
