using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.PaymentService;
using brownstone_hub_api.Services.StripeRentPayments;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.StripeRentPayments;

public sealed class StripeRentAllocationTests
{
    [Fact]
    public async Task AllocateAsync_WritesOneRentOnlyRowAndCompletionMarker_Idempotently()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        await StripeRentPaymentFlowTests.SeedLeaseAsync(context, 1, 2);
        context.StripeRentPayments.Add(StripeRentPaymentFlowTests.NewPayment("pi_allocate"));
        await context.SaveChangesAsync();
        var payments = new Mock<IPaymentService>();
        payments.Setup(x => x.AddPayment(It.IsAny<AddPaymentDto>())).ReturnsAsync((AddPaymentDto dto) =>
        {
            var payment = new Payment
            {
                LeaseId = dto.LeaseId, PropertyId = 1, OrganizationId = 2, Amount = dto.Amount,
                PaymentDate = dto.PaymentDate, Reference = dto.Reference, Status = dto.Status,
                StripePaymentIntentId = dto.StripePaymentIntentId, StripePaymentMethodId = dto.StripePaymentMethodId,
                FeeId = dto.FeeId, DepositId = dto.DepositId
            };
            context.Payments.Add(payment);
            context.SaveChanges();
            context.GeneralLedgerEntries.Add(new GeneralLedgerEntry
            {
                OrganizationId = 2, AccountId = 1, TransactionId = payment.Id,
                TransactionType = "Payment", Amount = dto.Amount, TransactionDate = dto.PaymentDate
            });
            context.SaveChanges();
            return ServiceResponse<List<LoadPaymentDto>>.CreateSuccess([]);
        });
        var service = new StripeRentAllocationService(context, payments.Object, Mock.Of<ILogger<StripeRentAllocationService>>());
        var command = Command("pi_allocate");

        await service.AllocateAsync(command);
        await service.AllocateAsync(command);

