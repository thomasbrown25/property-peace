using System.Text.RegularExpressions;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace brownstone_hub_api.Tests.Migrations;

public sealed class ShortStayCollectionApplicationMigrationTests
{
    private const string Previous = "20261020220615_AddAirbnbReadOnlyCalendarImport";
    private const string Current = "20261020234811_AddShortStayCollectionApplications";

    [Fact]
    public void Up_and_down_are_separate_additive_and_reversible()
    {
        using var db = CreateContext();
        var migrations = db.GetService<IMigrationsAssembly>();
        Assert.Contains(Previous, migrations.Migrations.Keys);
        Assert.Contains(Current, migrations.Migrations.Keys);
        Assert.True(string.CompareOrdinal(Current, Previous) > 0);
        var migration = migrations.CreateMigration(migrations.Migrations[Current], db.Database.ProviderName!);
        Assert.Equal(2, migration.UpOperations.OfType<CreateTableOperation>().Count());
        Assert.All(migration.UpOperations, operation => Assert.True(operation is CreateTableOperation or CreateIndexOperation, operation.GetType().Name));
        Assert.Equal(2, migration.DownOperations.Count);
        Assert.All(migration.DownOperations, operation => Assert.IsType<DropTableOperation>(operation));

        var migrator = db.GetService<IMigrator>();
        var up = migrator.GenerateScript(Previous, Current);
        var down = migrator.GenerateScript(Current, Previous);
        foreach (var table in new[] { "ShortStayCollectionApplications", "ShortStayCollectionApplicationProperties" })
        {
            Assert.Contains($"CREATE TABLE [financial].[{table}]", up);
            Assert.Contains($"DROP TABLE [financial].[{table}]", down);
        }
        Assert.Contains("PRIMARY KEY ([ShortStayCollectionApplicationId], [PropertyId])", up);
        Assert.Contains("CREATE INDEX [IX_ShortStayCollectionApplicationProperties_PropertyId]", up);
        Assert.Contains("CREATE UNIQUE INDEX [IX_ShortStayCollectionApplications_OrganizationId_ApplicantUserId]", up);
        Assert.Contains("WHERE [Status] <> 'Rejected'", up);
        Assert.Contains("CREATE UNIQUE INDEX [IX_ShortStayCollectionApplications_IdentityVerificationSessionId]", up);
        Assert.Contains("WHERE [IdentityVerificationSessionId] IS NOT NULL", up);
        Assert.Contains("[RowVersion] bigint NOT NULL DEFAULT CAST(1 AS bigint)", up);
        Assert.Contains("[PropertyAuthorityConfirmedAt] datetimeoffset NULL", up);
        Assert.Contains("CK_ShortStayCollectionApplications_Status", up);
        Assert.Contains("[Status] IN ('Draft', 'Submitted', 'IdentityPending', 'IdentityVerified', 'UnderReview', 'PayoutApproved', 'Suspended', 'Rejected')", up);
        Assert.Contains("FK_ShortStayCollectionApplicationProperties_Properties_PropertyId", up);
        Assert.Contains("FK_ShortStayCollectionApplicationProperties_ShortStayCollectionApplications_ShortStayCollectionApplicationId", up);
        Assert.Contains("ON DELETE CASCADE", up);
        Assert.DoesNotContain("ON DELETE CASCADE", up[..up.IndexOf("CREATE TABLE [financial].[ShortStayCollectionApplicationProperties]", StringComparison.Ordinal)]);
        Assert.DoesNotContain("ALTER TABLE [property].[Properties]", up);
        Assert.DoesNotContain("CREATE TABLE [listing]", up);
        Assert.DoesNotContain("DROP TABLE [property]", down);
        Assert.DoesNotContain("DROP TABLE [core]", down);
        Assert.DoesNotContain("DROP TABLE [organization]", down);
        Assert.DoesNotContain("bankaccount", up, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("identitydocument", up, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Previous_snapshot_excludes_collection_and_sql_server_models_agree_on_contract()
    {
        using var db = CreateContext();
        var migrations = db.GetService<IMigrationsAssembly>();
        var previous = migrations.CreateMigration(migrations.Migrations[Previous], db.Database.ProviderName!).TargetModel;
        Assert.Null(previous.FindEntityType(typeof(ShortStayCollectionApplication)));
        Assert.Null(previous.FindEntityType(typeof(ShortStayCollectionApplicationProperty)));

        foreach (var model in new[] {
            db.GetService<IDesignTimeModel>().Model,
            migrations.CreateMigration(migrations.Migrations[Current], db.Database.ProviderName!).TargetModel,
            migrations.ModelSnapshot!.Model
        })
        {
            var application = model.FindEntityType(typeof(ShortStayCollectionApplication))!;
            var scope = model.FindEntityType(typeof(ShortStayCollectionApplicationProperty))!;
            Assert.Equal("financial", application.GetSchema());
            Assert.Equal("financial", scope.GetSchema());
            Assert.Equal(new[] { "ShortStayCollectionApplicationId", "PropertyId" }, scope.FindPrimaryKey()!.Properties.Select(p => p.Name));
            Assert.Contains(scope.GetIndexes(), i => i.Properties.Select(p => p.Name).SequenceEqual(new[] { "PropertyId" }));
            var active = application.GetIndexes().Single(i => i.Properties.Select(p => p.Name).SequenceEqual(new[] { "OrganizationId", "ApplicantUserId" }));
            Assert.True(active.IsUnique);
            Assert.Equal("[Status] <> 'Rejected'", active.GetFilter());
            var session = application.GetIndexes().Single(i => i.Properties.Select(p => p.Name).SequenceEqual(new[] { "IdentityVerificationSessionId" }));
            Assert.True(session.IsUnique);
            Assert.Equal("[IdentityVerificationSessionId] IS NOT NULL", session.GetFilter());
            var version = application.FindProperty("RowVersion")!;
            Assert.True(version.IsConcurrencyToken);
            Assert.Equal(typeof(long), version.ClrType);
            Assert.Equal(1L, version.GetDefaultValue());
            var authority = application.FindProperty("PropertyAuthorityConfirmedAt")!;
            Assert.Equal(typeof(DateTimeOffset?), authority.ClrType);
            Assert.True(authority.IsNullable);
            Assert.Equal("[Status] IN ('Draft', 'Submitted', 'IdentityPending', 'IdentityVerified', 'UnderReview', 'PayoutApproved', 'Suspended', 'Rejected')",
                application.GetCheckConstraints().Single(c => c.Name == "CK_ShortStayCollectionApplications_Status").Sql);
            Assert.DoesNotContain(application.GetProperties(), p => Regex.IsMatch(p.Name, "bank|address|birth|photo|guest|document|evidence|payeeuserid", RegexOptions.IgnoreCase));
            Assert.DoesNotContain(scope.GetProperties(), p => p.Name != "ShortStayCollectionApplicationId" && p.Name != "PropertyId");
            Assert.Equal(DeleteBehavior.Cascade, scope.GetForeignKeys().Single(f => f.PrincipalEntityType.Name == typeof(ShortStayCollectionApplication).FullName).DeleteBehavior);
            Assert.Equal(DeleteBehavior.Restrict, scope.GetForeignKeys().Single(f => f.PrincipalEntityType.Name == typeof(Property).FullName).DeleteBehavior);
            Assert.All(application.GetForeignKeys(), fk => Assert.Equal(DeleteBehavior.Restrict, fk.DeleteBehavior));
        }
        Assert.False(db.Database.HasPendingModelChanges());
    }

    private static DataContext CreateContext() => new(new DbContextOptionsBuilder<DataContext>()
        .UseSqlServer("Server=(localdb)\\mssqllocaldb;Database=CollectionApplicationMigrationMetadata;Trusted_Connection=True")
        .Options);
}
