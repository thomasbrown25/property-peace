using System.Security.Claims;
using System.Text.Json;
using brownstone_hub_api.Attributes;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.ShortStay;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.ShortStay;
using brownstone_hub_api.Repositories.Units;
using brownstone_hub_api.Tests.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Units;

public sealed class ShortStayGuidebookDraftApiTests
{
    [Fact]
    public void Route_is_owner_only_and_payload_rejects_unknown_fields()
    {
        var type = typeof(ShortStayGuidebookDraftController);
        Assert.Equal("api/short-stay/units/{unitId:long}/guidebook-draft", Assert.Single(type.GetCustomAttributes(typeof(RouteAttribute), true).Cast<RouteAttribute>()).Template);
        Assert.NotNull(Assert.Single(type.GetCustomAttributes(typeof(AuthorizeAttribute), true)));
        Assert.NotNull(Assert.Single(type.GetMethod("Delete")!.GetCustomAttributes(typeof(HttpDeleteAttribute), true)));
        foreach (var name in new[] { "Get", "Put", "Delete" })
        {
            var roles = Assert.Single(type.GetMethod(name)!.GetCustomAttributes(typeof(RequireOrganizationRoleAttribute), true).Cast<RequireOrganizationRoleAttribute>()).AllowedRoles;
            Assert.Contains("Owner", roles);
            Assert.Contains("Manager", roles);
            Assert.DoesNotContain("Viewer", roles);
        }
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<SaveShortStayGuidebookDraftDto>("{\"houseRules\":\"Quiet\",\"wifiPassword\":\"secret\"}", new JsonSerializerOptions(JsonSerializerDefaults.Web)));
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<SaveShortStayGuidebookDraftDto>("{\"status\":\"Published\"}", new JsonSerializerOptions(JsonSerializerDefaults.Web)));
    }

    [Fact]
    public async Task Owner_creates_reads_and_replaces_one_draft()
    {
        await using var f = await Fixture.Create();
        var service = f.Service(20);
        Assert.Null((await service.Get(10)).Data);
        Assert.Equal(201, (await service.Put(10, new("No smoking", "Arrive after noon", "Try the park"))).StatusCode);
        Assert.Equal("No smoking", (await service.Get(10)).Data!.HouseRules);
        Assert.Equal(200, (await service.Put(10, new(null, "Use the main entrance", null))).StatusCode);
        f.Db.ChangeTracker.Clear();
        var saved = Assert.Single(await f.Db.ShortStayGuidebookDrafts.ToListAsync());
        Assert.Null(saved.HouseRules);
        Assert.Equal("Use the main entrance", saved.ArrivalOverview);
    }

    [Theory]
    [InlineData("Viewer", true, true, 403)]
    [InlineData("Manager", false, true, 403)]
    [InlineData("Manager", true, true, 200)]
    [InlineData("Owner", false, false, 403)]
    public async Task Membership_controls_access(string role, bool manage, bool active, int status)
    {
        await using var f = await Fixture.Create();
        var member = await f.Db.OrganizationMembers.SingleAsync();
        member.Role = role; member.CanManageProperties = manage; member.IsActive = active;
        await f.Db.SaveChangesAsync();
        Assert.Equal(status, (await f.Service(20).Get(10)).StatusCode);
        Assert.Equal(status == 200 ? 201 : status, (await f.Service(20).Put(10, new("Quiet", null, null))).StatusCode);
    }

    [Fact]
    public async Task Selected_org_subject_property_and_mode_are_checked()
    {
        await using var f = await Fixture.Create();
        f.Db.Organizations.Add(new Organization { Id = 21, IsActive = true });
        f.Db.OrganizationMembers.Add(new OrganizationMember { OrganizationId = 21, UserId = 42, Role = "Owner", IsActive = true });
        await f.Db.SaveChangesAsync();
        Assert.Equal(403, (await f.Service(null).Get(10)).StatusCode);
        Assert.Equal(403, (await f.Service(20, 999).Put(10, new("Quiet", null, null))).StatusCode);
        Assert.Equal(404, (await f.Service(21).Get(10)).StatusCode);
        Assert.Equal(404, (await f.Service(21).Put(10, new("Quiet", null, null))).StatusCode);
        Assert.Equal(409, (await f.Service(20).Put(11, new("Quiet", null, null))).StatusCode);
        var property = await f.Db.Properties.SingleAsync();
        property.IsDeleted = true;
        await f.Db.SaveChangesAsync();
        Assert.Equal(404, (await f.Service(20).Put(10, new("Quiet", null, null))).StatusCode);
        Assert.Empty(await f.Db.ShortStayGuidebookDrafts.ToListAsync());
    }

    [Fact]
    public async Task Rejects_oversize_and_sensitive_content()
    {
        await using var f = await Fixture.Create();
        foreach (var request in new[] { new SaveShortStayGuidebookDraftDto(new string('x', 2001), null, null),
                     new(null, "WiFi password: secret", null), new(null, "Door code 1234", null),
                     new(null, null, "Call 212-555-1234"), new(null, null, "Email me at guest@example.com"),
                     new("<script>alert(1)</script>", null, null) })
            Assert.Equal(400, (await f.Service(20).Put(10, request)).StatusCode);
        Assert.Empty(await f.Db.ShortStayGuidebookDrafts.ToListAsync());
    }

    [Fact]
    public async Task Relational_primary_key_enforces_one_draft_per_unit()
    {
        await using var f = await Fixture.Create();
        f.Db.ShortStayGuidebookDrafts.Add(new ShortStayGuidebookDraft { UnitId = 10, HouseRules = "Quiet" });
        await f.Db.SaveChangesAsync();
        f.Db.ChangeTracker.Clear();
        f.Db.ShortStayGuidebookDrafts.Add(new ShortStayGuidebookDraft { UnitId = 10, LocalNotes = "Park" });
        await Assert.ThrowsAsync<DbUpdateException>(() => f.Db.SaveChangesAsync());
    }

    [Fact]
    public async Task Discard_is_explicit_idempotent_and_never_returns_manual_fields()
    {
        await using var f = await Fixture.Create();
        var service = f.Service(20);
        Assert.Equal(201, (await service.Put(10, new("Quiet hours", "Arrive at noon", "Visit park"))).StatusCode);
        Assert.Equal(200, (await service.Put(10, new(null, null, null))).StatusCode);
        Assert.Equal(1, await f.Db.ShortStayGuidebookDrafts.CountAsync());
        var deleted = await service.Delete(10);
        Assert.Equal(200, deleted.StatusCode);
        Assert.Null(deleted.Data);
        Assert.DoesNotContain("Quiet hours", JsonSerializer.Serialize(deleted));
        Assert.Equal(200, (await service.Delete(10)).StatusCode);
        Assert.Null((await service.Get(10)).Data);
        Assert.Empty(await f.Db.ShortStayGuidebookDrafts.ToListAsync());
    }

    [Theory]
    [InlineData("Owner", true, true, 200)]
    [InlineData("Manager", true, true, 200)]
    [InlineData("Manager", false, true, 403)]
    [InlineData("Owner", true, false, 403)]
    [InlineData("Viewer", true, true, 403)]
    public async Task Discard_rechecks_current_membership(string role, bool manage, bool active, int status)
    {
        await using var f = await Fixture.Create();
        Assert.Equal(201, (await f.Service(20).Put(10, new("Private notes", null, null))).StatusCode);
        var member = await f.Db.OrganizationMembers.SingleAsync();
        member.Role = role; member.CanManageProperties = manage; member.IsActive = active;
        await f.Db.SaveChangesAsync();
        Assert.Equal(status, (await f.Service(20).Delete(10)).StatusCode);
        Assert.Equal(status == 200 ? 0 : 1, await f.Db.ShortStayGuidebookDrafts.CountAsync());
    }

    [Fact]
    public async Task Discard_rejects_cross_org_invalid_identity_and_wrong_mode_without_erasing_draft()
    {
        await using var f = await Fixture.Create();
        await f.Service(20).Put(10, new("Keep this", null, null));
        f.Db.Organizations.Add(new Organization { Id = 21, IsActive = true });
        f.Db.OrganizationMembers.Add(new OrganizationMember { OrganizationId = 21, UserId = 42, Role = "Owner", IsActive = true });
        await f.Db.SaveChangesAsync();
        Assert.Equal(403, (await f.Service(null).Delete(10)).StatusCode);
        Assert.Equal(403, (await f.Service(20, 999).Delete(10)).StatusCode);
        Assert.Equal(404, (await f.Service(21).Delete(10)).StatusCode);
        Assert.Equal(409, (await f.Service(20).Delete(11)).StatusCode);
        Assert.Equal("Keep this", (await f.Db.ShortStayGuidebookDrafts.SingleAsync()).HouseRules);
    }

    [Fact]
    public async Task Permanent_unit_deletion_cascades_its_draft_without_affecting_sibling()
    {
        await using var f = await Fixture.Create(foreignKeys: true);
        f.Db.ShortStayGuidebookDrafts.AddRange(
            new ShortStayGuidebookDraft { UnitId = 10, HouseRules = "Remove" },
            new ShortStayGuidebookDraft { UnitId = 11, HouseRules = "Retain" });
        await f.Db.SaveChangesAsync();
        f.Db.ChangeTracker.Clear();
        await f.Db.Units.Where(u => u.Id == 10).ExecuteDeleteAsync();
        Assert.Equal("Retain", (await f.Db.ShortStayGuidebookDrafts.SingleAsync()).HouseRules);
    }

    [Fact]
    public async Task Repository_unit_deletion_cascades_draft_for_single_and_property_bulk_removal()
    {
        await using var f = await Fixture.Create(foreignKeys: true);
        f.Db.ShortStayGuidebookDrafts.AddRange(new ShortStayGuidebookDraft { UnitId = 10 },
            new ShortStayGuidebookDraft { UnitId = 11 });
        await f.Db.SaveChangesAsync();
        f.Db.ChangeTracker.Clear();
        var repository = new UnitRepository(f.Db, NullLogger<UnitRepository>.Instance, MapperFactory.Create());
        await repository.DeleteUnit(10);
        Assert.Equal(11, (await f.Db.ShortStayGuidebookDrafts.SingleAsync()).UnitId);
        Assert.Equal(1, await repository.DeleteUnitsByPropertyId(7));
        Assert.Empty(await f.Db.ShortStayGuidebookDrafts.ToListAsync());
    }

    [Fact]
    public async Task Delete_route_returns_no_store_without_exposing_draft_fields()
    {
        await using var f = await Fixture.Create();
        await f.Service(20).Put(10, new("Private notes", null, null));
        var controller = new ShortStayGuidebookDraftController(f.Service(20))
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        var result = Assert.IsType<ObjectResult>(await controller.Delete(10, CancellationToken.None));
        Assert.Equal(200, result.StatusCode);
        Assert.Equal("no-store", controller.Response.Headers.CacheControl.ToString());
        Assert.DoesNotContain("Private notes", JsonSerializer.Serialize(result.Value));
    }

    private sealed class Fixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection;
        public DataContext Db { get; }
        private Fixture(SqliteConnection connection, DataContext db) { this.connection = connection; Db = db; }
        public static async Task<Fixture> Create(bool foreignKeys = false)
        {
            var connection = new SqliteConnection($"Data Source=:memory:;Foreign Keys={foreignKeys}");
            await connection.OpenAsync();
            var db = new SlimContext(new DbContextOptionsBuilder<DataContext>().UseSqlite(connection).Options);
            await db.Database.EnsureCreatedAsync();
            db.Organizations.Add(new Organization { Id = 20, IsActive = true });
            db.Properties.Add(new Property { Id = 7, OrganizationId = 20, Name = "Original" });
            db.Units.AddRange(new Unit { Id = 10, PropertyId = 7, Name = "Stay", RentalMode = ERentalMode.ShortTerm },
                new Unit { Id = 11, PropertyId = 7, Name = "Lease" });
            db.OrganizationMembers.Add(new OrganizationMember { OrganizationId = 20, UserId = 42, Role = "Owner", IsActive = true });
            await db.SaveChangesAsync();
            return new Fixture(connection, db);
        }
        public ShortStayGuidebookDraftService Service(long? org, long subject = 42)
        {
            var http = new DefaultHttpContext();
            http.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, subject.ToString())], "test"));
            if (org.HasValue) http.Items["OrganizationId"] = org.Value;
            http.Items["UserId"] = 42L;
            return new ShortStayGuidebookDraftService(Db, new HttpContextAccessor { HttpContext = http }, NullLogger<ShortStayGuidebookDraftService>.Instance);
        }
        public async ValueTask DisposeAsync() { await Db.DisposeAsync(); await connection.DisposeAsync(); }
    }
    private sealed class SlimContext(DbContextOptions<DataContext> options) : DataContext(options)
    {
        protected override void OnModelCreating(Microsoft.EntityFrameworkCore.ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            var keep = new[] { typeof(Property), typeof(Organization), typeof(OrganizationMember), typeof(Unit), typeof(ShortStayGuidebookDraft) };
            foreach (var entity in modelBuilder.Model.GetEntityTypes().ToList())
                if (!keep.Contains(entity.ClrType)) modelBuilder.Ignore(entity.ClrType);
            foreach (var entity in modelBuilder.Model.GetEntityTypes())
                foreach (var property in entity.GetProperties())
                    if (property.GetColumnType()?.Contains("(max)", StringComparison.OrdinalIgnoreCase) == true)
                        property.SetColumnType("TEXT");
        }
    }
}
