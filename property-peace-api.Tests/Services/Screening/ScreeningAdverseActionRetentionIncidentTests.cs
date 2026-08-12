using brownstone_hub_api.Data;
using brownstone_hub_api.Domain.Screening;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.Screening;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Screening;

public sealed class ScreeningAdverseActionRetentionIncidentTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 7, 12, 0, 0, TimeSpan.Zero);

    [Theory]
    [InlineData(ScreeningRentalDecision.Approved)]
    [InlineData(ScreeningRentalDecision.Deferred)]
    public async Task Adverse_action_rejects_ineligible_human_decisions(ScreeningRentalDecision decision)
    {
        await using var h = await Harness.CreateAsync(decision);
        await h.Adverse.Invoking(x => x.CreateAndDeliverAsync(new(10, 100, 30, 50, ScreeningAdverseActionType.FinalAdverseAction, ScreeningAdverseActionDeliveryChannel.Email)))
            .Should().ThrowAsync<InvalidOperationException>();
        h.Policy.Calls.Should().Be(0);
        h.Delivery.Calls.Should().Be(0);
    }

    [Fact]
    public async Task Notice_content_is_server_owned_complete_hashed_before_delivery_and_result_is_redacted()
    {
        await using var h = await Harness.CreateAsync(ScreeningRentalDecision.Denied);
        h.Delivery.BeforeReturn = async request =>
        {
            (await h.Db.ScreeningAdverseActions.SingleAsync()).NoticeContentSha256Hash.Should().Be(request.NoticeContentSha256Hash);
            request.ImmutableContent.Should().ContainAll("Example CRA", "1 CRA Way", "800-555-0100", "did not make the rental decision",
                "dispute", "free copy", "30 days", "income", "CA-2026");
            request.ToString().Should().NotContain("Example CRA").And.NotContain("applicant@example.test");
        };

        var result = await h.Adverse.CreateAndDeliverAsync(new(10, 100, 30, 50, ScreeningAdverseActionType.FinalAdverseAction, ScreeningAdverseActionDeliveryChannel.Email));

        h.Policy.Calls.Should().Be(1);
        result.ToString().Should().NotContain("delivery-token").And.NotContain("Example CRA");
        var notice = await h.Db.ScreeningAdverseActions.SingleAsync();
        notice.NoticeVersion.Should().Be("notice-v7");
        notice.JurisdictionCode.Should().Be("CA");
        notice.ImmutableNoticeContent.Should().Be(h.Delivery.Requests.Single().ImmutableContent);
        notice.ImmutableNoticeContent.Should().Contain("California local disclosure CA-2026.");
        notice.GetType().GetProperties().Should().NotContain(x => x.Name == "NoticeBody" || x.Name == "NoticeContent");
        (await h.Db.ScreeningAdverseActionDeliveryAttempts.SingleAsync()).AttemptNumber.Should().Be(1);
    }

    [Fact]
    public async Task Delivery_intent_is_durable_and_requested_before_the_provider_is_called()
    {
        await using var h = await Harness.CreateAsync(ScreeningRentalDecision.Denied);
        h.Delivery.BeforeReturn = async request =>
        {
            var attempt = await h.Db.ScreeningAdverseActionDeliveryAttempts.SingleAsync();
            attempt.Status.Should().Be(ScreeningDeliveryAttemptStatus.Requested);
            attempt.AttemptedAt.Should().Be(Now);
            attempt.DeliveredAt.Should().BeNull();
            attempt.ProviderIdempotencyKey.Should().Be(request.ProviderIdempotencyKey);
        };

        await h.Adverse.CreateAndDeliverAsync(new(10, 100, 30, 50, ScreeningAdverseActionType.FinalAdverseAction,
            ScreeningAdverseActionDeliveryChannel.Email));
    }

    [Fact]
    public async Task Provider_exception_durably_finalizes_the_requested_attempt_without_raw_exception_data()
    {
        await using var h = await Harness.CreateAsync(ScreeningRentalDecision.Denied);
        h.Delivery.Exception = new InvalidOperationException("https://provider.test/private/raw-secret");

        await h.Adverse.Invoking(x => x.CreateAndDeliverAsync(new(10, 100, 30, 50,
                ScreeningAdverseActionType.FinalAdverseAction, ScreeningAdverseActionDeliveryChannel.Email)))
            .Should().ThrowAsync<InvalidOperationException>();

        var attempt = await h.Db.ScreeningAdverseActionDeliveryAttempts.SingleAsync();
        attempt.Status.Should().Be(ScreeningDeliveryAttemptStatus.Failed);
        attempt.FailureCode.Should().Be("DeliveryProviderException");
        attempt.ProviderDeliveryReference.Should().BeNull();
        attempt.ToString().Should().NotContain("provider.test").And.NotContain("raw-secret");
    }

    [Fact]
    public async Task Retry_reuses_stable_provider_key_appends_one_retry_attempt_and_does_not_resend_after_delivery()
    {
        await using var h = await Harness.CreateAsync(ScreeningRentalDecision.Denied);
        h.Delivery.Outcomes.Enqueue(new ScreeningNoticeDeliveryOutcome(ScreeningDeliveryAttemptStatus.Failed, null, null, "MailboxUnavailable"));
        var created = await h.Adverse.CreateAndDeliverAsync(new(10, 100, 30, 50,
            ScreeningAdverseActionType.FinalAdverseAction, ScreeningAdverseActionDeliveryChannel.Email));
        var firstKey = h.Delivery.Requests.Single().ProviderIdempotencyKey;
        h.Delivery.Outcomes.Enqueue(new ScreeningNoticeDeliveryOutcome(ScreeningDeliveryAttemptStatus.Delivered, "delivery-token", Now.AddMinutes(2), null));

        await h.Adverse.RetryDeliveryAsync(new(10, 100, created.AdverseActionId, ScreeningAdverseActionDeliveryChannel.Email));
        await h.Adverse.RetryDeliveryAsync(new(10, 100, created.AdverseActionId, ScreeningAdverseActionDeliveryChannel.Email));

        h.Delivery.Requests.Should().HaveCount(2).And.OnlyContain(x => x.ProviderIdempotencyKey == firstKey);
        h.Policy.Calls.Should().Be(1, "retry must use the persisted exact notice evidence");
        (await h.Db.ScreeningAdverseActions.CountAsync()).Should().Be(1);
        var attempts = await h.Db.ScreeningAdverseActionDeliveryAttempts.OrderBy(x => x.AttemptNumber).ToListAsync();
        attempts.Should().HaveCount(2);
        attempts.Select(x => x.AttemptNumber).Should().Equal(1, 2);
        attempts.Should().OnlyContain(x => x.ProviderIdempotencyKey == firstKey);
    }

    [Fact]
    public async Task Replayed_create_returns_the_existing_delivered_notice_without_another_provider_send()
    {
        await using var h = await Harness.CreateAsync(ScreeningRentalDecision.Denied);
        var command = new CreateScreeningAdverseActionCommand(10, 100, 30, 50,
            ScreeningAdverseActionType.FinalAdverseAction, ScreeningAdverseActionDeliveryChannel.Email);

        var first = await h.Adverse.CreateAndDeliverAsync(command);
        var replay = await h.Adverse.CreateAndDeliverAsync(command);

        replay.Should().Be(first);
        h.Policy.Calls.Should().Be(1);
        h.Delivery.Calls.Should().Be(1);
        (await h.Db.ScreeningAdverseActions.CountAsync()).Should().Be(1);
        (await h.Db.ScreeningAdverseActionDeliveryAttempts.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task Open_dispute_frozen_or_mismatched_decision_report_and_cross_org_are_rejected()
    {
        await using var h = await Harness.CreateAsync(ScreeningRentalDecision.Conditional);
        h.Decision.IsFrozenByDispute = true;
        await h.Db.SaveChangesAsync();
        await h.Adverse.Invoking(x => x.CreateAndDeliverAsync(new(10, 100, 30, 50, ScreeningAdverseActionType.PreAdverseAction, ScreeningAdverseActionDeliveryChannel.Email)))
            .Should().ThrowAsync<InvalidOperationException>();

        await using var mismatched = await Harness.CreateAsync(ScreeningRentalDecision.Conditional,
            reliedUponReportRevisionId: 999);
        await mismatched.Adverse.Invoking(x => x.CreateAndDeliverAsync(new(10, 100, 30, 50, ScreeningAdverseActionType.PreAdverseAction, ScreeningAdverseActionDeliveryChannel.Email)))
            .Should().ThrowAsync<ScreeningProviderCorrelationException>();

        await h.Adverse.Invoking(x => x.CreateAndDeliverAsync(new(11, 100, 30, 50, ScreeningAdverseActionType.PreAdverseAction, ScreeningAdverseActionDeliveryChannel.Email)))
            .Should().ThrowAsync<ScreeningAuthorizationException>();
    }

    [Theory]
    [InlineData(ScreeningReportStatus.Received, false)]
    [InlineData(ScreeningReportStatus.Superseded, false)]
    [InlineData(ScreeningReportStatus.Complete, true)]
    public async Task Adverse_action_requires_relied_upon_current_nondeleted_complete_or_corrected_latest_report(
        ScreeningReportStatus status, bool deleted)
    {
        await using var h = await Harness.CreateAsync(ScreeningRentalDecision.Denied, reportStatus: status);
        h.Report.DeletedAt = deleted ? Now.AddMinutes(-1) : null;
        await h.Db.SaveChangesAsync();

        await h.Adverse.Invoking(x => x.CreateAndDeliverAsync(new(10, 100, 30, 50,
                ScreeningAdverseActionType.FinalAdverseAction, ScreeningAdverseActionDeliveryChannel.Email)))
            .Should().ThrowAsync<InvalidOperationException>();
        h.Delivery.Calls.Should().Be(0);
    }

    [Fact]
    public async Task Adverse_action_rejects_a_relied_upon_report_that_is_not_the_latest_current_revision()
    {
        await using var h = await Harness.CreateAsync(ScreeningRentalDecision.Denied);
        h.Db.ScreeningReportRevisions.Add(new ScreeningReportRevision
        {
            Id = 61, TenantScreeningOrderId = 30, OrganizationId = 10, Revision = 2, ProviderKey = "provider",
            ProviderReportReference = "report-ref-2", ReceivedAt = Now, Status = ScreeningReportStatus.Corrected,
            ReportVersion = "v2", NormalizedFactsJson = "{}", NormalizedFactsSha256Hash = new string('e', 64),
            SupersedesScreeningReportRevisionId = 60, RetentionExpiresAt = Now.AddDays(30)
        });
        await h.Db.SaveChangesAsync();

        await h.Adverse.Invoking(x => x.CreateAndDeliverAsync(new(10, 100, 30, 50,
                ScreeningAdverseActionType.FinalAdverseAction, ScreeningAdverseActionDeliveryChannel.Email)))
            .Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task Failed_delivery_and_retry_are_idempotent_and_content_immutable()
    {
        await using var h = await Harness.CreateAsync(ScreeningRentalDecision.Denied);
        h.Delivery.Outcomes.Enqueue(new ScreeningNoticeDeliveryOutcome(ScreeningDeliveryAttemptStatus.Failed, null, null, "MailboxUnavailable"));
        var created = await h.Adverse.CreateAndDeliverAsync(new(10, 100, 30, 50, ScreeningAdverseActionType.FinalAdverseAction, ScreeningAdverseActionDeliveryChannel.Email));
        h.Delivery.Outcomes.Enqueue(new ScreeningNoticeDeliveryOutcome(ScreeningDeliveryAttemptStatus.Delivered, "delivery-token", Now.AddMinutes(2), null));
        await h.Adverse.RetryDeliveryAsync(new(10, 100, created.AdverseActionId, ScreeningAdverseActionDeliveryChannel.Email));

        var attempts = await h.Db.ScreeningAdverseActionDeliveryAttempts.OrderBy(x => x.AttemptNumber).ToListAsync();
        attempts.Should().HaveCount(2);
        attempts.Select(x => x.AttemptNumber).Should().Equal(1, 2);
        attempts.Should().OnlyContain(x => x.NoticeContentSha256Hash ==
            h.Db.ScreeningAdverseActions.Single().NoticeContentSha256Hash);
        attempts[0].Status.Should().Be(ScreeningDeliveryAttemptStatus.Failed);
        attempts[1].Status.Should().Be(ScreeningDeliveryAttemptStatus.Delivered);
        attempts[1].ProviderIdempotencyKey.Should().Be(attempts[0].ProviderIdempotencyKey);
    }

    [Fact]
    public async Task Reconsideration_appends_history_and_resolution_may_reference_new_human_decision()
    {
        await using var h = await Harness.CreateAsync(ScreeningRentalDecision.Denied);
        var notice = await h.Adverse.CreateAndDeliverAsync(new(10, 100, 30, 50, ScreeningAdverseActionType.FinalAdverseAction, ScreeningAdverseActionDeliveryChannel.Email));
        await h.Adverse.RequestReconsiderationAsync(new(10, 100, notice.AdverseActionId, "applicant-request"));
        var replacement = h.AddDecision(51, ScreeningRentalDecision.Approved, 2);
        await h.Db.SaveChangesAsync();
        await h.Adverse.ResolveReconsiderationAsync(new(10, 100, notice.AdverseActionId, "review-complete", replacement.Id));

        var events = await h.Db.ScreeningReconsiderationEvents.OrderBy(x => x.Revision).ToListAsync();
        events.Select(x => x.ToStatus).Should().Equal(ScreeningReconsiderationStatus.Requested, ScreeningReconsiderationStatus.Resolved);
        events[1].NewScreeningRentalDecisionRevisionId.Should().Be(replacement.Id);
        (await h.Db.ScreeningAdverseActions.SingleAsync()).OriginalScreeningRentalDecisionRevisionId.Should().Be(50);
    }

    [Fact]
    public async Task Retention_gates_legal_hold_and_open_dispute_then_deletes_idempotently_and_minimizes_facts()
    {
        await using var h = await Harness.CreateAsync(ScreeningRentalDecision.Denied, retentionExpired: true);
        h.Report.IsUnderLegalHold = true;
        await h.Db.SaveChangesAsync();
        (await h.Retention.DeleteDueReportsAsync(10)).Should().Be(0);
        h.Report.IsUnderLegalHold = false;
        await h.Db.SaveChangesAsync();
        h.Db.ScreeningDisputes.Add(new ScreeningDispute { LocalDisputeId = Guid.NewGuid(), TenantScreeningOrderId = 30, OrganizationId = 10,
            ProviderKey = "provider", ProviderDisputeReference = "d1", Status = ScreeningDisputeStatus.Investigating, OpenedAt = Now,
            OriginalScreeningReportRevisionId = 60, IssueCodesJson = "[]", NotesSha256Hash = new string('b', 64), RetentionExpiresAt = Now.AddDays(1) });
        await h.Db.SaveChangesAsync();
        (await h.Retention.DeleteDueReportsAsync(10)).Should().Be(0);
        (await h.Db.ScreeningDisputes.SingleAsync()).Status = ScreeningDisputeStatus.Resolved;
        await h.Db.SaveChangesAsync();

        (await h.Retention.DeleteDueReportsAsync(10)).Should().Be(1);
        (await h.Retention.DeleteDueReportsAsync(10)).Should().Be(0);
        h.Gateway.DeleteCalls.Should().Be(1);
        var report = await h.Db.ScreeningReportRevisions.SingleAsync();
        report.DeleteRequestedAt.Should().NotBeNull();
        report.DeletedAt.Should().Be(Now);
        report.NormalizedFactsJson.Should().Be("{}");
        report.NormalizedFactsSha256Hash.Should().Be(new string('a', 64));
        (await h.Db.ScreeningRentalDecisionRevisions.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task Incident_recorder_persists_only_bounded_classification_hashes_and_append_only_status_events()
    {
        await using var h = await Harness.CreateAsync(ScreeningRentalDecision.Denied);
        var recorder = new ScreeningIncidentRecorder(h.Db, new FixedClock(Now));
        var incident = await recorder.RecordAsync(new ScreeningIncidentRecord(10, 30, "provider", "evt-secret",
            ScreeningIncidentType.WebhookIntegrityConflict, ScreeningIncidentSeverity.High, "callback-integrity", "raw secret narrative",
            "detect-ref", null, null));
        await recorder.ChangeStatusAsync(incident.Id, ScreeningIncidentStatus.Contained, 100, "contain-ref");

        var saved = await h.Db.ScreeningIncidents.SingleAsync();
        saved.AffectedResourceSha256Hash.Should().HaveLength(64);
        saved.DetectionSource.Should().Be("callback-integrity");
        saved.ToString().Should().NotContain("evt-secret").And.NotContain("raw secret narrative");
        typeof(ScreeningIncident).GetProperties().Should().NotContain(x => x.Name.Contains("Payload") || x.Name.Contains("Narrative"));
        (await h.Db.ScreeningIncidentEvents.OrderBy(x => x.Revision).Select(x => x.Status).ToListAsync())
            .Should().Equal(ScreeningIncidentStatus.Detected, ScreeningIncidentStatus.Contained);
    }

    [Fact]
    public async Task Incident_record_save_failure_leaves_neither_aggregate_nor_initial_event()
    {
        // EF InMemory does not support transactions. This context therefore rejects the save as soon as
        // the initial event is present. With the old two-save implementation the aggregate has already
        // escaped into the shared store; a single atomic save leaves the store entirely unchanged.
        var databaseName = Guid.NewGuid().ToString();
        var options = new DbContextOptionsBuilder<DataContext>().UseInMemoryDatabase(databaseName).Options;
        await using (var failingDb = new RejectIncidentAggregateSaveDataContext(options))
        {
            var recorder = new ScreeningIncidentRecorder(failingDb, new FixedClock(Now));

            await recorder.Invoking(x => x.RecordAsync(new ScreeningIncidentRecord(10, 30, "provider", "event-1",
                    ScreeningIncidentType.WebhookIntegrityConflict, ScreeningIncidentSeverity.High, "callback-integrity",
                    "resource-1", "detect-ref", null, null)))
                .Should().ThrowAsync<DbUpdateException>();
        }

        await using var verificationDb = new DataContext(options);
        (await verificationDb.ScreeningIncidents.CountAsync()).Should().Be(0);
        (await verificationDb.ScreeningIncidentEvents.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Incident_status_revision_race_returns_typed_conflict()
    {
        var databaseName = Guid.NewGuid().ToString();
        var options = new DbContextOptionsBuilder<DataContext>().UseInMemoryDatabase(databaseName).Options;
        long incidentId;
        await using (var setupDb = new DataContext(options))
        {
            incidentId = (await new ScreeningIncidentRecorder(setupDb, new FixedClock(Now)).RecordAsync(
                new ScreeningIncidentRecord(10, 30, "provider", "event-1", ScreeningIncidentType.WebhookIntegrityConflict,
                    ScreeningIncidentSeverity.High, "callback-integrity", "resource-1", "detect-ref", null, null))).Id;
        }

        await using var racingDb = new RejectIncidentStatusRevisionSaveDataContext(options);
        var recorder = new ScreeningIncidentRecorder(racingDb, new FixedClock(Now));
        await recorder.Invoking(x => x.ChangeStatusAsync(incidentId, ScreeningIncidentStatus.Contained, 100, "contain-ref"))
            .Should().ThrowAsync<ScreeningIncidentConflictException>();
    }

    private sealed class Harness : IAsyncDisposable
    {
        public required DataContext Db { get; init; }
        public required TenantScreeningAdverseActionService Adverse { get; init; }
        public required TenantScreeningRetentionService Retention { get; init; }
        public required Policy Policy { get; init; }
        public required Delivery Delivery { get; init; }
        public required Gateway Gateway { get; init; }
        public required ScreeningReportRevision Report { get; init; }
        public required ScreeningRentalDecisionRevision Decision { get; init; }

        public static async Task<Harness> CreateAsync(ScreeningRentalDecision decision, bool retentionExpired = false,
            ScreeningReportStatus reportStatus = ScreeningReportStatus.Complete,
            long? reliedUponReportRevisionId = 60)
        {
            var db = new DataContext(new DbContextOptionsBuilder<DataContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
            db.Organizations.AddRange(new Organization { Id = 10, Name = "Org" }, new Organization { Id = 11, Name = "Other" });
            db.Users.Add(new User { Id = 100, Email = "staff@example.test", FirstName = "S", LastName = "U" });
            db.OrganizationMembers.Add(new OrganizationMember { Id = 1, OrganizationId = 10, UserId = 100, Role = "Manager", IsActive = true });
            db.Properties.Add(new Property { Id = 20, OrganizationId = 10, LandlordId = 100, State = "CA", StreetAddress = "1 Main", City = "X", ZipCode = "00000" });
            var order = new TenantScreeningOrder { Id = 30, OrganizationId = 10, RentalApplicationId = 70, PropertyId = 20,
                ProviderKey = "provider", ProviderOrderId = "po-1", JurisdictionCode = "CA", RentalCriteriaVersion = "criteria-v1", CreatedAt = Now };
            order.ApplyTransition(ScreeningStatus.Complete, 1, Now.AddDays(-1));
            db.TenantScreeningOrders.Add(order);
            var report = new ScreeningReportRevision { Id = 60, TenantScreeningOrderId = 30, OrganizationId = 10, Revision = 1,
                ProviderKey = "provider", ProviderReportReference = "report-ref", ReceivedAt = Now.AddDays(-10), Status = reportStatus,
                ReportVersion = "v1", NormalizedFactsJson = "{\"score\":\"600\"}", NormalizedFactsSha256Hash = new string('a', 64),
                RetentionExpiresAt = retentionExpired ? Now.AddMinutes(-1) : Now.AddDays(30) };
            db.ScreeningReportRevisions.Add(report);
            var revision = new ScreeningRentalDecisionRevision { Id = 50, TenantScreeningOrderId = 30, OrganizationId = 10, RentalApplicationId = 70,
                Revision = 1, DecisionActorUserId = 100, Decision = decision, CriteriaVersion = "criteria-v1", CriteriaSnapshotSha256Hash = new string('c', 64),
                ReliedUponScreeningReportRevisionId = reliedUponReportRevisionId, ReasonCodesJson = "[\"income\"]", CreatedAt = Now.AddMinutes(-10), DisputeStatus = ScreeningDecisionDisputeStatus.None };
            db.ScreeningRentalDecisionRevisions.Add(revision);
            await db.SaveChangesAsync();
            var policy = new Policy(); var delivery = new Delivery(); var gateway = new Gateway(); var clock = new FixedClock(Now);
            return new Harness { Db = db, Policy = policy, Delivery = delivery, Gateway = gateway, Report = report, Decision = revision,
                Adverse = new TenantScreeningAdverseActionService(db, policy, delivery, clock), Retention = new TenantScreeningRetentionService(db, gateway, clock) };
        }

        public ScreeningRentalDecisionRevision AddDecision(long id, ScreeningRentalDecision decision, long revision)
        {
            var x = new ScreeningRentalDecisionRevision { Id = id, TenantScreeningOrderId = 30, OrganizationId = 10, RentalApplicationId = 70,
                Revision = revision, DecisionActorUserId = 100, Decision = decision, CriteriaVersion = "criteria-v1", CriteriaSnapshotSha256Hash = new string('d', 64),
                ReliedUponScreeningReportRevisionId = 60, ReasonCodesJson = "[\"review\"]", CreatedAt = Now, DisputeStatus = ScreeningDecisionDisputeStatus.None };
            Db.ScreeningRentalDecisionRevisions.Add(x); return x;
        }
        public ValueTask DisposeAsync() => Db.DisposeAsync();
    }

    private sealed class Policy : IAdverseActionPolicyResolver
    {
        public int Calls { get; private set; }
        public Task<AdverseActionPolicySnapshot> ResolveAsync(AdverseActionPolicyResolutionRequest request, CancellationToken cancellationToken = default)
        {
            Calls++;
            return Task.FromResult(new AdverseActionPolicySnapshot("notice-v7", "statute-v4", "CA-2026", "CA", "Example CRA", "1 CRA Way", "800-555-0100",
                "The CRA did not make the rental decision.", "You may dispute inaccurate information.", "You may obtain a free copy of your report within 30 days.",
                "California local disclosure CA-2026.", true));
        }
    }
    private sealed class Delivery : IScreeningNoticeDelivery
    {
        public int Calls { get; private set; }
        public List<ScreeningNoticeDeliveryRequest> Requests { get; } = [];
        public Queue<ScreeningNoticeDeliveryOutcome> Outcomes { get; } = new();
        public Exception? Exception { get; set; }
        public Func<ScreeningNoticeDeliveryRequest, Task>? BeforeReturn { get; set; }
        public async Task<ScreeningNoticeDeliveryOutcome> DeliverAsync(ScreeningNoticeDeliveryRequest request, CancellationToken cancellationToken = default)
        {
            Calls++; Requests.Add(request); if (BeforeReturn is not null) await BeforeReturn(request);
            if (Exception is not null) throw Exception;
            return Outcomes.Count == 0 ? new(ScreeningDeliveryAttemptStatus.Delivered, "delivery-token", Now, null) : Outcomes.Dequeue();
        }
    }
    private sealed class Gateway : IScreeningProviderGateway
    {
        public int DeleteCalls { get; private set; }
        public Task<ScreeningProviderOperationResult> DeleteReportAsync(ScreeningReportDeletionRequest request, CancellationToken cancellationToken = default)
        { DeleteCalls++; return Task.FromResult(new ScreeningProviderOperationResult("delete-ref", "deleted")); }
        public Task<AuthoritativeScreeningQuote> GetAuthoritativeQuoteAsync(ScreeningQuoteRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<ApplicantHostedSessionResult> CreateApplicantHostedSessionAsync(CreateApplicantScreeningSessionRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<NormalizedScreeningStatusUpdate> GetStatusAsync(ScreeningStatusRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }
    private sealed class FixedClock(DateTimeOffset now) : TimeProvider { public override DateTimeOffset GetUtcNow() => now; }

    private sealed class RejectIncidentAggregateSaveDataContext(DbContextOptions<DataContext> options) : DataContext(options)
    {
        public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            if (ChangeTracker.Entries<ScreeningIncidentEvent>().Any(x => x.State == EntityState.Added))
                throw new DbUpdateException("Simulated relational failure of the incident aggregate save.");

            return await base.SaveChangesAsync(cancellationToken);
        }
    }

    private sealed class RejectIncidentStatusRevisionSaveDataContext(DbContextOptions<DataContext> options) : DataContext(options)
    {
        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            if (ChangeTracker.Entries<ScreeningIncidentEvent>().Any(x => x.State == EntityState.Added && x.Entity.Revision > 1))
                throw new DbUpdateException("Simulated unique incident revision race.");

            return base.SaveChangesAsync(cancellationToken);
        }
    }
}
