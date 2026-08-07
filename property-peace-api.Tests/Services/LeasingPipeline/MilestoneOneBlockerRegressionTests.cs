using System.Reflection;
using System.Text.Json;
using brownstone_hub_api.Config;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.LeasingPipeline;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.FeatureReadiness;
using brownstone_hub_api.Services.LeasingPipeline;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.LeasingPipeline;

public sealed class MilestoneOneBlockerRegressionTests
{
    private sealed class CountingDataContext(DbContextOptions<DataContext> options) : DataContext(options)
    {
        public int Saves { get; private set; }
        public void ResetSaves() => Saves = 0;
        public override async Task<int> SaveChangesAsync(CancellationToken ct = default)
        {
            Saves++;
            return await base.SaveChangesAsync(ct);
        }
    }

    private static (CountingDataContext Db, LeasingPipelineService Sut) Create()
    {
        var db = new CountingDataContext(new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var readiness = new Mock<IFeatureReadinessService>();
        readiness.Setup(x => x.GetAsync(It.IsAny<long>(), It.IsAny<long?>(), It.IsAny<string>()))
            .ReturnsAsync((long _, long? _, string feature) =>
                new FeatureReadinessDto(feature, FeatureReadinessState.Available, true, true, true, true, true, true, []));
        return (db, new LeasingPipelineService(db, readiness.Object));
    }

    private static async Task SeedScope(DataContext db, bool secondUnit = false)
    {
        db.OrganizationMembers.Add(new OrganizationMember { Id = 1, OrganizationId = 10, UserId = 20, IsActive = true, Role = "Owner" });
        db.Properties.Add(new Property { Id = 30, OrganizationId = 10, LandlordId = 20 });
        db.Units.Add(new Unit { Id = 40, PropertyId = 30, OrganizationId = 10 });
        if (secondUnit) db.Units.Add(new Unit { Id = 41, PropertyId = 30, OrganizationId = 10 });
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task Furthest_application_evidence_wins_before_timestamp_then_id()
    {
        var (db, sut) = Create();
        await SeedScope(db);
        var now = DateTime.UtcNow;
        db.RentalApplications.AddRange(
            new RentalApplication { Id = 50, PropertyId = 30, UnitId = 40, OrganizationId = 10, LandlordId = 20, Status = EApplicationStatus.Approved, UpdatedAt = now.AddDays(-2) },
            new RentalApplication { Id = 51, PropertyId = 30, UnitId = 40, OrganizationId = 10, LandlordId = 20, Status = EApplicationStatus.Submitted, UpdatedAt = now },
            new RentalApplication { Id = 52, PropertyId = 30, UnitId = 40, OrganizationId = 10, LandlordId = 20, Status = EApplicationStatus.Rejected, UpdatedAt = now.AddDays(1) });
        await db.SaveChangesAsync();

        var result = await sut.GetForPropertyAsync(10, 20, 30, 40, default);

        result.CurrentStage.Should().Be(LeasingLifecycleStage.Approved);
        result.References.ApplicationId.Should().Be(50);
    }

    [Fact]
    public void Terminal_signature_never_pairs_blocker_with_send_action_when_provider_is_available()
    {
        var result = LeasingPipelineProjector.Project(new LeasingPipelineFacts
        {
            HasLeaseDraft = true,
            HasDeclinedOrExpiredSignature = true,
            ESignatureReady = true
        });

        result.Blocker!.Code.Should().Be("signatureTerminal");
        result.Action!.Code.Should().Be("reviewLease");
    }

    [Fact]
    public async Task Idempotency_is_addressed_resource_bound_and_resource_is_validated_before_replay()
    {
        var (db, sut) = Create();
        await SeedScope(db, secondUnit: true);
        var before = await sut.GetForPropertyAsync(10, 20, 30, 40, default);
        var request = new ShowingTransitionRequest(UnitLifecycleEventType.ShowingScheduled, DateTime.UtcNow.AddDays(1), null);
        await sut.TransitionShowingAsync(10, 20, 30, 40, before.Revision, "resource-key", "trace", request, default);

        var other = await sut.GetForPropertyAsync(10, 20, 30, 41, default);
        Func<Task> reused = () => sut.TransitionShowingAsync(10, 20, 30, 41, other.Revision, "resource-key", "trace", request, default);
        await reused.Should().ThrowAsync<PipelineConflictException>();

        Func<Task> missing = () => sut.TransitionShowingAsync(10, 20, 999, 999, other.Revision, "resource-key", "trace", request, default);
        await missing.Should().ThrowAsync<PipelineNotFoundException>();
    }

    [Fact]
    public async Task Transition_is_one_atomic_save_with_final_audit_and_revision_claim()
    {
        var (db, sut) = Create();
        await SeedScope(db);
        var before = await sut.GetForPropertyAsync(10, 20, 30, 40, default);
        db.ResetSaves();

        var request = new ShowingTransitionRequest(
            UnitLifecycleEventType.ShowingScheduled, DateTime.UtcNow.AddDays(1), null);
        var first = await sut.TransitionShowingAsync(10, 20, 30, 40, before.Revision, "atomic-key", "trace",
            request, default);

        db.Saves.Should().Be(1);
        var audit = await db.UnitLifecycleEvents.SingleAsync();
        audit.ResultingStage.Should().Be(LeasingLifecycleStage.ShowingScheduled);
        audit.PreviousRevision.Should().Be(before.Revision);
        var stored = JsonSerializer.Deserialize<LeasingPipelineDto>(audit.ResultSnapshotJson, LeasingPipelineJson.Options);
        stored.Should().BeEquivalentTo(first);
        first.References.EventId.Should().BeNull();
        first.RelevantRecords.Should().NotContain(x => x.Type == "event");

        var retry = await sut.TransitionShowingAsync(10, 20, 30, 40, before.Revision, "atomic-key", "trace",
            request, default);
        retry.Should().BeEquivalentTo(first);
        db.Saves.Should().Be(1);

        var current = await sut.GetForPropertyAsync(10, 20, 30, 40, default);
        current.References.EventId.Should().Be(audit.Id);
        current.RelevantRecords.Should().ContainSingle(x => x.Type == "event" && x.Id == audit.Id);
        current.Revision.Should().Be(first.Revision);
        audit.IdempotencyKeyHash.Should().HaveLength(64).And.NotBe("atomic-key");
        typeof(UnitLifecycleEvent).GetProperty("PreviousRevision").Should().NotBeNull();
        var entity = db.Model.FindEntityType(typeof(UnitLifecycleEvent))!;
        entity.GetIndexes().Should().Contain(i => i.IsUnique &&
            i.Properties.Select(p => p.Name).SequenceEqual(new[] { "OrganizationId", "PropertyId", "UnitId", "PreviousRevision" }));
    }

    [Fact]
    public void Public_contract_has_safe_relevant_record_metadata()
    {
        var records = typeof(LeasingPipelineDto).GetProperty("RelevantRecords");
        records.Should().NotBeNull();
        var recordType = typeof(LeasingPipelineDto).Assembly.GetType("brownstone_hub_api.Dtos.LeasingPipeline.LifecycleRecordDto");
        recordType.Should().NotBeNull();
        recordType!.GetProperties().Select(p => p.Name).Should().BeEquivalentTo(
            "Type", "Id", "Status", "CreatedAt", "UpdatedAt", "SubmittedAt", "ScheduledAt", "SentAt",
            "CompletedAt", "ExpiresAt", "OccurredAt", "EffectiveAt");
        recordType.GetProperties().Select(p => p.Name).Should().NotContain(n =>
            new[] { "Email", "Name", "Ssn", "Report", "Url", "Token", "Secret" }.Any(x => n.Contains(x, StringComparison.OrdinalIgnoreCase)));
    }

    [Fact]
    public async Task Audit_contract_has_no_note_and_rejects_free_prose_reason()
    {
        typeof(UnitLifecycleEvent).GetProperty("Note").Should().BeNull();
        typeof(UnitLifecycleEvent).GetProperty("IdempotencyKey").Should().BeNull();
        typeof(UnitLifecycleEvent).GetProperty("IdempotencyKeyHash").Should().NotBeNull();
        typeof(ShowingTransitionRequest).GetProperty("Note").Should().BeNull();

        var (db, sut) = Create();
        await SeedScope(db);
        var before = await sut.GetForPropertyAsync(10, 20, 30, 40, default);
        Func<Task> act = () => sut.TransitionShowingAsync(10, 20, 30, 40, before.Revision, "pii-key", "trace",
            new(UnitLifecycleEventType.ShowingScheduled, DateTime.UtcNow.AddDays(1), "Call Jane at jane@example.com"), default);
        await act.Should().ThrowAsync<PipelineValidationException>();
        (await db.UnitLifecycleEvents.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Direct_endpoints_are_scope_safe_and_equivalent_to_property_projection()
    {
        var (db, sut) = Create();
        await SeedScope(db);
        db.Listings.Add(new Listing { Id = 60, PropertyId = 30, UnitId = 40, OrganizationId = 10, CreatedBy = 20, Status = EListingStatus.Active, CreatedAt = DateTime.UtcNow });
        db.RentalApplications.Add(new RentalApplication { Id = 61, PropertyId = 30, UnitId = 40, OrganizationId = 10, LandlordId = 20, Status = EApplicationStatus.Submitted });
        await db.SaveChangesAsync();

        var property = await sut.GetForPropertyAsync(10, 20, 30, 40, default);
        (await sut.GetForListingAsync(10, 20, 60, default)).Should().BeEquivalentTo(property, o => o.Excluding(x => x.EvaluatedAt));
        (await sut.GetForApplicationAsync(10, 20, 61, default)).Should().BeEquivalentTo(property, o => o.Excluding(x => x.EvaluatedAt));
        Func<Task> wrongListing = () => sut.GetForListingAsync(11, 20, 60, default);
        await wrongListing.Should().ThrowAsync<PipelineForbiddenException>();
    }

    [Fact]
    public void Controller_declares_landlord_admin_authorization_metadata()
    {
        var authorize = typeof(LeasingPipelineController).GetCustomAttribute<AuthorizeAttribute>();
        authorize.Should().NotBeNull();
        authorize!.Roles.Should().Be("Landlord,Admin");
    }

    [Theory]
    [InlineData(LeasingLifecycleStage.Vacant)]
    [InlineData(LeasingLifecycleStage.Listed)]
    [InlineData(LeasingLifecycleStage.Lead)]
    [InlineData(LeasingLifecycleStage.ShowingScheduled)]
    [InlineData(LeasingLifecycleStage.Applied)]
    [InlineData(LeasingLifecycleStage.Screening)]
    [InlineData(LeasingLifecycleStage.Approved)]
    [InlineData(LeasingLifecycleStage.LeaseDraft)]
    [InlineData(LeasingLifecycleStage.SignaturePending)]
    [InlineData(LeasingLifecycleStage.MoveInReady)]
    [InlineData(LeasingLifecycleStage.Occupied)]
    public async Task Actual_domain_records_derive_all_eleven_canonical_states(LeasingLifecycleStage expected)
    {
        var (db, sut) = Create();
        await SeedScope(db);
        var now = DateTime.UtcNow;
        switch (expected)
        {
            case LeasingLifecycleStage.Listed:
                db.Listings.Add(new Listing { Id = 50, PropertyId = 30, UnitId = 40, OrganizationId = 10, CreatedBy = 20, Status = EListingStatus.Active, CreatedAt = now });
                break;
            case LeasingLifecycleStage.Lead:
                db.ApplicationInvites.Add(new ApplicationInvite { Id = 51, PropertyId = 30, UnitId = 40, OrganizationId = 10, CreatedBy = 20, CreatedAt = now, ExpiresAt = now.AddDays(1) });
                break;
            case LeasingLifecycleStage.ShowingScheduled:
                db.UnitLifecycleEvents.Add(Event(52, UnitLifecycleEventType.ShowingScheduled, now, now.AddDays(1)));
                break;
            case LeasingLifecycleStage.Applied:
            case LeasingLifecycleStage.Screening:
            case LeasingLifecycleStage.Approved:
                db.RentalApplications.Add(new RentalApplication { Id = 53, PropertyId = 30, UnitId = 40, OrganizationId = 10, LandlordId = 20,
                    Status = expected == LeasingLifecycleStage.Applied ? EApplicationStatus.Submitted :
                        expected == LeasingLifecycleStage.Screening ? EApplicationStatus.UnderReview : EApplicationStatus.Approved,
                    SubmittedAt = now, UpdatedAt = now });
                break;
            case LeasingLifecycleStage.LeaseDraft:
                db.Leases.Add(new Lease { Id = 54, UnitId = 40, OrganizationId = 10, IsActive = false, UpdatedAt = now });
                break;
            case LeasingLifecycleStage.SignaturePending:
                db.Leases.Add(new Lease { Id = 55, UnitId = 40, OrganizationId = 10, IsActive = false, UpdatedAt = now,
                    LeaseAgreement = new LeaseAgreement { Id = 56, SignatureStatus = ESignatureStatus.Sent, SignatureSentAt = now, SignatureExpiresAt = now.AddDays(1) } });
                break;
            case LeasingLifecycleStage.MoveInReady:
                db.Leases.Add(new Lease { Id = 57, UnitId = 40, OrganizationId = 10, IsActive = true, StartDate = now.AddDays(2), UpdatedAt = now,
                    LeaseAgreement = new LeaseAgreement { Id = 58, SignatureStatus = ESignatureStatus.Completed, SignatureCompletedAt = now } });
                break;
            case LeasingLifecycleStage.Occupied:
                (await db.Units.SingleAsync()).IsOccupied = true;
                break;
        }
        await db.SaveChangesAsync();

        (await sut.GetForPropertyAsync(10, 20, 30, 40, default)).CurrentStage.Should().Be(expected);
    }

    [Fact]
    public async Task Furthest_valid_lease_evidence_wins_and_historical_terminal_does_not_dominate()
    {
        var (db, sut) = Create();
        await SeedScope(db);
        var now = DateTime.UtcNow;
        db.Leases.Add(new Lease { Id = 60, UnitId = 40, OrganizationId = 10, IsActive = false, UpdatedAt = now,
            LeaseAgreement = new LeaseAgreement { Id = 61, SignatureStatus = ESignatureStatus.Declined, SignatureSentAt = now } });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        db.Leases.Add(new Lease { Id = 62, UnitId = 40, OrganizationId = 10, IsActive = false, UpdatedAt = now.AddDays(-2),
            LeaseAgreement = new LeaseAgreement { Id = 63, SignatureStatus = ESignatureStatus.Sent, SignatureSentAt = now.AddDays(-2), SignatureExpiresAt = now.AddDays(1) } });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var result = await sut.GetForPropertyAsync(10, 20, 30, 40, default);
        result.CurrentStage.Should().Be(LeasingLifecycleStage.SignaturePending);
        result.References.LeaseId.Should().Be(62);
        result.Blocker.Should().BeNull();
    }

    [Fact]
    public async Task Schedule_reschedule_cancel_and_complete_are_narrow_and_restore_authoritative_stage()
    {
        foreach (var terminalType in new[] { UnitLifecycleEventType.ShowingCancelled, UnitLifecycleEventType.ShowingCompleted })
        {
            var (db, sut) = Create();
            await SeedScope(db);
            var initial = await sut.GetForPropertyAsync(10, 20, 30, 40, default);
            var scheduled = await sut.TransitionShowingAsync(10, 20, 30, 40, initial.Revision, $"schedule-{terminalType}", "trace",
                new(UnitLifecycleEventType.ShowingScheduled, DateTime.UtcNow.AddDays(1), null), default);
            scheduled.CurrentStage.Should().Be(LeasingLifecycleStage.ShowingScheduled);
            var rescheduled = await sut.TransitionShowingAsync(10, 20, 30, 40, scheduled.Revision, $"reschedule-{terminalType}", "trace",
                new(UnitLifecycleEventType.ShowingRescheduled, DateTime.UtcNow.AddDays(2), null), default);
            var finished = await sut.TransitionShowingAsync(10, 20, 30, 40, rescheduled.Revision, $"finish-{terminalType}", "trace",
                new(terminalType, null, terminalType == UnitLifecycleEventType.ShowingCompleted ? "showingCompleted" : "landlordCancelled"), default);
            finished.CurrentStage.Should().Be(LeasingLifecycleStage.Vacant);
            (await db.UnitLifecycleEvents.CountAsync()).Should().Be(3);
        }
    }

    [Fact]
    public async Task Safe_relevant_records_contain_statuses_and_lifecycle_times_but_no_sensitive_values()
    {
        var (db, sut) = Create();
        await SeedScope(db);
        var submitted = DateTime.UtcNow.AddHours(-1);
        db.RentalApplications.Add(new RentalApplication { Id = 70, PropertyId = 30, UnitId = 40, OrganizationId = 10, LandlordId = 20,
            Status = EApplicationStatus.Submitted, SubmittedAt = submitted, Email = "private@example.com" });
        await db.SaveChangesAsync();

        var result = await sut.GetForPropertyAsync(10, 20, 30, 40, default);
        var record = result.RelevantRecords.Should().ContainSingle(x => x.Type == "application").Subject;
        record.Id.Should().Be(70);
        record.Status.Should().Be("submitted");
        record.SubmittedAt.Should().Be(submitted);
        JsonSerializer.Serialize(result, LeasingPipelineJson.Options).Should().NotContain("private@example.com");
    }

    private static UnitLifecycleEvent Event(long id, UnitLifecycleEventType type, DateTime occurred, DateTime? scheduled) => new()
    {
        Id = id, OrganizationId = 10, PropertyId = 30, UnitId = 40, ActorUserId = 20,
        PreviousStage = LeasingLifecycleStage.Vacant, ResultingStage = LeasingLifecycleStage.ShowingScheduled,
        EventType = type, ScheduledAtUtc = scheduled, OccurredAtUtc = occurred,
        RequestHash = new string('a', 64), PreviousRevision = new string('b', 64), CorrelationTrace = "trace", IdempotencyKeyHash = new string('c', 62) + id.ToString("00")
    };
}
