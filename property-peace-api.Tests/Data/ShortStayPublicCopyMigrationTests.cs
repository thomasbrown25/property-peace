using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace brownstone_hub_api.Tests.Migrations;

public sealed class ShortStayPublicCopyMigrationTests
{
    [Fact]
    public void Pricing_migration_is_additive_and_snapshot_matches_without_database_access()
    {
        using var db = new DataContext(new DbContextOptionsBuilder<DataContext>()
            .UseSqlServer("Server=192.0.2.1;Database=OfflineMetadata;User Id=invalid;Password=invalid").Options);
        var assembly = db.GetService<IMigrationsAssembly>();
        var id = Assert.Single(assembly.Migrations.Keys.Where(k => k.EndsWith("_AddShortStayPricingDiscounts")));
        var migration = assembly.CreateMigration(assembly.Migrations[id], db.Database.ProviderName!);
        Assert.Equal(new[] { "DiscountCents", "MonthlyDiscountPercent", "WeekendNightlyRate", "WeeklyDiscountPercent" },
            migration.UpOperations.OfType<AddColumnOperation>().Select(c => c.Name));
        Assert.DoesNotContain(migration.UpOperations, op => op is DropTableOperation or DropColumnOperation);
        Assert.False(db.Database.HasPendingModelChanges());
        var sql = db.GetService<IMigrator>().GenerateScript("20261021053837_AddShortStayPublicCopy", id);
        Assert.Contains("[DiscountCents] bigint NOT NULL DEFAULT CAST(0 AS bigint)", sql);
        Assert.DoesNotContain("DROP TABLE", sql);
    }

    [Fact]
    public void Migration_only_adds_nullable_curated_columns_after_refund_attempts()
    {
        using var db = new DataContext(new DbContextOptionsBuilder<DataContext>()
            .UseSqlServer("Server=192.0.2.1;Database=PublicCopyMetadata;User Id=invalid;Password=invalid").Options);
        const string previous = "20261021045328_AddShortStayRefundAttempts";
        const string current = "20261021053837_AddShortStayPublicCopy";
        var assembly = db.GetService<IMigrationsAssembly>();
        var ids = assembly.Migrations.Keys.ToArray();
        var index = Array.IndexOf(ids, current);
        Assert.True(index > 0);
        Assert.Equal(previous, ids[index - 1]);
        var migration = assembly.CreateMigration(assembly.Migrations[current], db.Database.ProviderName!);
        var columns = migration.UpOperations.OfType<AddColumnOperation>().ToList();
        Assert.Equal(["PublicSummary", "PublicTitle"], columns.Select(c => c.Name));
        Assert.All(columns, column => { Assert.Equal("listing", column.Schema); Assert.Equal("ShortStayListings", column.Table); Assert.True(column.IsNullable); });
        Assert.Equal([1200, 100], columns.Select(c => c.MaxLength));
        Assert.Equal(2, migration.UpOperations.Count);
        Assert.Null(assembly.CreateMigration(assembly.Migrations[previous], db.Database.ProviderName!).TargetModel
            .FindEntityType(typeof(ShortStayListing))!.FindProperty("PublicTitle"));
        var sql = db.GetService<IMigrator>().GenerateScript(previous, current);
        Assert.Contains("ALTER TABLE [listing].[ShortStayListings] ADD [PublicTitle] nvarchar(100) NULL", sql);
        Assert.Contains("ALTER TABLE [listing].[ShortStayListings] ADD [PublicSummary] nvarchar(1200) NULL", sql);
        Assert.DoesNotContain("DROP TABLE", sql);
        Assert.False(db.Database.HasPendingModelChanges());
    }
}
