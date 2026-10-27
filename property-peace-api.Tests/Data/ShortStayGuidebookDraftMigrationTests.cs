using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace brownstone_hub_api.Tests.Migrations;

public sealed class ShortStayGuidebookDraftMigrationTests
{
    private const string Previous = "20261020234811_AddShortStayCollectionApplications";
    private const string Current = "20261021020438_AddShortStayGuidebookDraft";

    [Fact]
    public void Migration_only_creates_one_reversible_owner_draft_table()
    {
        using var db = CreateContext();
        var assembly = db.GetService<IMigrationsAssembly>();
        Assert.Contains(Previous, assembly.Migrations.Keys);
        Assert.Contains(Current, assembly.Migrations.Keys);
        Assert.True(string.CompareOrdinal(Current, Previous) > 0);
        var migration = assembly.CreateMigration(assembly.Migrations[Current], db.Database.ProviderName!);
        var create = Assert.IsType<CreateTableOperation>(Assert.Single(migration.UpOperations));
        Assert.Equal("listing", create.Schema);
        Assert.Equal("ShortStayGuidebookDrafts", create.Name);
        Assert.Equal(new[] { "UnitId", "HouseRules", "ArrivalOverview", "LocalNotes" }, create.Columns.Select(c => c.Name));
        Assert.Equal(new[] { "UnitId" }, create.PrimaryKey!.Columns);
        Assert.Equal("[UnitId] > 0", Assert.Single(create.CheckConstraints).Sql);
        var fk = Assert.Single(create.ForeignKeys);
        Assert.Equal("property", fk.PrincipalSchema);
        Assert.Equal("Units", fk.PrincipalTable);
        Assert.Equal(new[] { "UnitId" }, fk.Columns);
        Assert.Equal(ReferentialAction.Cascade, fk.OnDelete);
        var drop = Assert.IsType<DropTableOperation>(Assert.Single(migration.DownOperations));
        Assert.Equal("ShortStayGuidebookDrafts", drop.Name);
        Assert.Equal("listing", drop.Schema);

        var migrator = db.GetService<IMigrator>();
        var up = migrator.GenerateScript(Previous, Current);
        var down = migrator.GenerateScript(Current, Previous);
        Assert.Contains("CREATE TABLE [listing].[ShortStayGuidebookDrafts]", up);
        Assert.Contains("PRIMARY KEY ([UnitId])", up);
        Assert.Contains("CK_ShortStayGuidebookDrafts_UnitId", up);
        Assert.Contains("FK_ShortStayGuidebookDrafts_Units_UnitId", up);
        Assert.Contains("ON DELETE CASCADE", up);
        Assert.DoesNotContain("ALTER TABLE [property].[Units]", up);
        Assert.DoesNotContain("CREATE TABLE [financial]", up);
        Assert.Contains("DROP TABLE [listing].[ShortStayGuidebookDrafts]", down);
        Assert.DoesNotContain("DROP TABLE [property]", down);
    }

    [Fact]
    public void Previous_excludes_draft_and_generated_models_match_sql_server_design_time_model()
    {
        using var db = CreateContext();
        var assembly = db.GetService<IMigrationsAssembly>();
        Assert.Null(assembly.CreateMigration(assembly.Migrations[Previous], db.Database.ProviderName!).TargetModel
            .FindEntityType(typeof(ShortStayGuidebookDraft)));
        foreach (var model in new[] {
            db.GetService<IDesignTimeModel>().Model,
            assembly.CreateMigration(assembly.Migrations[Current], db.Database.ProviderName!).TargetModel,
            assembly.ModelSnapshot!.Model
        })
        {
            var draft = model.FindEntityType(typeof(ShortStayGuidebookDraft))!;
            Assert.Equal("listing", draft.GetSchema());
            Assert.Equal("ShortStayGuidebookDrafts", draft.GetTableName());
            Assert.Equal(new[] { "UnitId" }, draft.FindPrimaryKey()!.Properties.Select(p => p.Name));
            Assert.Empty(draft.GetIndexes()); // The PK already enforces uniqueness per unit.
            Assert.Equal("[UnitId] > 0", Assert.Single(draft.GetCheckConstraints()).Sql);
            var fk = Assert.Single(draft.GetForeignKeys());
            Assert.Equal(typeof(Unit).FullName, fk.PrincipalEntityType.Name);
            Assert.Equal(DeleteBehavior.Cascade, fk.DeleteBehavior);
            foreach (var field in new[] { "HouseRules", "ArrivalOverview", "LocalNotes" })
            {
                var property = draft.FindProperty(field)!;
                Assert.Equal(2000, property.GetMaxLength());
                Assert.True(property.IsNullable);
            }
            Assert.Equal(4, draft.GetProperties().Count());
        }
        Assert.False(db.Database.HasPendingModelChanges());
    }

    private static DataContext CreateContext() => new(new DbContextOptionsBuilder<DataContext>()
        .UseSqlServer("Server=(localdb)\\mssqllocaldb;Database=GuidebookMigrationMetadata;Trusted_Connection=True")
        .Options);
}
