using System.ComponentModel.DataAnnotations;
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
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Units;

public sealed class ShortStayListingApiTests
{
    private static SaveShortStayListingDto Draft() => new() { NightlyBasePrice = 125, MinimumNights = 2,
        Capacity = 4, CleaningFee = 30, CheckInTime = new TimeOnly(15, 0), CheckOutTime = new TimeOnly(11, 0),
        HouseRules = "No smoking", Amenities = "Wi-Fi", CancellationPolicy = "Flexible" };

    [Fact]
    public async Task Omitted_pricing_preserves_existing_values_but_explicit_null_clears_weekend()
    {
        await using var f = await Fixture.Create();
        var service = f.Service(20);
        var initial = Draft();
        initial.WeekendNightlyRate = 180m;
        initial.WeeklyDiscountPercent = 12m;
        initial.MonthlyDiscountPercent = 22m;
        Assert.Equal(201, (await service.Put(10, initial)).StatusCode);

        // These are wire payloads: deserialization must distinguish missing from null.
        var oldClient = JsonSerializer.Deserialize<SaveShortStayListingDto>(
            """{"nightlyBasePrice":140,"minimumNights":2,"capacity":4,"cleaningFee":30}""",
            new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
        Assert.Equal(200, (await service.Put(10, oldClient)).StatusCode);
        f.Db.ChangeTracker.Clear();
        var saved = await f.Db.ShortStayListings.AsNoTracking().SingleAsync();
        Assert.Equal(180m, saved.WeekendNightlyRate);
        Assert.Equal(12m, saved.WeeklyDiscountPercent);
        Assert.Equal(22m, saved.MonthlyDiscountPercent);

        var newClient = JsonSerializer.Deserialize<SaveShortStayListingDto>(
            """{"nightlyBasePrice":150,"minimumNights":2,"capacity":4,"cleaningFee":30,"weekendNightlyRate":null,"weeklyDiscountPercent":0,"monthlyDiscountPercent":5}""",
            new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
        Assert.Equal(200, (await service.Put(10, newClient)).StatusCode);
        f.Db.ChangeTracker.Clear();
        saved = await f.Db.ShortStayListings.AsNoTracking().SingleAsync();
        Assert.Null(saved.WeekendNightlyRate);
        Assert.Equal(0m, saved.WeeklyDiscountPercent);
        Assert.Equal(5m, saved.MonthlyDiscountPercent);
    }

    [Fact]
    public async Task Curated_copy_round_trips_and_unrelated_edits_preserve_it()
    {
        await using var f = await Fixture.Create();
        var input = Draft();
        input.PublicTitle = "  Garden <b>suite</b>\u0001  ";
        input.PublicSummary = "  A quiet <script>alert(1)</script> retreat.\u0007  ";
        var service = f.Service(20);
        Assert.Equal(201, (await service.Put(10, input)).StatusCode);
        var saved = (await service.Get(10)).Data!;
        Assert.Equal("Garden suite", saved.PublicTitle);
        Assert.Equal("A quiet retreat.", saved.PublicSummary);
        var edit = Draft(); edit.PublicTitle = saved.PublicTitle; edit.PublicSummary = saved.PublicSummary;
        edit.NightlyBasePrice = 155;
        Assert.Equal(200, (await service.Put(10, edit)).StatusCode);
        f.Db.ChangeTracker.Clear();
        Assert.Equal("Garden suite", (await f.Db.ShortStayListings.SingleAsync()).PublicTitle);
        Assert.Equal("A quiet retreat.", (await service.Get(10)).Data!.PublicSummary);
        var olderClient = Draft(); olderClient.NightlyBasePrice = 175;
        Assert.Equal(200, (await service.Put(10, olderClient)).StatusCode);
        Assert.Equal("Garden suite", (await service.Get(10)).Data!.PublicTitle);
        Assert.Equal("A quiet retreat.", (await service.Get(10)).Data!.PublicSummary);
    }

    [Fact]
    public async Task Excessively_long_public_copy_is_rejected_without_persistence()
    {
        await using var f = await Fixture.Create();
        var input = Draft(); input.PublicTitle = new string('x', 101);
        Assert.Equal(400, (await f.Service(20).Put(10, input)).StatusCode);
        input.PublicTitle = "Safe"; input.PublicSummary = new string('y', 1201);
        Assert.Equal(400, (await f.Service(20).Put(10, input)).StatusCode);
        Assert.Empty(await f.Db.ShortStayListings.ToListAsync());
    }

    [Fact]
    public async Task Tax_policy_is_explicit_and_attestation_is_server_attributed_not_client_forged()
    {
        await using var f = await Fixture.Create();
        var service = f.Service(20);
        Assert.Equal(201, (await service.Put(10, Draft())).StatusCode);
        Assert.Null((await service.Get(10)).Data!.LodgingTaxRatePercent);
        var unacknowledged = Draft(); unacknowledged.LodgingTaxRatePercent = 0m;
        Assert.Equal(400, (await service.Put(10, unacknowledged)).StatusCode);
        var acknowledged = Draft(); acknowledged.LodgingTaxRatePercent = 0m;
        acknowledged.AttestLodgingTaxResponsibility = true;
        Assert.Equal(200, (await service.Put(10, acknowledged)).StatusCode);
        var saved = await f.Db.ShortStayListings.SingleAsync();
        Assert.Equal(0m, saved.LodgingTaxRatePercent);
        Assert.Equal(42, saved.TaxPolicyAttestedByUserId);
        Assert.True(saved.TaxPolicyAttestedAtUtc.HasValue);
        Assert.Equal(0m, (await service.Get(10)).Data!.LodgingTaxRatePercent);
        var cleared = Draft();
        Assert.Equal(200, (await service.Put(10, cleared)).StatusCode);
        Assert.Null(saved.LodgingTaxRatePercent);
        Assert.Null(saved.TaxPolicyAttestedAtUtc);
        Assert.Null(saved.TaxPolicyAttestedByUserId);
        f.Db.ChangeTracker.Clear();
        var persistedClear = await f.Db.ShortStayListings.AsNoTracking().SingleAsync();
        Assert.Null(persistedClear.LodgingTaxRatePercent);
        Assert.Null(persistedClear.TaxPolicyAttestedAtUtc);
        Assert.Null(persistedClear.TaxPolicyAttestedByUserId);
    }

    [Fact]
    public async Task Unrelated_edit_preserves_persisted_attestation_even_with_true_from_another_manager()
    {
        await using var f = await Fixture.Create();
        var initial = Draft(); initial.LodgingTaxRatePercent = 8.25m; initial.AttestLodgingTaxResponsibility = true;
        Assert.Equal(201, (await f.Service(20).Put(10, initial)).StatusCode);
        f.Db.ChangeTracker.Clear();
        var original = await f.Db.ShortStayListings.AsNoTracking().SingleAsync();
        var at = original.TaxPolicyAttestedAtUtc;
        Assert.NotNull(at);
        f.Db.OrganizationMembers.Add(new OrganizationMember { OrganizationId = 20, UserId = 43, Role = "Manager", CanManageProperties = true, IsActive = true });
        await f.Db.SaveChangesAsync();
        var edit = Draft(); edit.LodgingTaxRatePercent = 8.2500m; edit.AttestLodgingTaxResponsibility = true;
        edit.HouseRules = "No parties";
        var result = await f.Service(20, 43).Put(10, edit);
        Assert.Equal(200, result.StatusCode);
        Assert.Equal(at, result.Data!.TaxPolicyAttestedAtUtc);
        Assert.Equal(42, result.Data.TaxPolicyAttestedByUserId);
        f.Db.ChangeTracker.Clear();
        var persisted = await f.Db.ShortStayListings.AsNoTracking().SingleAsync();
        Assert.Equal("No parties", persisted.HouseRules);
        Assert.Equal(at, persisted.TaxPolicyAttestedAtUtc);
        Assert.Equal(42, persisted.TaxPolicyAttestedByUserId);

        edit.LodgingTaxRatePercent = 7.5m; edit.AttestLodgingTaxResponsibility = false;
        Assert.Equal(400, (await f.Service(20, 43).Put(10, edit)).StatusCode);
        f.Db.ChangeTracker.Clear();
        persisted = await f.Db.ShortStayListings.AsNoTracking().SingleAsync();
        Assert.Equal(8.25m, persisted.LodgingTaxRatePercent);
        Assert.Equal(at, persisted.TaxPolicyAttestedAtUtc);
        edit.AttestLodgingTaxResponsibility = true;
        Assert.Equal(200, (await f.Service(20, 43).Put(10, edit)).StatusCode);
        f.Db.ChangeTracker.Clear();
        persisted = await f.Db.ShortStayListings.AsNoTracking().SingleAsync();
        Assert.Equal(7.5m, persisted.LodgingTaxRatePercent);
        Assert.Equal(43, persisted.TaxPolicyAttestedByUserId);
        Assert.True(persisted.TaxPolicyAttestedAtUtc >= at);
    }

    [Theory]
    [InlineData(-0.01)]
    [InlineData(100.01)]
    [InlineData(7.12345)]
    public async Task Invalid_tax_percentage_is_rejected(double rate)
    {
        await using var f = await Fixture.Create();
        var request = Draft(); request.LodgingTaxRatePercent = (decimal)rate;
        request.AttestLodgingTaxResponsibility = true;
        Assert.Equal(400, (await f.Service(20).Put(10, request)).StatusCode);
    }

    [Fact]
    public void Routes_require_authenticated_owner_or_manager_and_use_separate_inventory()
    {
        var controller = typeof(ShortStayListingController);
        Assert.NotNull(controller.GetCustomAttributes(typeof(AuthorizeAttribute), true).SingleOrDefault());
        foreach (var method in new[] { nameof(ShortStayListingController.Get), nameof(ShortStayListingController.Put) })
        {
            var roles = Assert.Single(controller.GetMethod(method)!.GetCustomAttributes(typeof(RequireOrganizationRoleAttribute), true)
                .Cast<RequireOrganizationRoleAttribute>()).AllowedRoles;
            Assert.Contains("Owner", roles);
            Assert.Contains("Manager", roles);
            Assert.DoesNotContain("Viewer", roles);
        }
    }

    [Fact]
    public async Task Owner_can_create_read_update_draft_with_property_zone_and_one_row()
    {
        await using var f = await Fixture.Create();
        var service = f.Service(20);
        Assert.Null((await service.Get(10)).Data);
        var created = await service.Put(10, Draft());
        Assert.Equal(201, created.StatusCode);
        Assert.Equal("America/New_York", created.Data!.TimeZoneId);
        Assert.Equal("Wi-Fi", (await service.Get(10)).Data!.Amenities);
        var edit = Draft(); edit.NightlyBasePrice = 199;
        Assert.Equal(200, (await service.Put(10, edit)).StatusCode);
        Assert.Equal(199, (await service.Get(10)).Data!.NightlyBasePrice);
        Assert.Equal(1, await f.Db.ShortStayListings.CountAsync());
        Assert.Equal(ShortStayListingStatus.Draft, (await f.Db.ShortStayListings.SingleAsync()).Status);
    }

    [Theory]
    [InlineData("Viewer", true, true, 403)]
    [InlineData("Manager", false, true, 403)]
    [InlineData("Manager", true, true, 201)]
    [InlineData("Owner", false, false, 403)]
    public async Task Membership_is_checked_for_reads_and_writes(string role, bool manage, bool active, int expected)
    {
        await using var f = await Fixture.Create();
        var member = await f.Db.OrganizationMembers.SingleAsync();
        member.Role = role; member.CanManageProperties = manage; member.IsActive = active;
        await f.Db.SaveChangesAsync();
        Assert.Equal(expected == 201 ? 200 : 403, (await f.Service(20).Get(10)).StatusCode);
        Assert.Equal(expected, (await f.Service(20).Put(10, Draft())).StatusCode);
    }

    [Fact]
    public async Task No_selected_org_cross_org_and_mismatched_subject_fail_closed()
    {
        await using var f = await Fixture.Create();
        foreach (var service in new[] { f.Service(null), f.Service(21), f.Service(20, 999) })
        {
            Assert.NotEqual(200, (await service.Get(10)).StatusCode);
            Assert.NotEqual(201, (await service.Put(10, Draft())).StatusCode);
        }
        Assert.Equal(0, await f.Db.ShortStayListings.CountAsync());
    }

    [Fact]
    public async Task Mode_and_timezone_are_rechecked_on_each_read_and_write()
    {
        await using var f = await Fixture.Create();
        var service = f.Service(20);
        Assert.Equal(201, (await service.Put(10, Draft())).StatusCode);
        var unit = await f.Db.Units.SingleAsync();
        unit.RentalMode = ERentalMode.LongTerm;
        await f.Db.SaveChangesAsync();
        Assert.Equal(409, (await service.Put(10, Draft())).StatusCode);
        Assert.Equal(409, (await service.Get(10)).StatusCode);
        unit.RentalMode = ERentalMode.ShortTerm;
        var property = await f.Db.Properties.SingleAsync();
        property.TimeZoneId = "Mars/Olympus";
        await f.Db.SaveChangesAsync();
        Assert.Equal(409, (await service.Put(10, Draft())).StatusCode);
        Assert.Equal(409, (await service.Get(10)).StatusCode);
        property.TimeZoneId = null;
        await f.Db.SaveChangesAsync();
        Assert.Equal(409, (await service.Put(10, Draft())).StatusCode);
        Assert.Equal(409, (await service.Get(10)).StatusCode);
    }

    [Fact]
    public async Task Invalid_values_and_published_rows_cannot_be_written()
    {
        await using var f = await Fixture.Create();
        var service = f.Service(20);
        var draft = Draft();
        foreach (Action<SaveShortStayListingDto> invalidate in new Action<SaveShortStayListingDto>[] {
            d => d.NightlyBasePrice = 0, d => d.MinimumNights = 0, d => d.Capacity = 0,
            d => d.CleaningFee = -1, d => d.HouseRules = new string('x', 4001),
            d => d.Amenities = new string('x', 4001), d => d.CancellationPolicy = new string('x', 2001) })
        {
            var bad = Draft(); invalidate(bad);
            Assert.Equal(400, (await service.Put(10, bad)).StatusCode);
        }
        Assert.Equal(0, await f.Db.ShortStayListings.CountAsync());
        await service.Put(10, draft);
        var row = await f.Db.ShortStayListings.SingleAsync();
        row.Status = ShortStayListingStatus.Published;
        await f.Db.SaveChangesAsync();
        Assert.Equal(409, (await service.Put(10, Draft())).StatusCode);
        Assert.Equal(409, (await service.Get(10)).StatusCode);
    }

    [Theory]
    [InlineData("nightly")]
    [InlineData("cleaning")]
    public async Task Sub_cent_prices_are_rejected_on_create_and_update(string field)
    {
        await using var f = await Fixture.Create();
        var service = f.Service(20);
        var bad = Draft();
        if (field == "nightly") bad.NightlyBasePrice = 0.001m;
        else bad.CleaningFee = 1.999m;

        var results = new List<ValidationResult>();
        Assert.False(Validator.TryValidateObject(bad, new ValidationContext(bad), results, true));
        Assert.Contains(results, r => r.MemberNames.Contains(field == "nightly" ? nameof(bad.NightlyBasePrice) : nameof(bad.CleaningFee))
            && r.ErrorMessage!.Contains("decimal places", StringComparison.OrdinalIgnoreCase));

        var create = await service.Put(10, bad);
        Assert.Equal(400, create.StatusCode);
        Assert.Contains("decimal places", create.Message!, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(0, await f.Db.ShortStayListings.CountAsync());

        Assert.Equal(201, (await service.Put(10, Draft())).StatusCode);
        var update = await service.Put(10, bad);
        Assert.Equal(400, update.StatusCode);
        Assert.Contains("decimal places", update.Message!, StringComparison.OrdinalIgnoreCase);
        var saved = await f.Db.ShortStayListings.SingleAsync();
        Assert.Equal(125m, saved.NightlyBasePrice);
        Assert.Equal(30m, saved.CleaningFee);
    }

    [Fact]
    public async Task Cent_precision_prices_are_accepted()
    {
        await using var f = await Fixture.Create();
        var draft = Draft();
        draft.NightlyBasePrice = 0.01m;
        draft.CleaningFee = 1.99m;
        Assert.Equal(201, (await f.Service(20).Put(10, draft)).StatusCode);
        var saved = await f.Db.ShortStayListings.SingleAsync();
        Assert.Equal(0.01m, saved.NightlyBasePrice);
        Assert.Equal(1.99m, saved.CleaningFee);
    }

    [Fact]
    public async Task Cross_organization_cannot_read_or_overwrite_an_existing_draft()
    {
        await using var f = await Fixture.Create();
        Assert.Equal(201, (await f.Service(20).Put(10, Draft())).StatusCode);
        f.Db.Organizations.Add(new Organization { Id = 21, IsActive = true });
        f.Db.OrganizationMembers.Add(new OrganizationMember { OrganizationId = 21, UserId = 42, Role = "Owner", IsActive = true });
        await f.Db.SaveChangesAsync();
        Assert.Equal(404, (await f.Service(21).Get(10)).StatusCode);
        var otherDraft = Draft(); otherDraft.NightlyBasePrice = 999;
        Assert.Equal(404, (await f.Service(21).Put(10, otherDraft)).StatusCode);
        Assert.Equal(125, (await f.Service(20).Get(10)).Data!.NightlyBasePrice);
        var unit = await f.Db.Units.SingleAsync();
        unit.OrganizationId = 21;
        await f.Db.SaveChangesAsync();
        Assert.Equal(404, (await f.Service(20).Get(10)).StatusCode);
        Assert.Equal(404, (await f.Service(20).Put(10, Draft())).StatusCode);
    }

    [Fact]
    public async Task Database_unique_unit_index_rejects_duplicate_even_outside_api()
    {
        await using var f = await Fixture.Create();
        Assert.Equal(201, (await f.Service(20).Put(10, Draft())).StatusCode);
        f.Db.ChangeTracker.Clear();
        f.Db.ShortStayListings.Add(new ShortStayListing { UnitId = 10, NightlyBasePrice = 99 });
        await Assert.ThrowsAsync<DbUpdateException>(() => f.Db.SaveChangesAsync());
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
            db.Properties.Add(new Property { Id = 7, OrganizationId = 20, TimeZoneId = "America/New_York" });
            db.Units.Add(new Unit { Id = 10, PropertyId = 7, OrganizationId = 20, Name = "Suite", RentalMode = ERentalMode.ShortTerm });
            db.OrganizationMembers.Add(new OrganizationMember { OrganizationId = 20, UserId = 42, Role = "Owner", IsActive = true });
            await db.SaveChangesAsync();
            return new Fixture(connection, db);
        }
        public ShortStayListingService Service(long? org, long subject = 42)
        {
            var http = new DefaultHttpContext();
            http.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, subject.ToString())], "test"));
            if (org.HasValue) http.Items["OrganizationId"] = org.Value;
            http.Items["UserId"] = subject == 999 ? 42L : subject;
            return new ShortStayListingService(Db, new HttpContextAccessor { HttpContext = http }, NullLogger<ShortStayListingService>.Instance);
        }
        public async ValueTask DisposeAsync() { await Db.DisposeAsync(); await connection.DisposeAsync(); }
    }

    private sealed class SlimContext(DbContextOptions<DataContext> options) : DataContext(options)
    {
        protected override void OnModelCreating(Microsoft.EntityFrameworkCore.ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            var keep = new[] { typeof(Property), typeof(Unit), typeof(Organization), typeof(OrganizationMember), typeof(ShortStayListing) };
            foreach (var entity in modelBuilder.Model.GetEntityTypes().ToList())
                if (!keep.Contains(entity.ClrType)) modelBuilder.Ignore(entity.ClrType);
            foreach (var entity in modelBuilder.Model.GetEntityTypes())
                foreach (var property in entity.GetProperties())
                    if (property.GetColumnType()?.Contains("(max)", StringComparison.OrdinalIgnoreCase) == true)
                        property.SetColumnType("TEXT");
            // SQLite's decimal-as-TEXT affinity makes the SQL Server <= 100 check lexical
            // (e.g. "8.25" > "100"). Keep this fixture's range constraint numeric.
            modelBuilder.Entity<ShortStayListing>().Property(x => x.LodgingTaxRatePercent)
                .HasConversion<double?>().HasColumnType("REAL");
            modelBuilder.Entity<ShortStayListing>().Property(x => x.WeekendNightlyRate)
                .HasConversion<double?>().HasColumnType("REAL");
            modelBuilder.Entity<ShortStayListing>().Property(x => x.WeeklyDiscountPercent)
                .HasConversion<double>().HasColumnType("REAL");
            modelBuilder.Entity<ShortStayListing>().Property(x => x.MonthlyDiscountPercent)
                .HasConversion<double>().HasColumnType("REAL");
        }
    }
}
