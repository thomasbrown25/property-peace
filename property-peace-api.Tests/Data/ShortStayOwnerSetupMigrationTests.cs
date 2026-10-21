using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Metadata;
using Xunit;

namespace brownstone_hub_api.Tests.Migrations;

public sealed class ShortStayOwnerSetupMigrationTests
{
    private const string Previous = "20261020173316_AddUnitRentalMode";
    private const string Migration = "AddShortStayOwnerSetup";

    [Fact]
    public void Migration_is_separate_additive_and_reversible_without_guest_booking()
    {
        using var db = CreateContext();
        var assembly = db.GetService<IMigrationsAssembly>();
        var id = Assert.Single(assembly.Migrations.Keys, x => x.EndsWith("_" + Migration, StringComparison.Ordinal));
        Assert.True(string.CompareOrdinal(id, Previous) > 0);
        var migrator = db.GetService<IMigrator>();
        var up = migrator.GenerateScript(Previous, id);
        var down = migrator.GenerateScript(id, Previous);

        Assert.Contains("ALTER TABLE [property].[Properties] ADD [TimeZoneId] nvarchar(128) NULL", up);
        foreach (var table in new[] { "ShortStayListings", "ShortStayListingPhotos", "ShortStayBlocks", "ShortStayNightlyRateOverrides" })
        {
            Assert.Contains($"CREATE TABLE [listing].[{table}]", up);
            Assert.Contains($"DROP TABLE [listing].[{table}]", down);
        }
        Assert.Contains("FK_ShortStayListingPhotos_ShortStayListings_ShortStayListingId", up);
        Assert.Contains("IX_ShortStayListingPhotos_BlobName", up);
        Assert.Contains("IX_ShortStayListingPhotos_ShortStayListingId_DisplayOrder", up);
        Assert.Contains("IX_ShortStayListingPhotos_ShortStayListingId", up);
        Assert.Contains("WHERE [IsCoverPhoto] = 1", up);
        Assert.Contains("ALTER TABLE [property].[Properties] DROP COLUMN [TimeZoneId]", down);
        Assert.DoesNotContain("ShortStayBooking", up, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("DROP TABLE [property].[Units]", up);
        Assert.DoesNotContain("RentalMode]", up);
        Assert.DoesNotContain("CREATE TABLE [property].[Properties]", up);
    }

    [Fact]
    public void Migration_designer_and_snapshot_match_live_model_constraints_and_relationships()
    {
        using var db = CreateContext();
        var assembly = db.GetService<IMigrationsAssembly>();
        var id = Assert.Single(assembly.Migrations.Keys, x => x.EndsWith("_" + Migration, StringComparison.Ordinal));
        var models = new[] {
            db.GetService<IDesignTimeModel>().Model,
            assembly.CreateMigration(assembly.Migrations[id], db.Database.ProviderName!).TargetModel,
            assembly.ModelSnapshot!.Model
        };
        foreach (var model in models)
        {
            var property = model.FindEntityType(typeof(Property))!;
            var zone = property.FindProperty(nameof(Property.TimeZoneId))!;
            Assert.True(zone.IsNullable);
            Assert.Equal(128, zone.GetMaxLength());
            Assert.Null(zone.GetDefaultValue());

            var listing = model.FindEntityType(typeof(ShortStayListing))!;
            var photo = model.FindEntityType(typeof(ShortStayListingPhoto))!;
            var block = model.FindEntityType(typeof(ShortStayBlock))!;
            var rate = model.FindEntityType(typeof(ShortStayNightlyRateOverride))!;
            Assert.Equal("listing", listing.GetSchema());
            Assert.Equal("listing", photo.GetSchema());
            Assert.Equal("listing", block.GetSchema());
            Assert.Equal("listing", rate.GetSchema());
            Assert.True(listing.GetIndexes().Single(i => i.Properties.Select(p => p.Name).SequenceEqual(new[] { "UnitId" })).IsUnique);
            Assert.True(photo.GetIndexes().Single(i => i.Properties.Select(p => p.Name).SequenceEqual(new[] { "BlobName" })).IsUnique);
            Assert.True(photo.GetIndexes().Single(i => i.Properties.Select(p => p.Name).SequenceEqual(new[] { "ShortStayListingId", "DisplayOrder" })).IsUnique);
            var coverIndex = photo.GetIndexes().Single(i => i.Properties.Select(p => p.Name).SequenceEqual(new[] { "ShortStayListingId" }));
            Assert.True(coverIndex.IsUnique);
            Assert.Equal("[IsCoverPhoto] = 1", coverIndex.GetFilter());
            Assert.Equal(512, photo.FindProperty("BlobName")!.GetMaxLength());
            Assert.Equal("[BlobName] <> ''", photo.GetCheckConstraints().Single(c => c.Name == "CK_ShortStayListingPhotos_BlobName").Sql);
            Assert.Equal("[DisplayOrder] >= 0", photo.GetCheckConstraints().Single(c => c.Name == "CK_ShortStayListingPhotos_DisplayOrder").Sql);
            var photoFk = Assert.Single(photo.GetForeignKeys());
            Assert.Equal(typeof(ShortStayListing).FullName, photoFk.PrincipalEntityType.Name);
            Assert.Equal(DeleteBehavior.NoAction, photoFk.DeleteBehavior);
            Assert.True(rate.GetIndexes().Single(i => i.Properties.Select(p => p.Name).SequenceEqual(new[] { "UnitId", "Date" })).IsUnique);
            foreach (var entity in new[] { listing, block, rate })
            {
                var fk = Assert.Single(entity.GetForeignKeys());
                Assert.Equal(typeof(Unit).FullName, fk.PrincipalEntityType.Name);
                Assert.Equal(DeleteBehavior.NoAction, fk.DeleteBehavior);
            }
            foreach (var (entity, name) in new[] {
                (listing, "NightlyBasePrice"), (listing, "CleaningFee"), (rate, "NightlyRate") })
            {
                var decimalProperty = entity.FindProperty(name)!;
                Assert.Equal(18, decimalProperty.GetPrecision());
                Assert.Equal(2, decimalProperty.GetScale());
            }
            foreach (var (entity, name, sql) in new[] {
                (listing, "CK_ShortStayListings_NightlyBasePrice", "[NightlyBasePrice] > 0"),
                (listing, "CK_ShortStayListings_CleaningFee", "[CleaningFee] >= 0"),
                (listing, "CK_ShortStayListings_MinimumNights", "[MinimumNights] >= 1"),
                (listing, "CK_ShortStayListings_Capacity", "[Capacity] >= 1"),
                (listing, "CK_ShortStayListings_Status", "[Status] IN ('Draft', 'Published')"),
                (block, "CK_ShortStayBlocks_DateRange", "[EndDate] > [StartDate]"),
                (rate, "CK_ShortStayNightlyRateOverrides_NightlyRate", "[NightlyRate] > 0") })
                Assert.Equal(sql, entity.GetCheckConstraints().Single(c => c.Name == name).Sql);
            Assert.Null(model.FindEntityType("brownstone_hub_api.Models.ShortStayBooking"));
        }
    }

    private static DataContext CreateContext() => new(new DbContextOptionsBuilder<DataContext>()
        .UseSqlServer("Server=(localdb)\\mssqllocaldb;Database=ShortStayMigrationMetadata;Trusted_Connection=True")
        .Options);
}