        var row = await context.Payments.SingleAsync();
        row.Amount.Should().Be(100m);
        row.FeeId.Should().BeNull();
        row.DepositId.Should().BeNull();
        (await context.StripeRentPayments.SingleAsync()).AllocationCompletedAt.Should().NotBeNull();
        payments.Verify(x => x.AddPayment(It.IsAny<AddPaymentDto>()), Times.Once);
    }

    [Fact]
    public async Task AllocateAsync_WhenAccountingRejects_DoesNotMarkAllocationComplete()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        await StripeRentPaymentFlowTests.SeedLeaseAsync(context, 1, 2);
        context.StripeRentPayments.Add(StripeRentPaymentFlowTests.NewPayment("pi_fail"));
        await context.SaveChangesAsync();
        var payments = new Mock<IPaymentService>();
        payments.Setup(x => x.AddPayment(It.IsAny<AddPaymentDto>()))
            .ReturnsAsync(ServiceResponse<List<LoadPaymentDto>>.CreateError("rejected"));
        var service = new StripeRentAllocationService(context, payments.Object, Mock.Of<ILogger<StripeRentAllocationService>>());

        var act = () => service.AllocateAsync(Command("pi_fail"));

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*rejected*");
        (await context.StripeRentPayments.SingleAsync()).AllocationCompletedAt.Should().BeNull();
    }

    [Fact]
    public async Task AllocateAsync_WhenRequiredLedgerEntryIsMissing_DoesNotMarkAllocationComplete()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        await StripeRentPaymentFlowTests.SeedLeaseAsync(context, 1, 2);
        context.StripeRentPayments.Add(StripeRentPaymentFlowTests.NewPayment("pi_no_ledger"));
        await context.SaveChangesAsync();
        var payments = new Mock<IPaymentService>();
        payments.Setup(x => x.AddPayment(It.IsAny<AddPaymentDto>())).ReturnsAsync((AddPaymentDto dto) =>
        {
            context.Payments.Add(new Payment
            {
                LeaseId = dto.LeaseId, PropertyId = 1, OrganizationId = 2, Amount = dto.Amount,
                PaymentDate = dto.PaymentDate, Reference = dto.Reference, Status = dto.Status,
                StripePaymentIntentId = dto.StripePaymentIntentId
            });
            context.SaveChanges();
            return ServiceResponse<List<LoadPaymentDto>>.CreateSuccess([]);
        });
        var service = new StripeRentAllocationService(context, payments.Object, Mock.Of<ILogger<StripeRentAllocationService>>());

        var act = () => service.AllocateAsync(Command("pi_no_ledger"));

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*ledger*");
        (await context.StripeRentPayments.SingleAsync()).AllocationCompletedAt.Should().BeNull();
    }

    [Fact]
    public async Task AllocateAsync_PreservesTrackedWebhookEventForProcessedMarker()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.Add(StripeRentPaymentFlowTests.NewPayment("pi_event_marker"));
        await StripeRentPaymentFlowTests.SeedLeaseAsync(context, 1, 2);
        var webhookEvent = new StripeWebhookEvent { StripeEventId = "evt_marker", EventType = "payment_intent.succeeded" };
        context.Add(webhookEvent);
        await context.SaveChangesAsync();
        var paymentService = new Mock<IPaymentService>();
        paymentService.Setup(x => x.AddPayment(It.IsAny<AddPaymentDto>())).Callback((AddPaymentDto dto) =>
        {
            var payment = new Payment
            {
                LeaseId = dto.LeaseId, PropertyId = 1, OrganizationId = 2, Amount = dto.Amount,
                PaymentDate = dto.PaymentDate, Reference = dto.Reference, StripePaymentIntentId = dto.StripePaymentIntentId,
                Status = "Completed"
            };
            context.Payments.Add(payment);
            context.SaveChanges();
            context.GeneralLedgerEntries.Add(new GeneralLedgerEntry
            {
                AccountId = 1, OrganizationId = 2, TransactionId = payment.Id, TransactionType = "Payment",
                TransactionDate = dto.PaymentDate, Description = "Rent payment", Amount = dto.Amount,
                Reference = dto.Reference
            });
            context.SaveChanges();
        }).ReturnsAsync(ServiceResponse<List<LoadPaymentDto>>.CreateSuccess([]));
        var service = new StripeRentAllocationService(context, paymentService.Object,
            Mock.Of<ILogger<StripeRentAllocationService>>());

        var authority = new StripeRentPaymentSettlementAuthority("pi_event_marker", "ch_event", 10_000, "usd", 1, 2, 3,
            "op_pi_event_marker", DateTime.UtcNow);
        await service.AllocateAsync(new StripeRentAllocationCommand(authority, "pm_event", "card", DateTimeOffset.UtcNow));
        webhookEvent.Status = "Processed";
        webhookEvent.ProcessedAt = DateTime.UtcNow;
        await context.SaveChangesAsync();

        context.ChangeTracker.Clear();
        var storedEvent = await context.StripeWebhookEvents.SingleAsync();
        storedEvent.Status.Should().Be("Processed");
        storedEvent.ProcessedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task AllocateAsync_WhenTenantMembershipWasRevoked_FailsBeforeAccounting()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        await StripeRentPaymentFlowTests.SeedLeaseAsync(context, 1, 2);
        context.StripeRentPayments.Add(StripeRentPaymentFlowTests.NewPayment("pi_revoked"));
        context.TenantLeases.RemoveRange(context.TenantLeases);
        await context.SaveChangesAsync();
        var payments = new Mock<IPaymentService>();
        var service = new StripeRentAllocationService(context, payments.Object, Mock.Of<ILogger<StripeRentAllocationService>>());

        var act = () => service.AllocateAsync(Command("pi_revoked"));

        await act.Should().ThrowAsync<UnauthorizedAccessException>();
        payments.VerifyNoOtherCalls();
    }

    private static StripeRentAllocationCommand Command(string id) => new(
        new StripeRentPaymentSettlementAuthority(id, "ch_1", 100_00, "usd", 1, 2, 3, $"op_{id}", DateTime.UtcNow),
        "pm_1", "card", DateTimeOffset.UtcNow);
}
