using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Security;
using brownstone_hub_api.Services.RentPaymentAccess;
using brownstone_hub_api.Services.StripeRentPayments;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.RentPaymentAccess;

public sealed class RentPaymentActionReadinessServiceTests
{
    private const int OrganizationId = 701;
    private const int ActorUserId = 42;
    private const int PayeeUserId = 10;
    private static readonly DateTimeOffset Now = new(2031, 4, 5, 14, 30, 0, TimeSpan.Zero);

    public static TheoryData<RentPaymentAction, bool, string?> ProviderCases => new()
    {
        { RentPaymentAction.RequestAccess, true, null },
        { RentPaymentAction.Configure, false, "provider_disabled" },
        { RentPaymentAction.Pay, false, "provider_disabled" },
        { RentPaymentAction.Transfer, false, "provider_disabled" }
    };

    [Theory]
    [MemberData(nameof(ProviderCases))]
    public async Task Provider_disable_is_action_specific(
        RentPaymentAction action, bool allowed, string? blocker)
    {
        await using var db = CreateContext();
        SeedOrganization(db, "Manager");
        if (action != RentPaymentAction.RequestAccess)
        {
            SeedAccess(db, RentPaymentAccessStatus.Approved);
            SeedPayee(db, StripePayeeReviewStatus.PayoutApproved, true);
        }
        await db.SaveChangesAsync();
        var result = await CreateService(db, false, true).EvaluateAsync(
            ActorUserId, OrganizationId, action, CancellationToken.None);
        result.Allowed.Should().Be(allowed);
        result.ProviderEnabled.Should().BeFalse();
        if (blocker is null) result.Blockers.Should().NotContain("provider_disabled");
        else result.Blockers.Should().Contain(blocker);
    }

    public static TheoryData<RentPaymentAccessStatus?, RentPaymentAction, bool, string?> AccessCases => new()
    {
        { null, RentPaymentAction.RequestAccess, true, null },
        { null, RentPaymentAction.Configure, false, "access_not_requested" },
        { RentPaymentAccessStatus.Pending, RentPaymentAction.RequestAccess, false, "access_pending" },
        { RentPaymentAccessStatus.Pending, RentPaymentAction.Pay, false, "access_pending" },
        { RentPaymentAccessStatus.Rejected, RentPaymentAction.RequestAccess, true, null },
        { RentPaymentAccessStatus.Rejected, RentPaymentAction.Configure, false, "access_rejected" },
        { RentPaymentAccessStatus.Suspended, RentPaymentAction.RequestAccess, false, "access_suspended" },
        { RentPaymentAccessStatus.Suspended, RentPaymentAction.Transfer, false, "access_suspended" },
        { RentPaymentAccessStatus.Approved, RentPaymentAction.RequestAccess, false, "access_not_approved" }
    };

    [Theory]
    [MemberData(nameof(AccessCases))]
    public async Task Access_state_controls_action(
        RentPaymentAccessStatus? status, RentPaymentAction action, bool allowed, string? blocker)
    {
        await using var db = CreateContext();
        SeedOrganization(db, "Manager");
        if (status.HasValue) SeedAccess(db, status.Value);
        if (action is RentPaymentAction.Pay or RentPaymentAction.Transfer)
            SeedPayee(db, StripePayeeReviewStatus.PayoutApproved, true);
        await db.SaveChangesAsync();
        var result = await CreateService(db, transfersEnabled: true).EvaluateAsync(
            ActorUserId, OrganizationId, action, CancellationToken.None);
        result.Allowed.Should().Be(allowed);
        result.AccessStatus.Should().Be(status?.ToString() ?? "NotRequested");
        if (blocker is null) result.Blockers.Should().BeEmpty();
        else result.Blockers.Should().Contain(blocker);
    }

