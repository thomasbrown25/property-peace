using System.Security.Claims;
using brownstone_hub_api.Attributes;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.ShortStay;
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

public sealed class ShortStayPropertyTimeZoneApiTests
{
    [Fact]
    public void Routes_require_authentication_and_owner_or_manager()
    {
        var controller = typeof(ShortStayPropertyTimeZoneController);
        Assert.Equal("api/short-stay/properties/{propertyId:long}/timezone", Assert.Single(controller.GetCustomAttributes(typeof(RouteAttribute), true).Cast<RouteAttribute>()).Template);
        Assert.NotNull(Assert.Single(controller.GetCustomAttributes(typeof(AuthorizeAttribute), true)));
        foreach (var name in new[] { nameof(ShortStayPropertyTimeZoneController.Get), nameof(ShortStayPropertyTimeZoneController.Put) })
        {
            var roles = Assert.Single(controller.GetMethod(name)!.GetCustomAttributes(typeof(RequireOrganizationRoleAttribute), true)
                .Cast<RequireOrganizationRoleAttribute>()).AllowedRoles;
            Assert.Contains("Owner", roles);
            Assert.Contains("Manager", roles);
            Assert.DoesNotContain("Viewer", roles);
        }
    }

    [Fact]
    public async Task Owner_reads_nullable_zone_and_sets_only_zone_without_clobbering_other_fields()
    {
        await using var f = await Fixture.Create();
        var service = f.Service(20);
        var initial = await service.Get(7);
        Assert.Equal(200, initial.StatusCode);
        Assert.Null(initial.Data!.TimeZoneId);
        Assert.Equal(200, (await service.Put(7, new("America/New_York"))).StatusCode);
        f.Db.ChangeTracker.Clear();
        var saved = await f.Db.Properties.SingleAsync();
        Assert.Equal("America/New_York", saved.TimeZoneId);
        Assert.Equal("Original", saved.Name);
        Assert.Equal(20, saved.OrganizationId);
        Assert.Equal("America/New_York", (await service.Get(7)).Data!.TimeZoneId);
        Assert.Equal(200, (await service.Put(7, new("UTC"))).StatusCode);
        f.Db.ChangeTracker.Clear();
        Assert.Equal("UTC", (await f.Db.Properties.SingleAsync()).TimeZoneId);
    }

