using System.Security.Claims;
using System.Data.Common;
using System.Text.Json;
using brownstone_hub_api.Attributes;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.ShortStay;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Units;

public sealed class ShortStayInventoryReportTests
{
    private static readonly DateOnly Spring = new(2026, 3, 8);
    private static readonly DateTime Snapshot = new(2026, 3, 9, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Concurrent_committed_edit_cannot_mix_membership_and_inventory_reads()
    {
        var path = Path.Combine(Path.GetTempPath(), $"inventory-report-{Guid.NewGuid():N}.db");
        try
        {
            var connectionString = $"Data Source={path};Foreign Keys=False;Default Timeout=5";
            var options = new DbContextOptionsBuilder<DataContext>().UseSqlite(connectionString).Options;
            await using (var seed = new SlimContext(options))
            {
                await seed.Database.EnsureCreatedAsync();
                await seed.Database.ExecuteSqlRawAsync("PRAGMA journal_mode=WAL");
                seed.Organizations.Add(new Organization { Id = 20, IsActive = true });
                seed.Properties.Add(new Property { Id = 7, OrganizationId = 20, TimeZoneId = "America/New_York" });
                seed.Units.Add(new Unit { Id = 10, PropertyId = 7, OrganizationId = 20, Name = "Suite", RentalMode = ERentalMode.ShortTerm });
                seed.OrganizationMembers.Add(new OrganizationMember { OrganizationId = 20, UserId = 42, Role = "Owner", IsActive = true });
                seed.ShortStayListings.Add(new ShortStayListing { UnitId = 10, NightlyBasePrice = 120 });
                await seed.SaveChangesAsync();
            }

            // Interleave one atomic writer immediately after the membership SELECT. Without a
            // transaction the writer commits, so the report uses pre-edit access with post-edit inventory.
            var committed = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            var interceptor = new AfterMembershipRead(async () =>
            {
                var writer = Task.Run(async () =>
                {
                    await using var db = new SlimContext(options);
                    await using var tx = await db.Database.BeginTransactionAsync();
                    await db.Database.ExecuteSqlRawAsync("UPDATE OrganizationMembers SET IsActive = 0 WHERE OrganizationId = 20 AND UserId = 42");
                    db.ShortStayBlocks.Add(new ShortStayBlock { UnitId = 10, StartDate = Spring, EndDate = Spring.AddDays(1) });
                    await db.SaveChangesAsync();
                    await tx.CommitAsync();
                    committed.TrySetResult();
                });
                // Under a read transaction the writer cannot commit until the report closes it.
                // Without one, this wait ensures the edit lands between the separate SELECTs.
                try { await committed.Task.WaitAsync(TimeSpan.FromMilliseconds(500)); }
                catch (TimeoutException) { }
                _ = writer;
            });
            var readerOptions = new DbContextOptionsBuilder<DataContext>().UseSqlite(connectionString).AddInterceptors(interceptor).Options;
            await using var reader = new SlimContext(readerOptions);
            var http = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity([
                new Claim(ClaimTypes.NameIdentifier, "42"), new Claim(ClaimTypes.Role, "Landlord")], "test")) };
            http.Items["OrganizationId"] = 20L;
            http.Items["UserId"] = 42L;
            var service = new ShortStayInventoryReportService(reader, new HttpContextAccessor { HttpContext = http },
                new FixedClock(), NullLogger<ShortStayInventoryReportService>.Instance);
            var result = await service.Get(10, Spring, Spring.AddDays(1));
            Assert.Equal(200, result.StatusCode);
            Assert.Equal(0, result.Data!.BlockedNights);
            Assert.Equal(1, result.Data.PricedUnblockedNights);
            await committed.Task.WaitAsync(TimeSpan.FromSeconds(8));
            Assert.Equal(403, (await service.Get(10, Spring, Spring.AddDays(1))).StatusCode);
        }
        finally
        {
            SqliteConnection.ClearAllPools();
            foreach (var suffix in new[] { "", "-wal", "-shm" }) System.IO.File.Delete(path + suffix);
        }
    }

    private sealed class AfterMembershipRead(Func<Task> once) : DbCommandInterceptor
    {
        private int fired;
        public override async ValueTask<DbDataReader> ReaderExecutedAsync(DbCommand command, CommandExecutedEventData eventData,
            DbDataReader result, CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("OrganizationMembers", StringComparison.Ordinal) &&
                Interlocked.Exchange(ref fired, 1) == 0) await once();
            return result;
        }
    }

    [Fact]
    public void Route_is_owner_manager_read_only()
    {
        var type = typeof(ShortStayInventoryReportController);
        Assert.Equal("api/short-stay/units/{unitId:long}/inventory-report", Assert.Single(type.GetCustomAttributes(typeof(RouteAttribute), true).Cast<RouteAttribute>()).Template);
        Assert.NotNull(Assert.Single(type.GetCustomAttributes(typeof(AuthorizeAttribute), true)));
        var method = Assert.Single(type.GetMethods(), m => m.DeclaringType == type);
        Assert.NotNull(Assert.Single(method.GetCustomAttributes(typeof(HttpGetAttribute), true)));
        var roles = Assert.Single(method.GetCustomAttributes(typeof(RequireOrganizationRoleAttribute), true).Cast<RequireOrganizationRoleAttribute>()).AllowedRoles;
        Assert.Contains("Owner", roles); Assert.Contains("Manager", roles); Assert.DoesNotContain("Viewer", roles);
    }

    [Fact]
    public async Task Mixed_overlaps_count_unique_local_nights_and_only_prices_unblocked_inventory()
    {
        await using var f = await Fixture.Create();
        f.Db.ShortStayListings.Add(new ShortStayListing { UnitId = 10, NightlyBasePrice = 120 });
        f.Db.ShortStayBlocks.AddRange(
            new ShortStayBlock { UnitId = 10, StartDate = Spring.AddDays(-1), EndDate = Spring.AddDays(2) },
            new ShortStayBlock { UnitId = 10, StartDate = Spring.AddDays(1), EndDate = Spring.AddDays(3) });
        f.Db.ShortStayIcalSubscriptions.Add(new ShortStayIcalSubscription { UnitId = 10, OrgId = 20, Enabled = true,
            LastSuccessAtUtc = Snapshot.AddHours(-49), EncryptedUrl = "secret-url", UrlFingerprint = "secret-fingerprint",
            Occurrences = new List<ShortStayIcalOccurrence> {
                new() { UidKey = "secret-uid", RecurrenceKey = "secret-recurrence", StartDate = Spring.AddDays(1), EndDate = Spring.AddDays(4) },
                new() { UidKey = "other", RecurrenceKey = "other-recurrence", StartDate = Spring.AddDays(2), EndDate = Spring.AddDays(4) }
            } });
        f.Db.ShortStayNightlyRateOverrides.AddRange(
            new ShortStayNightlyRateOverride { UnitId = 10, Date = Spring.AddDays(3), NightlyRate = 200 },
            new ShortStayNightlyRateOverride { UnitId = 10, Date = Spring.AddDays(4), NightlyRate = 150 });
        await f.Db.SaveChangesAsync();
        var result = await f.Service(20).Get(10, Spring, Spring.AddDays(5));
        Assert.Equal(200, result.StatusCode);
        var data = result.Data!;
        Assert.Equal(5, data.TotalNights);
        Assert.Equal(3, data.OwnerBlockedNights);
        Assert.Equal(3, data.AirbnbBlockedNights);
        Assert.Equal(2, data.OverlapNights);
        Assert.Equal(4, data.BlockedNights);
        Assert.Equal(1, data.UnblockedNights);
        Assert.Equal(1, data.PricedUnblockedNights);
        Assert.Equal(0, data.UnpricedUnblockedNights);
        Assert.Equal("stale", data.AirbnbSyncStatus);
        Assert.True(data.AirbnbSyncStaleWarning);
        Assert.Equal(Snapshot, data.SnapshotAtUtc);
        Assert.Equal("America/New_York", data.TimeZoneId);
        Assert.False(data.BookingMetricsAvailable); Assert.False(data.RevenueMetricsAvailable); Assert.False(data.OccupancyMetricsAvailable);
        var json = JsonSerializer.Serialize(data);
        foreach (var forbidden in new[] { "secret-url", "secret-fingerprint", "secret-uid", "BookedNights" })
            Assert.DoesNotContain(forbidden, json);
    }

    [Fact]
    public async Task No_listing_is_unpriced_even_when_orphan_override_exists_and_DST_is_one_local_night()
    {
        await using var f = await Fixture.Create();
        f.Db.ShortStayNightlyRateOverrides.Add(new ShortStayNightlyRateOverride { UnitId = 10, Date = Spring, NightlyRate = 99 });
        await f.Db.SaveChangesAsync();
        var data = (await f.Service(20).Get(10, Spring, Spring.AddDays(2))).Data!;
        Assert.Equal(2, data.TotalNights);
        Assert.Equal(0, data.PricedUnblockedNights);
        Assert.Equal(2, data.UnpricedUnblockedNights);
        Assert.Equal("disabled", data.AirbnbSyncStatus);
        Assert.False(data.AirbnbSyncStaleWarning);
    }

    [Fact]
    public async Task Disabled_and_never_synced_imports_are_not_mistaken_for_fresh_inventory()
    {
        await using var f = await Fixture.Create();
        var sub = new ShortStayIcalSubscription { UnitId = 10, OrgId = 20, Enabled = true,
            EncryptedUrl = "private", UrlFingerprint = "fingerprint",
            Occurrences = new List<ShortStayIcalOccurrence> {
                new() { UidKey = "uid", RecurrenceKey = "recurrence", StartDate = Spring, EndDate = Spring.AddDays(1) }
            } };
        f.Db.ShortStayIcalSubscriptions.Add(sub); await f.Db.SaveChangesAsync();
        var report = (await f.Service(20).Get(10, Spring, Spring.AddDays(1))).Data!;
        Assert.Equal("never_synced", report.AirbnbSyncStatus);
        Assert.True(report.AirbnbSyncStaleWarning);
        Assert.Equal(1, report.AirbnbBlockedNights);
        sub.ConsecutiveFailures = 1; await f.Db.SaveChangesAsync();
        report = (await f.Service(20).Get(10, Spring, Spring.AddDays(1))).Data!;
        Assert.Equal("retrying", report.AirbnbSyncStatus);
        Assert.True(report.AirbnbSyncStaleWarning);
        sub.Enabled = false; await f.Db.SaveChangesAsync();
        report = (await f.Service(20).Get(10, Spring, Spring.AddDays(1))).Data!;
        Assert.Equal("disabled", report.AirbnbSyncStatus);
        Assert.Equal(0, report.AirbnbBlockedNights);
        Assert.Equal(1, report.UnblockedNights);
    }

    [Fact]
    public async Task Scope_mode_zone_and_range_fail_closed_and_other_units_do_not_leak()
    {
        await using var f = await Fixture.Create();
        f.Db.ShortStayBlocks.Add(new ShortStayBlock { UnitId = 11, StartDate = Spring, EndDate = Spring.AddDays(2) });
        await f.Db.SaveChangesAsync();
        Assert.Equal(0, (await f.Service(20).Get(10, Spring, Spring.AddDays(2))).Data!.BlockedNights);
        Assert.Equal(404, (await f.Service(21).Get(10, Spring, Spring.AddDays(2))).StatusCode);
        Assert.Equal(403, (await f.Service(null).Get(10, Spring, Spring.AddDays(2))).StatusCode);
        Assert.Equal(403, (await f.Service(20, 99).Get(10, Spring, Spring.AddDays(2))).StatusCode);
        Assert.Equal(400, (await f.Service(20).Get(10, Spring, Spring)).StatusCode);
        Assert.Equal(400, (await f.Service(20).Get(10, Spring, Spring.AddDays(91))).StatusCode);
        Assert.Equal(90, (await f.Service(20).Get(10, Spring, Spring.AddDays(90))).Data!.TotalNights);
        var member = await f.Db.OrganizationMembers.SingleAsync(m => m.OrganizationId == 20);
        member.Role = "Manager"; member.CanManageProperties = false; await f.Db.SaveChangesAsync();
        Assert.Equal(403, (await f.Service(20).Get(10, Spring, Spring.AddDays(1))).StatusCode);
        member.CanManageProperties = true; await f.Db.SaveChangesAsync();
        Assert.Equal(200, (await f.Service(20).Get(10, Spring, Spring.AddDays(1))).StatusCode);
        var unit = await f.Db.Units.SingleAsync(u => u.Id == 10);
        unit.RentalMode = ERentalMode.LongTerm; await f.Db.SaveChangesAsync();
        Assert.Equal(409, (await f.Service(20).Get(10, Spring, Spring.AddDays(1))).StatusCode);
        unit.RentalMode = ERentalMode.ShortTerm;
        var property = await f.Db.Properties.SingleAsync(); property.TimeZoneId = "Mars/Olympus"; await f.Db.SaveChangesAsync();
        Assert.Equal(409, (await f.Service(20).Get(10, Spring, Spring.AddDays(1))).StatusCode);
    }

    [Fact]
    public async Task Controller_requires_strict_local_iso_dates()
    {
        await using var f = await Fixture.Create();
        var controller = new ShortStayInventoryReportController(f.Service(20));
        Assert.IsType<BadRequestObjectResult>(await controller.Get(10, "2026-3-8", "2026-03-09", default));
        Assert.IsType<BadRequestObjectResult>(await controller.Get(10, "2026-03-08T00:00Z", "2026-03-09", default));
    }

    [Fact]
    public async Task Held_claims_are_sourced_unavailable_nights_not_bookings_or_revenue()
    {
        await using var f = await Fixture.Create();
        f.Db.ShortStayListings.Add(new ShortStayListing { UnitId = 10, NightlyBasePrice = 120 });
        var now = DateTimeOffset.UtcNow;
        f.Db.ShortStayReservations.Add(ShortStayReservation.CreateHold(10, 7, 20, 77, 42, "acct_private",
            Spring, Spring.AddDays(2), 1, [12000, 12000], now.AddHours(1), now));
        await f.Db.SaveChangesAsync();
        var report = (await f.Service(20).Get(10, Spring, Spring.AddDays(3))).Data!;
        Assert.Equal(2, report.HeldNights);
        Assert.Equal(0, report.ConfirmedNights);
        Assert.Equal(2, report.BlockedNights);
        Assert.Equal(1, report.PricedUnblockedNights);
        Assert.False(report.BookingMetricsAvailable);
        Assert.False(report.RevenueMetricsAvailable);
        Assert.False(report.OccupancyMetricsAvailable);
        Assert.DoesNotContain("acct_private", JsonSerializer.Serialize(report));
        await f.Db.Database.ExecuteSqlRawAsync("UPDATE ShortStayReservations SET Status = 'Confirmed', StripePaymentIntentId = 'pi_test', PaymentConfirmedAtUtc = CreatedAtUtc");
        report = (await f.Service(20).Get(10, Spring, Spring.AddDays(3))).Data!;
        Assert.Equal(0, report.HeldNights);
        Assert.Equal(2, report.ConfirmedNights);
        Assert.Equal(2, report.BlockedNights);
        Assert.False(report.BookingMetricsAvailable);
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
        public ShortStayInventoryReportService Service(long? org, long subject = 42)
        {
            var http = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, subject.ToString()), new Claim(ClaimTypes.Role, "Landlord")], "test")) };
            if (org.HasValue) http.Items["OrganizationId"] = org.Value;
            http.Items["UserId"] = 42L;
            return new ShortStayInventoryReportService(Db, new HttpContextAccessor { HttpContext = http },
                new FixedClock(), NullLogger<ShortStayInventoryReportService>.Instance);
        }
        public async ValueTask DisposeAsync() { await Db.DisposeAsync(); await connection.DisposeAsync(); }
    }
    private sealed class FixedClock : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => new(Snapshot);
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