    [Fact]
    public async Task Configure_allows_approved_manager_before_payee_approval()
    {
        await using var db = CreateContext();
        SeedOrganization(db, "Manager");
        SeedAccess(db, RentPaymentAccessStatus.Approved);
        SeedPayee(db, StripePayeeReviewStatus.UnderReview, false);
        await db.SaveChangesAsync();
        var result = await CreateService(db).EvaluateAsync(
            ActorUserId, OrganizationId, RentPaymentAction.Configure, CancellationToken.None);
        result.Allowed.Should().BeTrue();
        result.ConnectedPayeeApproved.Should().BeFalse();
        result.ConnectedPayeeReady.Should().BeFalse();
        result.Blockers.Should().BeEmpty();
    }

    [Fact]
    public async Task Configure_does_not_call_connected_payee_approval_service()
    {
        await using var db = CreateContext();
        SeedOrganization(db, "Manager");
        SeedAccess(db, RentPaymentAccessStatus.Approved);
        SeedPayee(db, StripePayeeReviewStatus.PayoutApproved, true);
        await db.SaveChangesAsync();
        var payeeService = new Mock<IStripeConnectedPayeeService>(MockBehavior.Strict);

        var result = await CreateService(db, payeeService: payeeService.Object).EvaluateAsync(
            ActorUserId, OrganizationId, RentPaymentAction.Configure, CancellationToken.None);

        result.Allowed.Should().BeTrue();
        result.Blockers.Should().BeEmpty();
    }

    public static TheoryData<StripePayeeReviewStatus?, bool, string> PayeeCases => new()
    {
        { null, false, "connected_payee_missing" },
        { StripePayeeReviewStatus.UnderReview, false, "connected_payee_under_review" },
        { StripePayeeReviewStatus.PayoutApproved, false, "connected_payee_not_ready" }
    };

    [Theory]
    [MemberData(nameof(PayeeCases))]
    public async Task Pay_requires_approved_ready_payee(
        StripePayeeReviewStatus? status, bool ready, string blocker)
    {
        await using var db = CreateContext();
        SeedOrganization(db, "Viewer");
        SeedAccess(db, RentPaymentAccessStatus.Approved);
        if (status.HasValue) SeedPayee(db, status.Value, ready);
        await db.SaveChangesAsync();
        var result = await CreateService(db).EvaluateAsync(
            ActorUserId, OrganizationId, RentPaymentAction.Pay, CancellationToken.None);
        result.Allowed.Should().BeFalse();
        result.Blockers.Should().Contain(blocker);
        result.ConnectedPayeeApproved.Should().Be(status == StripePayeeReviewStatus.PayoutApproved);
        result.ConnectedPayeeReady.Should().BeFalse();
    }

    [Fact]
    public async Task Transfer_flag_never_blocks_pay()
    {
        await using var db = CreateContext();
        SeedOrganization(db, "Viewer");
        SeedAccess(db, RentPaymentAccessStatus.Approved);
        SeedPayee(db, StripePayeeReviewStatus.PayoutApproved, true);
        await db.SaveChangesAsync();
        var service = CreateService(db, transfersEnabled: false);
        var pay = await service.EvaluateAsync(
            ActorUserId, OrganizationId, RentPaymentAction.Pay, CancellationToken.None);
        var transfer = await service.EvaluateAsync(
            ActorUserId, OrganizationId, RentPaymentAction.Transfer, CancellationToken.None);
        pay.Allowed.Should().BeTrue();
        pay.Blockers.Should().NotContain("transfers_disabled");
        transfer.Allowed.Should().BeFalse();
        transfer.Blockers.Should().ContainSingle().Which.Should().Be("transfers_disabled");
    }

    [Theory]
    [InlineData(RentPaymentAction.RequestAccess)]
    [InlineData(RentPaymentAction.Configure)]
    [InlineData(RentPaymentAction.Pay)]
    [InlineData(RentPaymentAction.Transfer)]
    public async Task Missing_active_actor_blocks_all_actions(RentPaymentAction action)
    {
        await using var db = CreateContext();
        SeedOrganization(db, null);
        SeedAccess(db, RentPaymentAccessStatus.Approved);
        SeedPayee(db, StripePayeeReviewStatus.PayoutApproved, true);
        await db.SaveChangesAsync();
        var result = await CreateService(db, transfersEnabled: true).EvaluateAsync(
            ActorUserId, OrganizationId, action, CancellationToken.None);
        result.Allowed.Should().BeFalse();
        result.Blockers.Should().Contain("actor_not_authorized");
    }

