using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.NotificationSettings;
using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Repositories.Subscriptions;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Services.StripeRentPayments;
using brownstone_hub_api.Services.StripeService;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Stripe;
using StripeAccount = Stripe.Account;
using Xunit;

namespace brownstone_hub_api.Tests.Services.StripeRentPayments;

public sealed class StripeWebhookConnectedAccountTests
{
    [Fact]
    public async Task AccountUpdated_ResolvesPayloadAccountIdThroughConnectedAccountGateway()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var gateway = new Mock<IStripeConnectedAccountGateway>(MockBehavior.Strict);
        var payees = new Mock<IStripeConnectedPayeeService>(MockBehavior.Strict);
        var authoritativeSnapshot = Snapshot("acct_payload", "authoritative-fingerprint");
        gateway.Setup(x => x.GetSnapshotAsync("acct_payload", It.IsAny<CancellationToken>()))
            .ReturnsAsync(authoritativeSnapshot);
        payees.Setup(x => x.SyncStripeSnapshotAsync(authoritativeSnapshot, "evt_account", It.IsAny<CancellationToken>()))
            .ReturnsAsync((StripeConnectedPayeeReview?)null);
        var service = CreateService(context, payees.Object, gateway.Object);
        var stripeEvent = AccountUpdatedEvent(new StripeAccount
        {
            Id = "acct_payload",
            ExternalAccounts = new StripeList<IExternalAccount>
            {
                HasMore = true,
                Data = []
            }
        });

        await service.HandleAccountUpdatedAsync(stripeEvent);

        gateway.Verify(x => x.GetSnapshotAsync("acct_payload", It.IsAny<CancellationToken>()), Times.Once);
        payees.Verify(x => x.SyncStripeSnapshotAsync(authoritativeSnapshot, "evt_account", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task AccountUpdated_WhenEmbeddedExternalAccountsAreAbsent_StillUsesGatewaySnapshot()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var gateway = new Mock<IStripeConnectedAccountGateway>(MockBehavior.Strict);
        var payees = new Mock<IStripeConnectedPayeeService>(MockBehavior.Strict);
        var authoritativeSnapshot = Snapshot("acct_without_embedded_list", "complete-list-fingerprint");
        gateway.Setup(x => x.GetSnapshotAsync("acct_without_embedded_list", It.IsAny<CancellationToken>()))
            .ReturnsAsync(authoritativeSnapshot);
        payees.Setup(x => x.SyncStripeSnapshotAsync(authoritativeSnapshot, "evt_account", It.IsAny<CancellationToken>()))
            .ReturnsAsync((StripeConnectedPayeeReview?)null);
        var service = CreateService(context, payees.Object, gateway.Object);

        await service.HandleAccountUpdatedAsync(AccountUpdatedEvent(new StripeAccount
        {
            Id = "acct_without_embedded_list",
            ExternalAccounts = null
        }));

        gateway.Verify(x => x.GetSnapshotAsync("acct_without_embedded_list", It.IsAny<CancellationToken>()), Times.Once);
        payees.Verify(x => x.SyncStripeSnapshotAsync(authoritativeSnapshot, "evt_account", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task AccountApplicationDeauthorized_SuspendsOnlyTheKnownLinkedPayee()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
        {
            StripeAccountId = "acct_linked",
            Status = StripePayeeReviewStatus.PayoutApproved,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        await context.SaveChangesAsync();

        var payees = new Mock<IStripeConnectedPayeeService>(MockBehavior.Strict);
        payees.Setup(x => x.SuspendAsync(
                "acct_linked",
                null,
                "Stripe Connect authorization was revoked by the connected account.",
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripeConnectedPayeeReview());
        var service = CreateService(context, payees.Object, Mock.Of<IStripeConnectedAccountGateway>());

        await service.HandleAccountApplicationDeauthorizedAsync(new Event
        {
            Id = "evt_deauthorized",
            Type = "account.application.deauthorized",
            Account = "acct_linked"
        });

        payees.Verify(x => x.SuspendAsync(
            "acct_linked",
            null,
            "Stripe Connect authorization was revoked by the connected account.",
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData("acct_foreign")]
    [InlineData(null)]
    public async Task AccountApplicationDeauthorized_WithoutKnownLinkedPayee_DoesNotSuspend(string? accountId)
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var payees = new Mock<IStripeConnectedPayeeService>(MockBehavior.Strict);
        var service = CreateService(context, payees.Object, Mock.Of<IStripeConnectedAccountGateway>());

        await service.HandleAccountApplicationDeauthorizedAsync(new Event
        {
            Id = "evt_deauthorized_unlinked",
            Type = "account.application.deauthorized",
            Account = accountId
        });

        payees.VerifyNoOtherCalls();
        Assert.Equal(0, await context.StripeConnectedPayeeReviews.CountAsync());
    }

    private static Event AccountUpdatedEvent(StripeAccount account) => new()
    {
        Id = "evt_account",
        Type = "account.updated",
        Data = new EventData { Object = account }
    };

    private static StripeConnectedAccountSnapshot Snapshot(string accountId, string fingerprint) => new(
        accountId,
        DateTimeOffset.Parse("2026-08-02T12:00:00Z"),
        true,
        true,
        true,
        "active",
        [],
        [],
        null,
        fingerprint,
        "daily",
        true);

    private static StripeWebhookService CreateService(
        DataContext context,
        IStripeConnectedPayeeService payees,
        IStripeConnectedAccountGateway gateway) => new(
            Mock.Of<ISubscriptionRepository>(),
            Mock.Of<ISubscriptionPlanRepository>(),
            Mock.Of<ISubscriptionHistoryRepository>(),
            Mock.Of<IOrganizationRepository>(),
            context,
            Mock.Of<ILogger<StripeWebhookService>>(),
            Mock.Of<INotificationService>(),
            Mock.Of<IUserRepository>(),
            Mock.Of<INotificationSettingRepository>(),
            Mock.Of<IStripeService>(),
            Mock.Of<IStripeRentPaymentService>(),
            Mock.Of<IStripeRentAllocationService>(),
            Mock.Of<IStripeRentLossAccountingService>(),
            payees,
            gateway,
            Mock.Of<IStripeRentGateway>());
}
