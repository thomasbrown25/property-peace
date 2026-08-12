using brownstone_hub_api.Repositories.NotificationSettings;
using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Repositories.Subscriptions;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Services.StripeRentPayments;
using brownstone_hub_api.Services.StripeService;
using brownstone_hub_api.Models;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Stripe;
using Xunit;

namespace brownstone_hub_api.Tests.Services.StripeRentPayments;

public sealed class StripeWebhookRefundTests
{
    [Fact]
    public async Task ChargeRefunded_UsesFreshSuccessfulExposureAndValidatesDurableProvenance()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var aggregate = StripeRentPaymentFlowTests.NewPayment("pi_refund");
        aggregate.StripeChargeId = "ch_refund";
        context.StripeRentPayments.Add(aggregate);
        await context.SaveChangesAsync();
        var rentPayments = new Mock<IStripeRentPaymentService>();
        var lossAccounting = new Mock<IStripeRentLossAccountingService>();
        var gateway = new Mock<IStripeRentGateway>();
        gateway.Setup(x => x.GetSourceStateAsync("ch_refund", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripeRentSourceState(true, true, false, false, null,
                "pi_refund", 10_000, "usd", 2_000));
        var service = CreateService(context, rentPayments.Object, lossAccounting.Object, gateway.Object);

        await service.HandleChargeRefundedAsync(ChargeRefundedEvent(9_000));

        rentPayments.Verify(x => x.ReconcileRefundExposureAsync("pi_refund", "ch_refund",
            string.Empty, It.IsAny<string>(), 2_000,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RefundCreated_WithMismatchedPaymentIntent_FailsClosedBeforeAccounting()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var aggregate = StripeRentPaymentFlowTests.NewPayment("pi_refund");
        aggregate.StripeChargeId = "ch_refund";
        context.StripeRentPayments.Add(aggregate);
        await context.SaveChangesAsync();
        var rentPayments = new Mock<IStripeRentPaymentService>();
        var lossAccounting = new Mock<IStripeRentLossAccountingService>();
        var gateway = new Mock<IStripeRentGateway>();
        gateway.Setup(x => x.GetSourceStateAsync("ch_refund", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripeRentSourceState(true, true, false, false, null,
                "pi_refund", 10_000, "usd", 3_000));
        var service = CreateService(context, rentPayments.Object, lossAccounting.Object, gateway.Object);
        var stripeEvent = RefundEvent("evt_bad_pi", "re_bad", 3_000);
        ((Refund)stripeEvent.Data.Object).PaymentIntentId = "pi_attacker";

        var act = () => service.HandleRefundCreatedAsync(stripeEvent);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*provenance*");
        rentPayments.Verify(x => x.MarkBlockedAsync(It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<StripeRentPaymentBlockKind>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<long?>(),
            It.IsAny<CancellationToken>()), Times.Never);
        lossAccounting.Verify(x => x.ApplyAsync(It.IsAny<StripeRentLossAccountingCommand>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task RefundUpdated_Failed_ReconcilesAuthoritativeZeroExposureSoLossCannotRemainPermanent()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var rentPayments = new Mock<IStripeRentPaymentService>();
        var lossAccounting = new Mock<IStripeRentLossAccountingService>();
        var gateway = new Mock<IStripeRentGateway>();
        gateway.Setup(x => x.GetSourceStateAsync("ch_refund", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripeRentSourceState(true, true, false, false, null,
                "pi_refund", 10_000, "usd", 0));
        var service = CreateService(context, rentPayments.Object, lossAccounting.Object, gateway.Object);

        await service.HandleRefundCreatedAsync(RefundEvent("evt_failed", "re_failed", 3_000, "failed"));

        rentPayments.Verify(x => x.ReconcileRefundExposureAsync("pi_refund", "ch_refund", "re_failed",
            It.IsAny<string>(), 0, It.IsAny<CancellationToken>()), Times.Once);
        lossAccounting.Verify(x => x.ApplyAsync(
            It.Is<StripeRentLossAccountingCommand>(c => c.PaymentIntentId == "pi_refund"),
            It.IsAny<CancellationToken>()), Times.Once);
    }
    [Fact]
    public async Task RefundSucceededThenFailed_AuthoritativeZeroRestoresAccountingWithoutDeletingLossHistory()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        await StripeRentPaymentFlowTests.SeedLeaseAsync(context, 1, 2);
        var aggregate = StripeRentPaymentFlowTests.NewPayment("pi_refund");
        aggregate.StripeChargeId = "ch_refund";
        aggregate.Status = StripeRentPaymentStatus.Held;
        aggregate.AllocationCompletedAt = DateTimeOffset.UtcNow.AddDays(-1);
        context.StripeRentPayments.Add(aggregate);
        var original = new Payment
        {
            LeaseId = 1, PropertyId = 1, OrganizationId = 2, Amount = 100m,
            PaymentDate = DateTime.UtcNow.AddDays(-1), Reference = "pi_refund", Status = "Completed",
            StripePaymentIntentId = "pi_refund", StripeChargeId = "ch_refund", Method = "card",
            CreatedByUserId = 3
        };
        context.Payments.Add(original);
        await context.SaveChangesAsync();
        context.GeneralLedgerEntries.Add(new GeneralLedgerEntry
        {
            OrganizationId = 2, AccountId = 1, TransactionId = original.Id, TransactionType = "Payment",
            Amount = 100m, TransactionDate = original.PaymentDate, Reference = original.Reference
        });
        await context.SaveChangesAsync();
        var gateway = new Mock<IStripeRentGateway>(MockBehavior.Strict);
        gateway.SetupSequence(x => x.GetSourceStateAsync("ch_refund", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripeRentSourceState(true, true, false, false, null,
                "pi_refund", 10_000, "usd", 3_000))
            .ReturnsAsync(new StripeRentSourceState(true, true, false, false, null,
                "pi_refund", 10_000, "usd", 0))
            .ReturnsAsync(new StripeRentSourceState(true, true, false, false, null,
                "pi_refund", 10_000, "usd", 0));
        var rentPayments = StripeRentPaymentFlowTests.CreateService(context, gateway.Object, true,
            transfersEnabled: false);
        var service = CreateService(context, rentPayments,
            new StripeRentLossAccountingService(context, Mock.Of<ILogger<StripeRentLossAccountingService>>()),
            gateway.Object);

        await service.HandleRefundCreatedAsync(RefundEvent("evt_succeeded", "re_transition", 3_000));
        await service.HandleRefundCreatedAsync(RefundEvent("evt_failed", "re_transition", 3_000, "failed"));

        context.ChangeTracker.Clear();
        (await context.StripeRentPayments.SingleAsync()).RefundedAmountCents.Should().Be(0);
        var paymentAdjustments = await context.Payments
            .Where(x => x.StripePaymentIntentId == "pi_refund" && x.Reference != "pi_refund")
            .OrderBy(x => x.Id).ToListAsync();
        paymentAdjustments.Select(x => x.Amount).Should().Equal(-30m, 30m);
        paymentAdjustments.Sum(x => x.Amount).Should().Be(0m);
        var immutableLossHistory = await context.GeneralLedgerEntries
            .Where(x => x.TransactionType == "PaymentLossReversal").ToListAsync();
        immutableLossHistory.Select(x => x.Amount).Should().BeEquivalentTo([-30m, 30m]);
        immutableLossHistory.Sum(x => x.Amount).Should().Be(0m);
        (await context.Payments.SingleAsync(x => x.Reference == "pi_refund")).Status.Should().Be("Completed");
        gateway.VerifyAll();
    }

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

        rentPayments.Verify(x => x.ReconcileRefundExposureAsync("pi_refund", "ch_refund",
            "re_1", It.IsAny<string>(), 3_000,
            It.IsAny<CancellationToken>()), Times.Once);
        lossAccounting.Verify(x => x.ApplyAsync(
            It.Is<StripeRentLossAccountingCommand>(c =>
                c.PaymentIntentId == "pi_refund" && c.Kind == StripeRentPaymentBlockKind.Refund),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RefundCreated_WhenRefundIsNotSucceeded_ReconcilesAuthoritativeExposureWithoutBlocking()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var rentPayments = new Mock<IStripeRentPaymentService>();
        var lossAccounting = new Mock<IStripeRentLossAccountingService>();
        var gateway = new Mock<IStripeRentGateway>();
        gateway.Setup(x => x.GetSourceStateAsync("ch_refund", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripeRentSourceState(true, true, false, false, null,
                "pi_refund", 10_000, "usd", 0));
        var service = CreateService(context, rentPayments.Object, lossAccounting.Object, gateway.Object);

        await service.HandleRefundCreatedAsync(RefundEvent("evt_pending", "re_pending", 4_000, "pending"));
        await service.HandleRefundCreatedAsync(RefundEvent("evt_failed", "re_pending", 4_000, "failed"));

        gateway.Verify(x => x.GetSourceStateAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Exactly(2));
        rentPayments.Verify(x => x.MarkBlockedAsync(It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<StripeRentPaymentBlockKind>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<long?>(),
            It.IsAny<CancellationToken>()), Times.Never);
        rentPayments.Verify(x => x.ReconcileRefundExposureAsync("pi_refund", "ch_refund", "re_pending",
            It.IsAny<string>(), 0, It.IsAny<CancellationToken>()), Times.Exactly(2));
        lossAccounting.Verify(x => x.ApplyAsync(It.IsAny<StripeRentLossAccountingCommand>(), It.IsAny<CancellationToken>()), Times.Exactly(2));
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

        rentPayments.Verify(x => x.ReconcileRefundExposureAsync("pi_refund", "ch_refund",
            It.IsAny<string>(), It.IsAny<string>(), 5_000,
            It.IsAny<CancellationToken>()), Times.Exactly(2));
        rentPayments.Verify(x => x.ReconcileRefundExposureAsync(It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<string>(), 7_000,
            It.IsAny<CancellationToken>()), Times.Never);
    }

    private static StripeWebhookService CreateService(
        brownstone_hub_api.Data.DataContext context,
        IStripeRentPaymentService rentPayments,
        IStripeRentLossAccountingService lossAccounting,
        IStripeRentGateway gateway)
    {
        if (!context.StripeRentPayments.Any())
        {
            var aggregate = StripeRentPaymentFlowTests.NewPayment("pi_refund");
            aggregate.StripeChargeId = "ch_refund";
            context.StripeRentPayments.Add(aggregate);
            context.SaveChanges();
        }
        return new(
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
    }

    private static Event RefundEvent(string eventId, string refundId, long amount, string status = "succeeded") => new()
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
                Status = status
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
