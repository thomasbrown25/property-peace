using brownstone_hub_api.Dtos.Stripe;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Services.PaymentService;
using brownstone_hub_api.Services.StripeRentPayments;
using brownstone_hub_api.Services.StripeService;
using brownstone_hub_api.Tests.Services.StripeRentPayments;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.StripeService;

public sealed class StripeAccountReadinessTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 2, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task AccountStatus_FreshCompleteApprovedSnapshot_ReportsOnlyAccountLevelReadiness()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        AddApprovedReviewAndAuthority(context, "acct_ready", "approved-fingerprint");
        await context.SaveChangesAsync();
        var gateway = new StubGateway(new StripeConnectedAccountSnapshot(
            "acct_ready", Now, true, true, true, "active", [], [], null,
            "approved-fingerprint", "manual", false, ChargesEnabled: true));
        var service = CreateService(context, gateway);

        var response = await service.GetAccountStatusAsync("acct_ready", 42, 2);

        response.Success.Should().BeTrue();
        response.Data.Should().NotBeNull();
        response.Data!.IsAccountReadyForRentTransfers.Should().BeTrue();
        response.Data.AccountReadinessReason.Should().BeNull();
        response.Data.Status.Should().Be("account_transfer_ready");
        response.Message.Should().ContainEquivalentOf("account-level");
        typeof(StripeAccountStatusDto).GetProperty("CanReceiveRentPayouts").Should().BeNull();
    }

    public static IEnumerable<object?[]> AccountControlRegressions()
    {
        yield return [new StripeConnectedAccountSnapshot("acct_control", Now, true, true, true, "active", ["company.tax_id"], [], null, "approved-fingerprint", "manual", false), "currently-due"];
        yield return [new StripeConnectedAccountSnapshot("acct_control", Now, true, true, true, "active", [], [], "requirements.pending_verification", "approved-fingerprint", "manual", false), "disabled"];
        yield return [new StripeConnectedAccountSnapshot("acct_control", Now, true, true, true, "active", [], [], null, "changed-fingerprint", "manual", false), "changed"];
        yield return [new StripeConnectedAccountSnapshot("acct_control", Now, true, true, true, "active", [], [], null, null, "manual", false), "payout destination"];
        yield return [new StripeConnectedAccountSnapshot("acct_control", Now, true, true, true, "active", [], [], null, "approved-fingerprint", "daily", false), "not manual"];
        yield return [new StripeConnectedAccountSnapshot("acct_control", Now, true, true, true, "active", [], [], null, "approved-fingerprint", "manual", true), "Instant Payout"];
        yield return [new StripeConnectedAccountSnapshot("acct_control", Now.AddMinutes(-6), true, true, true, "active", [], [], null, "approved-fingerprint", "manual", false), "stale"];
    }

    [Theory]
    [MemberData(nameof(AccountControlRegressions))]
    public async Task AccountStatus_AccountControlRegression_IsNotReady(
        StripeConnectedAccountSnapshot snapshot, string expectedReason)
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        AddApprovedReviewAndAuthority(context, "acct_control", "approved-fingerprint");
        await context.SaveChangesAsync();
        var service = CreateService(context, new StubGateway(snapshot));

        var response = await service.GetAccountStatusAsync("acct_control", 42, 2);

        response.Success.Should().BeTrue();
        response.Data!.IsAccountReadyForRentTransfers.Should().BeFalse();
        response.Data.AccountReadinessReason.Should().Contain(expectedReason);
        response.Data.Status.Should().NotBe("account_transfer_ready");
    }

    [Fact]
    public async Task AccountStatus_ApprovalWithoutCurrentScopedAuthority_IsNotReady()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        AddApprovedReviewAndAuthority(context, "acct_authority", "approved-fingerprint", activeAuthority: false);
        await context.SaveChangesAsync();
        var snapshot = new StripeConnectedAccountSnapshot(
            "acct_authority", Now, true, true, true, "active", [], [], null,
            "approved-fingerprint", "manual", false);
        var service = CreateService(context, new StubGateway(snapshot));

        var response = await service.GetAccountStatusAsync("acct_authority", 42, 2);

        response.Data!.IsAccountReadyForRentTransfers.Should().BeFalse();
        response.Data.AccountReadinessReason.Should().Contain("current organization authority");
    }

    [Fact]
    public async Task AccountStatus_SnapshotRetrievalFailure_FailsClosedWithoutClaimingTransferReadiness()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        AddApprovedReviewAndAuthority(context, "acct_unavailable", "approved-fingerprint");
        await context.SaveChangesAsync();
        var gateway = new Mock<IStripeConnectedAccountGateway>();
        gateway.Setup(x => x.GetSnapshotAsync("acct_unavailable", It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Stripe unavailable"));
        var service = CreateService(context, gateway.Object);

        var response = await service.GetAccountStatusAsync("acct_unavailable", 42, 2);

        response.Success.Should().BeTrue();
        response.Data!.IsAccountReadyForRentTransfers.Should().BeFalse();
        response.Data.AccountReadinessReason.Should().Contain("fresh Stripe connected-account snapshot");
    }

    private static brownstone_hub_api.Services.StripeService.StripeService CreateService(
        brownstone_hub_api.Data.DataContext context,
        IStripeConnectedAccountGateway gateway)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Stripe:ConnectedPayeeRisk:SnapshotMaxAgeMinutes"] = "5"
        }).Build();
        var payeeService = new StripeConnectedPayeeService(context, new FixedTimeProvider(Now));
        return new brownstone_hub_api.Services.StripeService.StripeService(
            Mock.Of<IUserRepository>(),
            Mock.Of<ILeaseRepository>(),
            Mock.Of<IPropertyRepository>(),
            Mock.Of<IPaymentService>(),
            Mock.Of<INotificationService>(),
            context,
            configuration,
            Mock.Of<ILogger<brownstone_hub_api.Services.StripeService.StripeService>>(),
            Mock.Of<IHttpContextAccessor>(),
            Mock.Of<IStripeRentPaymentService>(),
            payeeService,
            gateway,
            new FixedTimeProvider(Now));
    }

    private static void AddApprovedReviewAndAuthority(
        brownstone_hub_api.Data.DataContext context,
        string accountId,
        string fingerprint,
        bool activeAuthority = true)
    {
        context.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
        {
            UserId = 42,
            StripeAccountId = accountId,
            Status = StripePayeeReviewStatus.PayoutApproved,
            PropertyAuthorityAttested = true,
            ApprovedOrganizationId = 2,
            ApprovedAt = Now.AddDays(-1),
            CreatedAt = Now.AddDays(-30),
            UpdatedAt = Now.AddDays(-1),
            LastStripeSnapshotAt = Now.AddDays(-1),
            StripeDetailsSubmitted = true,
            StripePayoutsEnabled = true,
            StripeTransfersActive = true,
            StripeTransferCapabilityStatus = "active",
            ExternalAccountFingerprint = fingerprint,
            PayoutSchedulePolicy = "manual"
        });
        context.OrganizationMembers.Add(new OrganizationMember
        {
            UserId = 42,
            OrganizationId = 2,
            Role = "Owner",
            IsActive = activeAuthority
        });
    }

    private sealed class StubGateway(StripeConnectedAccountSnapshot snapshot) : IStripeConnectedAccountGateway
    {
        public Task<StripeConnectedAccountSnapshot> GetSnapshotAsync(
            string stripeAccountId, CancellationToken cancellationToken = default) => Task.FromResult(snapshot);
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
