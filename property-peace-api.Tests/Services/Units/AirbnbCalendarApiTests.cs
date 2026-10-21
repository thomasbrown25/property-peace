using System.Security.Claims;
using System.Text.Json;
using brownstone_hub_api.Attributes;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.ShortStay;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Security;
using brownstone_hub_api.Services.ShortStay;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Units;

public sealed class AirbnbCalendarApiTests
{
    private const string Url = "https://www.airbnb.com/calendar/ical/12345.ics?s=secret";
    private const string Replacement = "https://www.airbnb.com/calendar/ical/98765.ics?s=another";

    [Fact]
    public void Routes_require_both_api_and_organization_authorization()
    {
        var type = typeof(AirbnbCalendarController);
        Assert.Equal("api/short-stay/units/{unitId:long}/airbnb-calendar", Assert.Single(type.GetCustomAttributes(typeof(Microsoft.AspNetCore.Mvc.RouteAttribute), true).Cast<Microsoft.AspNetCore.Mvc.RouteAttribute>()).Template);
        Assert.Equal("Landlord,Admin", Assert.Single(type.GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>()).Roles);
        foreach (var name in new[] { "Get", "Connect", "Refresh", "Disable" })
        {
            var roles = Assert.Single(type.GetMethod(name)!.GetCustomAttributes(typeof(RequireOrganizationRoleAttribute), true).Cast<RequireOrganizationRoleAttribute>()).AllowedRoles;
            Assert.Contains("Owner", roles); Assert.Contains("Manager", roles);
        }
    }

    [Fact]
    public async Task Connect_refresh_replace_disable_are_redacted_and_generation_safe()
    {
        await using var f = await Fixture.Create(); var svc = f.Service(20);
        var first = await svc.Connect(10, new(Url));
        Assert.Equal(200, first.StatusCode);
        Assert.Equal("never_synced", first.Data!.Health);
        var sub = await f.Db.ShortStayIcalSubscriptions.SingleAsync();
        Assert.NotEqual(Url, sub.EncryptedUrl);
        Assert.Equal(Url, new ShortStayIcalSecretProtector(f.Key).DecryptUrl(sub.EncryptedUrl));
        Assert.Equal(64, sub.UrlFingerprint.Length);
        Assert.NotNull(sub.NextAttemptAtUtc);
        var oldFingerprint = sub.UrlFingerprint;
        var cipher = sub.EncryptedUrl;
        Assert.Equal(1, sub.Generation);
        Assert.Equal(200, (await svc.Connect(10, new(Url))).StatusCode);
        Assert.Equal(cipher, sub.EncryptedUrl);
        Assert.Equal(1, sub.Generation);
        Assert.Equal(200, (await svc.Refresh(10)).StatusCode);
        Assert.Equal(1, sub.Generation);
        sub.LastSuccessAtUtc = DateTime.UtcNow;
        await f.Db.SaveChangesAsync();
        Assert.Equal("healthy", (await svc.Get(10)).Data!.Health);
        sub.LastSuccessAtUtc = new DateTime(2026, 3, 8, 7, 30, 0, DateTimeKind.Utc);
        await f.Db.SaveChangesAsync();
        var stale = (await svc.Get(10)).Data!;
        Assert.Equal("stale", stale.Health);
        Assert.Equal("America/New_York", stale.TimeZoneId);
        Assert.Equal(new DateTime(2026, 3, 8, 3, 30, 0), stale.LastSuccessLocal);
        sub.ConsecutiveFailures = 2; sub.FailureCode = Url;
        await f.Db.SaveChangesAsync();
        Assert.Equal("retrying", (await svc.Get(10)).Data!.Health);
        Assert.DoesNotContain(Url, JsonSerializer.Serialize((await svc.Get(10)).Data));
        f.Db.ShortStayIcalOccurrences.Add(new ShortStayIcalOccurrence { SubscriptionId = sub.Id, UidKey = "uid", RecurrenceKey = "key", StartDate = new DateOnly(2026, 3, 8), EndDate = new DateOnly(2026, 3, 9) });
        await f.Db.SaveChangesAsync();
        Assert.Equal(200, (await svc.Connect(10, new(Replacement))).StatusCode);
        Assert.Empty(await f.Db.ShortStayIcalOccurrences.ToListAsync());
        Assert.Equal(2, sub.Generation);
        Assert.Null(sub.LastSuccessAtUtc);
        Assert.Equal(0, sub.ConsecutiveFailures);
        Assert.Equal(200, (await svc.Disable(10)).StatusCode);
        Assert.Equal(3, sub.Generation);
        Assert.False(sub.Enabled);
        Assert.Equal(string.Empty, sub.EncryptedUrl);
        Assert.Equal(string.Empty, sub.UrlFingerprint);
        Assert.Null(sub.NextAttemptAtUtc);
        var stored = await f.Db.ShortStayIcalSubscriptions.AsNoTracking().SingleAsync();
        Assert.Equal(string.Empty, stored.EncryptedUrl);
        Assert.Equal(string.Empty, stored.UrlFingerprint);
        Assert.NotEqual(oldFingerprint, stored.UrlFingerprint);
        Assert.NotEqual(cipher, stored.EncryptedUrl);
        Assert.Equal("disabled", (await svc.Get(10)).Data!.Health);
        Assert.DoesNotContain(Replacement, JsonSerializer.Serialize((await svc.Get(10)).Data));
        Assert.Equal(200, (await svc.Disable(10)).StatusCode);
        Assert.Equal(3, sub.Generation);
        Assert.Equal(409, (await svc.Refresh(10)).StatusCode);
        Assert.Equal(200, (await svc.Connect(10, new(Url))).StatusCode);
        Assert.Equal(4, sub.Generation);
        Assert.Equal(Url, new ShortStayIcalSecretProtector(f.Key).DecryptUrl(sub.EncryptedUrl));
        Assert.Equal(64, sub.UrlFingerprint.Length);
        Assert.Single(await f.Db.ShortStayIcalSubscriptions.ToListAsync());
        Assert.DoesNotContain(Url, JsonSerializer.Serialize((await svc.Get(10)).Data));
    }

