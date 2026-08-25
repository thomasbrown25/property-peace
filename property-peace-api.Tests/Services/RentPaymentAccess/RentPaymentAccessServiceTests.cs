using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.RentPaymentAccess;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.RentPaymentAccess;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Xunit;

namespace brownstone_hub_api.Tests.Services.RentPaymentAccess;

public sealed class RentPaymentAccessServiceTests
{
    private static readonly DateTimeOffset InitialNow = new(2031, 4, 5, 14, 30, 0, TimeSpan.Zero);

    [Fact]
    public async Task First_request_creates_pending_request_and_one_audit_event()
    {
        await using var db = CreateContext();
        var notifier = new RecordingNotifier
        {
            Handler = request =>
            {
                db.RentPaymentAccessRequests.Count().Should().Be(1);
                db.RentPaymentAccessAuditEvents.Count().Should().Be(1);
                request.Status.Should().Be("Pending");
                return Task.FromResult(new RentPaymentAccessNotificationResult(2, 0, 2));
            }
        };
        var logger = new CapturingLogger<RentPaymentAccessService>();
        var service = CreateService(db, notifier: notifier, logger: logger);

        var result = await service.RequestAsync(701, 41, CancellationToken.None);

        result.OrganizationId.Should().Be(701);
        result.Status.Should().Be("Pending");
        result.RequestedAtUtc.Should().Be(InitialNow.UtcDateTime);
        result.PublicId.Should().NotBeNull();
        var request = await db.RentPaymentAccessRequests.SingleAsync();
        request.RequestedByUserId.Should().Be(41);
        request.StatusChangedAtUtc.Should().Be(InitialNow.UtcDateTime);
        var audit = await db.RentPaymentAccessAuditEvents.SingleAsync();
        audit.OrganizationId.Should().Be(701);
        audit.PriorStatus.Should().BeNull();
        audit.NextStatus.Should().Be(RentPaymentAccessStatus.Pending);
        audit.ActorUserId.Should().Be(41);
        audit.OccurredAtUtc.Should().Be(InitialNow.UtcDateTime);
        notifier.Requests.Should().ContainSingle();
        logger.Messages.Should().ContainSingle(message =>
            message.Contains(result.PublicId!.Value.ToString(), StringComparison.Ordinal) &&
            message.Contains("organization 701", StringComparison.OrdinalIgnoreCase) &&
            message.Contains("2 attempted", StringComparison.OrdinalIgnoreCase) &&
            message.Contains("0 accepted", StringComparison.OrdinalIgnoreCase) &&
            message.Contains("2 failed", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Request_while_pending_returns_existing_request_without_another_audit_event()
    {
        await using var db = CreateContext();
        var notifier = new RecordingNotifier();
        var service = CreateService(db, notifier: notifier);
        var first = await service.RequestAsync(701, 41, CancellationToken.None);
        notifier.Requests.Clear();

        var duplicate = await service.RequestAsync(701, 99, CancellationToken.None);

        duplicate.Should().Be(first);
        (await db.RentPaymentAccessRequests.CountAsync()).Should().Be(1);
        (await db.RentPaymentAccessAuditEvents.CountAsync()).Should().Be(1);
        (await db.RentPaymentAccessRequests.SingleAsync()).RequestedByUserId.Should().Be(41);
        notifier.Requests.Should().BeEmpty();
    }

    [Fact]
    public async Task Request_while_approved_is_idempotent_and_does_not_regress_status()
    {
        await using var db = CreateContext();
        var request = AddRequest(db, RentPaymentAccessStatus.Approved, rowVersion: [7, 1]);
        AddAudit(db, request, null, RentPaymentAccessStatus.Pending, 41);
        AddAudit(db, request, RentPaymentAccessStatus.Pending, RentPaymentAccessStatus.Approved, 8);
        await db.SaveChangesAsync();
        var notifier = new RecordingNotifier();
        var service = CreateService(db, notifier: notifier);

        var result = await service.RequestAsync(701, 99, CancellationToken.None);

        result.Status.Should().Be("Approved");
        request.Status.Should().Be(RentPaymentAccessStatus.Approved);
        request.RequestedByUserId.Should().Be(41);
        (await db.RentPaymentAccessAuditEvents.CountAsync()).Should().Be(2);
        notifier.Requests.Should().BeEmpty();
    }

    [Fact]
    public async Task Rejected_request_can_be_resubmitted_with_new_request_time_and_audit_event()
    {
        await using var db = CreateContext();
        var request = AddRequest(db, RentPaymentAccessStatus.Rejected, rowVersion: [3]);
        request.DecisionReason = "Information did not match.";
        request.InternalNotes = "Reviewer-only note";
        request.ReviewedByUserId = 8;
        request.ReviewedAtUtc = InitialNow.UtcDateTime;
        await db.SaveChangesAsync();
        var clock = new MutableTimeProvider(InitialNow.AddDays(2));
        var notifier = new RecordingNotifier
        {
            Handler = detail =>
            {
                db.RentPaymentAccessRequests.Single().Status.Should().Be(RentPaymentAccessStatus.Pending);
                db.RentPaymentAccessAuditEvents.Single().NextStatus.Should().Be(RentPaymentAccessStatus.Pending);
                return Task.FromResult(new RentPaymentAccessNotificationResult(1, 1, 0));
            }
        };
        var service = CreateService(db, clock, notifier);

        var result = await service.RequestAsync(701, 52, CancellationToken.None);

        result.Status.Should().Be("Pending");
        result.RequestedAtUtc.Should().Be(InitialNow.AddDays(2).UtcDateTime);
        request.RequestedByUserId.Should().Be(52);
        request.ReviewedByUserId.Should().BeNull();
        request.ReviewedAtUtc.Should().BeNull();
        request.DecisionReason.Should().BeNull();
        request.InternalNotes.Should().BeNull();
        var audit = await db.RentPaymentAccessAuditEvents.SingleAsync();
        audit.PriorStatus.Should().Be(RentPaymentAccessStatus.Rejected);
        audit.NextStatus.Should().Be(RentPaymentAccessStatus.Pending);
        notifier.Requests.Should().ContainSingle(detail =>
            detail.PublicId == result.PublicId && detail.RequestedAtUtc == result.RequestedAtUtc);
    }

    [Fact]
    public async Task Suspended_request_cannot_be_self_resubmitted()
    {
        await using var db = CreateContext();
        AddRequest(db, RentPaymentAccessStatus.Suspended, rowVersion: [4]);
        await db.SaveChangesAsync();
        var service = CreateService(db);

        var act = () => service.RequestAsync(701, 41, CancellationToken.None);

        await act.Should().ThrowAsync<RentPaymentAccessInvalidTransitionException>();
        (await db.RentPaymentAccessAuditEvents.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Approval_from_pending_updates_review_fields_and_appends_safe_audit()
    {
        await using var db = CreateContext();
        var request = AddRequest(db, RentPaymentAccessStatus.Pending, rowVersion: [1, 2, 3]);
        await db.SaveChangesAsync();
        var service = CreateService(db);
        var review = new ReviewRentPaymentAccessRequestDto(
            " Verified eligibility ", "Bank account 9999; raw body must stay private", [1, 2, 3]);

        var result = await service.ApproveAsync(request.PublicId, 8, review, CancellationToken.None);

        result.Status.Should().Be("Approved");
        result.DecisionReason.Should().Be("Verified eligibility");
        result.InternalNotes.Should().Be("Bank account 9999; raw body must stay private");
        request.ReviewedByUserId.Should().Be(8);
        request.ReviewedAtUtc.Should().Be(InitialNow.UtcDateTime);
        var audit = await db.RentPaymentAccessAuditEvents.SingleAsync();
        audit.PriorStatus.Should().Be(RentPaymentAccessStatus.Pending);
        audit.NextStatus.Should().Be(RentPaymentAccessStatus.Approved);
        audit.SafeMetadataJson.Should().BeNull();
    }

    [Theory]
    [InlineData(RentPaymentAccessStatus.Approved)]
    [InlineData(RentPaymentAccessStatus.Rejected)]
    [InlineData(RentPaymentAccessStatus.Suspended)]
    public async Task Approval_is_rejected_from_any_state_other_than_pending(RentPaymentAccessStatus status)
    {
        await using var db = CreateContext();
        var request = AddRequest(db, status, rowVersion: [5]);
        await db.SaveChangesAsync();
        var service = CreateService(db);

        var act = () => service.ApproveAsync(request.PublicId, 8,
            new ReviewRentPaymentAccessRequestDto(null, null, [5]), CancellationToken.None);

        await act.Should().ThrowAsync<RentPaymentAccessInvalidTransitionException>();
        (await db.RentPaymentAccessAuditEvents.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Rejection_from_pending_requires_a_user_safe_reason()
    {
        await using var db = CreateContext();
        var request = AddRequest(db, RentPaymentAccessStatus.Pending, rowVersion: [6]);
        await db.SaveChangesAsync();
        var service = CreateService(db);

        var act = () => service.RejectAsync(request.PublicId, 8,
            new ReviewRentPaymentAccessRequestDto("   ", null, [6]), CancellationToken.None);

        await act.Should().ThrowAsync<RentPaymentAccessValidationException>();
        request.Status.Should().Be(RentPaymentAccessStatus.Pending);
        (await db.RentPaymentAccessAuditEvents.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Rejection_from_pending_records_reason_without_copying_caller_text_to_audit_metadata()
    {
        await using var db = CreateContext();
        var request = AddRequest(db, RentPaymentAccessStatus.Pending, rowVersion: [6]);
        await db.SaveChangesAsync();
        var service = CreateService(db);

        var result = await service.RejectAsync(request.PublicId, 8,
            new ReviewRentPaymentAccessRequestDto(" Missing verification ", "secret-token", [6]), CancellationToken.None);

        result.Status.Should().Be("Rejected");
        result.DecisionReason.Should().Be("Missing verification");
        (await db.RentPaymentAccessAuditEvents.SingleAsync()).SafeMetadataJson.Should().BeNull();
    }

    [Theory]
    [InlineData(RentPaymentAccessStatus.Approved)]
    [InlineData(RentPaymentAccessStatus.Rejected)]
    [InlineData(RentPaymentAccessStatus.Suspended)]
    public async Task Rejection_is_rejected_from_any_state_other_than_pending(RentPaymentAccessStatus status)
    {
        await using var db = CreateContext();
        var request = AddRequest(db, status, rowVersion: [9]);
        await db.SaveChangesAsync();
        var service = CreateService(db);

        var act = () => service.RejectAsync(request.PublicId, 8,
            new ReviewRentPaymentAccessRequestDto("Reason", null, [9]), CancellationToken.None);

        await act.Should().ThrowAsync<RentPaymentAccessInvalidTransitionException>();
    }

    [Theory]
    [InlineData(RentPaymentAccessStatus.Pending)]
    [InlineData(RentPaymentAccessStatus.Approved)]
    public async Task Suspension_is_allowed_from_pending_or_approved(RentPaymentAccessStatus status)
    {
        await using var db = CreateContext();
        var request = AddRequest(db, status, rowVersion: [7]);
        await db.SaveChangesAsync();
        var service = CreateService(db);

        var result = await service.SuspendAsync(request.PublicId, 8,
            new ReviewRentPaymentAccessRequestDto(" Risk review required ", null, [7]), CancellationToken.None);

        result.Status.Should().Be("Suspended");
        result.DecisionReason.Should().Be("Risk review required");
        var audit = await db.RentPaymentAccessAuditEvents.SingleAsync();
        audit.PriorStatus.Should().Be(status);
        audit.NextStatus.Should().Be(RentPaymentAccessStatus.Suspended);
    }

    [Fact]
    public async Task Suspension_requires_a_reason()
    {
        await using var db = CreateContext();
        var request = AddRequest(db, RentPaymentAccessStatus.Approved, rowVersion: [7]);
        await db.SaveChangesAsync();
        var service = CreateService(db);

        var act = () => service.SuspendAsync(request.PublicId, 8,
            new ReviewRentPaymentAccessRequestDto(null, null, [7]), CancellationToken.None);

        await act.Should().ThrowAsync<RentPaymentAccessValidationException>();
        request.Status.Should().Be(RentPaymentAccessStatus.Approved);
    }

    [Fact]
    public async Task Suspension_is_rejected_from_rejected_or_suspended()
    {
        await using var db = CreateContext();
        var request = AddRequest(db, RentPaymentAccessStatus.Rejected, rowVersion: [7]);
        await db.SaveChangesAsync();
        var service = CreateService(db);

        var act = () => service.SuspendAsync(request.PublicId, 8,
            new ReviewRentPaymentAccessRequestDto("Reason", null, [7]), CancellationToken.None);

        await act.Should().ThrowAsync<RentPaymentAccessInvalidTransitionException>();
    }

    [Fact]
    public async Task Stale_row_version_returns_typed_concurrency_conflict()
    {
        await using var db = CreateContext();
        var request = AddRequest(db, RentPaymentAccessStatus.Pending, rowVersion: [10, 20]);
        await db.SaveChangesAsync();
        var service = CreateService(db);

        var act = () => service.ApproveAsync(request.PublicId, 8,
            new ReviewRentPaymentAccessRequestDto(null, null, [10, 21]), CancellationToken.None);

        await act.Should().ThrowAsync<RentPaymentAccessConcurrencyException>();
        request.Status.Should().Be(RentPaymentAccessStatus.Pending);
        (await db.RentPaymentAccessAuditEvents.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Organization_read_never_returns_another_organizations_request()
    {
        await using var db = CreateContext();
        AddRequest(db, RentPaymentAccessStatus.Approved, organizationId: 702, rowVersion: [1]);
        await db.SaveChangesAsync();
        var service = CreateService(db);

        var result = await service.GetForOrganizationAsync(701, CancellationToken.None);

        result.OrganizationId.Should().Be(701);
        result.Status.Should().Be("NotRequested");
        result.PublicId.Should().BeNull();
    }

    [Fact]
    public async Task Missing_organization_request_maps_to_synthetic_not_requested()
    {
        await using var db = CreateContext();
        var service = CreateService(db);

        var result = await service.GetForOrganizationAsync(701, CancellationToken.None);

        result.Should().Be(new RentPaymentAccessDto(null, 701, "NotRequested", null, null, null));
    }

    [Fact]
    public async Task Admin_list_filters_status_and_maps_organization_and_requester_names()
    {
        await using var db = CreateContext();
        db.Organizations.AddRange(
            new Organization { Id = 701, Name = "Pine Property Group" },
            new Organization { Id = 702, Name = "Oak Property Group" });
        db.Users.AddRange(
            new User { Id = 41, FirstName = "Avery", LastName = "Landlord" },
            new User { Id = 42, FirstName = "Blake", LastName = "Owner" });
        AddRequest(db, RentPaymentAccessStatus.Pending, 701, requestedByUserId: 41, rowVersion: [1]);
        AddRequest(db, RentPaymentAccessStatus.Approved, 702, requestedByUserId: 42, rowVersion: [2]);
        await db.SaveChangesAsync();
        var service = CreateService(db);

        var result = await service.ListForAdminAsync("pending", CancellationToken.None);

        result.Should().ContainSingle();
        result[0].OrganizationId.Should().Be(701);
        result[0].OrganizationName.Should().Be("Pine Property Group");
        result[0].RequestedBy.Should().Be("Avery Landlord");
        result[0].Status.Should().Be("Pending");
    }

    [Fact]
    public async Task Admin_detail_includes_ordered_audit_history_and_internal_notes()
    {
        await using var db = CreateContext();
        db.Organizations.Add(new Organization { Id = 701, Name = "Pine Property Group" });
        db.Users.AddRange(
            new User { Id = 41, FirstName = "Avery", LastName = "Landlord" },
            new User { Id = 8, FirstName = "Riley", LastName = "Reviewer" });
        var request = AddRequest(db, RentPaymentAccessStatus.Approved, rowVersion: [4]);
        request.ReviewedByUserId = 8;
        request.InternalNotes = "Support-only context";
        AddAudit(db, request, RentPaymentAccessStatus.Pending, RentPaymentAccessStatus.Approved, 8,
            InitialNow.AddMinutes(2).UtcDateTime);
        AddAudit(db, request, null, RentPaymentAccessStatus.Pending, 41, InitialNow.UtcDateTime);
        await db.SaveChangesAsync();
        var service = CreateService(db);

        var result = await service.GetForAdminAsync(request.PublicId, CancellationToken.None);

        result.Should().NotBeNull();
        result!.OrganizationName.Should().Be("Pine Property Group");
        result.RequestedBy.Should().Be("Avery Landlord");
        result.InternalNotes.Should().Be("Support-only context");
        result.AuditEvents.Select(x => x.NextStatus).Should().Equal("Pending", "Approved");
    }

    [Fact]
    public async Task Admin_detail_reports_when_the_organization_has_a_connected_payee()
    {
        await using var db = CreateContext();
        db.Organizations.Add(new Organization { Id = 701, Name = "Pine Property Group" });
        db.Users.Add(new User { Id = 41, FirstName = "Avery", LastName = "Landlord" });
        var request = AddRequest(db, RentPaymentAccessStatus.Approved, organizationId: 701);
        db.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
        {
            UserId = 41,
            StripeAccountId = "acct_reviewed",
            ApprovedOrganizationId = 701
        });
        await db.SaveChangesAsync();

        var result = await CreateService(db).GetForAdminAsync(request.PublicId, CancellationToken.None);

        result!.ConnectedPayeeExists.Should().BeTrue();
    }
    [Fact]
    public async Task Admin_transition_for_missing_public_id_returns_typed_not_found()
    {
        await using var db = CreateContext();
        var service = CreateService(db);

        var act = () => service.ApproveAsync(Guid.NewGuid(), 8,
            new ReviewRentPaymentAccessRequestDto(null, null, [1]), CancellationToken.None);

        await act.Should().ThrowAsync<RentPaymentAccessNotFoundException>();
    }

    private static RentPaymentAccessService CreateService(
        DataContext db,
        TimeProvider? clock = null,
        IRentPaymentAccessNotificationService? notifier = null,
        ILogger<RentPaymentAccessService>? logger = null) =>
        new(db, clock ?? new MutableTimeProvider(InitialNow), notifier ?? new RecordingNotifier(),
            logger ?? new CapturingLogger<RentPaymentAccessService>());

    private static DataContext CreateContext() => new(
        new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase($"rent-payment-access-service-{Guid.NewGuid()}")
            .Options);

    private static RentPaymentAccessRequest AddRequest(
        DataContext db,
        RentPaymentAccessStatus status,
        int organizationId = 701,
        int requestedByUserId = 41,
        byte[]? rowVersion = null)
    {
        var request = new RentPaymentAccessRequest
        {
            OrganizationId = organizationId,
            Status = status,
            RequestedByUserId = requestedByUserId,
            RequestedAtUtc = InitialNow.AddDays(-1).UtcDateTime,
            StatusChangedAtUtc = InitialNow.AddDays(-1).UtcDateTime,
            RowVersion = rowVersion ?? [1]
        };
        db.RentPaymentAccessRequests.Add(request);
        return request;
    }

    private static void AddAudit(
        DataContext db,
        RentPaymentAccessRequest request,
        RentPaymentAccessStatus? priorStatus,
        RentPaymentAccessStatus nextStatus,
        int actorUserId,
        DateTime? occurredAtUtc = null) =>
        db.RentPaymentAccessAuditEvents.Add(new RentPaymentAccessAuditEvent
        {
            RentPaymentAccessRequest = request,
            OrganizationId = request.OrganizationId,
            PriorStatus = priorStatus,
            NextStatus = nextStatus,
            ActorUserId = actorUserId,
            OccurredAtUtc = occurredAtUtc ?? InitialNow.UtcDateTime
        });

    private sealed class MutableTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }

    private sealed class RecordingNotifier : IRentPaymentAccessNotificationService
    {
        public List<RentPaymentAccessAdminDetailDto> Requests { get; } = [];
        public Func<RentPaymentAccessAdminDetailDto, Task<RentPaymentAccessNotificationResult>> Handler { get; init; } =
            _ => Task.FromResult(new RentPaymentAccessNotificationResult(0, 0, 0));

        public async Task<RentPaymentAccessNotificationResult> NotifyReviewersAsync(
            RentPaymentAccessAdminDetailDto request,
            CancellationToken cancellationToken)
        {
            Requests.Add(request);
            return await Handler(request);
        }
    }

    private sealed class CapturingLogger<T> : ILogger<T>
    {
        public List<string> Messages { get; } = [];
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter) => Messages.Add(formatter(state, exception));
    }
}
