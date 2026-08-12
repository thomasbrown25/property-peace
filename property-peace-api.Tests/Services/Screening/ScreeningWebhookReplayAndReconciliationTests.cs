using System.Text;
using brownstone_hub_api.Data;
using brownstone_hub_api.Domain.Screening;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.Screening;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Screening;

public sealed class ScreeningWebhookReplayAndReconciliationTests
{
    private static readonly DateTimeOffset ProviderTime = new(2026, 8, 7, 10, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset ReceiptTime = new(2026, 8, 7, 12, 0, 0, TimeSpan.Zero);

    [Theory]
    [InlineData(ScreeningStatus.Processing)]
    [InlineData(ScreeningStatus.Complete)]
    public async Task Applicant_paid_order_with_initiation_only_cannot_leave_payment_pending(ScreeningStatus providerStatus)
    {
        await using var h = await Harness.CreateAsync(addOrder: false);
        h.AddPaymentPendingOrder();
        await h.Db.SaveChangesAsync();
        h.Verifier.Envelope = Envelope("initiation-only", "provider-order-1", providerStatus);

        var result = await h.Service.ApplyVerifiedCallbackAsync("provider-a", Request("signed"));

        result.Outcome.Should().Be(ScreeningCallbackOutcome.Rejected);
        (await h.Db.TenantScreeningOrders.SingleAsync()).Status.Should().Be(ScreeningStatus.PaymentPending);
        (await h.Db.ScreeningPaymentEvidence.ToListAsync()).Should().ContainSingle()
            .Which.Status.Should().Be(ScreeningPaymentEventStatus.AuthorizationInitiated);
        h.Gateway.ReportRequests.Should().BeEmpty("a report must not be fetched before authoritative payment succeeds");
    }

    [Theory]
    [InlineData(ScreeningPaymentEventStatus.Failed, "declined")]
    [InlineData(ScreeningPaymentEventStatus.Refunded, null)]
    [InlineData(ScreeningPaymentEventStatus.Reversed, null)]
    public async Task Failed_refunded_or_reversed_payment_is_appended_without_advancing(
        ScreeningPaymentEventStatus paymentStatus, string? failureCode)
    {
        await using var h = await Harness.CreateAsync(addOrder: false);
        h.AddPaymentPendingOrder();
        await h.Db.SaveChangesAsync();
        h.Verifier.Envelope = Envelope("payment-negative", "provider-order-1", ScreeningStatus.Processing,
            payment: Payment(paymentStatus, failureCode));

        var result = await h.Service.ApplyVerifiedCallbackAsync("provider-a", Request("signed-negative"));

        result.Outcome.Should().Be(ScreeningCallbackOutcome.Rejected);
        (await h.Db.TenantScreeningOrders.SingleAsync()).Status.Should().Be(ScreeningStatus.PaymentPending);
        var evidence = await h.Db.ScreeningPaymentEvidence.OrderBy(x => x.Revision).ToListAsync();
        evidence.Should().HaveCount(2);
        evidence[1].Revision.Should().Be(2);
        evidence[1].Status.Should().Be(paymentStatus);
        evidence[1].FailureCode.Should().Be(failureCode);
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public async Task Mismatched_authoritative_amount_or_operation_is_recorded_but_cannot_advance(
        bool mismatchAmount, bool mismatchOperation)
    {
        await using var h = await Harness.CreateAsync(addOrder: false);
        h.AddPaymentPendingOrder();
        await h.Db.SaveChangesAsync();
        var payment = Payment(ScreeningPaymentEventStatus.Authorized, applicantAmountMinor: mismatchAmount ? 4_501 : 4_500,
            totalAmountMinor: mismatchAmount ? 4_501 : 4_500,
            operationReference: mismatchOperation ? "other-operation" : "payment-operation-1");
        h.Verifier.Envelope = Envelope("payment-mismatch", "provider-order-1", ScreeningStatus.Processing,
            payment: payment);

        var result = await h.Service.ApplyVerifiedCallbackAsync("provider-a", Request("signed-mismatch"));

        result.Outcome.Should().Be(ScreeningCallbackOutcome.Rejected);
        (await h.Db.TenantScreeningOrders.SingleAsync()).Status.Should().Be(ScreeningStatus.PaymentPending);
        (await h.Db.ScreeningPaymentEvidence.CountAsync()).Should().Be(2,
            "authoritative mismatches remain immutable audit evidence");
    }

    [Fact]
    public async Task Matching_authoritative_payment_advances_once_and_is_idempotent()
    {
        await using var h = await Harness.CreateAsync(addOrder: false);
        h.AddPaymentPendingOrder();
        await h.Db.SaveChangesAsync();
        var payment = Payment(ScreeningPaymentEventStatus.Authorized);
        h.Verifier.Envelope = Envelope("payment-authorized", "provider-order-1", ScreeningStatus.Processing,
            payment: payment);

        var first = await h.Service.ApplyVerifiedCallbackAsync("provider-a", Request("authorized-1"));
        h.Verifier.Envelope = Envelope("payment-authorized-repeat", "provider-order-1", ScreeningStatus.Processing,
            payment: payment);
        var second = await h.Service.ApplyVerifiedCallbackAsync("provider-a", Request("authorized-2"));

        first.Outcome.Should().Be(ScreeningCallbackOutcome.Applied);
        second.Outcome.Should().Be(ScreeningCallbackOutcome.SameState);
        var order = await h.Db.TenantScreeningOrders.SingleAsync();
        order.Status.Should().Be(ScreeningStatus.Processing);
        order.CurrentRevision.Should().Be(2);
        var evidence = await h.Db.ScreeningPaymentEvidence.OrderBy(x => x.Revision).ToListAsync();
        evidence.Should().HaveCount(2);
        evidence.Select(x => x.Revision).Should().Equal(1, 2);
        evidence[1].Status.Should().Be(ScreeningPaymentEventStatus.Authorized);
    }

    [Fact]
    public async Task Polling_complete_without_authoritative_payment_keeps_applicant_order_payment_pending()
    {
        await using var h = await Harness.CreateAsync(addOrder: false);
        h.AddPaymentPendingOrder();
        await h.Db.SaveChangesAsync();
        h.Gateway.Status = new NormalizedScreeningStatusUpdate("provider-order-1", ScreeningStatus.Complete,
            ProviderTime, "done", ReceiptTime);

        var result = await h.Service.ReconcileOrderAsync(10, 100, 1);

        result.Outcome.Should().Be(ScreeningCallbackOutcome.Rejected);
        (await h.Db.TenantScreeningOrders.SingleAsync()).Status.Should().Be(ScreeningStatus.PaymentPending);
        h.Gateway.ReportRequests.Should().BeEmpty();
    }

    [Fact]
    public async Task Provider_event_identity_is_provider_scoped_and_recorded_at_is_receipt_time()
    {
        await using var h = await Harness.CreateAsync();
        h.Verifier.Envelope = Envelope("shared-event", "provider-order-1", ScreeningStatus.Complete);
        var first = await h.Service.ApplyVerifiedCallbackAsync("provider-a", Request("a"));
        h.AddOrder("provider-b", "provider-order-2", 2);
        await h.Db.SaveChangesAsync();
        h.Verifier.Envelope = Envelope("shared-event", "provider-order-2", ScreeningStatus.Complete, "provider-b");
        var second = await h.Service.ApplyVerifiedCallbackAsync("provider-b", Request("b"));

        first.Outcome.Should().Be(ScreeningCallbackOutcome.Applied);
        second.Outcome.Should().Be(ScreeningCallbackOutcome.Applied);
        var transitions = await h.Db.ScreeningTransitionEvents.Where(x => x.ProviderEventId == "shared-event").ToListAsync();
        transitions.Should().HaveCount(2).And.OnlyContain(x => x.ProviderKey == "provider-a" || x.ProviderKey == "provider-b");
        transitions.Should().OnlyContain(x => x.OccurredAt == ProviderTime && x.RecordedAt == ReceiptTime);
    }

    [Fact]
    public async Task Callback_verified_for_one_provider_cannot_be_posted_to_another_provider_route()
    {
        await using var h = await Harness.CreateAsync();
        h.AddOrder("provider-b", "provider-order-1", 2);
        await h.Db.SaveChangesAsync();
        h.Verifier.ConfiguredProviderKey = "provider-a";
        h.Verifier.Envelope = Envelope("cross-provider-event", "provider-order-1", ScreeningStatus.Complete);

        await h.Service.Invoking(x => x.ApplyVerifiedCallbackAsync("provider-b", Request("signed-for-provider-a")))
            .Should().ThrowAsync<UnauthorizedAccessException>();
        h.Verifier.LastRequestedProviderKey.Should().Be("provider-b");

        h.Db.ChangeTracker.Clear();
        (await h.Db.ScreeningWebhookInboxEvents.CountAsync()).Should().Be(0);
        (await h.Db.TenantScreeningOrders.ToListAsync()).Should().OnlyContain(x =>
            x.Status == ScreeningStatus.Processing && x.CurrentRevision == 1);
    }

    [Fact]
    public async Task Duplicate_same_hash_is_idempotent_but_changed_hash_is_typed_durable_security_conflict()
    {
        await using var h = await Harness.CreateAsync();
        h.Verifier.Envelope = Envelope("event-1", "provider-order-1", ScreeningStatus.Complete);
        await h.Service.ApplyVerifiedCallbackAsync("provider-a", Request("original"));

        var duplicate = await h.Service.ApplyVerifiedCallbackAsync("provider-a", Request("original"));
        duplicate.Outcome.Should().Be(ScreeningCallbackOutcome.Duplicate);
        (await h.Db.ScreeningWebhookInboxEvents.SingleAsync()).DuplicateCount.Should().Be(1);

        await h.Service.Invoking(x => x.ApplyVerifiedCallbackAsync("provider-a", Request("tampered")))
            .Should().ThrowAsync<ScreeningWebhookIntegrityException>();
        h.Db.ChangeTracker.Clear();
        var inbox = await h.Db.ScreeningWebhookInboxEvents.SingleAsync();
        inbox.DuplicateCount.Should().Be(1);
        inbox.SecurityIncidentCode.Should().Be("PayloadHashMismatch");
        inbox.PayloadSha256Hash.Should().NotBe(HashOf("tampered"));
        typeof(ScreeningWebhookInboxEvent).GetProperties().Should().NotContain(x => x.Name.Contains("RawPayload"));
        var incident = await h.Db.ScreeningIncidents.SingleAsync();
        incident.IncidentType.Should().Be(ScreeningIncidentType.WebhookIntegrityConflict);
        incident.AffectedResourceSha256Hash.Should().HaveLength(64);
        incident.ToString().Should().NotContain("tampered").And.NotContain("event-1");
    }

    [Fact]
    public async Task Concurrent_unique_insert_loser_detaches_failed_entity_and_applies_winner_duplicate_semantics()
    {
        await using var h = await Harness.CreateAsync(simulateInsertRace: true);
        h.Verifier.Envelope = Envelope("raced-event", "provider-order-1", ScreeningStatus.Complete);

        var result = await h.Service.ApplyVerifiedCallbackAsync("provider-a", Request("same-content"));

        result.Outcome.Should().Be(ScreeningCallbackOutcome.Duplicate);
        var inbox = await h.Db.ScreeningWebhookInboxEvents.SingleAsync();
        inbox.DuplicateCount.Should().Be(1);
        h.Db.ChangeTracker.Entries<ScreeningWebhookInboxEvent>().Should().ContainSingle();
    }

    [Fact]
    public async Task Unknown_order_is_retried_then_replayed_from_verified_normalized_facts_after_correlation_exists()
    {
        await using var h = await Harness.CreateAsync(addOrder: false);
        h.Verifier.Envelope = Envelope("event-late", "late-order", ScreeningStatus.Complete);
        var callback = await h.Service.ApplyVerifiedCallbackAsync("provider-a", Request("secret-payload"));
        callback.Outcome.Should().Be(ScreeningCallbackOutcome.Rejected);
        var inbox = await h.Db.ScreeningWebhookInboxEvents.SingleAsync();
        inbox.ProcessingStatus.Should().Be(ScreeningInboxProcessingStatus.RetryScheduled);
        inbox.ProviderOrderId.Should().Be("late-order");
        inbox.CanonicalStatus.Should().Be(ScreeningStatus.Complete);

        h.AddOrder("provider-a", "late-order", 1);
        await h.Db.SaveChangesAsync();
        h.Clock.Now = ReceiptTime.AddMinutes(2);
        h.Verifier.ThrowIfCalled = true;
        (await h.Service.ProcessPendingWebhookInboxAsync(10, TimeSpan.FromMinutes(1))).Should().Be(1);

        inbox.ProcessingStatus.Should().Be(ScreeningInboxProcessingStatus.Processed);
        inbox.TenantScreeningOrderId.Should().NotBeNull();
        (await h.Db.TenantScreeningOrders.SingleAsync()).Status.Should().Be(ScreeningStatus.Complete);
    }

    [Fact]
    public async Task Never_seen_callback_older_than_configured_signed_age_is_rejected_before_audit_insert()
    {
        await using var h = await Harness.CreateAsync();
        h.Verifier.Envelope = Envelope("stale-signature", "provider-order-1", ScreeningStatus.Complete,
            signedAt: ReceiptTime.AddMinutes(-6));

        await h.Service.Invoking(x => x.ApplyVerifiedCallbackAsync("provider-a", Request("stale-signed-body")))
            .Should().ThrowAsync<UnauthorizedAccessException>();

        (await h.Db.ScreeningWebhookInboxEvents.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Configured_signed_age_is_enforced_and_verified_envelope_must_bind_the_exact_body()
    {
        await using var h = await Harness.CreateAsync(maximumSignedAge: TimeSpan.FromMinutes(1));
        h.Verifier.Envelope = Envelope("too-old-for-policy", "provider-order-1", ScreeningStatus.Complete,
            signedAt: ReceiptTime.AddMinutes(-2));

        await h.Service.Invoking(x => x.ApplyVerifiedCallbackAsync("provider-a", Request("old-body")))
            .Should().ThrowAsync<UnauthorizedAccessException>();

        h.Verifier.Envelope = Envelope("unbound-body", "provider-order-1", ScreeningStatus.Complete);
        h.Verifier.BindToRequestPayload = false;
        await h.Service.Invoking(x => x.ApplyVerifiedCallbackAsync("provider-a", Request("different-body")))
            .Should().ThrowAsync<UnauthorizedAccessException>();

        (await h.Db.ScreeningWebhookInboxEvents.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Verified_authentication_provenance_is_bounded_and_persisted_without_signature_secret()
    {
        await using var h = await Harness.CreateAsync();
        h.Verifier.Envelope = Envelope("auth-audit", "provider-order-1", ScreeningStatus.Processing,
            authenticationScheme: "hmac-sha256", keyVersion: "key-v2");

        await h.Service.ApplyVerifiedCallbackAsync("provider-a", Request("signed-body"));

        var inbox = await h.Db.ScreeningWebhookInboxEvents.SingleAsync();
        inbox.SignedAt.Should().Be(ReceiptTime);
        inbox.AuthenticationScheme.Should().Be("hmac-sha256");
        inbox.AuthenticationKeyVersion.Should().Be("key-v2");
        inbox.ToString().Should().NotContain("signed-body");
    }

    [Fact]
    public async Task Provider_sequence_proves_obsolete_callback_and_records_terminal_stale_outcome_once()
    {
        await using var h = await Harness.CreateAsync();
        h.Verifier.Envelope = Envelope("newer", "provider-order-1", ScreeningStatus.Complete, providerSequence: 20);
        (await h.Service.ApplyVerifiedCallbackAsync("provider-a", Request("newer"))).Outcome
            .Should().Be(ScreeningCallbackOutcome.Applied);

        h.Verifier.Envelope = Envelope("older", "provider-order-1", ScreeningStatus.Processing,
            providerSequence: 19, signedAt: ReceiptTime.AddMinutes(1));
        h.Clock.Now = ReceiptTime.AddMinutes(1);
        var stale = await h.Service.ApplyVerifiedCallbackAsync("provider-a", Request("older"));

        stale.Outcome.Should().Be(ScreeningCallbackOutcome.Stale);
        var inbox = await h.Db.ScreeningWebhookInboxEvents.SingleAsync(x => x.ProviderEventId == "older");
        inbox.ProcessingStatus.Should().Be(ScreeningInboxProcessingStatus.Stale);
        inbox.FailureCode.Should().Be("ObsoleteProviderSequence");
        inbox.NextAttemptAt.Should().BeNull();
        (await h.Service.ProcessPendingWebhookInboxAsync(10, TimeSpan.FromMinutes(1))).Should().Be(0);
        (await h.Db.ScreeningIncidents.CountAsync(x => x.IncidentType == ScreeningIncidentType.WebhookDeadLetter)).Should().Be(0);
    }

    [Fact]
    public async Task Older_reverse_transition_without_sequence_is_terminal_stale_and_not_retried()
    {
        await using var h = await Harness.CreateAsync();
        h.Verifier.Envelope = Envelope("complete-first", "provider-order-1", ScreeningStatus.Complete);
        (await h.Service.ApplyVerifiedCallbackAsync("provider-a", Request("complete-first"))).Outcome
            .Should().Be(ScreeningCallbackOutcome.Applied);

        h.Clock.Now = ReceiptTime.AddMinutes(1);
        h.Verifier.Envelope = Envelope("older-processing", "provider-order-1", ScreeningStatus.Processing,
            signedAt: ReceiptTime.AddMinutes(1), occurredAt: ProviderTime.AddMinutes(-1));
        var result = await h.Service.ApplyVerifiedCallbackAsync("provider-a", Request("older-processing"));

        result.Outcome.Should().Be(ScreeningCallbackOutcome.Stale);
        var inbox = await h.Db.ScreeningWebhookInboxEvents.SingleAsync(x => x.ProviderEventId == "older-processing");
        inbox.ProcessingStatus.Should().Be(ScreeningInboxProcessingStatus.Stale);
        inbox.FailureCode.Should().Be("ObsoleteProviderTransition");
        inbox.NextAttemptAt.Should().BeNull();
        (await h.Service.ProcessPendingWebhookInboxAsync(10, TimeSpan.FromMinutes(1))).Should().Be(0);
    }

    [Fact]
    public async Task Expired_lease_is_recovered_and_same_state_is_processed_without_revision()
    {
        await using var h = await Harness.CreateAsync();
        var inbox = h.AddInbox("leased", ScreeningStatus.Processing);
        inbox.TryAcquireLease(Guid.NewGuid(), ReceiptTime.AddMinutes(-2), ReceiptTime.AddMinutes(-1)).Should().BeTrue();
        await h.Db.SaveChangesAsync();

        (await h.Service.ProcessPendingWebhookInboxAsync(10, TimeSpan.FromMinutes(1))).Should().Be(1);
        inbox.ProcessingStatus.Should().Be(ScreeningInboxProcessingStatus.Processed);
        (await h.Db.TenantScreeningOrders.SingleAsync()).CurrentRevision.Should().Be(1);
    }

    [Fact]
    public async Task Retry_is_dead_lettered_only_at_configured_bounded_attempts()
    {
        await using var h = await Harness.CreateAsync(addOrder: false, maxAttempts: 2);
        h.AddInbox("never-correlates", ScreeningStatus.Complete);
        await h.Db.SaveChangesAsync();

        (await h.Service.ProcessPendingWebhookInboxAsync(10, TimeSpan.FromMinutes(1))).Should().Be(1);
        var inbox = await h.Db.ScreeningWebhookInboxEvents.SingleAsync();
        inbox.ProcessingStatus.Should().Be(ScreeningInboxProcessingStatus.RetryScheduled);
        h.Clock.Now = ReceiptTime.AddMinutes(2);
        (await h.Service.ProcessPendingWebhookInboxAsync(10, TimeSpan.FromMinutes(1))).Should().Be(1);
        inbox.ProcessingStatus.Should().Be(ScreeningInboxProcessingStatus.DeadLettered);
        inbox.ProcessingAttempts.Should().Be(2);
        (await h.Db.ScreeningIncidents.SingleAsync()).IncidentType.Should().Be(ScreeningIncidentType.WebhookDeadLetter);
    }

    [Fact]
    public async Task Reconciliation_authorizes_correlates_and_applies_sequential_polling_revision()
    {
        await using var h = await Harness.CreateAsync();
        h.Gateway.Status = new NormalizedScreeningStatusUpdate("provider-order-1", ScreeningStatus.Complete, ProviderTime, "done", ReceiptTime);

        var result = await h.Service.ReconcileOrderAsync(10, 100, 1);

        result.Outcome.Should().Be(ScreeningCallbackOutcome.Applied);
        result.Revision.Should().Be(2);
        h.Gateway.StatusRequests.Should().ContainSingle(x => x.OrganizationId == 10 && x.ApplicationId == 30 &&
            x.ScreeningOrderId == 1 && x.ProviderOrderId == "provider-order-1");
        var transition = await h.Db.ScreeningTransitionEvents.SingleAsync();
        transition.Source.Should().Be(ScreeningTransitionSource.ProviderPolling);
        transition.ProviderKey.Should().Be("provider-a");
        transition.OccurredAt.Should().Be(ProviderTime);
        transition.RecordedAt.Should().Be(ReceiptTime);
        var report = await h.Db.ScreeningReportRevisions.SingleAsync();
        report.ProviderReportReference.Should().Be("report-1");
        report.ReportVersion.Should().Be("v1");
    }

    [Fact]
    public async Task Reconciliation_rejects_and_terminally_audits_obsolete_polling_sequence()
    {
        await using var h = await Harness.CreateAsync();
        h.Gateway.Status = new NormalizedScreeningStatusUpdate("provider-order-1", ScreeningStatus.Complete,
            ProviderTime, "done", ReceiptTime, providerSequence: 10);
        (await h.Service.ReconcileOrderAsync(10, 100, 1)).Outcome.Should().Be(ScreeningCallbackOutcome.Applied);

        h.Gateway.Status = new NormalizedScreeningStatusUpdate("provider-order-1", ScreeningStatus.Complete,
            ProviderTime.AddMinutes(-1), "stale", ReceiptTime, providerSequence: 9);
        var stale = await h.Service.ReconcileOrderAsync(10, 100, 1);

        stale.Outcome.Should().Be(ScreeningCallbackOutcome.Stale);
        (await h.Db.TenantScreeningOrders.SingleAsync()).CurrentRevision.Should().Be(2);
        var incident = await h.Db.ScreeningIncidents.SingleAsync(x =>
            x.IncidentType == ScreeningIncidentType.StaleProviderPollingState);
        incident.Status.Should().Be(ScreeningIncidentStatus.Detected);
        incident.FailureEvidenceReference.Should().Be("ObsoleteProviderSequence");
    }

    [Fact]
    public async Task Complete_webhook_persists_normalized_report_evidence_before_exposing_complete()
    {
        await using var h = await Harness.CreateAsync();
        h.Verifier.Envelope = Envelope("completed", "provider-order-1", ScreeningStatus.Complete);

        var result = await h.Service.ApplyVerifiedCallbackAsync("provider-a", Request("complete"));

        result.Outcome.Should().Be(ScreeningCallbackOutcome.Applied);
        (await h.Db.TenantScreeningOrders.SingleAsync()).Status.Should().Be(ScreeningStatus.Complete);
        var report = await h.Db.ScreeningReportRevisions.SingleAsync();
        report.ProviderReportReference.Should().Be("report-1");
        report.NormalizedFactsJson.Should().Be("{\"riskBand\":\"low\",\"score\":\"700\"}");
        (await h.Db.ScreeningTransitionEvents.SingleAsync()).ToStatus.Should().Be(ScreeningStatus.Complete);
        h.Gateway.ReportRequests.Should().ContainSingle(x => x.ScreeningOrderId == 1 &&
            x.ProviderOrderId == "provider-order-1");
    }

    [Fact]
    public async Task Complete_webhook_report_failure_schedules_retry_and_keeps_processing()
    {
        await using var h = await Harness.CreateAsync();
        h.Verifier.Envelope = Envelope("completed", "provider-order-1", ScreeningStatus.Complete);
        h.Gateway.Report = new NormalizedScreeningReportRevision("unsafe-report", "v1",
            NormalizedScreeningReportStatus.Complete,
            new Dictionary<string, string> { ["ssn"] = "111-22-3333" }, ProviderTime,
            TimeSpan.FromDays(30), ScreeningReportRetentionSignal.ProviderPolicy, null, ReceiptTime);

        var result = await h.Service.ApplyVerifiedCallbackAsync("provider-a", Request("complete"));

        result.Outcome.Should().Be(ScreeningCallbackOutcome.Rejected);
        (await h.Db.TenantScreeningOrders.SingleAsync()).Status.Should().Be(ScreeningStatus.Processing);
        (await h.Db.ScreeningReportRevisions.CountAsync()).Should().Be(0);
        var inbox = await h.Db.ScreeningWebhookInboxEvents.SingleAsync();
        inbox.ProcessingStatus.Should().Be(ScreeningInboxProcessingStatus.RetryScheduled);
        inbox.FailureCode.Should().Be("ProviderReportUnavailable");
        inbox.FailureDetail.Should().BeNull("provider exception details must not be persisted");
    }

    [Fact]
    public async Task Reconciliation_repairs_provider_complete_order_missing_local_report()
    {
        await using var h = await Harness.CreateAsync();
        h.Gateway.Status = new NormalizedScreeningStatusUpdate("provider-order-1", ScreeningStatus.Complete,
            ProviderTime, "done", ReceiptTime);

        await h.Service.ReconcileOrderAsync(10, 100, 1);

        (await h.Db.TenantScreeningOrders.SingleAsync()).Status.Should().Be(ScreeningStatus.Complete);
        (await h.Db.ScreeningReportRevisions.SingleAsync()).ProviderReportReference.Should().Be("report-1");
    }

    [Fact]
    public async Task Reconciliation_report_failure_is_typed_and_keeps_processing_without_evidence()
    {
        await using var h = await Harness.CreateAsync();
        h.Gateway.Status = new NormalizedScreeningStatusUpdate("provider-order-1", ScreeningStatus.Complete,
            ProviderTime, "done", ReceiptTime);
        h.Gateway.ReportFailure = new InvalidOperationException("provider unavailable");

        await h.Service.Invoking(x => x.ReconcileOrderAsync(10, 100, 1))
            .Should().ThrowAsync<ScreeningReportIngestionException>();

        (await h.Db.TenantScreeningOrders.SingleAsync()).Status.Should().Be(ScreeningStatus.Processing);
        (await h.Db.ScreeningReportRevisions.CountAsync()).Should().Be(0);
        (await h.Db.ScreeningTransitionEvents.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Duplicate_provider_report_is_idempotent_and_correction_appends_and_links()
    {
        await using var h = await Harness.CreateAsync();
        h.Verifier.Envelope = Envelope("completed", "provider-order-1", ScreeningStatus.Complete);
        await h.Service.ApplyVerifiedCallbackAsync("provider-a", Request("complete"));

        h.Gateway.Status = new NormalizedScreeningStatusUpdate("provider-order-1", ScreeningStatus.Complete,
            ProviderTime, "done", ReceiptTime);
        await h.Service.ReconcileOrderAsync(10, 100, 1);
        (await h.Db.ScreeningReportRevisions.CountAsync()).Should().Be(1);

        var first = await h.Db.ScreeningReportRevisions.SingleAsync();
        h.Gateway.Report = new NormalizedScreeningReportRevision("report-2", "v2",
            NormalizedScreeningReportStatus.Corrected,
            new Dictionary<string, string> { ["riskBand"] = "low", ["score"] = "710" },
            ReceiptTime.AddMinutes(1), TimeSpan.FromDays(30), ScreeningReportRetentionSignal.ProviderPolicy, first.Id,
            ReceiptTime.AddMinutes(2));
        h.Clock.Now = ReceiptTime.AddMinutes(2);
        await h.Service.ReconcileOrderAsync(10, 100, 1);

        var history = await h.Db.ScreeningReportRevisions.OrderBy(x => x.Revision).ToListAsync();
        history.Should().HaveCount(2);
        history[1].SupersedesScreeningReportRevisionId.Should().Be(history[0].Id);
        history[0].ProviderReportReference.Should().Be("report-1");
    }

    [Fact]
    public async Task Reconciliation_rejects_cross_org_provider_mismatch_and_terminal_orders_and_handles_same_state()
    {
        await using var h = await Harness.CreateAsync();
        await h.Service.Invoking(x => x.ReconcileOrderAsync(11, 100, 1)).Should().ThrowAsync<ScreeningAuthorizationException>();

        h.Gateway.Status = new NormalizedScreeningStatusUpdate("wrong-provider-order", ScreeningStatus.Complete, ProviderTime, null, ReceiptTime);
        await h.Service.Invoking(x => x.ReconcileOrderAsync(10, 100, 1)).Should().ThrowAsync<ScreeningProviderCorrelationException>();

        h.Gateway.Status = new NormalizedScreeningStatusUpdate("provider-order-1", ScreeningStatus.Processing, ProviderTime, null, ReceiptTime);
        var same = await h.Service.ReconcileOrderAsync(10, 100, 1);
        same.Outcome.Should().Be(ScreeningCallbackOutcome.SameState);
        same.Revision.Should().Be(1);

        var order = await h.Db.TenantScreeningOrders.SingleAsync();
        order.ApplyTransition(ScreeningStatus.Complete, 2, ReceiptTime);
        await h.Db.SaveChangesAsync();
        await h.Service.Invoking(x => x.ReconcileOrderAsync(10, 100, 1)).Should().ThrowAsync<InvalidOperationException>();
    }

    private static ScreeningCallbackRequest Request(string payload) => new(Encoding.UTF8.GetBytes(payload), []);
    private static string HashOf(string payload) => Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(payload))).ToLowerInvariant();
    private static VerifiedScreeningCallbackEnvelope Envelope(string eventId, string providerOrderId, ScreeningStatus status,
        string providerKey = "provider-a", ScreeningAuthoritativePaymentUpdate? payment = null,
        long? providerSequence = null, DateTimeOffset? signedAt = null,
        string authenticationScheme = "hmac-sha256", string keyVersion = "key-v1", DateTimeOffset? occurredAt = null) =>
        VerifiedScreeningCallbackEnvelope.Create(providerKey, eventId,
            new NormalizedScreeningStatusUpdate(providerOrderId, status, occurredAt ?? ProviderTime, "provider-reason", ReceiptTime,
                payment, providerSequence), ReceiptTime, signedAt ?? ReceiptTime, authenticationScheme, keyVersion,
            new string('0', 64), ReceiptTime);

    private static ScreeningAuthoritativePaymentUpdate Payment(ScreeningPaymentEventStatus status, string? failureCode = null,
        long applicantAmountMinor = 4_500, long totalAmountMinor = 4_500,
        string operationReference = "payment-operation-1") => new("quote-reference-1", operationReference,
        ScreeningPayer.Applicant, 0, applicantAmountMinor, 4_000, 500, totalAmountMinor - 4_500, totalAmountMinor,
        "USD", status, ProviderTime, failureCode, ReceiptTime);

    private sealed class Harness : IAsyncDisposable
    {
        private Harness(DataContext db, Gateway gateway, Verifier verifier, MutableTimeProvider clock, TenantScreeningService service)
            => (Db, Gateway, Verifier, Clock, Service) = (db, gateway, verifier, clock, service);
        public DataContext Db { get; }
        public Gateway Gateway { get; }
        public Verifier Verifier { get; }
        public MutableTimeProvider Clock { get; }
        public TenantScreeningService Service { get; }

        public static async Task<Harness> CreateAsync(bool addOrder = true, int maxAttempts = 3,
            bool simulateInsertRace = false, TimeSpan? maximumSignedAge = null)
        {
            var options = new DbContextOptionsBuilder<DataContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
            DataContext db = simulateInsertRace ? new RaceDataContext(options) : new DataContext(options);
            db.Organizations.AddRange(new Organization { Id = 10, Name = "Org" }, new Organization { Id = 11, Name = "Other" });
            db.Users.Add(new User { Id = 100, Email = "staff@test.invalid", FirstName = "Staff", LastName = "User" });
            db.OrganizationMembers.Add(new OrganizationMember { Id = 11, OrganizationId = 10, UserId = 100, Role = "Manager", IsActive = true });
            db.Properties.Add(new Property
            {
                Id = 20, OrganizationId = 10, LandlordId = 100, State = "CA",
                StreetAddress = "1 Main", City = "X", ZipCode = "00000"
            });
            var gateway = new Gateway();
            var verifier = new Verifier();
            var clock = new MutableTimeProvider { Now = ReceiptTime };
            var service = new TenantScreeningService(db, gateway, new UnusedPolicy(), new UnusedDelivery(), new UnusedLinks(), verifier, clock,
                new ScreeningWebhookProcessingOptions(maxAttempts, TimeSpan.FromMinutes(1), maximumSignedAge: maximumSignedAge));
            var harness = new Harness(db, gateway, verifier, clock, service);
            if (addOrder) harness.AddOrder("provider-a", "provider-order-1", 1);
            await db.SaveChangesAsync();
            if (db is RaceDataContext race) race.Armed = true;
            return harness;
        }

        public TenantScreeningOrder AddOrder(string provider, string providerOrderId, long id)
        {
            var order = new TenantScreeningOrder
            {
                Id = id, OrganizationId = 10, RentalApplicationId = 30, PropertyId = 20, ProviderKey = provider,
                ProviderOrderId = providerOrderId, PackageCode = "standard", JurisdictionCode = "CA",
                CreatedAt = ReceiptTime.AddDays(-1), RequesterUserId = 100
            };
            order.ApplyTransition(ScreeningStatus.Processing, 1, ReceiptTime.AddHours(-1));
            Db.TenantScreeningOrders.Add(order);
            return order;
        }

        public TenantScreeningOrder AddPaymentPendingOrder()
        {
            var order = new TenantScreeningOrder
            {
                Id = 1, OrganizationId = 10, RentalApplicationId = 30, PropertyId = 20, ProviderKey = "provider-a",
                ProviderOrderId = "provider-order-1", PackageCode = "standard", JurisdictionCode = "CA",
                Payer = ScreeningPayer.Applicant, QuoteReference = "quote-reference-1",
                LandlordAmountMinor = 0, ApplicantAmountMinor = 4_500, ProviderAmountMinor = 4_000,
                PlatformFeeMinor = 500, TaxAmountMinor = 0, TotalAmountMinor = 4_500, Currency = "USD",
                CreatedAt = ReceiptTime.AddDays(-1), RequesterUserId = 100
            };
            order.ApplyTransition(ScreeningStatus.PaymentPending, 1, ReceiptTime.AddHours(-1));
            Db.TenantScreeningOrders.Add(order);
            Db.ScreeningPaymentEvidence.Add(new ScreeningPaymentEvidence
            {
                TenantScreeningOrderId = 1, OrganizationId = 10, Payer = ScreeningPayer.Applicant,
                LandlordAmountMinor = 0, ApplicantAmountMinor = 4_500, ProviderAmountMinor = 4_000,
                PlatformFeeMinor = 500, TaxAmountMinor = 0, TotalAmountMinor = 4_500, Currency = "USD",
                QuoteReferenceHash = ScreeningAuthoritativePaymentUpdate.HashReference("quote-reference-1"),
                PaymentOperationReferenceHash = ScreeningAuthoritativePaymentUpdate.HashReference("payment-operation-1"),
                Status = ScreeningPaymentEventStatus.AuthorizationInitiated,
                Source = ScreeningPaymentEvidenceSource.HostedPaymentBoundary, Revision = 1,
                ProviderOccurredAt = ReceiptTime.AddHours(-1), RecordedAt = ReceiptTime.AddHours(-1)
            });
            return order;
        }

        public ScreeningWebhookInboxEvent AddInbox(string eventId, ScreeningStatus status)
        {
            var inbox = new ScreeningWebhookInboxEvent
            {
                ProviderKey = "provider-a", ProviderEventId = eventId, PayloadSha256Hash = new string('a', 64),
                ReceivedAt = ReceiptTime.AddMinutes(-5), ProviderOrderId = eventId == "leased" ? "provider-order-1" : "missing",
                CanonicalStatus = status, NormalizedReasonCode = "verified", OccurredAt = ProviderTime
            };
            Db.ScreeningWebhookInboxEvents.Add(inbox);
            return inbox;
        }
        public ValueTask DisposeAsync() => Db.DisposeAsync();
    }

    private sealed class RaceDataContext(DbContextOptions<DataContext> options) : DataContext(options)
    {
        public bool Armed { get; set; }
        public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            var losing = ChangeTracker.Entries<ScreeningWebhookInboxEvent>()
                .SingleOrDefault(x => x.State == EntityState.Added)?.Entity;
            if (!Armed || losing is null) return await base.SaveChangesAsync(cancellationToken);
            Armed = false;
            Entry(losing).State = EntityState.Detached;
            ScreeningWebhookInboxEvents.Add(new ScreeningWebhookInboxEvent
            {
                ProviderKey = losing.ProviderKey, ProviderEventId = losing.ProviderEventId,
                PayloadSha256Hash = losing.PayloadSha256Hash, ReceivedAt = losing.ReceivedAt,
                OccurredAt = losing.OccurredAt, ProviderOrderId = losing.ProviderOrderId,
                CanonicalStatus = losing.CanonicalStatus, NormalizedReasonCode = losing.NormalizedReasonCode
            });
            await base.SaveChangesAsync(cancellationToken);
            throw new DbUpdateException("Simulated provider-scoped unique constraint race.");
        }
    }

    private sealed class MutableTimeProvider : TimeProvider { public DateTimeOffset Now { get; set; } public override DateTimeOffset GetUtcNow() => Now; }
    private sealed class Verifier : IScreeningCallbackVerifier
    {
        public VerifiedScreeningCallbackEnvelope Envelope { get; set; } = null!;
        public string ConfiguredProviderKey { get; set; } = "provider-a";
        public string? LastRequestedProviderKey { get; private set; }
        public bool ThrowIfCalled { get; set; }
        public bool BindToRequestPayload { get; set; } = true;
        public ValueTask<VerifiedScreeningCallbackEnvelope> VerifyAsync(string providerKey, ScreeningCallbackRequest request, CancellationToken cancellationToken = default)
        {
            if (ThrowIfCalled) throw new InvalidOperationException("Replay must not reverify raw payload");
            LastRequestedProviderKey = providerKey;
            var bound = VerifiedScreeningCallbackEnvelope.Create(Envelope.ProviderKey, Envelope.EventId, Envelope.Update,
                Envelope.VerifiedAt, Envelope.SignedAt, Envelope.AuthenticationScheme, Envelope.AuthenticationKeyVersion,
                BindToRequestPayload
                    ? Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(request.Payload.Span)).ToLowerInvariant()
                    : Envelope.SignedPayloadSha256Hash,
                Envelope.VerifiedAt);
            return ValueTask.FromResult(bound);
        }
    }
    private sealed class Gateway : IScreeningProviderGateway
    {
        public NormalizedScreeningStatusUpdate Status { get; set; } = null!;
        public List<ScreeningStatusRequest> StatusRequests { get; } = [];
        public NormalizedScreeningReportRevision Report { get; set; } = new("report-1", "v1",
            NormalizedScreeningReportStatus.Complete,
            new Dictionary<string, string> { ["score"] = "700", ["riskBand"] = "low" },
            ProviderTime, TimeSpan.FromDays(30), ScreeningReportRetentionSignal.ProviderPolicy, null, ReceiptTime);
        public Exception? ReportFailure { get; set; }
        public List<ScreeningReportRequest> ReportRequests { get; } = [];
        public Task<NormalizedScreeningStatusUpdate> GetStatusAsync(ScreeningStatusRequest request, CancellationToken cancellationToken = default)
        { StatusRequests.Add(request); return Task.FromResult(Status); }
        public Task<NormalizedScreeningReportRevision> GetReportRevisionAsync(ScreeningReportRequest request,
            CancellationToken cancellationToken = default)
        {
            ReportRequests.Add(request);
            return ReportFailure is null
                ? Task.FromResult(Report)
                : Task.FromException<NormalizedScreeningReportRevision>(ReportFailure);
        }
        public Task<AuthoritativeScreeningQuote> GetAuthoritativeQuoteAsync(ScreeningQuoteRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<ApplicantHostedSessionResult> CreateApplicantHostedSessionAsync(CreateApplicantScreeningSessionRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }
    private sealed class UnusedPolicy : IScreeningPolicyResolver { public Task<ScreeningPolicySnapshot> ResolveAsync(ScreeningPolicyResolutionRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException(); }
    private sealed class UnusedDelivery : IScreeningApplicantInvitationDelivery { public Task DeliverAsync(ScreeningApplicantInvitationDeliveryRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException(); }
    private sealed class UnusedLinks : IScreeningApplicantLinkFactory { public Uri CreateApplicantAccessLink(string rawToken) => throw new NotSupportedException(); }
}