    [Fact]
    public async Task Disconnect_cleans_up_occurrences_even_for_already_disabled_subscription()
    {
        await using var f = await Fixture.Create();
        var svc = f.Service(20);
        Assert.Equal(200, (await svc.Disable(10)).StatusCode); // No subscription is a no-op.
        Assert.Empty(await f.Db.ShortStayIcalSubscriptions.ToListAsync());
        Assert.Equal(200, (await svc.Connect(10, new(Url))).StatusCode);
        var sub = await f.Db.ShortStayIcalSubscriptions.SingleAsync();
        sub.Enabled = false;
        sub.NextAttemptAtUtc = DateTime.UtcNow;
        f.Db.ShortStayIcalOccurrences.Add(new ShortStayIcalOccurrence { SubscriptionId = sub.Id,
            UidKey = "old", RecurrenceKey = "old", StartDate = new DateOnly(2026, 11, 1), EndDate = new DateOnly(2026, 11, 2) });
        await f.Db.SaveChangesAsync();
        var generation = sub.Generation;
        Assert.Equal(200, (await svc.Disable(10)).StatusCode);
        Assert.Equal(generation + 1, sub.Generation);
        Assert.Equal(string.Empty, sub.EncryptedUrl);
        Assert.Equal(string.Empty, sub.UrlFingerprint);
        Assert.Null(sub.NextAttemptAtUtc);
        Assert.Empty(await f.Db.ShortStayIcalOccurrences.AsNoTracking().ToListAsync());
        Assert.Equal(200, (await svc.Disable(10)).StatusCode);
        Assert.Equal(generation + 1, sub.Generation);
        Assert.Equal(string.Empty, (await f.Db.ShortStayIcalSubscriptions.AsNoTracking().SingleAsync()).EncryptedUrl);
    }

    [Fact]
    public async Task Denies_cross_org_spoofed_subject_and_manager_without_permission()
    {
        await using var f = await Fixture.Create();
        foreach (var svc in new[] { f.Service(null), f.Service(21), f.Service(20, 99), f.Service(20, 42, "Tenant") })
        {
            Assert.NotEqual(200, (await svc.Get(10)).StatusCode);
            Assert.NotEqual(200, (await svc.Connect(10, new(Url))).StatusCode);
            Assert.NotEqual(200, (await svc.Disable(10)).StatusCode);
            Assert.NotEqual(200, (await svc.Refresh(10)).StatusCode);
        }
        var member = await f.Db.OrganizationMembers.SingleAsync(m => m.OrganizationId == 20);
        member.Role = "Manager"; member.CanManageProperties = false; await f.Db.SaveChangesAsync();
        Assert.Equal(403, (await f.Service(20).Connect(10, new(Url))).StatusCode);
        member.CanManageProperties = true; await f.Db.SaveChangesAsync();
        Assert.Equal(200, (await f.Service(20).Connect(10, new(Url))).StatusCode);
        Assert.Equal(404, (await f.Service(21).Get(10)).StatusCode);
    }

