using System.Text.Json;
using brownstone_hub_api.Config;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.LeasingPipeline;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Migrations;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.FeatureReadiness;
using brownstone_hub_api.Services.LeasingPipeline;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.LeasingPipeline;

public sealed class FinalSpecRegressionTests
{
    private static IFeatureReadinessService Readiness()
    {
        var readiness = new Mock<IFeatureReadinessService>();
        readiness.Setup(x => x.GetAsync(It.IsAny<long>(), It.IsAny<long?>(), It.IsAny<string>()))
            .ReturnsAsync((long _, long? _, string feature) =>
                new FeatureReadinessDto(feature, FeatureReadinessState.Available, true, true, true, true, true, true, []));
        return readiness.Object;
    }

    private static async Task<DataContext> SeedAsync(DbContextOptions<DataContext>? options = null)
    {
        var db = new DataContext(options ?? new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.OrganizationMembers.Add(new OrganizationMember
            { Id = 1, OrganizationId = 10, UserId = 20, IsActive = true, Role = "Owner" });
        db.Properties.AddRange(
            new Property { Id = 30, OrganizationId = 10, LandlordId = 20 },
            new Property { Id = 31, OrganizationId = 10, LandlordId = 20 });
        db.Units.AddRange(
            new Unit { Id = 40, PropertyId = 30, OrganizationId = 10 },
            new Unit { Id = 41, PropertyId = 31, OrganizationId = 10 });
        await db.SaveChangesAsync();
        return db;
    }

    [Fact]
    public async Task Undefined_showing_event_type_is_rejected_without_audit_write()
    {
        await using var db = await SeedAsync();
        var sut = new LeasingPipelineService(db, Readiness());
        var before = await sut.GetForPropertyAsync(10, 20, 30, 40, default);

        Func<Task> act = () => sut.TransitionShowingAsync(10, 20, 30, 40, before.Revision,
            "undefined-enum-key", "trace", new ShowingTransitionRequest((UnitLifecycleEventType)99, null, null), default);

        await act.Should().ThrowAsync<PipelineValidationException>();
        (await db.UnitLifecycleEvents.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Retry_after_reschedule_and_cancel_returns_exact_original_safe_result()
    {
        await using var db = await SeedAsync();
        var sut = new LeasingPipelineService(db, Readiness());
        var initial = await sut.GetForPropertyAsync(10, 20, 30, 40, default);
        var scheduleRequest = new ShowingTransitionRequest(UnitLifecycleEventType.ShowingScheduled,
            DateTime.UtcNow.AddDays(1), "schedulingConflict");

        var original = await sut.TransitionShowingAsync(10, 20, 30, 40, initial.Revision,
            "raw-key-secret-url-signature-report-sas", "trace", scheduleRequest, default);
        var rescheduled = await sut.TransitionShowingAsync(10, 20, 30, 40, original.Revision,
            "reschedule-key", "trace", new(UnitLifecycleEventType.ShowingRescheduled, DateTime.UtcNow.AddDays(2), null), default);
        await sut.TransitionShowingAsync(10, 20, 30, 40, rescheduled.Revision,
            "cancel-key", "trace", new(UnitLifecycleEventType.ShowingCancelled, null, "landlordCancelled"), default);

        var replay = await sut.TransitionShowingAsync(10, 20, 30, 40, initial.Revision,
            "raw-key-secret-url-signature-report-sas", "different-trace", scheduleRequest, default);

        replay.Should().BeEquivalentTo(original);
        replay.CurrentStage.Should().Be(LeasingLifecycleStage.ShowingScheduled);
        (await db.UnitLifecycleEvents.CountAsync()).Should().Be(3);

        var firstAudit = await db.UnitLifecycleEvents.OrderBy(x => x.Id).FirstAsync();
        var snapshotProperty = typeof(UnitLifecycleEvent).GetProperty("ResultSnapshotJson");
        snapshotProperty.Should().NotBeNull();
        var snapshot = snapshotProperty!.GetValue(firstAudit).Should().BeOfType<string>().Subject;
        snapshot.Length.Should().BeLessThanOrEqualTo(4000);
        snapshot.Should().NotContain("schedulingConflict")
            .And.NotContain("raw-key-secret-url-signature-report-sas")
            .And.NotContain("different-trace");
        snapshot.ToLowerInvariant().Should().NotContain("reason")
            .And.NotContain("secret")
            .And.NotContain("url")
            .And.NotContain("report")
            .And.NotContain("sas");
        JsonDocument.Parse(snapshot).RootElement.ValueKind.Should().Be(JsonValueKind.Object);
    }

    [Fact]
    public async Task Same_key_is_organization_wide_across_service_instances_and_resources()
    {
        var options = new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        await using var firstDb = await SeedAsync(options);
        await using var secondDb = new DataContext(options);
        var first = new LeasingPipelineService(firstDb, Readiness());
        var second = new LeasingPipelineService(secondDb, Readiness());
        var request = new ShowingTransitionRequest(UnitLifecycleEventType.ShowingScheduled, DateTime.UtcNow.AddDays(1), null);
        var firstRevision = await first.GetForPropertyAsync(10, 20, 30, 40, default);
        await first.TransitionShowingAsync(10, 20, 30, 40, firstRevision.Revision, "global-key", "trace", request, default);
        var secondRevision = await second.GetForPropertyAsync(10, 20, 31, 41, default);

        Func<Task> reuse = () => second.TransitionShowingAsync(10, 20, 31, 41, secondRevision.Revision,
            "global-key", "trace", request, default);

        await reuse.Should().ThrowAsync<PipelineConflictException>();
        var entity = secondDb.Model.FindEntityType(typeof(UnitLifecycleEvent))!;
        entity.GetIndexes().Should().ContainSingle(index => index.IsUnique &&
            index.Properties.Select(property => property.Name)
                .SequenceEqual(new[] { "OrganizationId", "IdempotencyKeyHash" }));
        entity.GetIndexes().Should().Contain(index => index.IsUnique &&
            index.Properties.Select(property => property.Name)
                .SequenceEqual(new[] { "OrganizationId", "PropertyId", "UnitId", "PreviousRevision" }));
    }

    [Fact]
    public async Task Corrupt_replay_snapshot_fails_closed_without_returning_current_state_or_writing()
    {
        await using var db = await SeedAsync();
        var sut = new LeasingPipelineService(db, Readiness());
        var initial = await sut.GetForPropertyAsync(10, 20, 30, 40, default);
        var request = new ShowingTransitionRequest(UnitLifecycleEventType.ShowingScheduled, DateTime.UtcNow.AddDays(1), null);
        await sut.TransitionShowingAsync(10, 20, 30, 40, initial.Revision, "corrupt-key", "trace", request, default);
        var audit = await db.UnitLifecycleEvents.SingleAsync();
        audit.ResultSnapshotJson = "{not-valid-json";
        await db.SaveChangesAsync();

        Func<Task> replay = () => sut.TransitionShowingAsync(10, 20, 30, 40, initial.Revision,
            "corrupt-key", "trace", request, default);

        await replay.Should().ThrowAsync<PipelineConflictException>();
        (await db.UnitLifecycleEvents.CountAsync()).Should().Be(1);
    }

    [Fact]
    public void Lifecycle_migration_has_bounded_required_snapshot_and_global_idempotency_index()
    {
        var operations = new TestableLifecycleMigration().BuildUpOperations();
        var table = operations.OfType<CreateTableOperation>().Single(x => x.Name == "UnitLifecycleEvents");
        var snapshot = table.Columns.SingleOrDefault(x => x.Name == "ResultSnapshotJson");
        snapshot.Should().NotBeNull();
        snapshot!.IsNullable.Should().BeFalse();
        snapshot.MaxLength.Should().BePositive();

        operations.OfType<CreateIndexOperation>().Should().ContainSingle(index => index.IsUnique &&
            index.Columns.SequenceEqual(new[] { "OrganizationId", "IdempotencyKeyHash" }));
        operations.OfType<CreateIndexOperation>().Should().Contain(index => index.IsUnique &&
            index.Columns.SequenceEqual(new[] { "OrganizationId", "PropertyId", "UnitId", "PreviousRevision" }));
    }

    [Fact]
    public void Lifecycle_model_has_no_pending_migration_changes()
    {
        using var db = new DataContext(new DbContextOptionsBuilder<DataContext>()
            .UseSqlServer("Server=(localdb)\\mssqllocaldb;Database=model-only;Trusted_Connection=True")
            .Options);
        var snapshot = db.GetService<IMigrationsAssembly>().ModelSnapshot;
        var current = db.GetService<IDesignTimeModel>().Model;
        var differ = db.GetService<IMigrationsModelDiffer>();

        snapshot.Should().NotBeNull();
        var initializedSnapshot = db.GetService<IModelRuntimeInitializer>()
            .Initialize(snapshot!.Model, designTime: true);
        var differences = differ.GetDifferences(initializedSnapshot.GetRelationalModel(), current.GetRelationalModel());
        differences.Should().BeEmpty();
    }

    private sealed class TestableLifecycleMigration : AddUnitLifecycleEvents
    {
        public IReadOnlyList<MigrationOperation> BuildUpOperations()
        {
            var builder = new MigrationBuilder("Microsoft.EntityFrameworkCore.SqlServer");
            base.Up(builder);
            return builder.Operations;
        }
    }
}