    [Fact]
    public async Task Authority_failure_returns_denied_stable_blockers()
    {
        await using var db = CreateContext();
        var authority = new Mock<IOrganizationAuthorityResolver>();
        authority.Setup(x => x.ResolveActiveMemberAsync(
                ActorUserId, OrganizationId, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("unavailable"));
        var result = await CreateService(db, authority: authority.Object).EvaluateAsync(
            ActorUserId, OrganizationId, RentPaymentAction.Configure, CancellationToken.None);
        result.Allowed.Should().BeFalse();
        result.Blockers.Should().Equal(
            "provider_disabled", "access_not_approved", "actor_not_authorized");
    }

    private static RentPaymentActionReadinessService CreateService(
        DataContext db,
        bool providerEnabled = true,
        bool transfersEnabled = true,
        IOrganizationAuthorityResolver? authority = null,
        IStripeConnectedPayeeService? payeeService = null)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Stripe:RentPaymentsEnabled"] = providerEnabled.ToString(),
            ["Stripe:SecretKey"] = "stripe-secret",
            ["Stripe:TransfersEnabled"] = transfersEnabled.ToString()
        }).Build();
        return new RentPaymentActionReadinessService(
            db, authority ?? new OrganizationAuthorityResolver(db),
            payeeService ?? new StripeConnectedPayeeService(db, new FixedTimeProvider(Now)), configuration,
            new FixedTimeProvider(Now), NullLogger<RentPaymentActionReadinessService>.Instance);
    }

    private static DataContext CreateContext() => new(new DbContextOptionsBuilder<DataContext>()
        .UseInMemoryDatabase($"rent-payment-action-readiness-{Guid.NewGuid()}").Options);

    private static void SeedOrganization(DataContext db, string? actorRole)
    {
        db.Organizations.Add(new Organization
        {
            Id = OrganizationId, Name = "Readiness Org", IsActive = true, IsDeleted = false
        });
        if (actorRole is not null)
            db.OrganizationMembers.Add(new OrganizationMember
            {
                OrganizationId = OrganizationId, UserId = ActorUserId, Role = actorRole, IsActive = true
            });
        db.OrganizationMembers.Add(new OrganizationMember
        {
            OrganizationId = OrganizationId, UserId = PayeeUserId, Role = "Owner", IsActive = true
        });
    }

    private static void SeedAccess(DataContext db, RentPaymentAccessStatus status) =>
        db.RentPaymentAccessRequests.Add(new RentPaymentAccessRequest
        {
            OrganizationId = OrganizationId, Status = status, RequestedByUserId = PayeeUserId,
            RequestedAtUtc = Now.UtcDateTime, StatusChangedAtUtc = Now.UtcDateTime
        });

    private static void SeedPayee(DataContext db, StripePayeeReviewStatus status, bool ready) =>
        db.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
        {
            UserId = PayeeUserId,
            StripeAccountId = "acct_ready",
            Status = status,
            ApprovedAt = status == StripePayeeReviewStatus.PayoutApproved ? Now : null,
            ApprovedOrganizationId = status == StripePayeeReviewStatus.PayoutApproved ? OrganizationId : null,
            PropertyAuthorityAttested = status == StripePayeeReviewStatus.PayoutApproved,
            LastStripeSnapshotAt = ready ? Now : Now.AddMinutes(-10),
            StripeDetailsSubmitted = true,
            StripePayoutsEnabled = true,
            StripeTransfersActive = true,
            StripeTransferCapabilityStatus = "active",
            ExternalAccountFingerprint = "fingerprint",
            PayoutSchedulePolicy = "manual",
            InstantPayoutsAllowed = false,
            CreatedAt = Now,
            UpdatedAt = Now
        });

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
