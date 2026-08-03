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
        var rentPayments = StripeRentPaymentFlowTests.CreateService(context, gateway.Object, true, transfersEnabled: false);
        var service = CreateWebhookService(context, rentPayments, Mock.Of<IStripeRentAllocationService>(),
            new StripeRentLossAccountingService(context, Mock.Of<ILogger<StripeRentLossAccountingService>>()),
            gateway.Object, notifications.Object);
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
        (await context.GeneralLedgerEntries.Where(x => x.TransactionType == "PaymentLossReversal").ToListAsync())
            .Should().ContainSingle().Which.Amount.Should().Be(-50m);
        gateway.Verify(x => x.CreateTransferReversalAsync("tr_original", 3_000,
            "rent-transfer-reversal:pi_dispute_webhook:3000", It.IsAny<CancellationToken>()), Times.Once);
        gateway.Verify(x => x.CreateTransferReversalAsync("tr_original", 2_000,
            "rent-transfer-reversal:pi_dispute_webhook:5000", It.IsAny<CancellationToken>()), Times.Once);
        notifications.Verify(x => x.CreateNotification(It.IsAny<CreateNotificationDto>()), Times.Exactly(2));
        notifications.Verify(x => x.CreateNotification(It.Is<CreateNotificationDto>(n =>
            n.UserId == 10 && n.SendEmail && n.SendSMS && n.Title.Contains("Returned or Disputed"))), Times.Once);
        notifications.Verify(x => x.CreateNotification(It.Is<CreateNotificationDto>(n =>
            n.UserId == 3 && n.SendEmail && n.SendSMS && n.Title.Contains("Returned"))), Times.Once);
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
        INotificationService? notifications = null) => new(
        Mock.Of<ISubscriptionRepository>(), Mock.Of<ISubscriptionPlanRepository>(),
        Mock.Of<ISubscriptionHistoryRepository>(), Mock.Of<IOrganizationRepository>(), context,
        Mock.Of<ILogger<StripeWebhookService>>(), notifications ?? Mock.Of<INotificationService>(),
        Mock.Of<IUserRepository>(), Mock.Of<INotificationSettingRepository>(), Mock.Of<IStripeService>(),
        rentPayments, allocation, lossAccounting, Mock.Of<IStripeConnectedPayeeService>(),
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

    private static Event DisputeCreatedEvent(string eventId, long amount) => new()
    {
        Id = eventId, Type = "charge.dispute.created", Created = new DateTime(2026, 8, 2, 14, 0, 0, DateTimeKind.Utc),
        Data = new EventData { Object = new Dispute
        {
            Id = "dp_webhook", PaymentIntentId = "pi_dispute_webhook", ChargeId = "ch_dispute_webhook",
            Amount = amount, Currency = "usd", Status = "needs_response"
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
