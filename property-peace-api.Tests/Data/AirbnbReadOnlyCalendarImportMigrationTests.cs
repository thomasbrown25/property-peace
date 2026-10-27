using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace brownstone_hub_api.Tests.Migrations;

public sealed class AirbnbReadOnlyCalendarImportMigrationTests
{
    private const string Previous = "20261020204122_AddShortStayOwnerSetup";
    private const string Current = "20261020220615_AddAirbnbReadOnlyCalendarImport";

    [Fact]
    public void Migration_is_additive_reversible_and_contains_only_read_only_import_schema()
    {
        using var db = CreateContext();
        var migrations = db.GetService<IMigrationsAssembly>();
        Assert.Contains(Previous, migrations.Migrations.Keys);
        Assert.Contains(Current, migrations.Migrations.Keys);
        Assert.True(string.CompareOrdinal(Current, Previous) > 0);
        var migration = migrations.CreateMigration(migrations.Migrations[Current], db.Database.ProviderName!);
        Assert.Equal(2, migration.UpOperations.OfType<CreateTableOperation>().Count());
        Assert.All(migration.UpOperations, op => Assert.True(op is CreateTableOperation or CreateIndexOperation, op.GetType().Name));
        Assert.Equal(2, migration.DownOperations.Count);
        Assert.All(migration.DownOperations, op => Assert.IsType<DropTableOperation>(op));
        var sql = db.GetService<IMigrator>();
        var up = sql.GenerateScript(Previous, Current);
        var down = sql.GenerateScript(Current, Previous);

        foreach (var table in new[] { "ShortStayIcalSubscriptions", "ShortStayIcalOccurrences" })
        {
            Assert.Contains($"CREATE TABLE [listing].[{table}]", up);
            Assert.Contains($"DROP TABLE [listing].[{table}]", down);
        }
        Assert.Contains("FK_ShortStayIcalSubscriptions_Units_UnitId", up);
        Assert.Contains("FK_ShortStayIcalSubscriptions_Organizations_OrgId", up);
        Assert.Contains("FK_ShortStayIcalOccurrences_ShortStayIcalSubscriptions_SubscriptionId", up);
        Assert.Contains("ON DELETE CASCADE", up);
        Assert.Contains("CREATE UNIQUE INDEX [IX_ShortStayIcalSubscriptions_UnitId]", up);
        Assert.Contains("CREATE UNIQUE INDEX [IX_ShortStayIcalSubscriptions_LeaseToken]", up);
        Assert.Contains("WHERE [LeaseToken] IS NOT NULL", up);
        Assert.Contains("IX_ShortStayIcalSubscriptions_Enabled_NextAttemptAtUtc_LeaseExpiresAtUtc", up);
        Assert.Contains("IX_ShortStayIcalOccurrences_SubscriptionId_UidKey_RecurrenceKey", up);
        Assert.Contains("[EncryptedUrl] nvarchar(max) NOT NULL", up);
        Assert.Contains("[Enabled] = 0 OR [EncryptedUrl] <> ''", up);
        Assert.Contains("[Enabled] = 0 OR [UrlFingerprint] <> ''", up);
        Assert.DoesNotContain("[PlaintextUrl]", up, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("[Guest", up, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("[RRule]", up, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("ALTER TABLE [property].[Units]", up);
        Assert.DoesNotContain("ALTER TABLE [property].[Properties]", up);
        Assert.DoesNotContain("DROP TABLE [property].[Units]", down);
        Assert.DoesNotContain("DROP TABLE [organization].[Organizations]", down);
    }

    [Fact]
    public void Previous_snapshot_excludes_import_and_current_snapshot_matches_live_model()
    {
        using var db = CreateContext();
        var migrations = db.GetService<IMigrationsAssembly>();
        var previous = migrations.CreateMigration(migrations.Migrations[Previous], db.Database.ProviderName!).TargetModel;
        Assert.Null(previous.FindEntityType(typeof(ShortStayIcalSubscription)));
        Assert.Null(previous.FindEntityType(typeof(ShortStayIcalOccurrence)));

        var models = new[] {
            db.GetService<IDesignTimeModel>().Model,
            migrations.CreateMigration(migrations.Migrations[Current], db.Database.ProviderName!).TargetModel,
            migrations.ModelSnapshot!.Model
        };
        foreach (var model in models)
        {
            var sub = model.FindEntityType(typeof(ShortStayIcalSubscription))!;
            var occurrence = model.FindEntityType(typeof(ShortStayIcalOccurrence))!;
            Assert.Equal("listing", sub.GetSchema());
            Assert.Equal("listing", occurrence.GetSchema());
            Assert.True(sub.GetIndexes().Single(i => i.Properties.Select(p => p.Name).SequenceEqual(new[] { "UnitId" })).IsUnique);
            var lease = sub.GetIndexes().Single(i => i.Properties.Select(p => p.Name).SequenceEqual(new[] { "LeaseToken" }));
            Assert.True(lease.IsUnique);
            Assert.Equal("[LeaseToken] IS NOT NULL", lease.GetFilter());
            Assert.Contains(sub.GetIndexes(), i => i.Properties.Select(p => p.Name).SequenceEqual(new[] { "Enabled", "NextAttemptAtUtc", "LeaseExpiresAtUtc" }));
            Assert.True(occurrence.GetIndexes().Single(i => i.Properties.Select(p => p.Name).SequenceEqual(new[] { "SubscriptionId", "UidKey", "RecurrenceKey" })).IsUnique);
            Assert.Equal(4096, sub.FindProperty("EncryptedUrl")!.GetMaxLength());
            Assert.Equal(64, sub.FindProperty("UrlFingerprint")!.GetMaxLength());
            Assert.Equal("[Enabled] = 0 OR [EncryptedUrl] <> ''", sub.GetCheckConstraints().Single(c => c.Name == "CK_ShortStayIcalSubscriptions_EncryptedUrl").Sql);
            Assert.Equal("[Enabled] = 0 OR [UrlFingerprint] <> ''", sub.GetCheckConstraints().Single(c => c.Name == "CK_ShortStayIcalSubscriptions_UrlFingerprint").Sql);
            Assert.All(new[] { "UidKey", "RecurrenceKey" }, p => Assert.Equal(64, occurrence.FindProperty(p)!.GetMaxLength()));
            Assert.All(sub.GetForeignKeys(), fk => Assert.Equal(DeleteBehavior.NoAction, fk.DeleteBehavior));
            Assert.Equal(DeleteBehavior.Cascade, Assert.Single(occurrence.GetForeignKeys()).DeleteBehavior);
            Assert.Equal("([LeaseToken] IS NULL AND [LeaseExpiresAtUtc] IS NULL) OR ([LeaseToken] IS NOT NULL AND [LeaseExpiresAtUtc] IS NOT NULL)", sub.GetCheckConstraints().Single(c => c.Name == "CK_ShortStayIcalSubscriptions_LeasePair").Sql);
            Assert.Equal("[EndDate] > [StartDate]", occurrence.GetCheckConstraints().Single(c => c.Name == "CK_ShortStayIcalOccurrences_DateRange").Sql);
            Assert.DoesNotContain(sub.GetProperties(), p => p.Name is "PlaintextUrl" or "GuestName" or "RRule");
            Assert.DoesNotContain(occurrence.GetProperties(), p => p.Name is "PlaintextUrl" or "GuestName" or "RRule");
        }
        Assert.False(db.Database.HasPendingModelChanges());
    }

    private static DataContext CreateContext() => new(new DbContextOptionsBuilder<DataContext>()
        .UseSqlServer("Server=(localdb)\\mssqllocaldb;Database=AirbnbImportMigrationMetadata;Trusted_Connection=True")
        .Options);
}