    [Fact]
    public async Task Missing_key_and_invalid_urls_never_mutate_or_fetch()
    {
        await using var f = await Fixture.Create();
        Assert.Equal(503, (await f.Service(20, key: "").Connect(10, new(Url))).StatusCode);
        Assert.Equal(503, (await f.Service(20, key: "").Get(10)).StatusCode);
        Assert.Empty(await f.Db.ShortStayIcalSubscriptions.ToListAsync());
        foreach (var bad in new[] { "http://www.airbnb.com/calendar/ical/1.ics", "https://evil.com/calendar/ical/1.ics", "https://www.airbnb.com/calendar/ical/1.ics#fragment", "https://www.airbnb.com/calendar/ical/1.ics?x=%2f", Url + "\n" })
            Assert.Equal(400, (await f.Service(20).Connect(10, new(bad))).StatusCode);
        Assert.Empty(await f.Db.ShortStayIcalSubscriptions.ToListAsync());
        var unit = await f.Db.Units.SingleAsync(); unit.RentalMode = ERentalMode.LongTerm; await f.Db.SaveChangesAsync();
        Assert.Equal(409, (await f.Service(20).Connect(10, new(Url))).StatusCode);
    }

    private sealed class Fixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection;
        public DataContext Db { get; }
        public string Key { get; } = Convert.ToBase64String(Enumerable.Range(1, 32).Select(x => (byte)x).ToArray());
        private Fixture(SqliteConnection connection, DataContext db) { this.connection = connection; Db = db; }
        public static async Task<Fixture> Create()
        {
            var connection = new SqliteConnection("Data Source=:memory:;Foreign Keys=False"); await connection.OpenAsync();
            var db = new SlimContext(new DbContextOptionsBuilder<DataContext>().UseSqlite(connection).Options);
            await db.Database.EnsureCreatedAsync();
            db.Organizations.AddRange(new Organization { Id = 20, IsActive = true }, new Organization { Id = 21, IsActive = true });
            db.Properties.Add(new Property { Id = 7, OrganizationId = 20, TimeZoneId = "America/New_York" });
            db.Units.Add(new Unit { Id = 10, PropertyId = 7, OrganizationId = 20, Name = "Suite", RentalMode = ERentalMode.ShortTerm });
            db.OrganizationMembers.AddRange(new OrganizationMember { OrganizationId = 20, UserId = 42, Role = "Owner", IsActive = true }, new OrganizationMember { OrganizationId = 21, UserId = 42, Role = "Owner", IsActive = true });
            await db.SaveChangesAsync(); return new(connection, db);
        }
        public AirbnbCalendarService Service(long? org, long subject = 42, string role = "Landlord", string? key = null)
        {
            var http = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, subject.ToString()), new Claim(ClaimTypes.Role, role)], "test")) };
            if (org.HasValue) http.Items["OrganizationId"] = org.Value;
            http.Items["UserId"] = 42L;
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["ShortStayIcal:EncryptionKey"] = key ?? Key }).Build();
            return new AirbnbCalendarService(Db, new HttpContextAccessor { HttpContext = http }, config);
        }
        public async ValueTask DisposeAsync() { await Db.DisposeAsync(); await connection.DisposeAsync(); }
    }
    private sealed class SlimContext(DbContextOptions<DataContext> options) : DataContext(options)
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            var keep = new[] { typeof(Property), typeof(Unit), typeof(Organization), typeof(OrganizationMember), typeof(ShortStayIcalSubscription), typeof(ShortStayIcalOccurrence) };
            foreach (var entity in modelBuilder.Model.GetEntityTypes().ToList())
                if (!keep.Contains(entity.ClrType)) modelBuilder.Ignore(entity.ClrType);
            foreach (var entity in modelBuilder.Model.GetEntityTypes())
                foreach (var property in entity.GetProperties())
                    if (property.GetColumnType()?.Contains("(max)", StringComparison.OrdinalIgnoreCase) == true) property.SetColumnType("TEXT");
        }
    }
}
