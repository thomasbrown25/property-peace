using System.Security.Claims;
using brownstone_hub_api.Data;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.ShortStay;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.FileProviders;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Units;

public sealed class ExtendedStayAgreementTests
{
    private static readonly DateOnly Start = new(2026, 11, 1);
    [Fact]
    public async Task Owner_only_persists_any_length_half_open_and_rejects_overlaps()
    {
        await using var f = await Fixture.Create();
        Assert.Equal(403, (await f.Service(20, 99).Create(10, new(Start, Start.AddYears(2), "Guest"))).StatusCode);
        var owner = f.Service(20);
        Assert.Equal(400, (await owner.Create(10, new(Start, Start, "Guest"))).StatusCode);
        Assert.Equal(201, (await owner.Create(10, new(Start, Start.AddYears(2), "Guest"))).StatusCode);
        Assert.Equal(409, (await owner.Create(10, new(Start.AddDays(1), Start.AddDays(3), "Other"))).StatusCode);
        Assert.Equal(201, (await owner.Create(10, new(Start.AddYears(2), Start.AddYears(2).AddDays(1), "Other"))).StatusCode);
        Assert.Equal(2, (await owner.List(10)).Data!.Count);
        Assert.Equal(403, (await f.Service(21).List(10)).StatusCode);
        Assert.Equal(2, await f.Db.Set<ExtendedStayAgreement>().CountAsync());
    }
    [Fact]
    public async Task Owner_blocks_claims_and_airbnb_conflict_and_mode_is_checked()
    {
        await using var f = await Fixture.Create(); var owner = f.Service(20);
        f.Db.ShortStayBlocks.Add(new ShortStayBlock { UnitId = 10, StartDate = Start, EndDate = Start.AddDays(1) });
        f.Db.ShortStayIcalSubscriptions.Add(new ShortStayIcalSubscription { UnitId = 10, OrgId = 20, Enabled = true,
            EncryptedUrl = "secret", UrlFingerprint = "fingerprint", Occurrences = new List<ShortStayIcalOccurrence> {
                new() { UidKey = "uid", RecurrenceKey = "uid", StartDate = Start.AddDays(2), EndDate = Start.AddDays(3) } } });
        var now = DateTimeOffset.UtcNow;
        f.Db.ShortStayReservations.Add(ShortStayReservation.CreateHold(10, 7, 20, 77, 42, "acct_private",
            Start.AddDays(4), Start.AddDays(5), 1, [12000], now.AddHours(1), now));
        await f.Db.SaveChangesAsync();
        foreach (var day in new[] { 0, 2, 4 }) Assert.Equal(409,
            (await owner.Create(10, new(Start.AddDays(day), Start.AddDays(day + 1), "Guest"))).StatusCode);
        Assert.Equal(201, (await owner.Create(10, new(Start.AddDays(1), Start.AddDays(2), "Guest"))).StatusCode);
        var unit = await f.Db.Units.SingleAsync(u => u.Id == 10);
        unit.RentalMode = ERentalMode.LongTerm; await f.Db.SaveChangesAsync();
        Assert.Equal(409, (await owner.Create(10, new(Start.AddDays(6), Start.AddDays(7), "Guest"))).StatusCode);
    }
    private sealed class Fixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection;
        public DataContext Db { get; }
        private Fixture(SqliteConnection c, DataContext db) { connection = c; Db = db; }
        public static async Task<Fixture> Create()
        {
            var c = new SqliteConnection("Data Source=:memory:;Foreign Keys=False"); await c.OpenAsync();
            var db = new SlimContext(new DbContextOptionsBuilder<DataContext>().UseSqlite(c).Options);
            await db.Database.EnsureCreatedAsync();
            db.Organizations.AddRange(new Organization { Id = 20, IsActive = true }, new Organization { Id = 21, IsActive = true });
            db.Properties.Add(new Property { Id = 7, OrganizationId = 20, TimeZoneId = "America/New_York" });
            db.Units.Add(new Unit { Id = 10, PropertyId = 7, OrganizationId = 20, Name = "Suite", RentalMode = ERentalMode.ShortTerm });
            db.OrganizationMembers.Add(new OrganizationMember { OrganizationId = 20, UserId = 42, Role = "Owner", IsActive = true });
            await db.SaveChangesAsync(); return new(c, db);
        }
        public ExtendedStayAgreementService Service(long org, long subject = 42)
        {
            var http = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, subject.ToString())], "test", ClaimTypes.Name, ClaimTypes.Role)) };
            http.Items["OrganizationId"] = org; http.Items["UserId"] = 42L;
            return new ExtendedStayAgreementService(Db, new HttpContextAccessor { HttpContext = http }, new DevEnvironment());
        }
        public async ValueTask DisposeAsync() { await Db.DisposeAsync(); await connection.DisposeAsync(); }
    }
    private sealed class DevEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Development;
        public string ApplicationName { get; set; } = "test";
        public string ContentRootPath { get; set; } = ".";
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
    private sealed class SlimContext(DbContextOptions<DataContext> options) : DataContext(options)
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            var keep = new[] { typeof(Property), typeof(Unit), typeof(Organization), typeof(OrganizationMember), typeof(ShortStayBlock),
                typeof(ShortStayIcalSubscription), typeof(ShortStayIcalOccurrence), typeof(ShortStayReservation),
                typeof(ShortStayReservationNight), typeof(ShortStayOccupancyClaim), typeof(ExtendedStayAgreement) };
            foreach (var entity in modelBuilder.Model.GetEntityTypes().ToList())
                if (entity.ClrType != typeof(ActivityEvent) && !keep.Contains(entity.ClrType)) modelBuilder.Ignore(entity.ClrType);
            foreach (var entity in modelBuilder.Model.GetEntityTypes())
                foreach (var property in entity.GetProperties())
                    if (property.GetColumnType()?.Contains("(max)", StringComparison.OrdinalIgnoreCase) == true) property.SetColumnType("TEXT");
        }
    }
}
