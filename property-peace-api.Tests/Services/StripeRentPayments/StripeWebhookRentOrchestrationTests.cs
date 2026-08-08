using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.NotificationSettings;
using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Repositories.Subscriptions;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Services.PaymentService;
using brownstone_hub_api.Services.StripeRentPayments;
using brownstone_hub_api.Services.StripeService;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Stripe;
using Xunit;

namespace brownstone_hub_api.Tests.Services.StripeRentPayments;

public sealed class StripeWebhookRentOrchestrationTests
{
    [Theory]
    [InlineData("card", 7)]
    [InlineData("us_bank_account", 14)]
    public async Task PaymentIntentSucceeded_UsesSignedAuthority_AllocatesExactlyOnce_AndPlacesAuthoritativeHold(
        string authoritativeMethod, int holdDays)
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        await StripeRentPaymentFlowTests.SeedLeaseAsync(context, 1, 2);
        context.StripeRentPayments.Add(StripeRentPaymentFlowTests.NewPayment("pi_webhook_success"));
        await context.SaveChangesAsync();

        var gateway = new Mock<IStripeRentGateway>(MockBehavior.Strict);
        gateway.Setup(x => x.GetPaymentMethodTypeAsync("pi_webhook_success", It.IsAny<CancellationToken>()))
            .ReturnsAsync(authoritativeMethod);
        var accounting = AccountingBoundary(context);
        var rentPayments = StripeRentPaymentFlowTests.CreateService(context, gateway.Object, true);
        var allocation = new StripeRentAllocationService(context, accounting.Object,
            Mock.Of<ILogger<StripeRentAllocationService>>());
        var service = CreateWebhookService(context, rentPayments, allocation,
            new StripeRentLossAccountingService(context, Mock.Of<ILogger<StripeRentLossAccountingService>>()),
            gateway.Object);
        var occurredAt = new DateTimeOffset(2026, 8, 2, 12, 30, 0, TimeSpan.Zero);

        await service.HandlePaymentIntentSucceededAsync(PaymentIntentSucceededEvent(occurredAt));
        await service.HandlePaymentIntentSucceededAsync(PaymentIntentSucceededEvent(occurredAt));

