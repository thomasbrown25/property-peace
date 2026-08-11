using brownstone_hub_api.Data;
using brownstone_hub_api.Migrations;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Microsoft.EntityFrameworkCore.Metadata;
using Xunit;

namespace brownstone_hub_api.Tests.Migrations;

public sealed class Milestone14ActivationMigrationTests
{
    [Fact]
    public void Migration_TargetModelCarriesTheActivationSchema()
    {
        using var db = new DataContext(new DbContextOptionsBuilder<DataContext>()
            .UseSqlServer("Server=(localdb)\\mssqllocaldb;Database=model-only;Trusted_Connection=True")
            .Options);
        var assembly = db.GetService<IMigrationsAssembly>();
        const string migrationId = "20260811184804_Milestone14ActivationFunnel";

        assembly.Migrations.Should().ContainKey(migrationId);
        var migration = assembly.CreateMigration(assembly.Migrations[migrationId], db.Database.ProviderName!);
        var occurrence = migration.TargetModel.FindEntityType("brownstone_hub_api.Models.ActivationMilestoneOccurrence");

        occurrence.Should().NotBeNull();
        var occurrenceModel = occurrence!;
        occurrenceModel.GetTableName().Should().Be("ActivationMilestoneOccurrences");
        occurrenceModel.FindProperty("Milestone")!.GetMaxLength().Should().Be(64);
        occurrenceModel.FindProperty("OccurredAtUtc")!.GetPrecision().Should().Be(0);
        occurrenceModel.GetIndexes().Should().Contain(index =>
            index.IsUnique && index.GetDatabaseName() == "UX_ActivationOccurrence_OrganizationMilestoneSubject");
        occurrenceModel.GetIndexes().Should().Contain(index =>
            index.IsUnique && index.GetDatabaseName() == "UX_ActivationOccurrence_SourceReplay");
    }

    [Fact]
    public void RuntimeModel_HasNoChangesBeyondTheMigrationSnapshot()
    {
        using var db = new DataContext(new DbContextOptionsBuilder<DataContext>()
            .UseSqlServer("Server=(localdb)\\mssqllocaldb;Database=model-only;Trusted_Connection=True")
            .Options);
        var assembly = db.GetService<IMigrationsAssembly>();
        var modelDiffer = db.GetService<IMigrationsModelDiffer>();
        var runtimeModel = db.GetService<IDesignTimeModel>().Model.GetRelationalModel();
        var initializedSnapshot = db.GetService<IModelRuntimeInitializer>()
            .Initialize(assembly.ModelSnapshot!.Model);
        var snapshotModel = initializedSnapshot.GetRelationalModel();

        modelDiffer.GetDifferences(snapshotModel, runtimeModel).Should().BeEmpty();
    }

    [Fact]
    public void Migration_UpAndDownCreateAndRemoveTheActivationTable()
    {
        var migration = new TestableMigration();
        var up = migration.BuildUp();
        var table = up.OfType<CreateTableOperation>().Single(x => x.Name == "ActivationMilestoneOccurrences");

        table.Columns.Single(x => x.Name == "Milestone").MaxLength.Should().Be(64);
        table.Columns.Single(x => x.Name == "OccurredAtUtc").Precision.Should().Be(0);
        up.OfType<CreateIndexOperation>().Should().Contain(x =>
            x.Name == "UX_ActivationOccurrence_OrganizationMilestoneSubject" && x.IsUnique);
        up.OfType<CreateIndexOperation>().Should().Contain(x =>
            x.Name == "UX_ActivationOccurrence_SourceReplay" && x.IsUnique && x.Filter != null);
        up.OfType<SqlOperation>().Should().ContainSingle(x =>
            x.Sql.Contains("CREATE TRIGGER [TR_ActivationMilestoneOccurrences_AppendOnly]", StringComparison.Ordinal) &&
            x.Sql.Contains("INSTEAD OF UPDATE, DELETE", StringComparison.Ordinal));

        var down = migration.BuildDown();
        down.OfType<SqlOperation>().Should().ContainSingle(x =>
            x.Sql.Contains("DROP TRIGGER [TR_ActivationMilestoneOccurrences_AppendOnly]", StringComparison.Ordinal));
        down.OfType<DropTableOperation>()
            .Should().ContainSingle(x => x.Name == "ActivationMilestoneOccurrences");
    }

    private sealed class TestableMigration : Milestone14ActivationFunnel
    {
        public IReadOnlyList<MigrationOperation> BuildUp()
        {
            var builder = new MigrationBuilder("Microsoft.EntityFrameworkCore.SqlServer");
            base.Up(builder);
            return builder.Operations;
        }

        public IReadOnlyList<MigrationOperation> BuildDown()
        {
            var builder = new MigrationBuilder("Microsoft.EntityFrameworkCore.SqlServer");
            base.Down(builder);
            return builder.Operations;
        }
    }
}
