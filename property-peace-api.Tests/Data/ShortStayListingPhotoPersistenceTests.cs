using System.Text.RegularExpressions;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Xunit;

namespace brownstone_hub_api.Tests.ShortStay;

public sealed class ShortStayListingPhotoPersistenceTests
{
    [Fact]
    public async Task Photo_round_trips_in_display_order_without_a_monthly_listing_relationship_or_sas()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = Context(connection);
        await CreateTables(db);
        await SeedParent(db);
        await db.Database.ExecuteSqlRawAsync("INSERT INTO Listings (Id) VALUES (1)");

        db.ShortStayListingPhotos.AddRange(
            new ShortStayListingPhoto { ShortStayListingId = 1, BlobName = "private/second.jpg", DisplayOrder = 2, CreatedAtUtc = new DateTime(2026, 1, 2, 0, 0, 0, DateTimeKind.Utc) },
            new ShortStayListingPhoto { ShortStayListingId = 1, BlobName = "private/first.jpg", DisplayOrder = 0, IsCoverPhoto = true, CreatedAtUtc = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var photos = await db.ShortStayListingPhotos.OrderBy(p => p.DisplayOrder).ToListAsync();
        Assert.Equal(new[] { "private/first.jpg", "private/second.jpg" }, photos.Select(p => p.BlobName));
        Assert.True(photos[0].IsCoverPhoto);
        Assert.Equal(new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc), photos[0].CreatedAtUtc);
        Assert.Equal(2, await db.ShortStayListings.Where(x => x.Id == 1).SelectMany(x => x.Photos).CountAsync());
    }

    [Fact]
    public async Task Foreign_key_requires_short_stay_parent_even_when_monthly_listing_has_same_id_and_prevents_parent_delete()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = Context(connection);
        await CreateTables(db);
        await db.Database.ExecuteSqlRawAsync("INSERT INTO Listings (Id) VALUES (1)");
        await Assert.ThrowsAsync<SqliteException>(() => Insert(db, 1, "private/orphan.jpg", 0, false));
        await SeedParent(db);
        await Insert(db, 1, "private/real.jpg", 0, true);
        await Assert.ThrowsAsync<SqliteException>(() => db.Database.ExecuteSqlRawAsync("DELETE FROM ShortStayListings WHERE Id = 1"));
        Assert.Equal(1, await db.ShortStayListingPhotos.CountAsync());
    }

    [Fact]
    public async Task Blob_key_and_position_are_unique_and_cover_is_single_per_short_stay_listing()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = Context(connection);
        await CreateTables(db);
        await SeedParent(db);
        await db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayListings (Id) VALUES (2)");
        await Insert(db, 1, "private/one.jpg", 0, true);
        await Assert.ThrowsAsync<SqliteException>(() => Insert(db, 1, "private/two.jpg", 0, false));
        await Assert.ThrowsAsync<SqliteException>(() => Insert(db, 2, "private/one.jpg", 0, false));
        await Assert.ThrowsAsync<SqliteException>(() => Insert(db, 1, "private/two.jpg", 1, true));
        await Assert.ThrowsAsync<SqliteException>(() => Insert(db, 1, "private/negative.jpg", -1, false));
        await Assert.ThrowsAsync<SqliteException>(() => Insert(db, 1, "", 1, false));
        await Insert(db, 1, "private/two.jpg", 1, false);
        await Insert(db, 2, "private/three.jpg", 0, true);
        Assert.Equal(3, await db.ShortStayListingPhotos.CountAsync());
    }

    private static DataContext Context(SqliteConnection connection) => new(new DbContextOptionsBuilder<DataContext>()
        .UseSqlite(connection).Options);

    private static Task<int> Insert(DataContext db, long parentId, string blobName, int order, bool cover) =>
        db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO ShortStayListingPhotos (ShortStayListingId, BlobName, DisplayOrder, IsCoverPhoto, CreatedAtUtc) VALUES ({parentId}, {blobName}, {order}, {cover}, {new DateTime(2026, 1, 1)})");

    private static Task<int> SeedParent(DataContext db) =>
        db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayListings (Id) VALUES (1)");

    private static async Task CreateTables(DataContext db)
    {
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE ShortStayListings (Id INTEGER PRIMARY KEY)");
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE Listings (Id INTEGER PRIMARY KEY)");
        // Use actual EF-generated DDL, not a hand-authored approximation of the photo constraints.
        var ddl = db.Database.GenerateCreateScript();
        var table = Regex.Match(ddl, "CREATE TABLE [^;]*ShortStayListingPhotos[^;]*;", RegexOptions.Singleline);
        Assert.True(table.Success, "EF must generate ShortStayListingPhotos");
        await db.Database.ExecuteSqlRawAsync(table.Value);
        foreach (Match index in Regex.Matches(ddl, "CREATE (?:UNIQUE )?INDEX [^;]*ShortStayListingPhotos[^;]*;", RegexOptions.Singleline))
            await db.Database.ExecuteSqlRawAsync(index.Value);
        var photoType = db.Model.FindEntityType(typeof(ShortStayListingPhoto))!;
        Assert.Equal("listing", photoType.GetSchema());
        Assert.Single(photoType.GetForeignKeys());
        Assert.Equal(typeof(ShortStayListing), photoType.GetForeignKeys().Single().PrincipalEntityType.ClrType);
        Assert.Equal(DeleteBehavior.NoAction, photoType.GetForeignKeys().Single().DeleteBehavior);
        Assert.DoesNotContain(photoType.GetProperties(), p => p.Name.Contains("Sas", StringComparison.OrdinalIgnoreCase) || p.Name.Contains("Url", StringComparison.OrdinalIgnoreCase));
    }
}
