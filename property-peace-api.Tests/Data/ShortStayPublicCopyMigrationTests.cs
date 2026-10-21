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
    public void Migration_only_adds_nullable_curated_columns_after_refund_attempts()
    {
        using var db = new DataContext(new DbContextOptionsBuilder<DataContext>()
            .UseSqlServer("Server=192.0.2.1;Database=PublicCopyMetadata;User Id=invalid;Password=invalid").Options);
        const string previous = "20261021045328_AddShortStayRefundAttempts";
        const string current = "20261021053837_AddShortStayPublicCopy";
        var assembly = db.GetService<IMigrationsAssembly>();
        Assert.Equal(previous, assembly.Migrations.Keys.TakeLast(2).First());
        Assert.Equal(current, assembly.Migrations.Keys.Last());
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
