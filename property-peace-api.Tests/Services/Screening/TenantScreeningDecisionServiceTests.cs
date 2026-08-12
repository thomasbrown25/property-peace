using brownstone_hub_api.Data;
using brownstone_hub_api.Domain.Screening;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.Screening;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Screening;

public sealed class TenantScreeningDecisionServiceTests
{
    [Fact]
    public void Report_access_contract_rejects_untrusted_or_unsafe_locations_and_redacts_output()
    {
        var now = new DateTimeOffset(2026, 8, 7, 12, 0, 0, TimeSpan.Zero);
        FluentActions.Invoking(() => ScreeningReportAccessResult.Create(
                new Uri("https://evil.test/report"), now.AddMinutes(5), "grant", [new Uri("https://reports.provider.test/")], now))
            .Should().Throw<ArgumentException>();
        FluentActions.Invoking(() => ScreeningReportAccessResult.Create(
                new Uri("http://reports.provider.test/report"), now.AddMinutes(5), "grant", [new Uri("https://reports.provider.test/")], now))
            .Should().Throw<ArgumentException>();
        var result = ScreeningReportAccessResult.Create(new Uri("https://reports.provider.test/secret"), now.AddMinutes(5),
            "grant-secret", [new Uri("https://reports.provider.test/")], now);
        result.ToString().Should().NotContain("secret");
    }

    [Fact]
    public async Task Report_revisions_are_sequential_hashed_and_corrections_preserve_history()
    {
        await using var h = await Harness.CreateAsync();
        var firstOccurred = h.Now.AddHours(-2);
        var firstRetrieved = h.Now.AddHours(-1);
        var first = await h.Service.RecordReportRevisionAsync(new RecordScreeningReportRevisionCommand(
            "provider", "po-1", "report-1", "v1", ScreeningReportStatus.Complete,
            new Dictionary<string, string> { ["riskBand"] = "low", ["score"] = "700" }, null, TimeSpan.FromDays(30),
            firstOccurred, firstRetrieved, ScreeningReportRetentionSignal.LegalRequirement));
        var second = await h.Service.RecordReportRevisionAsync(new RecordScreeningReportRevisionCommand(
            "provider", "po-1", "report-2", "v2", ScreeningReportStatus.Corrected,
            new Dictionary<string, string> { ["score"] = "710", ["riskBand"] = "low" }, first.Id, TimeSpan.FromDays(30),
            h.Now.AddMinutes(-2), h.Now.AddMinutes(-1), ScreeningReportRetentionSignal.OrganizationPolicy));

        second.Revision.Should().Be(2);
        second.SupersedesScreeningReportRevisionId.Should().Be(first.Id);
        second.NormalizedFactsSha256Hash.Should().HaveLength(64);
        var history = await h.Db.ScreeningReportRevisions.OrderBy(x => x.Revision).ToListAsync();
        history.Should().HaveCount(2);
        history[0].Status.Should().Be(ScreeningReportStatus.Complete, "correction links must not mutate original evidence");
        history[0].ProviderOccurredAt.Should().Be(firstOccurred);
        history[0].ReceivedAt.Should().Be(firstRetrieved);
        history[0].RetentionSignal.Should().Be(ScreeningReportRetentionSignal.LegalRequirement);
        history[1].RetentionSignal.Should().Be(ScreeningReportRetentionSignal.OrganizationPolicy);
    }

