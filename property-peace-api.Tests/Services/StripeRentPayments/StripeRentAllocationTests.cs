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

    [Fact]
    public async Task FeeSuccess_CreditsOnlySelectedFee_AndReplayDoesNotCreditTwice()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        await StripeRentPaymentFlowTests.SeedLeaseAsync(context, 1, 2);
        context.LeaseFees.Add(new LeaseFee { Id = 19, LeaseId = 1, OrganizationId = 2, Amount = 100m });
        var aggregate = StripeRentPaymentFlowTests.NewPayment("pi_fee_allocate");
        aggregate.ChargeId = "fee:19";
        aggregate.AmountCents = 3500;
        context.StripeRentPayments.Add(aggregate);
        context.Accounts.Add(new Account { Id = 440, OrganizationId = 2, AccountCode = "4400",
            AccountType = brownstone_hub_api.Enums.EAccountType.Income });
        await context.SaveChangesAsync();
        var payments = RecordingPayments(context);
        var service = new StripeRentAllocationService(context, payments.Object, Mock.Of<ILogger<StripeRentAllocationService>>());
        var command = Command("pi_fee_allocate", 3500);

        await service.AllocateAsync(command);
        await service.AllocateAsync(command);

        var row = await context.Payments.SingleAsync();
        row.FeeId.Should().Be(19);
        row.DepositId.Should().BeNull();
        row.OrganizationId.Should().Be(2);
        row.LeaseId.Should().Be(1);
        row.Status.Should().Be("Completed");
        row.Amount.Should().Be(35m);
        (await context.GeneralLedgerEntries.SingleAsync()).AccountId.Should().Be(440);
        (await context.StripeRentPayments.SingleAsync()).AllocationCompletedAt.Should().NotBeNull();
        payments.Verify(x => x.AddPayment(It.IsAny<AddPaymentDto>()), Times.Once);
    }

    [Theory]
    [InlineData("fee:019", 19, 2, 100)]
    [InlineData("fee:19", 19, 3, 100)]
    [InlineData("fee:19", 19, 2, 20)]
    [InlineData("fee:missing", 19, 2, 100)]
    [InlineData("deposit:pooled:1", 19, 2, 100)]
    public async Task InvalidOrObsoleteFee_DeniesAllocationWithoutCreditingRent(
        string chargeId, long feeId, long feeOrg, decimal feeAmount)
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        await StripeRentPaymentFlowTests.SeedLeaseAsync(context, 1, 2);
        context.LeaseFees.Add(new LeaseFee { Id = feeId, LeaseId = 1, OrganizationId = feeOrg, Amount = feeAmount });
        var aggregate = StripeRentPaymentFlowTests.NewPayment("pi_fee_invalid");
        aggregate.ChargeId = chargeId;
        aggregate.AmountCents = 3500;
        context.StripeRentPayments.Add(aggregate);
        await context.SaveChangesAsync();
        var payments = new Mock<IPaymentService>();
        var service = new StripeRentAllocationService(context, payments.Object, Mock.Of<ILogger<StripeRentAllocationService>>());

        await ((Func<Task>)(() => service.AllocateAsync(Command("pi_fee_invalid", 3500))))
            .Should().ThrowAsync<InvalidOperationException>();
        payments.VerifyNoOtherCalls();
        (await context.StripeRentPayments.SingleAsync()).AllocationCompletedAt.Should().BeNull();
    }

    [Fact]
    public async Task FeeSuccess_RejectsPriorCompletedFeeCreditThatExhaustsBalance()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        await StripeRentPaymentFlowTests.SeedLeaseAsync(context, 1, 2);
        context.LeaseFees.Add(new LeaseFee { Id = 19, LeaseId = 1, OrganizationId = 2, Amount = 50m });
        var aggregate = StripeRentPaymentFlowTests.NewPayment("pi_fee_full");
        aggregate.ChargeId = "fee:19";
        aggregate.AmountCents = 3500;
        context.StripeRentPayments.Add(aggregate);
        context.Payments.Add(new Payment { LeaseId = 1, OrganizationId = 2, FeeId = 19,
            Amount = 20m, Status = "Completed", PaymentDate = DateTime.UtcNow });
        await context.SaveChangesAsync();
        var payments = new Mock<IPaymentService>();

        await ((Func<Task>)(() => new StripeRentAllocationService(context, payments.Object,
            Mock.Of<ILogger<StripeRentAllocationService>>()).AllocateAsync(Command("pi_fee_full", 3500))))
            .Should().ThrowAsync<InvalidOperationException>().WithMessage("*balance*");
        payments.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task FeeSuccess_WrongIncomeAccountCannotMarkAllocationComplete()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        await StripeRentPaymentFlowTests.SeedLeaseAsync(context, 1, 2);
        context.LeaseFees.Add(new LeaseFee { Id = 19, LeaseId = 1, OrganizationId = 2, Amount = 100m });
        var aggregate = StripeRentPaymentFlowTests.NewPayment("pi_fee_wrong_account");
        aggregate.ChargeId = "fee:19";
        context.StripeRentPayments.Add(aggregate);
        context.Accounts.Add(new Account { Id = 440, OrganizationId = 2, AccountCode = "4000",
            AccountType = brownstone_hub_api.Enums.EAccountType.Income });
        await context.SaveChangesAsync();
        var payments = RecordingPayments(context);
        var service = new StripeRentAllocationService(context, payments.Object, Mock.Of<ILogger<StripeRentAllocationService>>());

        await ((Func<Task>)(() => service.AllocateAsync(Command("pi_fee_wrong_account"))))
            .Should().ThrowAsync<InvalidOperationException>().WithMessage("*ledger*");
        (await context.StripeRentPayments.SingleAsync()).AllocationCompletedAt.Should().BeNull();
    }

    [Fact]
    public async Task FeeSuccess_CompletedMarkerWithWrongFeeCannotSilentlyReplay()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        await StripeRentPaymentFlowTests.SeedLeaseAsync(context, 1, 2);
        var aggregate = StripeRentPaymentFlowTests.NewPayment("pi_fee_mismatch");
        aggregate.ChargeId = "fee:19";
        aggregate.AllocationCompletedAt = DateTimeOffset.UtcNow;
        context.StripeRentPayments.Add(aggregate);
        context.Payments.Add(new Payment { LeaseId = 1, OrganizationId = 2, FeeId = 20,
            Amount = 100m, StripePaymentIntentId = aggregate.PaymentIntentId, Status = "Completed",
            PaymentDate = DateTime.UtcNow });
        await context.SaveChangesAsync();
        var payments = new Mock<IPaymentService>();

        await ((Func<Task>)(() => new StripeRentAllocationService(context, payments.Object,
            Mock.Of<ILogger<StripeRentAllocationService>>()).AllocateAsync(Command("pi_fee_mismatch"))))
            .Should().ThrowAsync<InvalidOperationException>().WithMessage("*does not exactly match*");
        payments.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task ConcurrentIntentsForOneFee_CannotBothCreditBeyondBalance()
    {
        var database = Guid.NewGuid().ToString();
        await using (var setup = StripeRentPaymentFlowTests.CreateContext(database))
        {
            await StripeRentPaymentFlowTests.SeedLeaseAsync(setup, 1, 2);
            setup.LeaseFees.Add(new LeaseFee { Id = 19, LeaseId = 1, OrganizationId = 2, Amount = 50m });
            setup.Accounts.Add(new Account { Id = 440, OrganizationId = 2, AccountCode = "4400",
                AccountType = brownstone_hub_api.Enums.EAccountType.Income });
            foreach (var id in new[] { "pi_fee_one", "pi_fee_two" })
            {
                var aggregate = StripeRentPaymentFlowTests.NewPayment(id);
                aggregate.ChargeId = "fee:19";
                aggregate.AmountCents = 3500;
                setup.StripeRentPayments.Add(aggregate);
            }
            await setup.SaveChangesAsync();
        }
        await using var first = StripeRentPaymentFlowTests.CreateContext(database);
        await using var second = StripeRentPaymentFlowTests.CreateContext(database);
        var accepted = 0;
        async Task Allocate(brownstone_hub_api.Data.DataContext db, string id)
        {
            try
            {
                await new StripeRentAllocationService(db, RecordingPayments(db).Object,
                    Mock.Of<ILogger<StripeRentAllocationService>>()).AllocateAsync(Command(id, 3500));
                Interlocked.Increment(ref accepted);
            }
            catch (InvalidOperationException) { }
        }

        await Task.WhenAll(Allocate(first, "pi_fee_one"), Allocate(second, "pi_fee_two"));

        accepted.Should().Be(1);
        await using var verify = StripeRentPaymentFlowTests.CreateContext(database);
        (await verify.Payments.Where(p => p.FeeId == 19).SumAsync(p => p.Amount)).Should().Be(35m);
    }

    private static Mock<IPaymentService> RecordingPayments(brownstone_hub_api.Data.DataContext context)
    {
        var payments = new Mock<IPaymentService>();
        payments.Setup(x => x.AddPayment(It.IsAny<AddPaymentDto>())).ReturnsAsync((AddPaymentDto dto) =>
        {
            var row = new Payment { LeaseId = dto.LeaseId, OrganizationId = 2, Amount = dto.Amount,
                PaymentDate = dto.PaymentDate, Reference = dto.Reference, StripePaymentIntentId = dto.StripePaymentIntentId,
                FeeId = dto.FeeId, DepositId = dto.DepositId, Status = dto.Status };
            context.Payments.Add(row);
            context.SaveChanges();
            context.GeneralLedgerEntries.Add(new GeneralLedgerEntry { OrganizationId = 2, AccountId = 440,
                TransactionId = row.Id, TransactionType = "Payment", Amount = dto.Amount });
            context.SaveChanges();
            return ServiceResponse<List<LoadPaymentDto>>.CreateSuccess([]);
        });
        return payments;
    }

    private static StripeRentAllocationCommand Command(string id, long cents = 100_00) => new(
        new StripeRentPaymentSettlementAuthority(id, "ch_1", cents, "usd", 1, 2, 3, $"op_{id}", DateTime.UtcNow),
        "pm_1", "card", DateTimeOffset.UtcNow);
}
