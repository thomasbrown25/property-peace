using brownstone_hub_api.Data;
using brownstone_hub_api.Domain.Screening;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.Screening;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Screening;

public sealed class ScreeningRetentionConcurrencyTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 7, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Sql_server_model_marks_the_claim_token_as_an_optimistic_concurrency_boundary()
    {
        using var db = new DataContext(new DbContextOptionsBuilder<DataContext>()
            .UseSqlServer("Server=(localdb)\\mssqllocaldb;Database=ScreeningRetentionMetadataOnly;Trusted_Connection=True")
            .Options);
        var property = db.Model.FindEntityType(typeof(ScreeningReportRevision))!
            .FindProperty(nameof(ScreeningReportRevision.DeletionClaimToken))!;
        property.IsConcurrencyToken.Should().BeTrue();
        property.GetColumnType().Should().Be("uniqueidentifier");
    }

    [Fact]
    public async Task Deletion_lifecycle_evidence_cannot_be_rewritten_or_removed()
    {
        var options = Options();
        await SeedAsync(options);
        await using var db = new DataContext(options);
        (await Service(db, new Gateway()).ClaimNextDueReportAsync(10)).Should().NotBeNull();

        var evidence = await db.ScreeningReportDeletionEvents.SingleAsync();
        evidence.ReasonCode = "rewritten";
        await FluentActions.Invoking(() => db.SaveChangesAsync())
            .Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*append-only*");

        db.Entry(evidence).State = EntityState.Unchanged;
        db.ScreeningReportDeletionEvents.Remove(evidence);
        await FluentActions.Invoking(() => db.SaveChangesAsync())
            .Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*append-only*");
    }

    [Fact]
    public async Task Separate_claim_contexts_have_only_one_lease_owner()
    {
        var options = Options();
        await SeedAsync(options);
        var gateway = new Gateway();
        await using var firstDb = new DataContext(options);
        await using var secondDb = new DataContext(options);

        var claims = await Task.WhenAll(Service(firstDb, gateway).ClaimNextDueReportAsync(10),
            Service(secondDb, gateway).ClaimNextDueReportAsync(10));

        claims.Count(x => x is not null).Should().Be(1);
    }

    [Fact]
    public async Task Legal_hold_in_a_separate_context_revokes_an_unexecuted_deletion_claim()
    {
        var options = Options();
        await SeedAsync(options);
        var gateway = new Gateway();
        ScreeningReportDeletionClaim claim;
        await using (var claimDb = new DataContext(options))
        {
            var retention = Service(claimDb, gateway);
            claim = (await retention.ClaimNextDueReportAsync(10))!;
        }

        await using (var holdDb = new DataContext(options))
            await Service(holdDb, gateway).PlaceLegalHoldAsync(10, 60, "litigation");

        await using (var executeDb = new DataContext(options))
            (await Service(executeDb, gateway).ExecuteClaimAsync(claim)).Should().BeFalse();

        gateway.DeleteCalls.Should().Be(0);
        await using var verify = new DataContext(options);
        var report = await verify.ScreeningReportRevisions.SingleAsync();
        report.IsUnderLegalHold.Should().BeTrue();
        report.DeletionClaimToken.Should().BeNull();
        (await verify.ScreeningReportDeletionEvents.OrderBy(x => x.Revision).Select(x => x.EventType).ToListAsync())
            .Should().Equal(ScreeningReportDeletionEventType.Claimed, ScreeningReportDeletionEventType.RevokedForLegalHold);
    }

    [Fact]
    public async Task Open_dispute_in_a_separate_context_revokes_an_unexecuted_claim()
    {
        var options = Options();
        await SeedAsync(options, applicantToken: "token");
        var gateway = new Gateway();
        ScreeningReportDeletionClaim claim;
        await using (var claimDb = new DataContext(options))
            claim = (await Service(claimDb, gateway).ClaimNextDueReportAsync(10))!;

        await using (var disputeDb = new DataContext(options))
        {
            var decisions = new TenantScreeningDecisionService(disputeDb, gateway, new FixedClock(Now));
            await decisions.OpenDisputeAsync(ScreeningDisputeOpenCommand.ForApplicant("token", 60, ["identity"], "bounded"));
        }

        await using (var executeDb = new DataContext(options))
            (await Service(executeDb, gateway).ExecuteClaimAsync(claim)).Should().BeFalse();
        gateway.DeleteCalls.Should().Be(0);
        await using var verify = new DataContext(options);
        (await verify.ScreeningReportRevisions.SingleAsync()).DeletionClaimToken.Should().BeNull();
        (await verify.ScreeningReportDeletionEvents.OrderBy(x => x.Revision).Select(x => x.EventType).ToListAsync())
            .Should().Equal(ScreeningReportDeletionEventType.Claimed, ScreeningReportDeletionEventType.RevokedForDispute);
    }

    [Fact]
    public async Task Durable_pending_dispute_blocks_claim_and_delete_during_provider_call()
    {
        var options = Options();
        await SeedAsync(options, applicantToken: "token");
        var gateway = new Gateway();
        gateway.BeforeDispute = async () =>
        {
            await using var retentionDb = new DataContext(options);
            (await Service(retentionDb, gateway).ClaimNextDueReportAsync(10)).Should().BeNull();
            var durable = await retentionDb.ScreeningDisputeIntents.AsNoTracking().SingleAsync();
            durable.Status.Should().Be(ScreeningDisputeIntentStatus.Processing);
            (await retentionDb.ScreeningReportRevisions.AsNoTracking().SingleAsync()).PendingDisputeOperationId
                .Should().Be(durable.OperationId);
        };

        await using var disputeDb = new DataContext(options);
        var decisions = new TenantScreeningDecisionService(disputeDb, gateway, new FixedClock(Now));
        await decisions.OpenDisputeAsync(ScreeningDisputeOpenCommand.ForApplicant("token", 60, ["identity"], "bounded"));

        gateway.DeleteCalls.Should().Be(0);
        gateway.DisputeCalls.Should().Be(1);
    }

    [Fact]
    public async Task Final_pre_delete_check_treats_a_pending_dispute_as_a_preservation_hold()
    {
        var options = Options();
        await SeedAsync(options);
        var gateway = new Gateway();
        await using var claimDb = new DataContext(options);
        var claim = (await Service(claimDb, gateway).ClaimNextDueReportAsync(10))!;

        await using (var fenceDb = new DataContext(options))
        {
            var report = await fenceDb.ScreeningReportRevisions.SingleAsync();
            report.PendingDisputeOperationId = Guid.NewGuid();
            await fenceDb.SaveChangesAsync();
        }

        await using var executeDb = new DataContext(options);
        (await Service(executeDb, gateway).ExecuteClaimAsync(claim)).Should().BeFalse();
        gateway.DeleteCalls.Should().Be(0);
    }

    [Fact]
    public async Task Process_interruption_leaves_a_lease_that_can_be_reclaimed_after_expiry()
    {
        var options = Options();
        await SeedAsync(options);
        var gateway = new Gateway();
        ScreeningReportDeletionClaim abandoned;
        await using (var firstDb = new DataContext(options))
            abandoned = (await Service(firstDb, gateway).ClaimNextDueReportAsync(10))!;

        await using (var earlyDb = new DataContext(options))
            (await Service(earlyDb, gateway).ClaimNextDueReportAsync(10)).Should().BeNull();

        await using (var laterDb = new DataContext(options))
        {
            var reclaimed = await Service(laterDb, gateway, Now.AddMinutes(6)).ClaimNextDueReportAsync(10);
            reclaimed.Should().NotBeNull();
            reclaimed!.ClaimToken.Should().NotBe(abandoned.ClaimToken);
        }

        gateway.DeleteCalls.Should().Be(0);
    }

    [Fact]
    public async Task Hold_racing_after_provider_call_started_fails_closed_and_persists_critical_sanitized_incident()
    {
        var options = Options();
        await SeedAsync(options);
        var gateway = new Gateway();
        var claimDb = new DataContext(options);
        var claim = (await Service(claimDb, gateway).ClaimNextDueReportAsync(10))!;
        gateway.BeforeDelete = async () =>
        {
            await using var holdDb = new DataContext(options);
            await Service(holdDb, gateway).Invoking(x => x.PlaceLegalHoldAsync(10, 60, "secret-litigation-narrative"))
                .Should().ThrowAsync<ScreeningDeletionSafetyConflictException>();
        };

        (await Service(claimDb, gateway).ExecuteClaimAsync(claim)).Should().BeFalse(
            "the durable legal hold must prevent local deletion finalization even after the provider call returned");

        await using var verify = new DataContext(options);
        var incident = await verify.ScreeningIncidents.SingleAsync(x =>
            x.IncidentType == ScreeningIncidentType.ProviderDeletionHoldConflict);
        incident.Severity.Should().Be(ScreeningIncidentSeverity.Critical);
        incident.IncidentType.Should().Be(ScreeningIncidentType.ProviderDeletionHoldConflict);
        incident.ToString().Should().NotContain("secret-litigation-narrative");
        (await verify.ScreeningIncidentEvents.CountAsync(x =>
            x.EvidenceReference == "LegalHoldRacedWithProviderDeletion")).Should().Be(1);
        (await verify.ScreeningReportDeletionEvents.AnyAsync(x => x.EventType == ScreeningReportDeletionEventType.HoldRacedWithProviderDeletion)).Should().BeTrue();
        (await verify.ScreeningReportRevisions.SingleAsync()).DeletedAt.Should().BeNull();
    }

    [Fact]
    public async Task Dispute_racing_after_provider_call_started_fails_closed_and_persists_critical_incident()
    {
        var options = Options();
        await SeedAsync(options, applicantToken: "token");
        var gateway = new Gateway();
        await using var claimDb = new DataContext(options);
        var claim = (await Service(claimDb, gateway).ClaimNextDueReportAsync(10))!;
        gateway.BeforeDelete = async () =>
        {
            await using var disputeDb = new DataContext(options);
            var decisions = new TenantScreeningDecisionService(disputeDb, gateway, new FixedClock(Now));
            await decisions.Invoking(x => x.OpenDisputeAsync(
                    ScreeningDisputeOpenCommand.ForApplicant("token", 60, ["identity"], "private narrative")))
                .Should().ThrowAsync<ScreeningDeletionSafetyConflictException>();
        };

        (await Service(claimDb, gateway).ExecuteClaimAsync(claim)).Should().BeTrue();

        await using var verify = new DataContext(options);
        var incident = await verify.ScreeningIncidents.SingleAsync();
        incident.IncidentType.Should().Be(ScreeningIncidentType.ProviderDeletionDisputeConflict);
        incident.Severity.Should().Be(ScreeningIncidentSeverity.Critical);
        incident.ToString().Should().NotContain("private narrative");
        (await verify.ScreeningDisputes.CountAsync()).Should().Be(0);
        (await verify.ScreeningReportDeletionEvents.AnyAsync(x =>
            x.EventType == ScreeningReportDeletionEventType.DisputeRacedWithProviderDeletion)).Should().BeTrue();
    }

    [Fact]
    public async Task Ambiguous_started_provider_call_is_reclaimed_and_reconciled_with_same_operation()
    {
        var options = Options();
        await SeedAsync(options);
        var gateway = new Gateway { ThrowAfterDelete = true };
        ScreeningReportDeletionClaim original;
        await using (var first = new DataContext(options))
        {
            original = (await Service(first, gateway).ClaimNextDueReportAsync(10))!;
            (await Service(first, gateway).ExecuteClaimAsync(original)).Should().BeFalse();
        }
        gateway.ThrowAfterDelete = false;
        gateway.DeletionStatus = ScreeningReportDeletionStatus.Deleted;
        await using (var recovery = new DataContext(options))
        {
            var reclaimed = await Service(recovery, gateway, Now.AddMinutes(6)).ClaimNextDueReportAsync(10);
            reclaimed.Should().NotBeNull();
            reclaimed!.ProviderIdempotencyKey.Should().Be(original.ProviderIdempotencyKey);
            (await Service(recovery, gateway, Now.AddMinutes(6)).ExecuteClaimAsync(reclaimed)).Should().BeTrue();
        }
        gateway.DeleteCalls.Should().Be(1);
        gateway.IntrospectionCalls.Should().Be(1);
        await using var verify = new DataContext(options);
        (await verify.ScreeningReportDeletionEvents.Select(x => x.EventType).ToListAsync())
            .Should().Contain(ScreeningReportDeletionEventType.ProviderOutcomeAmbiguous)
            .And.Contain(ScreeningReportDeletionEventType.ProviderDeletionReconciled);
    }

    [Fact]
    public async Task Hold_after_ambiguous_call_prevents_replay_and_leaves_durable_manual_incident()
    {
        var options = Options();
        await SeedAsync(options);
        var gateway = new Gateway { ThrowAfterDelete = true };
        await using (var first = new DataContext(options))
        {
            var claim = (await Service(first, gateway).ClaimNextDueReportAsync(10))!;
            (await Service(first, gateway).ExecuteClaimAsync(claim)).Should().BeFalse();
        }
        await using (var hold = new DataContext(options))
            await Service(hold, gateway).Invoking(x => x.PlaceLegalHoldAsync(10, 60, "litigation"))
                .Should().ThrowAsync<ScreeningDeletionSafetyConflictException>();
        gateway.ThrowAfterDelete = false;
        await using (var recovery = new DataContext(options))
            (await Service(recovery, gateway, Now.AddMinutes(6)).ClaimNextDueReportAsync(10)).Should().BeNull();
        gateway.DeleteCalls.Should().Be(1);
        await using var verify = new DataContext(options);
        (await verify.ScreeningReportRevisions.SingleAsync()).DeletedAt.Should().BeNull();
        (await verify.ScreeningIncidents.AnyAsync(x => x.IncidentType == ScreeningIncidentType.ProviderDeletionHoldConflict))
            .Should().BeTrue();
    }

    private static TenantScreeningRetentionService Service(DataContext db, Gateway gateway, DateTimeOffset? now = null) =>
        new(db, gateway, new FixedClock(now ?? Now));

    private static DbContextOptions<DataContext> Options() => new DbContextOptionsBuilder<DataContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).EnableSensitiveDataLogging(false).Options;

    private static async Task SeedAsync(DbContextOptions<DataContext> options, string? applicantToken = null)
    {
        await using var db = new DataContext(options);
        db.Organizations.Add(new Organization { Id = 10, Name = "Org" });
        var order = new TenantScreeningOrder { Id = 30, OrganizationId = 10, RentalApplicationId = 70, PropertyId = 20,
            ProviderKey = "provider", ProviderOrderId = "po-1", JurisdictionCode = "CA", RentalCriteriaVersion = "v1", CreatedAt = Now.AddDays(-10) };
        order.ApplyTransition(ScreeningStatus.Complete, 1, Now.AddDays(-2));
        if (applicantToken is not null)
        {
            order.ApplicantAccessTokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(
                $"property-peace-applicant-invitation-v1\n{applicantToken}"))).ToLowerInvariant();
            order.ApplicantAccessExpiresAt = Now.AddDays(1);
        }
        db.TenantScreeningOrders.Add(order);
        db.ScreeningReportRevisions.Add(new ScreeningReportRevision { Id = 60, TenantScreeningOrderId = 30, OrganizationId = 10,
            Revision = 1, ProviderKey = "provider", ProviderReportReference = "report-ref", ReceivedAt = Now.AddDays(-9),
            ProviderOccurredAt = Now.AddDays(-9), Status = ScreeningReportStatus.Complete, ReportVersion = "v1",
            NormalizedFactsJson = "{}", NormalizedFactsSha256Hash = new string('a', 64), RetentionExpiresAt = Now.AddMinutes(-1) });
        await db.SaveChangesAsync();
    }

    private sealed class Gateway : IScreeningProviderGateway
    {
        public int DeleteCalls { get; private set; }
        public int DisputeCalls { get; private set; }
        public Func<Task>? BeforeDelete { get; set; }
        public Func<Task>? BeforeDispute { get; set; }
        public bool ThrowAfterDelete { get; set; }
        public ScreeningReportDeletionStatus DeletionStatus { get; set; } = ScreeningReportDeletionStatus.Unknown;
        public int IntrospectionCalls { get; private set; }
        public async Task<ScreeningProviderOperationResult> OpenDisputeAsync(ScreeningProviderDisputeRequest request, CancellationToken cancellationToken = default)
        { DisputeCalls++; if (BeforeDispute is not null) await BeforeDispute(); return new("dispute-ref", "accepted"); }
        public async Task<ScreeningProviderOperationResult> DeleteReportAsync(ScreeningReportDeletionRequest request, CancellationToken cancellationToken = default)
        { DeleteCalls++; if (BeforeDelete is not null) await BeforeDelete(); if (ThrowAfterDelete) throw new TimeoutException(); return new("delete-ref", "deleted"); }
        public Task<ScreeningReportDeletionSnapshot> IntrospectReportDeletionAsync(ScreeningReportDeletionRequest request,
            CancellationToken cancellationToken = default)
        { IntrospectionCalls++; return Task.FromResult(new ScreeningReportDeletionSnapshot(DeletionStatus, "status-ref")); }
        public Task<AuthoritativeScreeningQuote> GetAuthoritativeQuoteAsync(ScreeningQuoteRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<ApplicantHostedSessionResult> CreateApplicantHostedSessionAsync(CreateApplicantScreeningSessionRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<NormalizedScreeningStatusUpdate> GetStatusAsync(ScreeningStatusRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }

    private sealed class FixedClock(DateTimeOffset now) : TimeProvider { public override DateTimeOffset GetUtcNow() => now; }
}