    [Theory]
    [InlineData("ssn", "123-45-6789")]
    [InlineData("taxpayerIdentificationNumber", "12-3456789")]
    [InlineData("dateOfBirth", "1990-01-02")]
    [InlineData("reportUrl", "https://provider.test/raw-report")]
    [InlineData("applicantName", "Jane Applicant")]
    [InlineData("applicantAddress", "1 Main Street")]
    [InlineData("freeText", "Jane Applicant lives at 1 Main Street")]
    [InlineData("bankAccountNumber", "1234567890123456")]
    [InlineData("providerMysteryFact", "low")]
    [InlineData("riskBand", "123-45-6789")]
    [InlineData("riskBand", "1990-01-02")]
    [InlineData("riskBand", "https://provider.test/raw-report")]
    [InlineData("riskBand", "1234567890123456")]
    [InlineData("riskBand", "Jane Applicant lives at 1 Main Street")]
    public async Task Report_facts_reject_non_allowlisted_or_sensitive_identity_data(string key, string value)
    {
        await using var h = await Harness.CreateAsync();

        await FluentActions.Invoking(() => h.Service.RecordReportRevisionAsync(new(
                "provider", "po-1", "unsafe-report", "v1", ScreeningReportStatus.Complete,
                new Dictionary<string, string> { [key] = value }, null, TimeSpan.FromDays(30),
                h.Now.AddMinutes(-2), h.Now.AddMinutes(-1), ScreeningReportRetentionSignal.ProviderPolicy)))
            .Should().ThrowAsync<ArgumentException>();

        (await h.Db.ScreeningReportRevisions.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Access_is_org_scoped_short_lived_audited_without_persisting_or_rendering_uri()
    {
        await using var h = await Harness.CreateAsync();
        await h.AddReportAsync();
        var result = await h.Service.RequestReportAccessAsync(10, 100, 30, ScreeningReportAccessPurpose.RentalDecision);
        result.AccessUri.AbsoluteUri.Should().Contain("one-time-secret");
        result.ToString().Should().NotContain("one-time-secret");
        var audit = await h.Db.ScreeningReportAccessAudits.SingleAsync();
        audit.GrantReference.Should().Be("grant-1");
        audit.GetType().GetProperties().Should().NotContain(p => p.Name.Contains("Uri") || p.Name.Contains("Url"));
        (await h.Db.ScreeningReportAccessAudits.AsNoTracking().SingleAsync()).ToString().Should().NotContain("one-time-secret");
        await FluentActions.Invoking(() => h.Service.RequestReportAccessAsync(11, 100, 30, ScreeningReportAccessPurpose.RentalDecision))
            .Should().ThrowAsync<ScreeningAuthorizationException>();
    }

    [Fact]
    public async Task Applicant_report_access_is_token_scoped_dispute_only_and_audited_without_fake_staff_actor()
    {
        await using var h = await Harness.CreateAsync();
        await h.AddReportAsync();

        var result = await h.Service.RequestApplicantReportAccessAsync("applicant-token", ScreeningReportAccessPurpose.DisputeReview);

        result.AccessUri.Should().Be(new Uri("https://reports.provider.test/one-time-secret"));
        var audit = await h.Db.ScreeningReportAccessAudits.SingleAsync();
        audit.ActorUserId.Should().BeNull();
        audit.Purpose.Should().Be(ScreeningReportAccessPurpose.DisputeReview);
        await FluentActions.Invoking(() => h.Service.RequestApplicantReportAccessAsync(
                "applicant-token", ScreeningReportAccessPurpose.RentalDecision))
            .Should().ThrowAsync<ScreeningReportAccessDeniedException>();
    }

    [Fact]
    public async Task Nonmember_cannot_fabricate_support_elevation()
    {
        await using var h = await Harness.CreateAsync(addMember: false);
        await h.AddReportAsync();
        await FluentActions.Invoking(() => h.Service.RequestReportAccessAsync(10, 900, 30,
                ScreeningReportAccessPurpose.SupportInvestigation, 12345))
            .Should().ThrowAsync<ScreeningAuthorizationException>();
        (await h.Db.ScreeningReportAccessAudits.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Organization_manager_cannot_use_support_purpose_without_platform_identity_and_active_elevation()
    {
        await using var h = await Harness.CreateAsync();
        await h.AddReportAsync();
        h.Db.ScreeningSupportElevations.Add(new ScreeningSupportElevation
        {
            Id = 50, OrganizationId = 10, SubjectUserId = 100, ApprovedByUserId = 900,
            CaseReference = "CASE-50", Reason = "Support investigation",
            Purpose = ScreeningReportAccessPurpose.SupportInvestigation, IssuedAt = h.Now,
            ExpiresAt = h.Now.AddMinutes(10), MaximumAccessCount = 1
        });
        await h.Db.SaveChangesAsync();

        await FluentActions.Invoking(() => h.Service.RequestReportAccessAsync(10, 100, 30,
                ScreeningReportAccessPurpose.SupportInvestigation))
            .Should().ThrowAsync<ScreeningAuthorizationException>();
        await FluentActions.Invoking(() => h.Service.RequestReportAccessAsync(10, 100, 30,
                ScreeningReportAccessPurpose.SupportInvestigation, 50))
            .Should().ThrowAsync<ScreeningAuthorizationException>();
        (await h.Db.ScreeningReportAccessAudits.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Decisions_require_human_authority_matching_criteria_and_report_and_freeze_during_dispute()
    {
        await using var h = await Harness.CreateAsync();
        var report = await h.AddReportAsync();
        var first = await h.Service.RecordHumanDecisionAsync(new RecordHumanScreeningDecisionCommand(10, 100, 30,
            ScreeningRentalDecision.Approved, "criteria-v1", report.Id, ["income-verified"]));
        var second = await h.Service.RecordHumanDecisionAsync(new RecordHumanScreeningDecisionCommand(10, 100, 30,
            ScreeningRentalDecision.Conditional, "criteria-v1", report.Id, ["deposit"]));
        second.Revision.Should().Be(2);
        second.SupersedesScreeningRentalDecisionRevisionId.Should().Be(first.Id);

        h.Db.ScreeningReportRevisions.Add(new ScreeningReportRevision { TenantScreeningOrderId = 31, OrganizationId = 10,
            Revision = 1, ProviderKey = "provider", ProviderReportReference = "other", ReceivedAt = h.Now,
            Status = ScreeningReportStatus.Complete, ReportVersion = "v1", NormalizedFactsJson = "{}",
            NormalizedFactsSha256Hash = new string('a', 64), RetentionExpiresAt = h.Now.AddDays(1) });
        await h.Db.SaveChangesAsync();
        var other = await h.Db.ScreeningReportRevisions.SingleAsync(x => x.ProviderReportReference == "other");
        await FluentActions.Invoking(() => h.Service.RecordHumanDecisionAsync(new(10, 100, 30, ScreeningRentalDecision.Denied, "criteria-v1", other.Id, ["x"])))
            .Should().ThrowAsync<ScreeningProviderCorrelationException>();

        await h.Service.OpenDisputeAsync(ScreeningDisputeOpenCommand.ForStaff(10, 100, 30, report.Id, ["identity"], "private narrative"));
        await FluentActions.Invoking(() => h.Service.RecordHumanDecisionAsync(new(10, 100, 30, ScreeningRentalDecision.Deferred, "criteria-v1", report.Id, ["dispute"])))
            .Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task Adverse_capable_decision_requires_a_report_revision()
    {
        await using var h = await Harness.CreateAsync();
        await h.AddReportAsync();

        await FluentActions.Invoking(() => h.Service.RecordHumanDecisionAsync(new(10, 100, 30,
                ScreeningRentalDecision.Denied, "criteria-v1", null, ["criteria-not-met"])))
            .Should().ThrowAsync<ScreeningProviderCorrelationException>();
        (await h.Db.ScreeningRentalDecisionRevisions.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Adverse_capable_decision_rejects_deleted_report_revision()
    {
        await using var h = await Harness.CreateAsync();
        var report = await h.AddReportAsync();
        report.DeleteRequestedAt = h.Now;
        report.DeletedAt = h.Now;
        await h.Db.SaveChangesAsync();

        await FluentActions.Invoking(() => h.Service.RecordHumanDecisionAsync(new(10, 100, 30,
                ScreeningRentalDecision.Conditional, "criteria-v1", report.Id, ["deposit"])))
            .Should().ThrowAsync<ScreeningProviderCorrelationException>();
        (await h.Db.ScreeningRentalDecisionRevisions.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Adverse_capable_decision_rejects_incomplete_report_revision()
    {
        await using var h = await Harness.CreateAsync();
        var report = await h.Service.RecordReportRevisionAsync(new("provider", "po-1", "received-report", "v1",
            ScreeningReportStatus.Received, new Dictionary<string, string> { ["riskBand"] = "low" }, null, TimeSpan.FromDays(30),
            h.Now.AddMinutes(-2), h.Now.AddMinutes(-1), ScreeningReportRetentionSignal.ProviderPolicy));

        await FluentActions.Invoking(() => h.Service.RecordHumanDecisionAsync(new(10, 100, 30,
                ScreeningRentalDecision.Denied, "criteria-v1", report.Id, ["criteria-not-met"])))
            .Should().ThrowAsync<ScreeningProviderCorrelationException>();
        (await h.Db.ScreeningRentalDecisionRevisions.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Adverse_capable_decision_rejects_superseded_or_stale_report_revision()
    {
        await using var h = await Harness.CreateAsync();
        var original = await h.AddReportAsync();
        var corrected = await h.Service.RecordReportRevisionAsync(new("provider", "po-1", "corrected-report", "v2",
            ScreeningReportStatus.Corrected, new Dictionary<string, string> { ["riskBand"] = "low" }, original.Id, TimeSpan.FromDays(30),
            h.Now.AddMinutes(-2), h.Now.AddMinutes(-1), ScreeningReportRetentionSignal.ProviderPolicy));

        await FluentActions.Invoking(() => h.Service.RecordHumanDecisionAsync(new(10, 100, 30,
                ScreeningRentalDecision.Denied, "criteria-v1", original.Id, ["criteria-not-met"])))
            .Should().ThrowAsync<ScreeningProviderCorrelationException>();
        var accepted = await h.Service.RecordHumanDecisionAsync(new(10, 100, 30,
            ScreeningRentalDecision.Conditional, "criteria-v1", corrected.Id, ["deposit"]));
        accepted.ReliedUponScreeningReportRevisionId.Should().Be(corrected.Id);
    }

    [Fact]
    public async Task Adverse_capable_decision_rejects_an_older_non_superseded_report_revision()
    {
        await using var h = await Harness.CreateAsync();
        var older = await h.AddReportAsync();
        var latest = await h.Service.RecordReportRevisionAsync(new("provider", "po-1", "newer-report", "v2",
            ScreeningReportStatus.Complete, new Dictionary<string, string> { ["riskBand"] = "medium" }, null, TimeSpan.FromDays(30),
            h.Now.AddMinutes(-2), h.Now.AddMinutes(-1), ScreeningReportRetentionSignal.ProviderPolicy));

        await FluentActions.Invoking(() => h.Service.RecordHumanDecisionAsync(new(10, 100, 30,
                ScreeningRentalDecision.Conditional, "criteria-v1", older.Id, ["deposit"])))
            .Should().ThrowAsync<ScreeningProviderCorrelationException>();
        var accepted = await h.Service.RecordHumanDecisionAsync(new(10, 100, 30,
            ScreeningRentalDecision.Denied, "criteria-v1", latest.Id, ["criteria-not-met"]));
        accepted.ReliedUponScreeningReportRevisionId.Should().Be(latest.Id);
    }

    [Fact]
    public async Task Applicant_token_dispute_is_provider_idempotent_and_correction_update_preserves_original()
    {
        await using var h = await Harness.CreateAsync();
        var report = await h.AddReportAsync();
        var opened = await h.Service.OpenDisputeAsync(ScreeningDisputeOpenCommand.ForApplicant("applicant-token", report.Id, ["address"], "raw narrative"));
        var retry = await h.Service.OpenDisputeAsync(ScreeningDisputeOpenCommand.ForApplicant("applicant-token", report.Id, ["address"], "raw narrative"));
        retry.Id.Should().Be(opened.Id);
        h.Gateway.DisputeCalls.Should().Be(1);
        (await h.Db.ScreeningDisputes.SingleAsync()).NotesSha256Hash.Should().HaveLength(64);
        typeof(ScreeningDispute).GetProperties().Should().NotContain(p => p.Name.Contains("Narrative"));
        (await h.Db.TenantScreeningOrders.FindAsync(30L))!.Status.Should().Be(ScreeningStatus.Disputed);

        var corrected = await h.Service.RecordReportRevisionAsync(new("provider", "po-1", "report-corrected", "v2",
            ScreeningReportStatus.Corrected, new Dictionary<string, string> { ["riskBand"] = "low" }, report.Id, TimeSpan.FromDays(30),
            h.Now.AddMinutes(-2), h.Now.AddMinutes(-1), ScreeningReportRetentionSignal.ProviderPolicy));
        await h.Service.RecordDisputeUpdateAsync(new(opened.Id, "provider", "evt-2", ScreeningDisputeStatus.Resolved,
            ScreeningStatus.Complete, corrected.Id, h.Now, "corrected"));
        var dispute = await h.Db.ScreeningDisputes.SingleAsync();
        dispute.OriginalScreeningReportRevisionId.Should().Be(report.Id);
        dispute.CorrectedScreeningReportRevisionId.Should().Be(corrected.Id);
        (await h.Db.ScreeningDisputeEvents.CountAsync()).Should().Be(2);
        (await h.Db.TenantScreeningOrders.FindAsync(30L))!.Status.Should().Be(ScreeningStatus.Complete);
    }

    [Fact]
    public async Task Dispute_intent_is_durable_before_provider_execution_and_ambiguous_acceptance_is_recoverable()
    {
        await using var h = await Harness.CreateAsync();
        var report = await h.AddReportAsync();
        Guid? firstOperation = null;
        h.Gateway.DisputeBehavior = request =>
        {
            firstOperation = request.LocalDisputeId;
            h.Gateway.DisputeBehavior = null;
            throw new OperationCanceledException("provider outcome deliberately ambiguous");
        };

        await FluentActions.Invoking(() => h.Service.OpenDisputeAsync(
                ScreeningDisputeOpenCommand.ForApplicant("applicant-token", report.Id, ["address"], "raw narrative")))
            .Should().ThrowAsync<OperationCanceledException>();

        var intent = await h.Db.ScreeningDisputeIntents.AsNoTracking().SingleAsync();
        firstOperation.Should().NotBeNull();
        intent.OperationId.Should().Be(firstOperation.Value);
        intent.Status.Should().Be(ScreeningDisputeIntentStatus.Pending);
        (await h.Db.ScreeningReportRevisions.AsNoTracking().SingleAsync()).PendingDisputeOperationId
            .Should().Be(intent.OperationId);
        (await h.Db.ScreeningDisputes.CountAsync()).Should().Be(0);

        h.Clock.Advance(TimeSpan.FromMinutes(1));
        (await h.Service.ProcessPendingDisputeIntentsAsync(10, TimeSpan.FromMinutes(1))).Should().Be(1);

        h.Gateway.DisputeCalls.Should().Be(2);
        h.Gateway.DisputeOperationIds.Should().OnlyContain(x => x == firstOperation.Value);
        (await h.Db.ScreeningDisputes.CountAsync()).Should().Be(1);
        (await h.Db.ScreeningDisputeEvents.CountAsync()).Should().Be(1);
        (await h.Db.ScreeningDisputeIntents.AsNoTracking().SingleAsync()).Status
            .Should().Be(ScreeningDisputeIntentStatus.Completed);
        (await h.Db.ScreeningReportRevisions.AsNoTracking().SingleAsync()).PendingDisputeOperationId.Should().BeNull();
    }

    [Fact]
    public async Task Expiration_calls_provider_only_when_correlated_and_records_legal_transition()
    {
        await using var h = await Harness.CreateAsync(complete: false);
        await h.Service.CancelOrExpireAsync(new ScreeningOrderCancellationCommand(10, 100, 30, "invitation-expired"));
        h.Gateway.CancelCalls.Should().Be(1);
        (await h.Db.TenantScreeningOrders.FindAsync(30L))!.Status.Should().Be(ScreeningStatus.Expired);
        (await h.Db.ScreeningTransitionEvents.SingleAsync()).ToStatus.Should().Be(ScreeningStatus.Expired);
        h.Db.TenantScreeningOrders.Add(Harness.Order(32, null, ScreeningStatus.ConsentPending, h.Now));
        await h.Db.SaveChangesAsync();
        await h.Service.CancelOrExpireAsync(new(10, 100, 32, "invitation-expired"));
        h.Gateway.CancelCalls.Should().Be(1);
    }

    [Fact]
    public async Task Cancellation_intent_is_durable_before_provider_execution_and_retry_recovers_ambiguous_acceptance()
    {
        await using var h = await Harness.CreateAsync(complete: false);
        h.Gateway.CancelBehavior = _ =>
        {
            h.Gateway.CancelBehavior = null;
            throw new OperationCanceledException("acceptance outcome is deliberately ambiguous");
        };

        await FluentActions.Invoking(() => h.Service.CancelOrExpireAsync(
                new ScreeningOrderCancellationCommand(10, 100, 30, "invitation-expired")))
            .Should().ThrowAsync<OperationCanceledException>();

        var durable = await h.Db.ScreeningCancellationIntents.AsNoTracking().SingleAsync();
        durable.ExpectedOrderRevision.Should().Be(1);
        durable.Status.Should().Be(ScreeningCancellationIntentStatus.Pending);
        (await h.Db.TenantScreeningOrders.FindAsync(30L))!.Status.Should().Be(ScreeningStatus.ConsentPending);

        (await h.Db.OrganizationMembers.SingleAsync()).IsActive = false;
        await h.Db.SaveChangesAsync();
        await h.Service.Invoking(x => x.CancelOrExpireAsync(
                new ScreeningOrderCancellationCommand(10, 100, 30, "departed-actor-direct-retry")))
            .Should().ThrowAsync<ScreeningAuthorizationException>();

        h.Clock.Advance(TimeSpan.FromMinutes(1));
        (await h.Service.ProcessPendingCancellationIntentsAsync(10, TimeSpan.FromMinutes(1))).Should().Be(1);
        h.Gateway.CancelCalls.Should().Be(2, "ambiguous provider outcomes are retried with the same order correlation");
        (await h.Db.TenantScreeningOrders.FindAsync(30L))!.Status.Should().Be(ScreeningStatus.Expired);
        (await h.Db.ScreeningCancellationIntents.AsNoTracking().SingleAsync()).Status
            .Should().Be(ScreeningCancellationIntentStatus.Completed);
    }

    [Fact]
    public async Task Completion_wins_when_it_is_observed_before_cancellation_finalization()
    {
        await using var h = await Harness.CreateAsync(complete: false);
        h.Gateway.CancelBehavior = async _ =>
        {
            var order = await h.Db.TenantScreeningOrders.FindAsync(30L);
            order!.ApplyTransition(ScreeningStatus.Processing, 2, h.Now);
            order.ApplyTransition(ScreeningStatus.Complete, 3, h.Now);
            await h.Db.SaveChangesAsync();
            return new ScreeningProviderOperationResult("cancel-provider-1", "accepted");
        };

        await h.Service.CancelOrExpireAsync(new ScreeningOrderCancellationCommand(10, 100, 30, "requested"));

        (await h.Db.TenantScreeningOrders.FindAsync(30L))!.Status.Should().Be(ScreeningStatus.Complete);
        (await h.Db.ScreeningCancellationIntents.AsNoTracking().SingleAsync()).Status
            .Should().Be(ScreeningCancellationIntentStatus.SupersededByCompletion);
        (await h.Db.ScreeningTransitionEvents.AnyAsync(x => x.ToStatus == ScreeningStatus.Expired)).Should().BeFalse();
    }

    private sealed class Harness : IAsyncDisposable
    {
        public required DataContext Db { get; init; }
        public required TenantScreeningDecisionService Service { get; init; }
        public required Gateway Gateway { get; init; }
        public required AdjustableTimeProvider Clock { get; init; }
        public DateTimeOffset Now { get; init; }

        public static async Task<Harness> CreateAsync(bool addMember = true, bool complete = true)
        {
            var now = new DateTimeOffset(2026, 8, 7, 12, 0, 0, TimeSpan.Zero);
            var db = new DataContext(new DbContextOptionsBuilder<DataContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
            db.Organizations.AddRange(new Organization { Id = 10, Name = "Org" }, new Organization { Id = 11, Name = "Other" });
            db.Users.AddRange(new User { Id = 100, Email = "staff@test", FirstName = "S", LastName = "U" }, new User { Id = 900, Email = "support@test", FirstName = "X", LastName = "Y" });
            if (addMember) db.OrganizationMembers.Add(new OrganizationMember { Id = 1, OrganizationId = 10, UserId = 100, Role = "Manager", IsActive = true });
            db.Properties.Add(new Property { Id = 20, OrganizationId = 10, LandlordId = 100, State = "CA", StreetAddress = "1 Main", City = "X", ZipCode = "00000" });
            db.TenantScreeningOrders.Add(Order(30, "po-1", complete ? ScreeningStatus.Complete : ScreeningStatus.ConsentPending, now));
            db.TenantScreeningOrders.Add(Order(31, "po-2", ScreeningStatus.Complete, now));
            await db.SaveChangesAsync();
            var gateway = new Gateway(now);
            var clock = new AdjustableTimeProvider(now);
            return new Harness { Db = db, Gateway = gateway, Clock = clock, Now = now,
                Service = new TenantScreeningDecisionService(db, gateway, clock) };
        }

        public async Task<ScreeningReportRevision> AddReportAsync() => await Service.RecordReportRevisionAsync(new(
            "provider", "po-1", "report-1", "v1", ScreeningReportStatus.Complete,
            new Dictionary<string, string> { ["riskBand"] = "low" }, null, TimeSpan.FromDays(30),
            Now.AddMinutes(-4), Now.AddMinutes(-3), ScreeningReportRetentionSignal.ProviderPolicy));

        public static TenantScreeningOrder Order(long id, string? providerOrder, ScreeningStatus status, DateTimeOffset now)
        {
            var x = new TenantScreeningOrder { Id = id, OrganizationId = 10, RentalApplicationId = 40 + id, PropertyId = 20,
                ProviderKey = "provider", ProviderOrderId = providerOrder, RentalCriteriaVersion = "criteria-v1",
                RentalCriteriaStatement = "criteria", CreatedAt = now, QuoteExpiresAt = now.AddDays(1) };
            if (status != ScreeningStatus.Invited) x.ApplyTransition(status, 1, now);
            var rawToken = id == 30 ? "applicant-token" : $"other-token-{id}";
            x.SetApplicantAccess(Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes($"property-peace-applicant-invitation-v1\n{rawToken}"))).ToLowerInvariant(), now.AddDays(1));
            return x;
        }
        public ValueTask DisposeAsync() => Db.DisposeAsync();
    }

    private sealed class AdjustableTimeProvider(DateTimeOffset now) : TimeProvider
    {
        private DateTimeOffset _now = now;
        public override DateTimeOffset GetUtcNow() => _now;
        public void Advance(TimeSpan amount) => _now = _now.Add(amount);
    }

    private sealed class Gateway(DateTimeOffset now) : IScreeningProviderGateway
    {
        public int DisputeCalls { get; private set; }
        public int CancelCalls { get; private set; }
        public List<Guid> DisputeOperationIds { get; } = [];
        public Func<ScreeningProviderDisputeRequest, Task<ScreeningProviderOperationResult>>? DisputeBehavior { get; set; }
        public Func<ScreeningCancellationRequest, Task<ScreeningProviderOperationResult>>? CancelBehavior { get; set; }
        public Task<ScreeningReportAccessResult> GetReportAccessAsync(ScreeningReportAccessRequest request, CancellationToken cancellationToken = default) =>
            Task.FromResult(ScreeningReportAccessResult.Create(new Uri("https://reports.provider.test/one-time-secret"), now.AddMinutes(5), "grant-1", [new Uri("https://reports.provider.test/")], now));
        public Task<ScreeningProviderOperationResult> OpenDisputeAsync(ScreeningProviderDisputeRequest request, CancellationToken cancellationToken = default)
        {
            DisputeCalls++;
            DisputeOperationIds.Add(request.LocalDisputeId);
            return DisputeBehavior?.Invoke(request) ?? Task.FromResult(new ScreeningProviderOperationResult("dispute-provider-1", "accepted"));
        }
        public Task<ScreeningProviderOperationResult> CancelOrExpireAsync(ScreeningCancellationRequest request, CancellationToken cancellationToken = default)
        {
            CancelCalls++;
            return CancelBehavior?.Invoke(request) ?? Task.FromResult(new ScreeningProviderOperationResult("cancel-provider-1", "accepted"));
        }
        public Task<AuthoritativeScreeningQuote> GetAuthoritativeQuoteAsync(ScreeningQuoteRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<ApplicantHostedSessionResult> CreateApplicantHostedSessionAsync(CreateApplicantScreeningSessionRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<NormalizedScreeningStatusUpdate> GetStatusAsync(ScreeningStatusRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }
}
