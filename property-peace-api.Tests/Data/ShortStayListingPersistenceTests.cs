using System.ComponentModel.DataAnnotations;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.ShortStay;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using System.Text.RegularExpressions;
using Xunit;

namespace brownstone_hub_api.Tests.ShortStay;

public sealed class ShortStayListingPersistenceTests
{
    [Fact]
    public async Task Separate_listing_round_trips_with_property_timezone_and_keeps_lease_listing_mapping()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = Context(connection);
        await CreateTables(db);
        var property = new Property { LandlordId = 1, TimeZoneId = "America/New_York" };
        var unit = new Unit { Name = "Suite", Property = property, RentalMode = ERentalMode.ShortTerm };
        db.ShortStayListings.Add(new ShortStayListing
        {
            Unit = unit, NightlyBasePrice = 125.50m, CleaningFee = 35.25m,
            MinimumNights = 2, Capacity = 4, CheckInTime = new TimeOnly(15, 0),
            CheckOutTime = new TimeOnly(11, 0), HouseRules = "No smoking",
            Amenities = "Wi-Fi, parking", CancellationPolicy = "Flexible"
        });
        // Existing property FK requires a landlord; fixture uses a relational seed.
        await db.Database.ExecuteSqlRawAsync("INSERT INTO Users (Id) VALUES (1)");
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var saved = await db.ShortStayListings.Include(x => x.Unit).ThenInclude(x => x.Property).SingleAsync();
        Assert.Equal("America/New_York", saved.Unit.Property.TimeZoneId);
        Assert.Equal(125.50m, saved.NightlyBasePrice);
        Assert.Equal(35.25m, saved.CleaningFee);
        Assert.Equal(new TimeOnly(15, 0), saved.CheckInTime);
        Assert.Equal(new TimeOnly(11, 0), saved.CheckOutTime);
        Assert.Equal("No smoking", saved.HouseRules);
        Assert.Equal("Wi-Fi, parking", saved.Amenities);
        Assert.Equal("Flexible", saved.CancellationPolicy);
        Assert.Equal(ShortStayListingStatus.Draft, saved.Status);
        Assert.Equal(18, db.Model.FindEntityType(typeof(ShortStayListing))!
            .FindProperty(nameof(ShortStayListing.NightlyBasePrice))!.GetPrecision());
        Assert.Equal(2, db.Model.FindEntityType(typeof(ShortStayListing))!
            .FindProperty(nameof(ShortStayListing.CleaningFee))!.GetScale());
        Assert.Equal(128, db.Model.FindEntityType(typeof(Property))!
            .FindProperty(nameof(Property.TimeZoneId))!.GetMaxLength());
        Assert.Equal("Listings", db.Model.FindEntityType(typeof(Listing))!.GetTableName());
        Assert.Equal("ShortStayListings", db.Model.FindEntityType(typeof(ShortStayListing))!.GetTableName());
        var listingEntity = db.Model.FindEntityType(typeof(ShortStayListing))!;
        Assert.True(listingEntity.GetIndexes().Single(index => index.Properties.Single().Name == nameof(ShortStayListing.UnitId)).IsUnique);
        Assert.Equal(Microsoft.EntityFrameworkCore.DeleteBehavior.NoAction,
            listingEntity.GetForeignKeys().Single().DeleteBehavior);
    }

    [Fact]
    public async Task Relational_unique_unit_fk_and_numeric_checks_are_enforced()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = Context(connection);
        await CreateTables(db);
        await Assert.ThrowsAsync<SqliteException>(() => db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayListings (UnitId, NightlyBasePrice, CleaningFee, MinimumNights, Capacity, Status) VALUES (999, 1, 0, 1, 1, 'Draft')"));
        await db.Database.ExecuteSqlRawAsync("INSERT INTO Users (Id) VALUES (1)");
        db.Units.Add(new Unit { Id = 7, Name = "Suite", Property = new Property { LandlordId = 1 } });
        await db.SaveChangesAsync();
        await db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayListings (UnitId, NightlyBasePrice, CleaningFee, MinimumNights, Capacity, Status) VALUES (7, 1, 0, 1, 1, 'Draft')");
        await Assert.ThrowsAsync<SqliteException>(() => db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayListings (UnitId, NightlyBasePrice, CleaningFee, MinimumNights, Capacity, Status) VALUES (7, 1, 0, 1, 1, 'Draft')"));
        await db.Database.ExecuteSqlRawAsync("DELETE FROM ShortStayListings WHERE UnitId = 7");
        await Assert.ThrowsAsync<SqliteException>(() => db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayListings (UnitId, NightlyBasePrice, CleaningFee, MinimumNights, Capacity, Status) VALUES (7, -1, 0, 1, 1, 'Draft')"));
        await Assert.ThrowsAsync<SqliteException>(() => db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayListings (UnitId, NightlyBasePrice, CleaningFee, MinimumNights, Capacity, Status) VALUES (7, 1, 0, 0, 1, 'Draft')"));
        await Assert.ThrowsAsync<SqliteException>(() => db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayListings (UnitId, NightlyBasePrice, CleaningFee, MinimumNights, Capacity, Status) VALUES (7, 1, -1, 1, 1, 'Draft')"));
        await Assert.ThrowsAsync<SqliteException>(() => db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayListings (UnitId, NightlyBasePrice, CleaningFee, MinimumNights, Capacity, Status) VALUES (7, 1, 0, 1, 0, 'Draft')"));
        await Assert.ThrowsAsync<SqliteException>(() => db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayListings (UnitId, NightlyBasePrice, CleaningFee, MinimumNights, Capacity, Status) VALUES (7, 1, 0, 1, 1, 'Unknown')"));
    }

    [Theory]
    [InlineData("America/New_York", true)]
    [InlineData("Europe/London", true)]
    [InlineData("Mars/Olympus", false)]
    [InlineData("Eastern Standard Time", false)]
    public void Property_timezone_uses_iana_ids(string zone, bool valid)
    {
        var dto = new ShortStayListingDraftDto { UnitId = 1, NightlyBasePrice = 20, MinimumNights = 1, Capacity = 2, TimeZoneId = zone };
        Assert.Equal(valid, Validator.TryValidateObject(dto, new ValidationContext(dto), new List<ValidationResult>(), true));
    }

    [Fact]
    public void Draft_dto_rejects_bad_values_and_accepts_valid_values()
    {
        var dto = new ShortStayListingDraftDto { UnitId = 1, NightlyBasePrice = 0, CleaningFee = -1, MinimumNights = 0, Capacity = 0, TimeZoneId = "UTC" };
        Assert.False(Validator.TryValidateObject(dto, new ValidationContext(dto), new List<ValidationResult>(), true));
        dto.NightlyBasePrice = 10; dto.CleaningFee = 0; dto.MinimumNights = 1; dto.Capacity = 1;
        Assert.True(Validator.TryValidateObject(dto, new ValidationContext(dto), new List<ValidationResult>(), true));
    }

    [Fact]
    public void Property_model_allows_legacy_null_but_rejects_non_iana_zone()
    {
        var property = new Property();
        Assert.True(Validator.TryValidateObject(property, new ValidationContext(property), new List<ValidationResult>(), true));
        property.TimeZoneId = "Eastern Standard Time";
        Assert.False(Validator.TryValidateObject(property, new ValidationContext(property), new List<ValidationResult>(), true));
    }

    private static DataContext Context(SqliteConnection connection) => new(new DbContextOptionsBuilder<DataContext>()
        .UseSqlite(connection).Options);

    private static async Task CreateTables(DataContext db)
    {
        // Full model includes SQL Server-only DDL. Use relational parent fixtures and the actual EF listing DDL.
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE Users (Id INTEGER PRIMARY KEY)");
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE Properties (Id INTEGER PRIMARY KEY, LandlordId INTEGER NOT NULL REFERENCES Users(Id),
                TimeZoneId TEXT, ClientId INTEGER, OrganizationId INTEGER, PrimaryManagerId INTEGER, OperatingAccountId INTEGER, DeletedAt TEXT,
                Name TEXT, Description TEXT NOT NULL DEFAULT '', PropertyType TEXT NOT NULL DEFAULT 'SingleFamily',
                ContactEmail TEXT NOT NULL DEFAULT '', ContactPhone TEXT NOT NULL DEFAULT '',
                StreetAddress TEXT NOT NULL DEFAULT '', City TEXT NOT NULL DEFAULT '', State TEXT NOT NULL DEFAULT '',
                ZipCode TEXT NOT NULL DEFAULT '', YearBuilt INTEGER NOT NULL DEFAULT 0, LotSize REAL NOT NULL DEFAULT 0,
                TargetRent TEXT NOT NULL DEFAULT '0', TargetDeposit TEXT NOT NULL DEFAULT '0',
                MainImageUrl TEXT NOT NULL DEFAULT '', DateListed TEXT NOT NULL DEFAULT '2026-01-01',
                IsDeleted INTEGER NOT NULL DEFAULT 0, IsOccupied INTEGER NOT NULL DEFAULT 0)
            """);
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE Units (Id INTEGER PRIMARY KEY, PropertyId INTEGER NOT NULL REFERENCES Properties(Id), OrganizationId INTEGER,
                Name TEXT NOT NULL, RentalMode TEXT NOT NULL DEFAULT 'LongTerm',
                Bedrooms TEXT NOT NULL DEFAULT '', Baths TEXT NOT NULL DEFAULT '', Type TEXT NOT NULL DEFAULT '',
                SquareFeet INTEGER NOT NULL DEFAULT 0, IsOccupied INTEGER NOT NULL DEFAULT 0)
            """);
        var ddl = db.Database.GenerateCreateScript();
        var table = Regex.Match(ddl, "CREATE TABLE [^;]*ShortStayListings[^;]*;", RegexOptions.Singleline);
        Assert.True(table.Success, "EF must generate the short-stay table");
        await db.Database.ExecuteSqlRawAsync(table.Value);
        var index = Regex.Match(ddl, "CREATE UNIQUE INDEX [^;]*ShortStayListings[^;]*;", RegexOptions.Singleline);
        Assert.True(index.Success, "EF must generate the per-unit unique index");
        await db.Database.ExecuteSqlRawAsync(index.Value);
    }
}