        gateway.Verify(x => x.GetPaymentMethodTypeAsync("pi_webhook_success", It.IsAny<CancellationToken>()), Times.Once);
        accounting.Verify(x => x.AddPayment(It.Is<AddPaymentDto>(p =>
            p.LeaseId == 1 && p.Amount == 100m && p.Reference == "pi_webhook_success"
            && p.StripePaymentIntentId == "pi_webhook_success" && p.StripePaymentMethodId == "pm_signed"
            && p.Method == authoritativeMethod && p.Status == "Completed" && p.FeeId == null && p.DepositId == null)), Times.Once);
        (await context.Payments.Where(x => x.Amount > 0).ToListAsync()).Should().ContainSingle();
        (await context.Deposits.CountAsync()).Should().Be(0);
        (await context.GeneralLedgerEntries.Where(x => x.TransactionType == "Payment").ToListAsync())
            .Should().ContainSingle().Which.Amount.Should().Be(100m);
        var aggregate = await context.StripeRentPayments.SingleAsync();
        aggregate.Status.Should().Be(StripeRentPaymentStatus.Held);
        aggregate.StripeChargeId.Should().Be("ch_signed");
        aggregate.PaymentMethodType.Should().Be(authoritativeMethod);
        aggregate.HeldAt.Should().Be(occurredAt);
        aggregate.TransferEligibleAt.Should().Be(occurredAt.AddDays(holdDays));
    }

    [Fact]
    public async Task PaymentIntentSucceeded_WithUnknownAuthoritativePaymentMethod_FailsClosedBeforeAccounting()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        await StripeRentPaymentFlowTests.SeedLeaseAsync(context, 1, 2);
        context.StripeRentPayments.Add(StripeRentPaymentFlowTests.NewPayment("pi_webhook_success"));
        await context.SaveChangesAsync();
        var gateway = new Mock<IStripeRentGateway>(MockBehavior.Strict);
        gateway.Setup(x => x.GetPaymentMethodTypeAsync("pi_webhook_success", It.IsAny<CancellationToken>()))
            .ReturnsAsync((string?)null);
        var accounting = AccountingBoundary(context);
        var rentPayments = StripeRentPaymentFlowTests.CreateService(context, gateway.Object, true);
        var service = CreateWebhookService(context, rentPayments,
            new StripeRentAllocationService(context, accounting.Object, Mock.Of<ILogger<StripeRentAllocationService>>()),
            new StripeRentLossAccountingService(context, Mock.Of<ILogger<StripeRentLossAccountingService>>()), gateway.Object);

        var act = () => service.HandlePaymentIntentSucceededAsync(
            PaymentIntentSucceededEvent(new DateTimeOffset(2026, 8, 2, 12, 30, 0, TimeSpan.Zero)));

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*payment method*");
        accounting.Verify(x => x.AddPayment(It.IsAny<AddPaymentDto>()), Times.Never);
        (await context.Payments.CountAsync()).Should().Be(0);
        var aggregate = await context.StripeRentPayments.SingleAsync();
        aggregate.Status.Should().Be(StripeRentPaymentStatus.Blocked);
        aggregate.AllocationCompletedAt.Should().BeNull();
        aggregate.TransferEligibleAt.Should().BeNull();
    }

    [Fact]
    public async Task PaymentIntentSucceeded_WithTamperedSignedMetadata_RejectsProvenanceWithoutAccounting()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        await StripeRentPaymentFlowTests.SeedLeaseAsync(context, 1, 2);
        context.StripeRentPayments.Add(StripeRentPaymentFlowTests.NewPayment("pi_webhook_success"));
        await context.SaveChangesAsync();
        var gateway = new Mock<IStripeRentGateway>(MockBehavior.Strict);
        var accounting = AccountingBoundary(context);
        var rentPayments = StripeRentPaymentFlowTests.CreateService(context, gateway.Object, true);
        var service = CreateWebhookService(context, rentPayments,
            new StripeRentAllocationService(context, accounting.Object, Mock.Of<ILogger<StripeRentAllocationService>>()),
            new StripeRentLossAccountingService(context, Mock.Of<ILogger<StripeRentLossAccountingService>>()), gateway.Object);
        var stripeEvent = PaymentIntentSucceededEvent(DateTimeOffset.UtcNow);
        ((PaymentIntent)stripeEvent.Data.Object).Metadata["organizationId"] = "999";

        var act = () => service.HandlePaymentIntentSucceededAsync(stripeEvent);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*durable server authority*");
        gateway.VerifyNoOtherCalls();
        accounting.Verify(x => x.AddPayment(It.IsAny<AddPaymentDto>()), Times.Never);
        (await context.Payments.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task PaymentIntentFailed_AfterAllocatedBankPayment_ReopensBalanceExactlyOnceAndBlocksTransfer()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        await StripeRentPaymentFlowTests.SeedLeaseAsync(context, 1, 2);
        var aggregate = StripeRentPaymentFlowTests.NewPayment("pi_bank_return");
        aggregate.Status = StripeRentPaymentStatus.Held;
        aggregate.PaymentMethodType = "us_bank_account";
        aggregate.StripeChargeId = "ch_bank_return";
        aggregate.AllocationCompletedAt = DateTimeOffset.UtcNow.AddDays(-2);
        aggregate.HeldAt = DateTimeOffset.UtcNow.AddDays(-2);
        aggregate.TransferEligibleAt = DateTimeOffset.UtcNow.AddDays(12);
        context.StripeRentPayments.Add(aggregate);
        var original = new Payment
        {
            LeaseId = 1, PropertyId = 1, OrganizationId = 2, Amount = 100m,
            PaymentDate = DateTime.UtcNow.AddDays(-2), Reference = "pi_bank_return", Status = "Completed",
            StripePaymentIntentId = "pi_bank_return", StripeChargeId = "ch_bank_return",
            Method = "us_bank_account", CreatedByUserId = 3
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
        gateway.Setup(x => x.GetPaymentIntentStateAsync("pi_bank_return", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripeRentPaymentIntentState(true, "requires_payment_method"));
        var rentPayments = StripeRentPaymentFlowTests.CreateService(context, gateway.Object, true, transfersEnabled: false);
        var service = CreateWebhookService(context, rentPayments, Mock.Of<IStripeRentAllocationService>(),
            new StripeRentLossAccountingService(context, Mock.Of<ILogger<StripeRentLossAccountingService>>()),
            gateway.Object);
        var failed = BankPaymentFailedEvent();

        await service.HandlePaymentIntentPaymentFailedAsync(failed);
        await service.HandlePaymentIntentPaymentFailedAsync(failed);

        context.ChangeTracker.Clear();
        aggregate = await context.StripeRentPayments.SingleAsync();
        aggregate.Status.Should().Be(StripeRentPaymentStatus.Blocked);
        aggregate.DisputedAmountCents.Should().Be(10_000);
        aggregate.TransferEligibleAt.Should().BeNull();
        (await context.Payments.Where(x => x.Reference == "pi_bank_return:loss").ToListAsync())
            .Should().ContainSingle().Which.Amount.Should().Be(-100m);
        (await context.GeneralLedgerEntries.Where(x => x.TransactionType == "PaymentLossReversal").ToListAsync())
            .Should().ContainSingle().Which.Amount.Should().Be(-100m);
        (await context.Payments.SingleAsync(x => x.Amount > 0)).Status.Should().Be("Disputed");
        gateway.Verify(x => x.GetPaymentIntentStateAsync("pi_bank_return", It.IsAny<CancellationToken>()), Times.Exactly(2));
        gateway.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData("succeeded")]
    [InlineData("processing")]
    public async Task PaymentIntentFailed_StaleEventForReusableIntent_DoesNotOverwriteAuthoritativeProgress(string currentStatus)
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        await StripeRentPaymentFlowTests.SeedLeaseAsync(context, 1, 2);
        var aggregate = StripeRentPaymentFlowTests.NewPayment("pi_stale_failure");
        aggregate.Status = StripeRentPaymentStatus.Processing;
        context.StripeRentPayments.Add(aggregate);
        await context.SaveChangesAsync();
        var gateway = new Mock<IStripeRentGateway>(MockBehavior.Strict);
        gateway.Setup(x => x.GetPaymentIntentStateAsync("pi_stale_failure", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripeRentPaymentIntentState(true, currentStatus));
        var rentPayments = StripeRentPaymentFlowTests.CreateService(context, gateway.Object, true);
        var service = CreateWebhookService(context, rentPayments, Mock.Of<IStripeRentAllocationService>(),
            new StripeRentLossAccountingService(context, Mock.Of<ILogger<StripeRentLossAccountingService>>()), gateway.Object);

        await service.HandlePaymentIntentPaymentFailedAsync(PaymentIntentFailedEvent("pi_stale_failure"));

        (await context.StripeRentPayments.SingleAsync()).Status.Should().Be(StripeRentPaymentStatus.Processing);
        gateway.VerifyAll();
    }

    [Theory]
    [InlineData("succeeded")]
    [InlineData("processing")]
    public async Task PaymentIntentFailed_StaleEventForAllocatedBankPayment_DoesNotReopenAccounting(string currentStatus)
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        await StripeRentPaymentFlowTests.SeedLeaseAsync(context, 1, 2);
        var aggregate = StripeRentPaymentFlowTests.NewPayment("pi_bank_return");
        aggregate.Status = StripeRentPaymentStatus.Held;
        aggregate.PaymentMethodType = "us_bank_account";
        aggregate.StripeChargeId = "ch_bank_return";
        aggregate.AllocationCompletedAt = DateTimeOffset.UtcNow.AddDays(-2);
        aggregate.TransferEligibleAt = DateTimeOffset.UtcNow.AddDays(12);
        context.StripeRentPayments.Add(aggregate);
        await context.SaveChangesAsync();
        var gateway = new Mock<IStripeRentGateway>(MockBehavior.Strict);
        gateway.Setup(x => x.GetPaymentIntentStateAsync("pi_bank_return", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripeRentPaymentIntentState(true, currentStatus));
        var rentPayments = StripeRentPaymentFlowTests.CreateService(context, gateway.Object, true, transfersEnabled: false);
        var service = CreateWebhookService(context, rentPayments, Mock.Of<IStripeRentAllocationService>(),
            new StripeRentLossAccountingService(context, Mock.Of<ILogger<StripeRentLossAccountingService>>()), gateway.Object);

        await service.HandlePaymentIntentPaymentFailedAsync(BankPaymentFailedEvent());

        context.ChangeTracker.Clear();
        aggregate = await context.StripeRentPayments.SingleAsync();
        aggregate.Status.Should().Be(StripeRentPaymentStatus.Held);
        aggregate.DisputedAmountCents.Should().Be(0);
        aggregate.TransferEligibleAt.Should().NotBeNull();
        (await context.Payments.CountAsync()).Should().Be(0);
        (await context.GeneralLedgerEntries.CountAsync()).Should().Be(0);
        gateway.VerifyAll();
    }

    [Fact]
    public async Task PaymentIntentFailed_WhenProviderAuthorityUnavailable_ContainsAllocatedPaymentAndThrowsForRetry()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        await StripeRentPaymentFlowTests.SeedLeaseAsync(context, 1, 2);
        var aggregate = StripeRentPaymentFlowTests.NewPayment("pi_bank_return");
        aggregate.Status = StripeRentPaymentStatus.Held;
        aggregate.PaymentMethodType = "us_bank_account";
        aggregate.StripeChargeId = "ch_bank_return";
        aggregate.AllocationCompletedAt = DateTimeOffset.UtcNow.AddDays(-2);
        aggregate.TransferEligibleAt = DateTimeOffset.UtcNow.AddDays(12);
        context.StripeRentPayments.Add(aggregate);
        await context.SaveChangesAsync();
        var gateway = new Mock<IStripeRentGateway>(MockBehavior.Strict);
        gateway.Setup(x => x.GetPaymentIntentStateAsync("pi_bank_return", It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("provider unavailable"));
        var rentPayments = StripeRentPaymentFlowTests.CreateService(context, gateway.Object, true, transfersEnabled: false);
        var service = CreateWebhookService(context, rentPayments, Mock.Of<IStripeRentAllocationService>(),
            new StripeRentLossAccountingService(context, Mock.Of<ILogger<StripeRentLossAccountingService>>()), gateway.Object);

        var act = () => service.HandlePaymentIntentPaymentFailedAsync(BankPaymentFailedEvent());

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*must retry*");
        context.ChangeTracker.Clear();
        aggregate = await context.StripeRentPayments.SingleAsync();
        aggregate.Status.Should().Be(StripeRentPaymentStatus.Blocked);
        aggregate.RiskReason.Should().Contain("operator review");
        aggregate.TransferEligibleAt.Should().BeNull();
        aggregate.DisputedAmountCents.Should().Be(0);
        (await context.Payments.CountAsync()).Should().Be(0);
        (await context.GeneralLedgerEntries.CountAsync()).Should().Be(0);
        gateway.VerifyAll();
    }

    [Fact]
    public async Task PaymentIntentFailed_CurrentProviderFailure_MarksReusableIntentFailed()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        await StripeRentPaymentFlowTests.SeedLeaseAsync(context, 1, 2);
        context.StripeRentPayments.Add(StripeRentPaymentFlowTests.NewPayment("pi_current_failure"));
        await context.SaveChangesAsync();
        var gateway = new Mock<IStripeRentGateway>(MockBehavior.Strict);
        gateway.Setup(x => x.GetPaymentIntentStateAsync("pi_current_failure", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripeRentPaymentIntentState(true, "requires_payment_method"));
        var rentPayments = StripeRentPaymentFlowTests.CreateService(context, gateway.Object, true);
        var service = CreateWebhookService(context, rentPayments, Mock.Of<IStripeRentAllocationService>(),
            new StripeRentLossAccountingService(context, Mock.Of<ILogger<StripeRentLossAccountingService>>()), gateway.Object);

        await service.HandlePaymentIntentPaymentFailedAsync(PaymentIntentFailedEvent("pi_current_failure"));

        (await context.StripeRentPayments.SingleAsync()).Status.Should().Be(StripeRentPaymentStatus.Failed);
        gateway.VerifyAll();
    }

    [Fact]
    public async Task ChargeDisputeCreated_WithMismatchedCharge_RejectsProvenanceBeforeMutation()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        await SeedTransferredPaymentWithNotificationGraphAsync(context);
        var gateway = new Mock<IStripeRentGateway>(MockBehavior.Strict);
        var rentPayments = StripeRentPaymentFlowTests.CreateService(context, gateway.Object, true, transfersEnabled: false);
        var service = CreateWebhookService(context, rentPayments, Mock.Of<IStripeRentAllocationService>(),
            new StripeRentLossAccountingService(context, Mock.Of<ILogger<StripeRentLossAccountingService>>()),
            gateway.Object);
        var stripeEvent = DisputeCreatedEvent("evt_wrong_charge", 3_000);
        ((Dispute)stripeEvent.Data.Object).ChargeId = "ch_not_the_durable_charge";

        var act = () => service.HandleChargeDisputeCreatedAsync(stripeEvent);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*charge provenance*");
        context.ChangeTracker.Clear();
        var aggregate = await context.StripeRentPayments.SingleAsync();
        aggregate.Status.Should().Be(StripeRentPaymentStatus.Transferred);
        aggregate.DisputedAmountCents.Should().Be(0);
        (await context.Payments.CountAsync(x => x.Reference == "pi_dispute_webhook:loss")).Should().Be(0);
        gateway.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task ChargeDisputeCreated_IsCumulativeReplaySafe_DispatchesExactRecovery_AndNotifiesOnce()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        await SeedTransferredPaymentWithNotificationGraphAsync(context);
        var gateway = new Mock<IStripeRentGateway>(MockBehavior.Strict);
        gateway.Setup(x => x.CreateTransferReversalAsync("tr_original", 3_000,
                "rent-transfer-reversal:pi_dispute_webhook:3000", It.IsAny<CancellationToken>()))
            .ReturnsAsync("trr_3000");
        gateway.Setup(x => x.CreateTransferReversalAsync("tr_original", 2_000,
                "rent-transfer-reversal:pi_dispute_webhook:5000", It.IsAny<CancellationToken>()))
            .ReturnsAsync("trr_5000");
        var notifications = new Mock<INotificationService>();
        notifications.Setup(x => x.CreateNotification(It.IsAny<CreateNotificationDto>()))
            .ReturnsAsync(ServiceResponse<NotificationDto>.CreateSuccess(new NotificationDto()));
        var payees = new Mock<IStripeConnectedPayeeService>(MockBehavior.Strict);
        payees.Setup(x => x.SuspendAsync("acct_landlord", null,
                It.Is<string>(reason => reason.Contains("dispute", StringComparison.OrdinalIgnoreCase)),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripeConnectedPayeeReview { StripeAccountId = "acct_landlord", Status = StripePayeeReviewStatus.Suspended });
        var rentPayments = StripeRentPaymentFlowTests.CreateService(context, gateway.Object, true, transfersEnabled: false);
        var service = CreateWebhookService(context, rentPayments, Mock.Of<IStripeRentAllocationService>(),
            new StripeRentLossAccountingService(context, Mock.Of<ILogger<StripeRentLossAccountingService>>()),
            gateway.Object, notifications.Object, payees.Object);
        var first = DisputeCreatedEvent("evt_dp_1", 3_000);

        await service.HandleChargeDisputeCreatedAsync(first);
        await service.HandleChargeDisputeCreatedAsync(first);
        await rentPayments.ProcessEligibleTransfersAsync();
        await service.HandleChargeDisputeCreatedAsync(DisputeCreatedEvent("evt_dp_2", 5_000));
        await rentPayments.ProcessEligibleTransfersAsync();

        var aggregate = await context.StripeRentPayments.SingleAsync();
        aggregate.Status.Should().Be(StripeRentPaymentStatus.Blocked);
        aggregate.DisputedAmountCents.Should().Be(5_000);
        aggregate.ReversedAmountCents.Should().Be(5_000);
        (await context.Payments.Where(x => x.Reference == "pi_dispute_webhook:loss").ToListAsync())
            .Should().ContainSingle().Which.Amount.Should().Be(-50m);
        var immutableLossHistory = await context.GeneralLedgerEntries
            .Where(x => x.TransactionType == "PaymentLossReversal").OrderBy(x => x.Id).ToListAsync();
        immutableLossHistory.Select(x => x.Amount).Should().Equal(-30m, -20m);
        immutableLossHistory.Sum(x => x.Amount).Should().Be(-50m);
        gateway.Verify(x => x.CreateTransferReversalAsync("tr_original", 3_000,
            "rent-transfer-reversal:pi_dispute_webhook:3000", It.IsAny<CancellationToken>()), Times.Once);
        gateway.Verify(x => x.CreateTransferReversalAsync("tr_original", 2_000,
            "rent-transfer-reversal:pi_dispute_webhook:5000", It.IsAny<CancellationToken>()), Times.Once);
        notifications.Verify(x => x.CreateNotification(It.IsAny<CreateNotificationDto>()), Times.Exactly(2));
        notifications.Verify(x => x.CreateNotification(It.Is<CreateNotificationDto>(n =>
            n.UserId == 10 && n.SendEmail && n.SendSMS && n.Title.Contains("Returned or Disputed"))), Times.Once);
        notifications.Verify(x => x.CreateNotification(It.Is<CreateNotificationDto>(n =>
            n.UserId == 3 && n.SendEmail && n.SendSMS && n.Title.Contains("Returned"))), Times.Once);
        payees.Verify(x => x.SuspendAsync("acct_landlord", null,
            It.Is<string>(reason => reason.Contains("dispute", StringComparison.OrdinalIgnoreCase)),
            It.IsAny<CancellationToken>()), Times.Exactly(3));
    }

    [Fact]
    public async Task ChargeDisputeCreated_WhenSuspensionFails_PersistsContainmentAndRetriesSuspension()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        await SeedTransferredPaymentWithNotificationGraphAsync(context);
        var gateway = new Mock<IStripeRentGateway>(MockBehavior.Strict);
        var notifications = new Mock<INotificationService>();
        notifications.Setup(x => x.CreateNotification(It.IsAny<CreateNotificationDto>()))
            .ReturnsAsync(ServiceResponse<NotificationDto>.CreateSuccess(new NotificationDto()));
        var payees = new Mock<IStripeConnectedPayeeService>(MockBehavior.Strict);
        payees.SetupSequence(x => x.SuspendAsync("acct_landlord", null,
                It.Is<string>(reason => reason.Contains("dp_webhook")), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new KeyNotFoundException("Connected payee review was not found."))
            .ReturnsAsync(new StripeConnectedPayeeReview
            {
                StripeAccountId = "acct_landlord", Status = StripePayeeReviewStatus.Suspended
            });
        var rentPayments = StripeRentPaymentFlowTests.CreateService(context, gateway.Object, true, transfersEnabled: false);
        var service = CreateWebhookService(context, rentPayments, Mock.Of<IStripeRentAllocationService>(),
            new StripeRentLossAccountingService(context, Mock.Of<ILogger<StripeRentLossAccountingService>>()),
            gateway.Object, notifications.Object, payees.Object);
        var dispute = DisputeCreatedEvent("evt_dp_retry", 3_000);

        var firstAttempt = () => service.HandleChargeDisputeCreatedAsync(dispute);
        await firstAttempt.Should().ThrowAsync<KeyNotFoundException>();

        var contained = await context.StripeRentPayments.SingleAsync();
        contained.Status.Should().Be(StripeRentPaymentStatus.ReversalPending);
        contained.DisputedAmountCents.Should().Be(3_000);
        (await context.Payments.CountAsync(x => x.Reference == "pi_dispute_webhook:loss")).Should().Be(1);
        (await context.GeneralLedgerEntries.CountAsync(x => x.TransactionType == "PaymentLossReversal")).Should().Be(1);

        await service.HandleChargeDisputeCreatedAsync(dispute);

        payees.Verify(x => x.SuspendAsync("acct_landlord", null,
            It.Is<string>(reason => reason.Contains("dp_webhook")), It.IsAny<CancellationToken>()), Times.Exactly(2));
        notifications.Verify(x => x.CreateNotification(It.IsAny<CreateNotificationDto>()), Times.Exactly(2));
        (await context.Payments.CountAsync(x => x.Reference == "pi_dispute_webhook:loss")).Should().Be(1);
        (await context.GeneralLedgerEntries.CountAsync(x => x.TransactionType == "PaymentLossReversal")).Should().Be(1);
    }

    [Fact]
    public async Task ChargeDisputeClosed_Won_RestoresAccountingExactlyOnceWithoutDeletingHistoryOrCreatingTransfer()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        await SeedTransferredPaymentWithNotificationGraphAsync(context);
        var gateway = new Mock<IStripeRentGateway>(MockBehavior.Strict);
        var payees = new Mock<IStripeConnectedPayeeService>();
        var rentPayments = StripeRentPaymentFlowTests.CreateService(context, gateway.Object, true, transfersEnabled: false);
        var lossAccounting = new StripeRentLossAccountingService(context,
            Mock.Of<ILogger<StripeRentLossAccountingService>>());
        var service = CreateWebhookService(context, rentPayments, Mock.Of<IStripeRentAllocationService>(),
            lossAccounting, gateway.Object, payees: payees.Object);
        await service.HandleChargeDisputeCreatedAsync(DisputeCreatedEvent("evt_created", 3_000));

        await service.HandleChargeDisputeClosedAsync(DisputeClosedEvent("evt_won_1", "won", 3_000));
        await service.HandleChargeDisputeClosedAsync(DisputeClosedEvent("evt_won_1", "won", 3_000));
        await service.HandleChargeDisputeClosedAsync(DisputeClosedEvent("evt_won_duplicate", "won", 3_000));
        await service.HandleChargeDisputeCreatedAsync(DisputeCreatedEvent("evt_created_stale", 3_000));

        context.ChangeTracker.Clear();
        var aggregate = await context.StripeRentPayments.SingleAsync();
        aggregate.DisputedAmountCents.Should().Be(0);
        aggregate.DisputeRecoveredAmountCents.Should().Be(3_000);
        aggregate.DisputeClosedAt.Should().NotBeNull();
        aggregate.StripeDisputeStatus.Should().Be("won");
        aggregate.Status.Should().Be(StripeRentPaymentStatus.Blocked);
        (await context.Payments.CountAsync(x => x.Reference == "pi_dispute_webhook:loss")).Should().Be(1);
        (await context.Payments.CountAsync(x => x.Reference == "pi_dispute_webhook:dispute-recovery")).Should().Be(0);
        (await context.Payments.SingleAsync(x => x.Reference == "pi_dispute_webhook:loss")).Amount.Should().Be(0m);
        (await context.GeneralLedgerEntries.Where(x => x.TransactionType == "PaymentLossRecovery").ToListAsync())
            .Should().ContainSingle().Which.Amount.Should().Be(30m);
        (await context.Payments.SingleAsync(x => x.Amount > 0 && x.Reference == "pi_dispute_webhook")).Status
            .Should().Be("Completed");
        gateway.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task ChargeDisputeClosed_Lost_LeavesLossStateIntact()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        await SeedTransferredPaymentWithNotificationGraphAsync(context);
        var gateway = new Mock<IStripeRentGateway>(MockBehavior.Strict);
        var payees = new Mock<IStripeConnectedPayeeService>();
        var rentPayments = StripeRentPaymentFlowTests.CreateService(context, gateway.Object, true, transfersEnabled: false);
        var service = CreateWebhookService(context, rentPayments, Mock.Of<IStripeRentAllocationService>(),
            new StripeRentLossAccountingService(context, Mock.Of<ILogger<StripeRentLossAccountingService>>()),
            gateway.Object, payees: payees.Object);
        await service.HandleChargeDisputeCreatedAsync(DisputeCreatedEvent("evt_created_lost", 3_000));

        await service.HandleChargeDisputeClosedAsync(DisputeClosedEvent("evt_lost", "lost", 3_000));

        var aggregate = await context.StripeRentPayments.SingleAsync();
        aggregate.DisputedAmountCents.Should().Be(3_000);
        aggregate.StripeDisputeStatus.Should().Be("lost");
        (await context.Payments.CountAsync(x => x.Reference == "pi_dispute_webhook:dispute-recovery")).Should().Be(0);
        (await context.Payments.SingleAsync(x => x.Amount > 0)).Status.Should().Be("Disputed");
        gateway.VerifyNoOtherCalls();
    }

    private static Mock<IPaymentService> AccountingBoundary(DataContext context)
    {
        var accounting = new Mock<IPaymentService>(MockBehavior.Strict);
        accounting.Setup(x => x.AddPayment(It.IsAny<AddPaymentDto>())).ReturnsAsync((AddPaymentDto dto) =>
        {
            var payment = new Payment
            {
                LeaseId = dto.LeaseId, PropertyId = 1, OrganizationId = 2, Amount = dto.Amount,
                PaymentDate = dto.PaymentDate, Reference = dto.Reference, Method = dto.Method, Status = dto.Status,
                StripePaymentIntentId = dto.StripePaymentIntentId, StripePaymentMethodId = dto.StripePaymentMethodId,
                CreatedByUserId = dto.CreatedByUserId, FeeId = dto.FeeId, DepositId = dto.DepositId
            };
            context.Payments.Add(payment);
            context.SaveChanges();
            context.GeneralLedgerEntries.Add(new GeneralLedgerEntry
            {
                OrganizationId = 2, AccountId = 1, TransactionId = payment.Id, TransactionType = "Payment",
                Amount = dto.Amount, TransactionDate = dto.PaymentDate, Reference = dto.Reference
            });
            context.SaveChanges();
            return ServiceResponse<List<LoadPaymentDto>>.CreateSuccess([]);
        });
        return accounting;
    }

    private static StripeWebhookService CreateWebhookService(DataContext context,
        IStripeRentPaymentService rentPayments, IStripeRentAllocationService allocation,
        IStripeRentLossAccountingService lossAccounting, IStripeRentGateway gateway,
        INotificationService? notifications = null,
        IStripeConnectedPayeeService? payees = null) => new(
        Mock.Of<ISubscriptionRepository>(), Mock.Of<ISubscriptionPlanRepository>(),
        Mock.Of<ISubscriptionHistoryRepository>(), Mock.Of<IOrganizationRepository>(), context,
        Mock.Of<ILogger<StripeWebhookService>>(), notifications ?? Mock.Of<INotificationService>(),
        Mock.Of<IUserRepository>(), Mock.Of<INotificationSettingRepository>(), Mock.Of<IStripeService>(),
        rentPayments, allocation, lossAccounting, payees ?? Mock.Of<IStripeConnectedPayeeService>(),
        Mock.Of<IStripeConnectedAccountGateway>(), gateway);

    private static Event PaymentIntentSucceededEvent(DateTimeOffset occurredAt) => new()
    {
        Id = "evt_signed_success", Type = "payment_intent.succeeded", Created = occurredAt.UtcDateTime,
        Data = new EventData { Object = new PaymentIntent
        {
            Id = "pi_webhook_success", LatestChargeId = "ch_signed", PaymentMethodId = "pm_signed",
            Amount = 10_000, Currency = "usd", Status = "succeeded",
            Metadata = new Dictionary<string, string>
            {
                ["paymentFlow"] = "separate_charges_and_transfers", ["leaseId"] = "1",
                ["organizationId"] = "2", ["tenantUserId"] = "3", ["operationId"] = "op_pi_webhook_success"
            }
        }}
    };

    private static Event BankPaymentFailedEvent() => new()
    {
        Id = "evt_bank_return",
        Type = "payment_intent.payment_failed",
        Created = new DateTime(2026, 8, 4, 14, 0, 0, DateTimeKind.Utc),
        Data = new EventData { Object = new PaymentIntent
        {
            Id = "pi_bank_return", LatestChargeId = "ch_bank_return", Amount = 10_000,
            Currency = "usd", Status = "requires_payment_method",
            Metadata = new Dictionary<string, string>()
        }}
    };

    private static Event PaymentIntentFailedEvent(string paymentIntentId) => new()
    {
        Id = $"evt_{paymentIntentId}_failed", Type = "payment_intent.payment_failed",
        Created = new DateTime(2026, 8, 4, 14, 0, 0, DateTimeKind.Utc),
        Data = new EventData { Object = new PaymentIntent
        {
            Id = paymentIntentId, Amount = 10_000, Currency = "usd", Status = "requires_payment_method",
            Metadata = new Dictionary<string, string> { ["leaseId"] = "1" }
        }}
    };

    private static Event DisputeCreatedEvent(string eventId, long amount) => new()
    {
        Id = eventId, Type = "charge.dispute.created", Created = new DateTime(2026, 8, 2, 14, 0, 0, DateTimeKind.Utc),
        Data = new EventData { Object = new Dispute
        {
            Id = "dp_webhook", PaymentIntentId = "pi_dispute_webhook", ChargeId = "ch_dispute_webhook",
            Amount = amount, Currency = "usd", Status = "needs_response"
        }}
    };

    private static Event DisputeClosedEvent(string eventId, string status, long amount) => new()
    {
        Id = eventId, Type = "charge.dispute.closed", Created = new DateTime(2026, 8, 5, 14, 0, 0, DateTimeKind.Utc),
        Data = new EventData { Object = new Dispute
        {
            Id = "dp_webhook", PaymentIntentId = "pi_dispute_webhook", ChargeId = "ch_dispute_webhook",
            Amount = amount, Currency = "usd", Status = status
        }}
    };

    private static async Task SeedTransferredPaymentWithNotificationGraphAsync(DataContext context)
    {
        var landlord = new User { Id = 10, Email = "landlord@example.test" };
        var property = new Property { Id = 1, Name = "Audit House", LandlordId = 10, Landlord = landlord, OrganizationId = 2 };
        var unit = new Unit { Id = 1, PropertyId = 1, Property = property, OrganizationId = 2 };
        var lease = new Lease
        {
            Id = 1, UnitId = 1, Unit = unit, OrganizationId = 2, IsActive = true,
            StartDate = DateTime.UtcNow.AddMonths(-2), EndDate = DateTime.UtcNow.AddYears(1),
            RentAmount = 100m, RentFrequency = "Monthly"
        };
        var tenant = new Tenant { Id = 103, UserId = 3, OrganizationId = 2, Firstname = "Audit", Lastname = "Tenant" };
        context.AddRange(landlord, property, unit, lease, tenant,
            new TenantLease { LeaseId = 1, TenantId = 103 });
        var aggregate = StripeRentPaymentFlowTests.NewPayment("pi_dispute_webhook");
        aggregate.Status = StripeRentPaymentStatus.Transferred;
        aggregate.StripeChargeId = "ch_dispute_webhook";
        aggregate.StripeTransferId = "tr_original";
        aggregate.TransferredAt = DateTimeOffset.UtcNow.AddDays(-1);
        aggregate.AllocationCompletedAt = DateTimeOffset.UtcNow.AddDays(-8);
        context.StripeRentPayments.Add(aggregate);
        var payment = new Payment
        {
            LeaseId = 1, Lease = lease, PropertyId = 1, OrganizationId = 2, Amount = 100m,
            PaymentDate = DateTime.UtcNow.AddDays(-8), Reference = "pi_dispute_webhook", Status = "Completed",
            StripePaymentIntentId = "pi_dispute_webhook", StripeChargeId = "ch_dispute_webhook", Method = "card",
            CreatedByUserId = 3
        };
        context.Payments.Add(payment);
        await context.SaveChangesAsync();
        context.GeneralLedgerEntries.Add(new GeneralLedgerEntry
        {
            OrganizationId = 2, AccountId = 1, TransactionId = payment.Id, TransactionType = "Payment",
            Amount = 100m, TransactionDate = payment.PaymentDate, Reference = payment.Reference
        });
        await context.SaveChangesAsync();
    }
}