    [Theory]
    [InlineData("listing")]
    [InlineData("block")]
    [InlineData("rate")]
    public async Task Different_zone_is_conflict_when_any_sibling_has_short_stay_inventory(string kind)
    {
        await using var f = await Fixture.Create();
        var service = f.Service(20);
        Assert.Equal(200, (await service.Put(7, new("America/New_York"))).StatusCode);
        f.Db.Units.AddRange(new Unit { Id = 10, PropertyId = 7, Name = "First" },
            new Unit { Id = 11, PropertyId = 7, Name = "Sibling" });
        await f.Db.SaveChangesAsync();
        switch (kind)
        {
            case "listing": f.Db.ShortStayListings.Add(new ShortStayListing { UnitId = 11, NightlyBasePrice = 100 }); break;
            case "block": f.Db.ShortStayBlocks.Add(new ShortStayBlock { UnitId = 11, StartDate = new(2026, 3, 8), EndDate = new(2026, 3, 9) }); break;
            case "rate": f.Db.ShortStayNightlyRateOverrides.Add(new ShortStayNightlyRateOverride { UnitId = 11, Date = new(2026, 3, 8), NightlyRate = 100 }); break;
        }
        await f.Db.SaveChangesAsync();
        var conflict = await service.Put(7, new("America/Los_Angeles"));
        Assert.Equal(409, conflict.StatusCode);
        Assert.Contains("review", conflict.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(200, (await service.Put(7, new("America/New_York"))).StatusCode);
        f.Db.ChangeTracker.Clear();
        Assert.Equal("America/New_York", (await f.Db.Properties.SingleAsync()).TimeZoneId);
    }

    [Theory]
    [InlineData(true, false, 10)]  // A connected feed protects its local-date interpretation even before first sync.
    [InlineData(false, true, 10)]  // Disabling a feed does not discard retained imported dates.
    [InlineData(false, true, 11)]  // Check the entire property, not just the first unit.
    public async Task Different_zone_conflicts_with_airbnb_subscription_or_retained_occurrences(bool enabled, bool occurrence, long feedUnitId)
    {
        await using var f = await Fixture.Create();
        var service = f.Service(20);
        Assert.Equal(200, (await service.Put(7, new("America/New_York"))).StatusCode);
        f.Db.Units.AddRange(new Unit { Id = 10, PropertyId = 7, Name = "First" },
            new Unit { Id = 11, PropertyId = 7, Name = "Sibling" });
        var sub = new ShortStayIcalSubscription
        {
            UnitId = feedUnitId, OrgId = 20, Enabled = enabled,
            EncryptedUrl = "encrypted", UrlFingerprint = "fingerprint"
        };
        f.Db.ShortStayIcalSubscriptions.Add(sub);
        if (occurrence)
            f.Db.ShortStayIcalOccurrences.Add(new ShortStayIcalOccurrence
            {
                Subscription = sub, UidKey = "uid", RecurrenceKey = "recurrence",
                StartDate = new(2026, 3, 8), EndDate = new(2026, 3, 9)
            });
        await f.Db.SaveChangesAsync();

        var conflict = await service.Put(7, new("America/Los_Angeles"));
        Assert.Equal(409, conflict.StatusCode);
        Assert.Contains("review", conflict.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(200, (await service.Put(7, new("America/New_York"))).StatusCode);
        f.Db.ChangeTracker.Clear();
        Assert.Equal("America/New_York", (await f.Db.Properties.SingleAsync()).TimeZoneId);
    }

    [Fact]
    public async Task Zone_can_change_after_airbnb_feed_and_occurrences_are_deleted()
    {
        await using var f = await Fixture.Create();
        var service = f.Service(20);
        Assert.Equal(200, (await service.Put(7, new("America/New_York"))).StatusCode);
        f.Db.Units.Add(new Unit { Id = 10, PropertyId = 7, Name = "First" });
        var sub = new ShortStayIcalSubscription { UnitId = 10, OrgId = 20, Enabled = false,
            EncryptedUrl = "encrypted", UrlFingerprint = "fingerprint" };
        f.Db.ShortStayIcalSubscriptions.Add(sub);
        f.Db.ShortStayIcalOccurrences.Add(new ShortStayIcalOccurrence { Subscription = sub,
            UidKey = "uid", RecurrenceKey = "recurrence", StartDate = new(2026, 3, 8), EndDate = new(2026, 3, 9) });
        await f.Db.SaveChangesAsync();
        Assert.Equal(409, (await service.Put(7, new("America/Los_Angeles"))).StatusCode);

        f.Db.ShortStayIcalOccurrences.RemoveRange(f.Db.ShortStayIcalOccurrences);
        f.Db.ShortStayIcalSubscriptions.Remove(sub);
        await f.Db.SaveChangesAsync();
        Assert.Equal(200, (await service.Put(7, new("America/Los_Angeles"))).StatusCode);
        f.Db.ChangeTracker.Clear();
        Assert.Equal("America/Los_Angeles", (await f.Db.Properties.SingleAsync()).TimeZoneId);
    }

    [Fact]
    public async Task Other_properties_inventory_does_not_block_zone_change()
    {
        await using var f = await Fixture.Create();
        f.Db.Organizations.Add(new Organization { Id = 21, IsActive = true });
        f.Db.Properties.Add(new Property { Id = 8, OrganizationId = 21, Name = "Other" });
        f.Db.Units.Add(new Unit { Id = 11, PropertyId = 8, Name = "Other unit" });
        f.Db.ShortStayListings.Add(new ShortStayListing { UnitId = 11, NightlyBasePrice = 100 });
        var otherSub = new ShortStayIcalSubscription { UnitId = 11, OrgId = 21,
            EncryptedUrl = "encrypted", UrlFingerprint = "fingerprint" };
        f.Db.ShortStayIcalSubscriptions.Add(otherSub);
        f.Db.ShortStayIcalOccurrences.Add(new ShortStayIcalOccurrence { Subscription = otherSub,
            UidKey = "uid", RecurrenceKey = "recurrence", StartDate = new(2026, 3, 8), EndDate = new(2026, 3, 9) });
        await f.Db.SaveChangesAsync();
        var service = f.Service(20);
        Assert.Equal(200, (await service.Put(7, new("America/New_York"))).StatusCode);
        Assert.Equal(200, (await service.Put(7, new("America/Los_Angeles"))).StatusCode);
        f.Db.ChangeTracker.Clear();
        Assert.Equal("America/Los_Angeles", (await f.Db.Properties.SingleAsync(p => p.Id == 7)).TimeZoneId);
    }

    [Fact]
    public async Task Initial_zone_is_allowed_even_with_existing_inventory()
    {
        await using var f = await Fixture.Create();
        f.Db.Units.Add(new Unit { Id = 11, PropertyId = 7, Name = "Sibling" });
        f.Db.ShortStayBlocks.Add(new ShortStayBlock { UnitId = 11, StartDate = new(2026, 3, 8), EndDate = new(2026, 3, 9) });
        f.Db.ShortStayIcalSubscriptions.Add(new ShortStayIcalSubscription { UnitId = 11, OrgId = 20,
            EncryptedUrl = "encrypted", UrlFingerprint = "fingerprint" });
        await f.Db.SaveChangesAsync();
        Assert.Equal(200, (await f.Service(20).Put(7, new("America/New_York"))).StatusCode);
        f.Db.ChangeTracker.Clear();
        Assert.Equal("America/New_York", (await f.Db.Properties.SingleAsync()).TimeZoneId);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    [InlineData("Eastern Standard Time")]
    [InlineData("Mars/Olympus")]
    [InlineData("America\\New_York")]
    public async Task Invalid_or_missing_zone_is_rejected_without_modifying_property(string? zone)
    {
        await using var f = await Fixture.Create();
        Assert.Equal(400, (await f.Service(20).Put(7, new SaveShortStayPropertyTimeZoneDto(zone))).StatusCode);
        f.Db.ChangeTracker.Clear();
        Assert.Null((await f.Db.Properties.SingleAsync()).TimeZoneId);
    }

    [Fact]
    public async Task Missing_request_invalid_id_and_inactive_organization_fail_closed()
    {
        await using var f = await Fixture.Create();
        var service = f.Service(20);
        Assert.Equal(400, (await service.Put(7, null)).StatusCode);
        Assert.Equal(400, (await service.Get(0)).StatusCode);
        Assert.Equal(400, (await service.Put(0, new("UTC"))).StatusCode);
        var org = await f.Db.Organizations.SingleAsync();
        org.IsActive = false;
        await f.Db.SaveChangesAsync();
        Assert.Equal(403, (await service.Get(7)).StatusCode);
        Assert.Equal(403, (await service.Put(7, new("UTC"))).StatusCode);
    }

    [Theory]
    [InlineData("Viewer", true, true, 403)]
    [InlineData("Manager", false, true, 403)]
    [InlineData("Manager", true, true, 200)]
    [InlineData("Owner", false, false, 403)]
    public async Task Membership_controls_reads_and_writes(string role, bool manage, bool active, int status)
    {
        await using var f = await Fixture.Create();
        var member = await f.Db.OrganizationMembers.SingleAsync();
        member.Role = role; member.CanManageProperties = manage; member.IsActive = active;
        await f.Db.SaveChangesAsync();
        Assert.Equal(status, (await f.Service(20).Get(7)).StatusCode);
        Assert.Equal(status, (await f.Service(20).Put(7, new("UTC"))).StatusCode);
    }

    [Fact]
    public async Task Selected_org_subject_and_property_org_must_match_even_for_member_of_both_orgs()
    {
        await using var f = await Fixture.Create();
        f.Db.Organizations.Add(new Organization { Id = 21, IsActive = true });
        f.Db.OrganizationMembers.Add(new OrganizationMember { OrganizationId = 21, UserId = 42, Role = "Owner", IsActive = true });
        await f.Db.SaveChangesAsync();
        foreach (var service in new[] { f.Service(null), f.Service(21), f.Service(20, 999), f.Service(20, 42, false) })
        {
            Assert.Contains((await service.Get(7)).StatusCode, new[] { 403, 404 });
            Assert.False((await service.Put(7, new("UTC"))).Success);
        }
        Assert.Equal(404, (await f.Service(21).Get(7)).StatusCode);
        Assert.Equal(404, (await f.Service(21).Put(7, new("UTC"))).StatusCode);
        var property = await f.Db.Properties.SingleAsync();
        property.IsDeleted = true;
        await f.Db.SaveChangesAsync();
        Assert.Equal(404, (await f.Service(20).Get(7)).StatusCode);
        Assert.Equal(404, (await f.Service(20).Put(7, new("UTC"))).StatusCode);
        f.Db.ChangeTracker.Clear();
        Assert.Null((await f.Db.Properties.SingleAsync()).TimeZoneId);
    }

    private sealed class Fixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection;
        public DataContext Db { get; }
        private Fixture(SqliteConnection connection, DataContext db) { this.connection = connection; Db = db; }
        public static async Task<Fixture> Create()
        {
            var connection = new SqliteConnection("Data Source=:memory:;Foreign Keys=False");
            await connection.OpenAsync();
            var db = new SlimContext(new DbContextOptionsBuilder<DataContext>().UseSqlite(connection).Options);
            await db.Database.EnsureCreatedAsync();
            db.Organizations.Add(new Organization { Id = 20, IsActive = true });
            db.Properties.Add(new Property { Id = 7, OrganizationId = 20, Name = "Original" });
            db.OrganizationMembers.Add(new OrganizationMember { OrganizationId = 20, UserId = 42, Role = "Owner", IsActive = true });
            await db.SaveChangesAsync();
            return new Fixture(connection, db);
        }
        public ShortStayPropertyTimeZoneService Service(long? org, long subject = 42, bool authenticated = true)
        {
            var http = new DefaultHttpContext();
            http.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, subject.ToString())], authenticated ? "test" : null));
            if (org.HasValue) http.Items["OrganizationId"] = org.Value;
            http.Items["UserId"] = 42L;
            return new ShortStayPropertyTimeZoneService(Db, new HttpContextAccessor { HttpContext = http }, NullLogger<ShortStayPropertyTimeZoneService>.Instance);
        }
        public async ValueTask DisposeAsync() { await Db.DisposeAsync(); await connection.DisposeAsync(); }
    }
    private sealed class SlimContext(DbContextOptions<DataContext> options) : DataContext(options)
    {
        protected override void OnModelCreating(Microsoft.EntityFrameworkCore.ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            var keep = new[] { typeof(Property), typeof(Organization), typeof(OrganizationMember), typeof(Unit),
                typeof(ShortStayListing), typeof(ShortStayBlock), typeof(ShortStayNightlyRateOverride),
                typeof(ShortStayIcalSubscription), typeof(ShortStayIcalOccurrence) };
            foreach (var entity in modelBuilder.Model.GetEntityTypes().ToList())
                if (!keep.Contains(entity.ClrType)) modelBuilder.Ignore(entity.ClrType);
            foreach (var entity in modelBuilder.Model.GetEntityTypes())
                foreach (var property in entity.GetProperties())
                    if (property.GetColumnType()?.Contains("(max)", StringComparison.OrdinalIgnoreCase) == true)
                        property.SetColumnType("TEXT");
        }
    }
}
