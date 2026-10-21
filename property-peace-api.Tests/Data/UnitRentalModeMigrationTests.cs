using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Metadata;
using Xunit;

namespace brownstone_hub_api.Tests.Migrations;

public sealed class UnitRentalModeMigrationTests
{
    private const string Previous = "20261020000000_AddExpoPushTokens";
    private const string Migration = "20261020173316_AddUnitRentalMode";
    private const string Constraint = "CK_Units_RentalMode";
    private const string AllowedValues = "[RentalMode] IN ('LongTerm', 'ShortTerm')";

    [Fact]
    public void Sql_server_model_and_migration_snapshot_enforce_allowed_persisted_modes()
    {
        using var db = CreateContext();
        var liveTable = db.GetService<IDesignTimeModel>().Model.FindEntityType(typeof(Unit))!;
        Assert.Equal(AllowedValues, liveTable.GetCheckConstraints().Single(c => c.Name == Constraint).Sql);

        var migrations = db.GetService<IMigrationsAssembly>();
        var snapshotTable = migrations.ModelSnapshot!.Model.FindEntityType(typeof(Unit))!;
        Assert.Equal(AllowedValues, snapshotTable.GetCheckConstraints().Single(c => c.Name == Constraint).Sql);
        var migrationTable = migrations.Migrations[Migration];
        var targetModel = migrations.CreateMigration(migrationTable, db.Database.ProviderName!).TargetModel;
        Assert.Equal(AllowedValues, targetModel.FindEntityType(typeof(Unit))!
            .GetCheckConstraints().Single(c => c.Name == Constraint).Sql);
    }

    [Fact]
    public void Sql_server_migration_adds_constraint_after_defaulted_column_and_removes_it_before_column()
    {
        using var db = CreateContext();
        var migrator = db.GetService<IMigrator>();
        var up = migrator.GenerateScript(Previous, Migration);
        Assert.Contains("ALTER TABLE [property].[Units] ADD [RentalMode] nvarchar(32) NOT NULL DEFAULT N'LongTerm'", up);
        Assert.Contains("ALTER TABLE [property].[Units] ADD CONSTRAINT [CK_Units_RentalMode] CHECK ([RentalMode] IN ('LongTerm', 'ShortTerm'))", up);
        Assert.True(up.IndexOf("ADD [RentalMode]", StringComparison.Ordinal) < up.IndexOf("ADD CONSTRAINT [CK_Units_RentalMode]", StringComparison.Ordinal));

        var down = migrator.GenerateScript(Migration, Previous);
        Assert.Contains("ALTER TABLE [property].[Units] DROP CONSTRAINT [CK_Units_RentalMode]", down);
        Assert.Contains("ALTER TABLE [property].[Units] DROP COLUMN [RentalMode]", down);
        Assert.True(down.IndexOf("DROP CONSTRAINT [CK_Units_RentalMode]", StringComparison.Ordinal) < down.IndexOf("DROP COLUMN [RentalMode]", StringComparison.Ordinal));
    }

    private static DataContext CreateContext() => new(new DbContextOptionsBuilder<DataContext>()
        .UseSqlServer("Server=(localdb)\\mssqllocaldb;Database=UnitRentalModeMetadata;Trusted_Connection=True")
        .Options);
}
