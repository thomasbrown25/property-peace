using brownstone_hub_api.Config;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.LeasingPipeline;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.FeatureReadiness;
using brownstone_hub_api.Services.LeasingPipeline;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.LeasingPipeline;

public sealed class LeasingPipelineServiceTests
{
    private static (DataContext Db, LeasingPipelineService Sut) Create(Func<CancellationToken, Task>? beforeFinalInsert = null)
    {
        var db = new DataContext(new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var readiness = new Mock<IFeatureReadinessService>();
        readiness.Setup(x => x.GetAsync(It.IsAny<long>(), It.IsAny<long?>(), It.IsAny<string>()))
            .ReturnsAsync((long _, long? _, string feature) =>
                new FeatureReadinessDto(feature, FeatureReadinessState.Available, true, true, true, true, true, true, []));
        return (db, new LeasingPipelineService(db, readiness.Object, beforeFinalInsert));
    }

    private static async Task SeedScope(DataContext db, int unitCount = 1)
    {
        db.OrganizationMembers.Add(new OrganizationMember { Id = 1, OrganizationId = 10, UserId = 20, IsActive = true, Role = "Owner" });
        db.Properties.Add(new Property { Id = 30, OrganizationId = 10, LandlordId = 20 });
        for (var i = 0; i < unitCount; i++)
            db.Units.Add(new Unit { Id = 40 + i, PropertyId = 30, OrganizationId = 10 });
        await db.SaveChangesAsync();
    }

    [Theory]
    [InlineData(false, "Owner", 10, typeof(PipelineForbiddenException))]
    [InlineData(true, "Viewer", 10, typeof(PipelineForbiddenException))]
    [InlineData(true, "Owner", 11, typeof(PipelineForbiddenException))]
    public async Task Fails_closed_for_removed_stale_role_and_cross_org(bool active, string role, long org, Type error)
    {
        var (db, sut) = Create();
        await SeedScope(db);
        var member = await db.OrganizationMembers.SingleAsync();
        member.IsActive = active;
        member.Role = role;
        await db.SaveChangesAsync();

        Func<Task> act = () => sut.GetForPropertyAsync(org, 20, 30, 40, CancellationToken.None);
        (await act.Should().ThrowAsync<Exception>()).Which.Should().BeOfType(error);
    }

    [Fact]
    public async Task Legacy_null_unit_records_attach_only_to_exact_single_unit_and_never_broadcast()
    {
        var (db, sut) = Create();
        await SeedScope(db);
        db.RentalApplications.Add(new RentalApplication { Id = 50, PropertyId = 30, UnitId = null, OrganizationId = 10, LandlordId = 20, Status = EApplicationStatus.Submitted });
        await db.SaveChangesAsync();
        (await sut.GetForPropertyAsync(10, 20, 30, 40, default)).CurrentStage.Should().Be(LeasingLifecycleStage.Applied);

        db.Units.Add(new Unit { Id = 41, PropertyId = 30, OrganizationId = 10 });
        await db.SaveChangesAsync();
        (await sut.GetForPropertyAsync(10, 20, 30, 40, default)).CurrentStage.Should().Be(LeasingLifecycleStage.Vacant);
        (await sut.GetForPropertyAsync(10, 20, 30, 41, default)).CurrentStage.Should().Be(LeasingLifecycleStage.Vacant);
    }

    [Fact]
    public async Task Related_records_require_matching_org_property_and_unit_and_candidates_are_deterministic()
    {
        var (db, sut) = Create();
        await SeedScope(db);
        db.RentalApplications.AddRange(
            new RentalApplication { Id = 51, PropertyId = 30, UnitId = 40, OrganizationId = 11, LandlordId = 20, Status = EApplicationStatus.Approved, UpdatedAt = DateTime.UtcNow.AddDays(2) },
            new RentalApplication { Id = 52, PropertyId = 30, UnitId = 40, OrganizationId = 10, LandlordId = 20, Status = EApplicationStatus.Submitted, UpdatedAt = DateTime.UtcNow },
            new RentalApplication { Id = 53, PropertyId = 30, UnitId = 40, OrganizationId = 10, LandlordId = 20, Status = EApplicationStatus.Submitted, UpdatedAt = DateTime.UtcNow.AddMinutes(1) });
        await db.SaveChangesAsync();
        var result = await sut.GetForPropertyAsync(10, 20, 30, 40, default);
        result.CurrentStage.Should().Be(LeasingLifecycleStage.Applied);
        result.References.ApplicationId.Should().Be(53);
    }

    [Fact]
    public async Task Showing_command_requires_revision_and_key_is_idempotent_audited_and_payload_bound()
    {
        var (db, sut) = Create();
        await SeedScope(db);
        var before = await sut.GetForPropertyAsync(10, 20, 30, 40, default);
        var request = new ShowingTransitionRequest(UnitLifecycleEventType.ShowingScheduled, DateTime.UtcNow.AddDays(1), null);

        var first = await sut.TransitionShowingAsync(10, 20, 30, 40, before.Revision, "same-key", "trace-1", request, default);
        var retry = await sut.TransitionShowingAsync(10, 20, 30, 40, before.Revision, "same-key", "trace-1", request, default);
        first.References.EventId.Should().Be(retry.References.EventId);
        (await db.UnitLifecycleEvents.CountAsync()).Should().Be(1);
        var audit = await db.UnitLifecycleEvents.SingleAsync();
        audit.ActorUserId.Should().Be(20);
        audit.CorrelationTrace.Should().Be("trace-1");
        audit.PreviousStage.Should().Be(LeasingLifecycleStage.Vacant);
        audit.ResultingStage.Should().Be(LeasingLifecycleStage.ShowingScheduled);
        audit.RequestHash.Should().NotBeNullOrWhiteSpace();

        Func<Task> changed = () => sut.TransitionShowingAsync(10, 20, 30, 40, before.Revision, "same-key", "trace-2",
            request with { Reason = "schedulingConflict" }, default);
        await changed.Should().ThrowAsync<PipelineConflictException>();
        (await db.UnitLifecycleEvents.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task Stale_or_rejected_transition_has_no_audit()
    {
        var (db, sut) = Create();
        await SeedScope(db);
        Func<Task> stale = () => sut.TransitionShowingAsync(10, 20, 30, 40, "stale", "key", "trace",
            new(UnitLifecycleEventType.ShowingScheduled, DateTime.UtcNow.AddDays(1), null), default);
        await stale.Should().ThrowAsync<PipelineConflictException>();
        (await db.UnitLifecycleEvents.CountAsync()).Should().Be(0);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Ended_lease_does_not_trap_a_vacant_unit_at_lease_draft(bool isActive)
    {
        var (db, sut) = Create();
        await SeedScope(db);
        db.Leases.Add(new Lease
        {
            Id = 60, UnitId = 40, OrganizationId = 10, IsActive = isActive,
            StartDate = DateTime.UtcNow.AddYears(-1), EndDate = DateTime.UtcNow.Date.AddDays(-1)
        });
        await db.SaveChangesAsync();

        var result = await sut.GetForPropertyAsync(10, 20, 30, 40, default);

        result.CurrentStage.Should().Be(LeasingLifecycleStage.Vacant);
        result.References.LeaseId.Should().BeNull();
        result.RelevantRecords.Should().NotContain(x => x.Type == "lease" || x.Type == "signature");
    }

    [Fact]
    public async Task Current_terminal_signature_remains_a_reviewable_current_lease_draft()
    {
        var (db, sut) = Create();
        await SeedScope(db);
        db.Leases.Add(new Lease
        {
            Id = 60, UnitId = 40, OrganizationId = 10, IsActive = false,
            StartDate = DateTime.UtcNow.AddDays(30), EndDate = DateTime.UtcNow.AddYears(1),
            LeaseAgreement = new LeaseAgreement { Id = 61, SignatureStatus = ESignatureStatus.Declined }
        });
        await db.SaveChangesAsync();

        var result = await sut.GetForPropertyAsync(10, 20, 30, 40, default);

        result.CurrentStage.Should().Be(LeasingLifecycleStage.LeaseDraft);
        result.Blocker!.Code.Should().Be("signatureTerminal");
    }

    [Fact]
    public async Task Newer_listing_and_application_win_after_historical_lease_is_excluded()
    {
        var (db, sut) = Create();
        await SeedScope(db);
        db.Leases.Add(new Lease
        {
            Id = 60, UnitId = 40, OrganizationId = 10, IsActive = true,
            StartDate = DateTime.UtcNow.AddYears(-2), EndDate = DateTime.UtcNow.Date.AddDays(-1),
            LeaseAgreement = new LeaseAgreement { Id = 61, SignatureStatus = ESignatureStatus.Completed, SignatureCompletedAt = DateTime.UtcNow.AddYears(-2) }
        });
        db.Listings.Add(new Listing
        {
            Id = 62, PropertyId = 30, UnitId = 40, OrganizationId = 10, CreatedBy = 20,
            Status = EListingStatus.Active, CreatedAt = DateTime.UtcNow.AddDays(-2)
        });
        db.RentalApplications.Add(new RentalApplication
        {
            Id = 63, PropertyId = 30, UnitId = 40, OrganizationId = 10, LandlordId = 20,
            Status = EApplicationStatus.Submitted, SubmittedAt = DateTime.UtcNow.AddDays(-1)
        });
        await db.SaveChangesAsync();

        var result = await sut.GetForPropertyAsync(10, 20, 30, 40, default);

        result.CurrentStage.Should().Be(LeasingLifecycleStage.Applied);
        result.References.ListingId.Should().Be(62);
        result.References.ApplicationId.Should().Be(63);
        result.References.LeaseId.Should().BeNull();
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Ended_converted_lease_and_its_historical_application_do_not_override_current_cycle(bool isActive)
    {
        var (db, sut) = Create();
        await SeedScope(db);
        var now = DateTime.UtcNow;
        db.Leases.Add(new Lease
        {
            Id = 64, UnitId = 40, OrganizationId = 10, IsActive = isActive,
            StartDate = now.AddYears(-2), EndDate = now.Date.AddDays(-1), UpdatedAt = now.AddYears(-1)
        });
        db.RentalApplications.AddRange(
            new RentalApplication
            {
                Id = 65, PropertyId = 30, UnitId = 40, OrganizationId = 10, LandlordId = 20,
                Status = EApplicationStatus.Approved, SubmittedAt = now.AddYears(-2),
                ReviewedAt = now.AddYears(-2), ConvertedToLeaseId = 64
            },
            new RentalApplication
            {
                Id = 67, PropertyId = 30, UnitId = 40, OrganizationId = 10, LandlordId = 20,
                Status = EApplicationStatus.Submitted, SubmittedAt = now.AddDays(-1)
            });
        db.Listings.Add(new Listing
        {
            Id = 66, PropertyId = 30, UnitId = 40, OrganizationId = 10, CreatedBy = 20,
            Status = EListingStatus.Active, CreatedAt = now.AddDays(-2)
        });
        await db.SaveChangesAsync();

        var result = await sut.GetForPropertyAsync(10, 20, 30, 40, default);

        result.CurrentStage.Should().Be(LeasingLifecycleStage.Applied);
        result.References.ListingId.Should().Be(66);
        result.References.ApplicationId.Should().Be(67);
        result.References.LeaseId.Should().BeNull();
        result.RelevantRecords.Should().NotContain(x => x.Type == "lease" || x.Type == "signature");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(30)]
    public async Task Current_or_future_converted_lease_remains_current_lifecycle_evidence(int endDateOffsetDays)
    {
        var (db, sut) = Create();
        await SeedScope(db);
        var now = DateTime.UtcNow;
        db.Leases.Add(new Lease
        {
            Id = 68, UnitId = 40, OrganizationId = 10, IsActive = false,
            StartDate = now.AddDays(-10), EndDate = now.Date.AddDays(endDateOffsetDays), UpdatedAt = now
        });
        db.RentalApplications.Add(new RentalApplication
        {
            Id = 69, PropertyId = 30, UnitId = 40, OrganizationId = 10, LandlordId = 20,
            Status = EApplicationStatus.Approved, SubmittedAt = now, ReviewedAt = now,
            ConvertedToLeaseId = 68
        });
        await db.SaveChangesAsync();

        var result = await sut.GetForPropertyAsync(10, 20, 30, 40, default);

        result.CurrentStage.Should().Be(LeasingLifecycleStage.LeaseDraft);
        result.References.ApplicationId.Should().Be(69);
        result.References.LeaseId.Should().Be(68);
    }

    [Fact]
    public async Task Revision_changes_when_selected_invite_authoritative_expiry_changes()
    {
        var (db, sut) = Create();
        await SeedScope(db);
        db.ApplicationInvites.Add(new ApplicationInvite
        {
            Id = 70, PropertyId = 30, UnitId = 40, OrganizationId = 10, CreatedBy = 20,
            CreatedAt = DateTime.UtcNow, ExpiresAt = DateTime.UtcNow.AddDays(2)
        });
        await db.SaveChangesAsync();
        var before = await sut.GetForPropertyAsync(10, 20, 30, 40, default);

        (await db.ApplicationInvites.SingleAsync()).ExpiresAt = DateTime.UtcNow.AddDays(3);
        await db.SaveChangesAsync();
        var after = await sut.GetForPropertyAsync(10, 20, 30, 40, default);

        after.References.InviteId.Should().Be(70);
        after.Revision.Should().NotBe(before.Revision);
    }

    [Fact]
    public void SqlServer_application_candidate_query_is_translatable_bounded_and_pii_minimized()
    {
        var options = new DbContextOptionsBuilder<DataContext>()
            .UseSqlServer("Server=(localdb)\\mssqllocaldb;Database=PipelineSqlShape;Trusted_Connection=True;")
            .Options;
        using var db = new DataContext(options);
        var readiness = new Mock<IFeatureReadinessService>();
        var sut = new LeasingPipelineService(db, readiness.Object);
        var method = typeof(LeasingPipelineService).GetMethod("ApplicationCandidates",
            System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)!;
        var query = (IQueryable)method.Invoke(sut, [10L, 30L, 40L, false, DateTime.UtcNow.Date])!;

        var sql = query.Cast<object>().Take(1).ToQueryString();

        sql.Should().Contain("TOP");
        sql.Should().Contain("RentalApplications");
        sql.Should().NotContain("FirstName").And.NotContain("LastName").And.NotContain("Email")
            .And.NotContain("Ssn").And.NotContain("CreditScore").And.NotContain("ReportUrl")
            .And.NotContain("ReviewNotes").And.NotContain("AdditionalNotes");
    }

    [Fact]
    public async Task Authoritative_change_before_final_insert_fails_stale_without_audit()
    {
        DataContext? captured = null;
        var (db, sut) = Create(async _ =>
        {
            captured!.Listings.Add(new Listing
            {
                Id = 80, PropertyId = 30, UnitId = 40, OrganizationId = 10, CreatedBy = 20,
                Status = EListingStatus.Active, CreatedAt = DateTime.UtcNow
            });
            await captured.SaveChangesAsync();
        });
        captured = db;
        await SeedScope(db);
        var before = await sut.GetForPropertyAsync(10, 20, 30, 40, default);

        Func<Task> act = () => sut.TransitionShowingAsync(10, 20, 30, 40, before.Revision, "race-key", "trace",
            new(UnitLifecycleEventType.ShowingScheduled, DateTime.UtcNow.AddDays(1), null), default);

        await act.Should().ThrowAsync<PipelineConflictException>().WithMessage("*stale*");
        (await db.UnitLifecycleEvents.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Malformed_idempotency_replay_snapshot_fails_closed()
    {
        var (db, sut) = Create();
        await SeedScope(db);
        var before = await sut.GetForPropertyAsync(10, 20, 30, 40, default);
        var request = new ShowingTransitionRequest(UnitLifecycleEventType.ShowingScheduled, DateTime.UtcNow.AddDays(1), null);
        await sut.TransitionShowingAsync(10, 20, 30, 40, before.Revision, "bad-replay", "trace", request, default);
        var audit = await db.UnitLifecycleEvents.SingleAsync();
        audit.ResultSnapshotJson = "{not-json";
        await db.SaveChangesAsync();

        Func<Task> replay = () => sut.TransitionShowingAsync(10, 20, 30, 40, before.Revision, "bad-replay", "trace", request, default);

        await replay.Should().ThrowAsync<PipelineConflictException>().WithMessage("*invalid*");
    }
}
