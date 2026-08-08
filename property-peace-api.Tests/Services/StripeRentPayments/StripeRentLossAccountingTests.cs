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
    public async Task ApplyAsync_ReplayedCumulativeRefund_AppendsOnlyTheLedgerDeltaWithoutDuplicatingProjection()
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
        var ledgerDeltas = await context.GeneralLedgerEntries
            .Where(x => x.TransactionType == "PaymentLossReversal")
            .OrderBy(x => x.Id)
            .ToListAsync();
        ledgerDeltas.Select(x => x.Amount).Should().Equal(-30m, -20m);
        ledgerDeltas.Select(x => x.Reference).Should().OnlyHaveUniqueItems();
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
    public async Task RecoverWonDispute_WithOverlappingRefund_RestoresOnlyLossBeyondRefundExposure()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var aggregate = await SeedCompletedPaymentAsync(context, refundedCents: 3_000, disputedCents: 8_000);
        aggregate.StripeDisputeId = "dp_overlap";
        await context.SaveChangesAsync();
        var service = new StripeRentLossAccountingService(context, Mock.Of<ILogger<StripeRentLossAccountingService>>());
        await service.ApplyAsync(new StripeRentLossAccountingCommand(
            "pi_loss", StripeRentPaymentBlockKind.Dispute, DateTimeOffset.UtcNow));

        await service.RecoverWonDisputeAsync("pi_loss", "ch_loss", "dp_overlap", 8_000, "usd",
            DateTimeOffset.UtcNow.AddMinutes(1));

        context.ChangeTracker.Clear();
        (await context.Payments.SingleAsync(x => x.Reference == "pi_loss:loss")).Amount.Should().Be(-30m);
        (await context.Payments.CountAsync(x => x.Reference == "pi_loss:dispute-recovery")).Should().Be(0);
        var ledgerHistory = await context.GeneralLedgerEntries
            .Where(x => x.TransactionType == "PaymentLossReversal" || x.TransactionType == "PaymentLossRecovery")
            .ToListAsync();
        ledgerHistory.Sum(x => x.Amount).Should().Be(-30m);
        ledgerHistory.Single(x => x.TransactionType == "PaymentLossRecovery").Amount.Should().Be(70m);
    }

    [Fact]
    public async Task RecoverWonDispute_AfterPriorTransferReversal_FailsClosedForManualDestinationFunding()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var aggregate = await SeedCompletedPaymentAsync(context, refundedCents: 3_000, disputedCents: 8_000);
        aggregate.StripeDisputeId = "dp_reversed";
        aggregate.StripeTransferId = "tr_retained";
        aggregate.StripeTransferReversalId = "trr_retained";
        aggregate.ReversedAmountCents = 10_000;
        aggregate.ReversalTargetAmountCents = 10_000;
        aggregate.ReversalIncrementAmountCents = 7_000;
        aggregate.NextTransferAttemptAt = DateTimeOffset.UtcNow.AddMinutes(5);
        await context.SaveChangesAsync();
        var service = new StripeRentLossAccountingService(context, Mock.Of<ILogger<StripeRentLossAccountingService>>());
        await service.ApplyAsync(new StripeRentLossAccountingCommand(
            "pi_loss", StripeRentPaymentBlockKind.Dispute, DateTimeOffset.UtcNow));

        await service.RecoverWonDisputeAsync("pi_loss", "ch_loss", "dp_reversed", 8_000, "usd",
            DateTimeOffset.UtcNow.AddMinutes(1));

        context.ChangeTracker.Clear();
        aggregate = await context.StripeRentPayments.SingleAsync();
        aggregate.Status.Should().Be(StripeRentPaymentStatus.RecoveryFailed);
        aggregate.RiskReason.Should().Contain("manual destination funding");
        aggregate.StripeTransferId.Should().Be("tr_retained");
        aggregate.StripeTransferReversalId.Should().Be("trr_retained");
        aggregate.ReversedAmountCents.Should().Be(10_000);
        aggregate.ReversalTargetAmountCents.Should().Be(0);
        aggregate.ReversalIncrementAmountCents.Should().Be(0);
        aggregate.TransferEligibleAt.Should().BeNull();
        aggregate.NextTransferAttemptAt.Should().BeNull();
        (await context.GeneralLedgerEntries.SingleAsync(x => x.TransactionType == "PaymentLossRecovery"))
            .Amount.Should().Be(70m);

        await service.RecoverWonDisputeAsync("pi_loss", "ch_loss", "dp_reversed", 8_000, "usd",
            DateTimeOffset.UtcNow.AddMinutes(2));
        context.ChangeTracker.Clear();
        aggregate = await context.StripeRentPayments.SingleAsync();
        aggregate.Status.Should().Be(StripeRentPaymentStatus.RecoveryFailed);
        aggregate.RiskReason.Should().Contain("manual destination funding");
        aggregate.ReversedAmountCents.Should().Be(10_000);
    }

    [Fact]
    public async Task ApplyDisputeCreatedAsync_StaleTrackedReplayAfterWonClosure_IsNoOpUnderIntentGate()
    {
        var database = Guid.NewGuid().ToString();
        await using (var seed = StripeRentPaymentFlowTests.CreateContext(database))
        {
            await SeedCompletedPaymentAsync(seed, refundedCents: 0, disputedCents: 0);
            var service = new StripeRentLossAccountingService(seed, Mock.Of<ILogger<StripeRentLossAccountingService>>());
            await service.ApplyDisputeCreatedAsync(new StripeRentDisputeCreatedCommand(
                "pi_loss", "ch_loss", "dp_race", 3_000, DateTimeOffset.UtcNow, "dispute"));
        }

        await using var staleContext = StripeRentPaymentFlowTests.CreateContext(database);
        _ = await staleContext.StripeRentPayments.SingleAsync();
        var staleService = new StripeRentLossAccountingService(staleContext,
            Mock.Of<ILogger<StripeRentLossAccountingService>>());
        await using (var wonContext = StripeRentPaymentFlowTests.CreateContext(database))
        {
            var wonService = new StripeRentLossAccountingService(wonContext,
                Mock.Of<ILogger<StripeRentLossAccountingService>>());
            await wonService.RecoverWonDisputeAsync("pi_loss", "ch_loss", "dp_race", 3_000, "usd",
                DateTimeOffset.UtcNow.AddMinutes(1));
        }

        var replay = await staleService.ApplyDisputeCreatedAsync(new StripeRentDisputeCreatedCommand(
            "pi_loss", "ch_loss", "dp_race", 3_000, DateTimeOffset.UtcNow, "stale dispute"));

        replay.Applied.Should().BeFalse();
        staleContext.ChangeTracker.Clear();
        var aggregate = await staleContext.StripeRentPayments.SingleAsync();
        aggregate.StripeDisputeStatus.Should().Be("won");
        aggregate.DisputedAmountCents.Should().Be(0);
        (await staleContext.GeneralLedgerEntries.CountAsync(x => x.TransactionType == "PaymentLossReversal"))
            .Should().Be(1);
    }

    [Fact]
    public async Task ApplyAsync_AfterWaitingOnLossGate_ReloadsCombinedRefundAndDisputeExposure()
    {
        var database = Guid.NewGuid().ToString();
        await using (var seed = StripeRentPaymentFlowTests.CreateContext(database))
            await SeedCompletedPaymentAsync(seed, refundedCents: 3_000, disputedCents: 0);

        await using var staleContext = StripeRentPaymentFlowTests.CreateContext(database);
        var staleAggregate = await staleContext.StripeRentPayments.SingleAsync();
        staleAggregate.RefundedAmountCents.Should().Be(3_000);
        staleAggregate.DisputedAmountCents.Should().Be(0);

        await using (var concurrentContext = StripeRentPaymentFlowTests.CreateContext(database))
        {
            var concurrentAggregate = await concurrentContext.StripeRentPayments.SingleAsync();
            concurrentAggregate.DisputedAmountCents = 8_000;
            await concurrentContext.SaveChangesAsync();
        }

        var service = new StripeRentLossAccountingService(staleContext,
            Mock.Of<ILogger<StripeRentLossAccountingService>>());
        await service.ApplyAsync(new StripeRentLossAccountingCommand(
            "pi_loss", StripeRentPaymentBlockKind.Refund, DateTimeOffset.UtcNow));

        staleContext.ChangeTracker.Clear();
        var aggregate = await staleContext.StripeRentPayments.SingleAsync();
        aggregate.RefundedAmountCents.Should().Be(3_000);
        aggregate.DisputedAmountCents.Should().Be(8_000);
        (await staleContext.Payments.SingleAsync(x => x.Reference == "pi_loss:loss")).Amount.Should().Be(-100m);
        (await staleContext.GeneralLedgerEntries.SingleAsync(x => x.TransactionType == "PaymentLossReversal"))
            .Amount.Should().Be(-100m);
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

    internal static async Task<StripeRentPayment> SeedCompletedPaymentAsync(
        Data.DataContext context, long refundedCents, long disputedCents, bool includeLedger = true)
    {
        await StripeRentPaymentFlowTests.SeedLeaseAsync(context, 1, 2);
        var aggregate = StripeRentPaymentFlowTests.NewPayment("pi_loss");
        aggregate.Status = StripeRentPaymentStatus.Blocked;
        aggregate.StripeChargeId = "ch_loss";
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
