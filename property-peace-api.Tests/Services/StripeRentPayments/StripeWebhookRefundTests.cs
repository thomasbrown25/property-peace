using brownstone_hub_api.Repositories.NotificationSettings;
using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Repositories.Subscriptions;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Services.StripeRentPayments;
using brownstone_hub_api.Services.StripeService;
using Microsoft.Extensions.Logging;
using Moq;
using Stripe;
using Xunit;

namespace brownstone_hub_api.Tests.Services.StripeRentPayments;

public sealed class StripeWebhookRefundTests
{
    [Fact]
    public async Task RefundCreated_UsesAuthoritativeCumulativeChargeAmountWithoutWaitingForChargeRefunded()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var rentPayments = new Mock<IStripeRentPaymentService>();
        var lossAccounting = new Mock<IStripeRentLossAccountingService>();
        var gateway = new Mock<IStripeRentGateway>();
        gateway.Setup(x => x.GetSourceStateAsync("ch_refund", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripeRentSourceState(true, true, false, false, null,
                "pi_refund", 10_000, "usd", 3_000));
        var service = CreateService(context, rentPayments.Object, lossAccounting.Object, gateway.Object);

        await service.HandleRefundCreatedAsync(RefundEvent("evt_refund_1", "re_1", 3_000));

        rentPayments.Verify(x => x.MarkBlockedAsync("pi_refund", "ch_refund",
            StripeRentPaymentBlockKind.Refund, "re_1", It.IsAny<string>(), 3_000,
            It.IsAny<CancellationToken>()), Times.Once);
        lossAccounting.Verify(x => x.ApplyAsync(
            It.Is<StripeRentLossAccountingCommand>(c =>
                c.PaymentIntentId == "pi_refund" && c.Kind == StripeRentPaymentBlockKind.Refund),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RefundCreated_AfterChargeRefunded_ReplaysSameCumulativeTargetInsteadOfAddingRefundAgain()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var rentPayments = new Mock<IStripeRentPaymentService>();
        var lossAccounting = new Mock<IStripeRentLossAccountingService>();
        var gateway = new Mock<IStripeRentGateway>();
        gateway.Setup(x => x.GetSourceStateAsync("ch_refund", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripeRentSourceState(true, true, false, false, null,
                "pi_refund", 10_000, "usd", 5_000));
        var service = CreateService(context, rentPayments.Object, lossAccounting.Object, gateway.Object);

        await service.HandleChargeRefundedAsync(ChargeRefundedEvent(5_000));
        await service.HandleRefundCreatedAsync(RefundEvent("evt_refund_late", "re_late", 2_000));

        rentPayments.Verify(x => x.MarkBlockedAsync("pi_refund", "ch_refund",
            StripeRentPaymentBlockKind.Refund, It.IsAny<string>(), It.IsAny<string>(), 5_000,
            It.IsAny<CancellationToken>()), Times.Exactly(2));
        rentPayments.Verify(x => x.MarkBlockedAsync(It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<StripeRentPaymentBlockKind>(), It.IsAny<string>(), It.IsAny<string>(), 7_000,
            It.IsAny<CancellationToken>()), Times.Never);
    }

    private static StripeWebhookService CreateService(
        brownstone_hub_api.Data.DataContext context,
        IStripeRentPaymentService rentPayments,
        IStripeRentLossAccountingService lossAccounting,
        IStripeRentGateway gateway) => new(
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
            rentPayments,
            Mock.Of<IStripeRentAllocationService>(),
            lossAccounting,
            Mock.Of<IStripeConnectedPayeeService>(),
            Mock.Of<IStripeConnectedAccountGateway>(),
            gateway);

    private static Event RefundEvent(string eventId, string refundId, long amount) => new()
    {
        Id = eventId,
        Type = "refund.created",
        Created = DateTime.UtcNow,
        Data = new EventData
        {
            Object = new Refund
            {
                Id = refundId,
                ChargeId = "ch_refund",
                PaymentIntentId = "pi_refund",
                Amount = amount,
                Status = "succeeded"
            }
        }
    };

    private static Event ChargeRefundedEvent(long cumulativeAmount) => new()
    {
        Id = "evt_charge_refunded",
        Type = "charge.refunded",
        Created = DateTime.UtcNow,
        Data = new EventData
        {
            Object = new Charge
            {
                Id = "ch_refund",
                PaymentIntentId = "pi_refund",
                Amount = 10_000,
                AmountRefunded = cumulativeAmount,
                Refunded = cumulativeAmount == 10_000
            }
        }
    };
}
