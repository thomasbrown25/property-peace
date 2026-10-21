using System.Security.Claims;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.ShortStay;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Units;

public sealed class ShortStayPhotoApiTests
{
    private static readonly byte[] Png = CreatePng();
    private static byte[] CreatePng()
    {
        using var bitmap = new SkiaSharp.SKBitmap(2, 2);
        bitmap.Erase(SkiaSharp.SKColors.Red);
        using var image = SkiaSharp.SKImage.FromBitmap(bitmap);
        using var data = image.Encode(SkiaSharp.SKEncodedImageFormat.Png, 100);
        return data.ToArray();
    }
    [Fact]
    public void Routes_are_separate_and_authorized()
    {
        var type = typeof(ShortStayListingPhotoController);
        Assert.NotNull(type.GetCustomAttributes(typeof(AuthorizeAttribute), true).SingleOrDefault());
        Assert.Equal("api/short-stay/units/{unitId:long}/listing/photos", ((Microsoft.AspNetCore.Mvc.RouteAttribute)type.GetCustomAttributes(typeof(Microsoft.AspNetCore.Mvc.RouteAttribute), true).Single()).Template);
    }
    [Fact]
    public async Task Scope_and_parent_checks_precede_storage_for_every_operation()
    {
        await using var f = await Fixture.Create();
        foreach (var service in new[] { f.Service(null), f.Service(21), f.Service(20, 999) })
        {
            Assert.NotEqual(200, (await service.List(10)).StatusCode);
            Assert.NotEqual(201, (await service.Upload(10, [File(Png)])).StatusCode);
            Assert.NotEqual(200, (await service.Delete(10, 123)).StatusCode);
            Assert.NotEqual(200, (await service.SetCover(10, 123)).StatusCode);
        }
        Assert.Empty(f.Storage.Written);
        var member = await f.Db.OrganizationMembers.SingleAsync();
        member.Role = "Manager"; member.CanManageProperties = false;
        await f.Db.SaveChangesAsync();
        Assert.Equal(403, (await f.Service(20).List(10)).StatusCode);
        member.CanManageProperties = true;
        await f.Db.SaveChangesAsync();
        Assert.Equal(404, (await f.Service(20).List(999)).StatusCode);
        Assert.Equal(404, (await f.Service(20).List(10)).StatusCode); // listing required
        f.Db.ShortStayListings.Add(new ShortStayListing { UnitId = 10, NightlyBasePrice = 100 });
        await f.Db.SaveChangesAsync();
        Assert.Equal(200, (await f.Service(20).List(10)).StatusCode);
        var unit = await f.Db.Units.SingleAsync(); unit.RentalMode = ERentalMode.LongTerm;
        await f.Db.SaveChangesAsync();
        Assert.Equal(409, (await f.Service(20).Upload(10, [File(Png)])).StatusCode);
    }
    [Fact]
    public async Task Upload_validates_all_files_before_writing_and_compensates_failed_batch()
    {
        await using var f = await Fixture.Create();
        f.Db.ShortStayListings.Add(new ShortStayListing { UnitId = 10, NightlyBasePrice = 100 });
        await f.Db.SaveChangesAsync();
        var s = f.Service(20);
        Assert.Equal(400, (await s.Upload(10, [File(Png), File([1, 2, 3])])).StatusCode);
        Assert.Empty(f.Storage.Written);
        f.Storage.FailAt = 2;
        Assert.Equal(503, (await s.Upload(10, [File(Png), File(Png)])).StatusCode);
        Assert.Empty(f.Storage.Written);
        Assert.Empty(await f.Db.ShortStayListingPhotos.ToListAsync());
        f.Storage.FailAt = 0;
        Assert.Equal(201, (await s.Upload(10, [File(Png)])).StatusCode);
        Assert.Single(f.Storage.Written);
        Assert.StartsWith("org/20/units/10/listings/", f.Storage.Written.Single());
        Assert.True((await f.Db.ShortStayListingPhotos.SingleAsync()).IsCoverPhoto);
    }
    [Fact]
    public async Task Invalid_signatures_limits_and_database_failure_leave_no_uploaded_objects()
    {
        await using var f = await Fixture.Create();
        f.Db.ShortStayListings.Add(new ShortStayListing { UnitId = 10, NightlyBasePrice = 100 });
        await f.Db.SaveChangesAsync();
        var s = f.Service(20);
        var spoofed = File(Png); spoofed.ContentType = "image/jpeg";
        foreach (var bad in new[] { File([1, 2, 3]), spoofed, File(new byte[5 * 1024 * 1024 + 1]) })
            Assert.Equal(400, (await s.Upload(10, [bad])).StatusCode);
        Assert.Equal(400, (await s.Upload(10, Enumerable.Repeat(File(Png), 6).ToArray())).StatusCode);
        Assert.Empty(f.Storage.Written);
        await f.Db.Database.ExecuteSqlRawAsync("CREATE TRIGGER reject_photo BEFORE INSERT ON ShortStayListingPhotos BEGIN SELECT RAISE(FAIL, 'private DB error'); END;");
        Assert.Equal(503, (await s.Upload(10, [File(Png)])).StatusCode);
        Assert.Empty(f.Storage.Written);
        Assert.Empty(await f.Db.ShortStayListingPhotos.ToListAsync());
    }
    [Fact]
    public async Task Delete_cleanup_failure_reports_committed_deletion_without_exposing_private_orphan()
    {
        await using var f = await Fixture.Create();
        f.Db.ShortStayListings.Add(new ShortStayListing { UnitId = 10, NightlyBasePrice = 100 });
        await f.Db.SaveChangesAsync();
        var s = f.Service(20);
        Assert.Equal(201, (await s.Upload(10, [File(Png)])).StatusCode);
        var id = (await f.Db.ShortStayListingPhotos.SingleAsync()).Id;
        f.Storage.FailDelete = true;
        var result = await s.Delete(10, id);
        Assert.Equal(200, result.StatusCode);
        Assert.True(result.Success);
        Assert.True(result.Data);
        Assert.Empty((await s.List(10)).Data!);
        Assert.Empty(await f.Db.ShortStayListingPhotos.ToListAsync());
        Assert.Single(f.Storage.Written); // private orphan; maintenance must reconcile it
        Assert.Equal(404, (await s.Delete(10, id)).StatusCode); // retry cannot delete the committed row again
        Assert.Contains(f.Log.Messages, message => message.Contains($"{id}") && message.Contains("cleanup failed"));
        Assert.DoesNotContain(f.Log.Messages, message => message.Contains("org/") || message.Contains("secret") || message.Contains("https://"));
    }
    [Fact]
    public async Task Delete_database_failure_does_not_report_success_or_delete_private_blob()
    {
        await using var f = await Fixture.Create();
        f.Db.ShortStayListings.Add(new ShortStayListing { UnitId = 10, NightlyBasePrice = 100 });
        await f.Db.SaveChangesAsync();
        var s = f.Service(20);
        Assert.Equal(201, (await s.Upload(10, [File(Png)])).StatusCode);
        var id = (await f.Db.ShortStayListingPhotos.SingleAsync()).Id;
        await f.Db.Database.ExecuteSqlRawAsync("CREATE TRIGGER reject_photo_delete BEFORE DELETE ON ShortStayListingPhotos BEGIN SELECT RAISE(FAIL, 'private DB error'); END;");
        Assert.Equal(503, (await s.Delete(10, id)).StatusCode);
        Assert.Equal(id, (await f.Db.ShortStayListingPhotos.AsNoTracking().SingleAsync()).Id);
        Assert.Single(f.Storage.Written);
        Assert.Equal(0, f.Storage.DeleteCalls);
    }
    [Fact]
    public async Task Foreign_photo_cannot_be_deleted_or_made_cover_and_read_urls_are_scoped()
    {
        await using var f = await Fixture.Create();
        f.Db.ShortStayListings.AddRange(new ShortStayListing { UnitId = 10, NightlyBasePrice = 100 }, new ShortStayListing { UnitId = 11, NightlyBasePrice = 100 });
        f.Db.Units.Add(new Unit { Id = 11, PropertyId = 7, OrganizationId = 20, Name = "Other", RentalMode = ERentalMode.ShortTerm });
        await f.Db.SaveChangesAsync();
        var s = f.Service(20);
        Assert.Equal(201, (await s.Upload(10, [File(Png), File(Png)])).StatusCode);
        Assert.Equal(201, (await s.Upload(11, [File(Png)])).StatusCode);
        var foreign = await f.Db.ShortStayListingPhotos.Where(p => p.ShortStayListing.UnitId == 11).SingleAsync();
        Assert.Equal(404, (await s.Delete(10, foreign.Id)).StatusCode);
        Assert.Equal(404, (await s.SetCover(10, foreign.Id)).StatusCode);
        Assert.Contains(foreign.BlobName, f.Storage.Written);
        var photos = (await s.List(10)).Data!;
        Assert.Equal(2, photos.Count);
        Assert.All(photos, p => Assert.StartsWith("https://private.invalid/", p.Url));
        Assert.Equal(200, (await s.SetCover(10, photos.Single(p => !p.IsCoverPhoto).Id)).StatusCode);
        Assert.Single(await f.Db.ShortStayListingPhotos.Where(p => p.ShortStayListing.UnitId == 10 && p.IsCoverPhoto).ToListAsync());
        Assert.Equal(200, (await s.Delete(10, photos.Single(p => p.IsCoverPhoto).Id)).StatusCode);
        Assert.Single(await f.Db.ShortStayListingPhotos.Where(p => p.ShortStayListing.UnitId == 10).ToListAsync());
    }
    private static FormFile File(byte[] bytes) => new(new MemoryStream(bytes), 0, bytes.Length, "files", "a.png") { Headers = new HeaderDictionary(), ContentType = "image/png" };
    private sealed class Storage : IShortStayPhotoStorage
    {
        public HashSet<string> Written { get; } = [];
        public int FailAt { get; set; }
        public bool FailDelete { get; set; }
        public int DeleteCalls { get; private set; }
        private int calls;
        public Task Write(string key, byte[] bytes, string contentType, CancellationToken ct) { if (++calls == FailAt) throw new IOException("secret"); Written.Add(key); return Task.CompletedTask; }
        public Task Delete(string key, CancellationToken ct) { DeleteCalls++; if (FailDelete) throw new IOException("secret"); Written.Remove(key); return Task.CompletedTask; }
        public Task<string> ReadUrl(string key, CancellationToken ct) => Task.FromResult("https://private.invalid/" + key);
    }
    private sealed class Fixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection;
        public DataContext Db { get; }
        public Storage Storage { get; } = new();
        public TestLogger Log { get; } = new();
        private Fixture(SqliteConnection connection, DataContext db) { this.connection = connection; Db = db; }
        public static async Task<Fixture> Create()
        {
            var connection = new SqliteConnection("Data Source=:memory:;Foreign Keys=False"); await connection.OpenAsync();
            var db = new SlimContext(new DbContextOptionsBuilder<DataContext>().UseSqlite(connection).Options);
            await db.Database.EnsureCreatedAsync();
            db.Organizations.Add(new Organization { Id = 20, IsActive = true });
            db.Properties.Add(new Property { Id = 7, OrganizationId = 20 });
            db.Units.Add(new Unit { Id = 10, PropertyId = 7, OrganizationId = 20, Name = "Suite", RentalMode = ERentalMode.ShortTerm });
            db.OrganizationMembers.Add(new OrganizationMember { OrganizationId = 20, UserId = 42, Role = "Owner", IsActive = true });
            await db.SaveChangesAsync(); return new Fixture(connection, db);
        }
        public ShortStayListingPhotoService Service(long? org, long subject = 42)
        {
            var http = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, subject.ToString())], "test")) };
            if (org.HasValue) http.Items["OrganizationId"] = org.Value;
            http.Items["UserId"] = 42L;
            return new ShortStayListingPhotoService(Db, new HttpContextAccessor { HttpContext = http }, Storage, Log);
        }
        public async ValueTask DisposeAsync() { await Db.DisposeAsync(); await connection.DisposeAsync(); }
    }
    private sealed class TestLogger : ILogger<ShortStayListingPhotoService>
    {
        public List<string> Messages { get; } = [];
        public IDisposable BeginScope<TState>(TState state) where TState : notnull => NullScope.Instance;
        public bool IsEnabled(LogLevel level) => true;
        public void Log<TState>(LogLevel level, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter) => Messages.Add(formatter(state, exception));
        private sealed class NullScope : IDisposable
        {
            public static readonly NullScope Instance = new();
            public void Dispose() { }
        }
    }
    private sealed class SlimContext(DbContextOptions<DataContext> options) : DataContext(options)
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            var keep = new[] { typeof(Property), typeof(Unit), typeof(Organization), typeof(OrganizationMember), typeof(ShortStayListing), typeof(ShortStayListingPhoto) };
            foreach (var entity in modelBuilder.Model.GetEntityTypes().ToList()) if (!keep.Contains(entity.ClrType)) modelBuilder.Ignore(entity.ClrType);
            foreach (var entity in modelBuilder.Model.GetEntityTypes()) foreach (var property in entity.GetProperties())
                if (property.GetColumnType()?.Contains("(max)", StringComparison.OrdinalIgnoreCase) == true) property.SetColumnType("TEXT");
        }
    }
}
