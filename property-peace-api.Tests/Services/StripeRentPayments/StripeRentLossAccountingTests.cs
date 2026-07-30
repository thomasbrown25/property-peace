using brownstone_hub_api.Models;
using brownstone_hub_api.Services.StripeRentPayments;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.StripeRentPayments;

public sealed class StripeRentLossAccountingTests
{
    [Fact]
    public async Task ApplyAsync_PartialRefund_ReopensExactAmountAndUpdatesOneLedgerReversal()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        await SeedCompletedPaymentAsync(context, refundedCents: 3_000, disputedCents: 0);
        var service = new StripeRentLossAccountingService(context, Mock.Of<ILogger<StripeRentLossAccountingService>>());
        var outstandingBefore = await Utils.RentCalculator.GetOutstandingForTenantAsync(context, 1);

        await service.ApplyAsync(new StripeRentLossAccountingCommand("pi_loss", StripeRentPaymentBlockKind.Refund, DateTimeOffset.UtcNow));

        var outstandingAfter = await Utils.RentCalculator.GetOutstandingForTenantAsync(context, 1);
        outstandingAfter.Should().Be(outstandingBefore + 30m);

        var original = await context.Payments.SingleAsync(x => x.Amount > 0);
        original.Status.Should().Be("PartiallyRefunded");
        var adjustment = await context.Payments.SingleAsync(x => x.Amount < 0);
        adjustment.Amount.Should().Be(-30m);
        adjustment.Status.Should().Be("Completed");
        var reversal = await context.GeneralLedgerEntries.SingleAsync(x => x.TransactionType == "PaymentLossReversal");
        reversal.Amount.Should().Be(-30m);
    }

    [Fact]
    public async Task ApplyAsync_ReplayedCumulativeRefund_UpdatesExistingAdjustmentRatherThanDuplicating()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var aggregate = await SeedCompletedPaymentAsync(context, refundedCents: 3_000, disputedCents: 0);
        var service = new StripeRentLossAccountingService(context, Mock.Of<ILogger<StripeRentLossAccountingService>>());
        var command = new StripeRentLossAccountingCommand("pi_loss", StripeRentPaymentBlockKind.Refund, DateTimeOffset.UtcNow);
        await service.ApplyAsync(command);
        aggregate.RefundedAmountCents = 5_000;
        await context.SaveChangesAsync();

        await service.ApplyAsync(command);

        (await context.Payments.Where(x => x.Amount < 0).ToListAsync()).Should().ContainSingle().Which.Amount.Should().Be(-50m);
        (await context.GeneralLedgerEntries.Where(x => x.TransactionType == "PaymentLossReversal").ToListAsync())
            .Should().ContainSingle().Which.Amount.Should().Be(-50m);
    }

    [Fact]
    public async Task ApplyAsync_RefundThenDispute_CapsCumulativeLossAtCapturedAmount()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        await SeedCompletedPaymentAsync(context, refundedCents: 3_000, disputedCents: 8_000);
        var service = new StripeRentLossAccountingService(context, Mock.Of<ILogger<StripeRentLossAccountingService>>());

        await service.ApplyAsync(new StripeRentLossAccountingCommand("pi_loss", StripeRentPaymentBlockKind.Dispute, DateTimeOffset.UtcNow));

        (await context.Payments.SingleAsync(x => x.Amount > 0)).Status.Should().Be("Disputed");
        (await context.Payments.SingleAsync(x => x.Amount < 0)).Amount.Should().Be(-100m);
        (await context.GeneralLedgerEntries.SingleAsync(x => x.TransactionType == "PaymentLossReversal")).Amount.Should().Be(-100m);
    }

    [Fact]
    public async Task ApplyAsync_MissingOriginalLedger_FailsBeforeMutatingLocalAccounting()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        await SeedCompletedPaymentAsync(context, refundedCents: 3_000, disputedCents: 0, includeLedger: false);
        var service = new StripeRentLossAccountingService(context, Mock.Of<ILogger<StripeRentLossAccountingService>>());

        var act = () => service.ApplyAsync(new StripeRentLossAccountingCommand("pi_loss", StripeRentPaymentBlockKind.Refund, DateTimeOffset.UtcNow));

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*ledger*");
        (await context.Payments.SingleAsync()).Status.Should().Be("Completed");
        (await context.Payments.CountAsync()).Should().Be(1);
    }

    private static async Task<StripeRentPayment> SeedCompletedPaymentAsync(
        Data.DataContext context, long refundedCents, long disputedCents, bool includeLedger = true)
    {
        await StripeRentPaymentFlowTests.SeedLeaseAsync(context, 1, 2);
        var aggregate = StripeRentPaymentFlowTests.NewPayment("pi_loss");
        aggregate.Status = StripeRentPaymentStatus.Blocked;
        aggregate.AllocationCompletedAt = DateTimeOffset.UtcNow;
        aggregate.RefundedAmountCents = refundedCents;
        aggregate.DisputedAmountCents = disputedCents;
        context.StripeRentPayments.Add(aggregate);
        var payment = new Payment
        {
            LeaseId = 1, PropertyId = 1, OrganizationId = 2, Amount = 100m,
            PaymentDate = DateTime.UtcNow, Reference = "pi_loss", Status = "Completed",
            StripePaymentIntentId = "pi_loss", StripeChargeId = "ch_loss", Method = "card"
        };
        context.Payments.Add(payment);
        await context.SaveChangesAsync();
        if (includeLedger)
        {
            context.GeneralLedgerEntries.Add(new GeneralLedgerEntry
            {
                OrganizationId = 2, AccountId = 1, TransactionId = payment.Id,
                TransactionType = "Payment", Amount = 100m, TransactionDate = DateTime.UtcNow,
                Reference = "pi_loss"
            });
            await context.SaveChangesAsync();
        }
        return aggregate;
    }
}
