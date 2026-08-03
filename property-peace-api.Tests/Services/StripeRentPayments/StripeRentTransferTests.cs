using brownstone_hub_api.Models;
using brownstone_hub_api.Services.StripeRentPayments;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.StripeRentPayments;

public sealed class StripeRentTransferTests
{
    [Fact]
    public async Task MarkBlockedAsync_AfterTransfer_QueuesIdempotentReversal()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var payment = HeldPayment(DateTimeOffset.UtcNow.AddDays(-1));
        payment.Status = StripeRentPaymentStatus.Transferred;
        payment.StripeTransferId = "tr_123";
        context.Add(payment);
        await context.SaveChangesAsync();
        var service = CreateService(context, Mock.Of<IStripeRentGateway>(), Mock.Of<IStripeRentRiskService>(), transfersEnabled: false);

        await service.MarkBlockedAsync(payment.PaymentIntentId, payment.StripeChargeId,
            StripeRentPaymentBlockKind.Dispute, "dp_123", "charge disputed", 7_500);

        var stored = await context.StripeRentPayments.SingleAsync();
        stored.Status.Should().Be(StripeRentPaymentStatus.ReversalPending);
        stored.StripeTransferId.Should().Be("tr_123");
        stored.StripeDisputeId.Should().Be("dp_123");
        stored.DisputedAmountCents.Should().Be(7_500);
    }

    [Fact]
    public async Task ProcessEligibleAsync_PartialRefund_ReversesOnlyIncrementalLostAmount()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var payment = HeldPayment(DateTimeOffset.UtcNow.AddDays(-1));
        payment.Status = StripeRentPaymentStatus.Transferred;
        payment.StripeTransferId = "tr_partial";
        context.Add(payment);
        await context.SaveChangesAsync();
        var gateway = new Mock<IStripeRentGateway>();
        gateway.Setup(x => x.CreateTransferReversalAsync("tr_partial", 3_000,
                "rent-transfer-reversal:pi_transfer:3000", It.IsAny<CancellationToken>()))
            .ReturnsAsync("trr_partial_1");
        gateway.Setup(x => x.CreateTransferReversalAsync("tr_partial", 2_000,
                "rent-transfer-reversal:pi_transfer:5000", It.IsAny<CancellationToken>()))
            .ReturnsAsync("trr_partial_2");
        var service = CreateService(context, gateway.Object, Mock.Of<IStripeRentRiskService>(), transfersEnabled: false);

        await service.MarkBlockedAsync("pi_transfer", "ch_123", StripeRentPaymentBlockKind.Refund,
            "re_partial_1", "partial refund", 3_000);
        await service.ProcessEligibleTransfersAsync();
        var stored = await context.StripeRentPayments.SingleAsync();
        stored.Status.Should().Be(StripeRentPaymentStatus.Blocked);
        stored.ReversedAmountCents.Should().Be(3_000);

        await service.MarkBlockedAsync("pi_transfer", "ch_123", StripeRentPaymentBlockKind.Refund,
            "re_partial_2", "larger cumulative refund", 5_000);
        await service.ProcessEligibleTransfersAsync();
        stored = await context.StripeRentPayments.SingleAsync();
        stored.Status.Should().Be(StripeRentPaymentStatus.Blocked);
        stored.ReversedAmountCents.Should().Be(5_000);
        gateway.VerifyAll();
    }

    [Fact]
    public async Task ProcessEligibleAsync_WhenLargerRefundArrivesDuringReversal_PreservesPendingDifference()
    {
        var database = Guid.NewGuid().ToString();
        await using (var setup = StripeRentPaymentFlowTests.CreateContext(database))
        {
            var payment = HeldPayment(DateTimeOffset.UtcNow.AddDays(-1));
            payment.Status = StripeRentPaymentStatus.Transferred;
            payment.StripeTransferId = "tr_concurrent_refund";
            setup.Add(payment);
            await setup.SaveChangesAsync();
        }
        var gateway = new Mock<IStripeRentGateway>();
        gateway.Setup(x => x.CreateTransferReversalAsync("tr_concurrent_refund", 3_000,
                "rent-transfer-reversal:pi_transfer:3000", It.IsAny<CancellationToken>()))
            .Returns(async () =>
            {
                await using var concurrent = StripeRentPaymentFlowTests.CreateContext(database);
                var concurrentService = CreateService(concurrent, gateway.Object, Mock.Of<IStripeRentRiskService>(), transfersEnabled: false);
                await concurrentService.MarkBlockedAsync("pi_transfer", "ch_123", StripeRentPaymentBlockKind.Refund,
                    "re_concurrent_2", "larger refund arrived during reversal", 5_000);
                return "trr_concurrent_1";
            });
        gateway.Setup(x => x.CreateTransferReversalAsync("tr_concurrent_refund", 2_000,
                "rent-transfer-reversal:pi_transfer:5000", It.IsAny<CancellationToken>()))
            .ReturnsAsync("trr_concurrent_2");
        await using var context = StripeRentPaymentFlowTests.CreateContext(database);
        var service = CreateService(context, gateway.Object, Mock.Of<IStripeRentRiskService>(), transfersEnabled: false);

        await service.MarkBlockedAsync("pi_transfer", "ch_123", StripeRentPaymentBlockKind.Refund,
            "re_concurrent_1", "partial refund", 3_000);
        await service.ProcessEligibleTransfersAsync();
        context.ChangeTracker.Clear();
        var stored = await context.StripeRentPayments.SingleAsync();
        stored.ReversedAmountCents.Should().Be(3_000);
        stored.RefundedAmountCents.Should().Be(5_000);
        stored.Status.Should().Be(StripeRentPaymentStatus.ReversalPending);

        await service.ProcessEligibleTransfersAsync();
        context.ChangeTracker.Clear();
        stored = await context.StripeRentPayments.SingleAsync();
        stored.ReversedAmountCents.Should().Be(5_000);
        stored.Status.Should().Be(StripeRentPaymentStatus.Blocked);
        gateway.VerifyAll();
    }

    [Fact]
    public async Task ProcessEligibleAsync_AmbiguousPartialReversal_ReplaysExactAttemptBeforeLargerRefundDelta()
    {
        var database = Guid.NewGuid().ToString();
        await using (var setup = StripeRentPaymentFlowTests.CreateContext(database))
        {
            var payment = HeldPayment(DateTimeOffset.UtcNow.AddDays(-1));
            payment.Status = StripeRentPaymentStatus.Transferred;
            payment.StripeTransferId = "tr_ambiguous_reversal";
            setup.Add(payment);
            await setup.SaveChangesAsync();
        }
        var gateway = new Mock<IStripeRentGateway>();
        var firstAttempt = true;
        gateway.Setup(x => x.CreateTransferReversalAsync("tr_ambiguous_reversal", 3_000,
                "rent-transfer-reversal:pi_transfer:3000", It.IsAny<CancellationToken>()))
            .Returns(async () =>
            {
                if (firstAttempt)
                {
                    firstAttempt = false;
                    await using var concurrent = StripeRentPaymentFlowTests.CreateContext(database);
                    var concurrentService = CreateService(concurrent, gateway.Object, Mock.Of<IStripeRentRiskService>(), transfersEnabled: false);
                    await concurrentService.MarkBlockedAsync("pi_transfer", "ch_123", StripeRentPaymentBlockKind.Refund,
                        "re_ambiguous_larger", "larger refund during response loss", 5_000);
                    throw new TimeoutException("Stripe accepted reversal but response was lost");
                }
                return "trr_original_attempt";
            });
        gateway.Setup(x => x.CreateTransferReversalAsync("tr_ambiguous_reversal", 2_000,
                "rent-transfer-reversal:pi_transfer:5000", It.IsAny<CancellationToken>()))
            .ReturnsAsync("trr_delta");
        await using var context = StripeRentPaymentFlowTests.CreateContext(database);
        var service = CreateService(context, gateway.Object, Mock.Of<IStripeRentRiskService>(), transfersEnabled: false);

        await service.MarkBlockedAsync("pi_transfer", "ch_123", StripeRentPaymentBlockKind.Refund,
            "re_ambiguous_initial", "initial partial refund", 3_000);
        await service.ProcessEligibleTransfersAsync();
        context.ChangeTracker.Clear();
        var stored = await context.StripeRentPayments.SingleAsync();
        stored.ReversedAmountCents.Should().Be(0);
        stored.ReversalTargetAmountCents.Should().Be(3_000);
        stored.ReversalIncrementAmountCents.Should().Be(3_000);
        stored.RefundedAmountCents.Should().Be(5_000);

        await service.ProcessEligibleTransfersAsync();
        context.ChangeTracker.Clear();
        stored = await context.StripeRentPayments.SingleAsync();
        stored.ReversedAmountCents.Should().Be(3_000);
        stored.Status.Should().Be(StripeRentPaymentStatus.ReversalPending);

        await service.ProcessEligibleTransfersAsync();
        context.ChangeTracker.Clear();
        stored = await context.StripeRentPayments.SingleAsync();
        stored.ReversedAmountCents.Should().Be(5_000);
        stored.Status.Should().Be(StripeRentPaymentStatus.Blocked);
        gateway.Verify(x => x.CreateTransferReversalAsync("tr_ambiguous_reversal", 3_000,
            "rent-transfer-reversal:pi_transfer:3000", It.IsAny<CancellationToken>()), Times.Exactly(2));
        gateway.Verify(x => x.CreateTransferReversalAsync("tr_ambiguous_reversal", 2_000,
            "rent-transfer-reversal:pi_transfer:5000", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessEligibleAsync_ReversesTransferredBlockedPayment_EvenWhenNewTransfersAreDisabled()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var payment = HeldPayment(DateTimeOffset.UtcNow.AddDays(-1));
        payment.Status = StripeRentPaymentStatus.ReversalPending;
        payment.StripeTransferId = "tr_123";
        payment.DisputedAmountCents = payment.AmountCents;
        context.Add(payment);
        await context.SaveChangesAsync();
        var gateway = new Mock<IStripeRentGateway>();
        gateway.Setup(x => x.CreateTransferReversalAsync("tr_123", 10_000, "rent-transfer-reversal:pi_transfer:10000", It.IsAny<CancellationToken>()))
            .ReturnsAsync("trr_123");
        var service = CreateService(context, gateway.Object, Mock.Of<IStripeRentRiskService>(), transfersEnabled: false);

        await service.ProcessEligibleTransfersAsync();

        var stored = await context.StripeRentPayments.SingleAsync();
        stored.Status.Should().Be(StripeRentPaymentStatus.Reversed);
        stored.StripeTransferReversalId.Should().Be("trr_123");
        gateway.Verify(x => x.CreateTransferReversalAsync("tr_123", 10_000, "rent-transfer-reversal:pi_transfer:10000", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessEligibleAsync_WhenReversalKeepsFailing_StopsInDurableRecoveryFailedState()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var payment = HeldPayment(DateTimeOffset.UtcNow.AddDays(-1));
        payment.Status = StripeRentPaymentStatus.ReversalPending;
        payment.StripeTransferId = "tr_123";
        payment.DisputedAmountCents = payment.AmountCents;
        context.Add(payment);
        await context.SaveChangesAsync();
        var gateway = new Mock<IStripeRentGateway>();
        gateway.Setup(x => x.CreateTransferReversalAsync("tr_123", 10_000, "rent-transfer-reversal:pi_transfer:10000", It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("connected balance unavailable"));
        var config = new Dictionary<string, string?> { ["Stripe:ReversalMaxAttempts"] = "2" };
        var service = CreateService(context, gateway.Object, Mock.Of<IStripeRentRiskService>(), transfersEnabled: false, config: config);

        await service.ProcessEligibleTransfersAsync();
        await service.ProcessEligibleTransfersAsync();
        await service.ProcessEligibleTransfersAsync();

        var stored = await context.StripeRentPayments.SingleAsync();
        stored.Status.Should().Be(StripeRentPaymentStatus.RecoveryFailed);
        stored.ReversalAttemptCount.Should().Be(2);
        stored.LastReversalError.Should().Contain("connected balance unavailable");
        gateway.Verify(x => x.CreateTransferReversalAsync("tr_123", 10_000, "rent-transfer-reversal:pi_transfer:10000", It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    [Fact]
    public async Task ProcessEligibleAsync_WhenStripeSourceIsRefunded_BlocksBeforeTransfer()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.Add(HeldPayment(DateTimeOffset.UtcNow.AddDays(-1)));
        await context.SaveChangesAsync();
        var risk = new Mock<IStripeRentRiskService>();
        risk.Setup(x => x.EvaluateAsync(It.IsAny<StripeRentPayment>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RentTransferRiskDecision.Allow());
        var gateway = new Mock<IStripeRentGateway>();
        gateway.Setup(x => x.GetSourceStateAsync("ch_123", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripeRentSourceState(true, true, true, false, null, "pi_transfer", 100_00, "usd"));
        var service = CreateService(context, gateway.Object, risk.Object, transfersEnabled: true);

        await service.ProcessEligibleTransfersAsync();

        var stored = await context.StripeRentPayments.SingleAsync();
        stored.Status.Should().Be(StripeRentPaymentStatus.Blocked);
        stored.RiskReason.Should().Contain("refunded");
        gateway.Verify(x => x.CreateTransferAsync(It.IsAny<StripeRentTransferRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ProcessEligibleAsync_WhenTransfersSwitchMissing_DoesNothingFailClosed()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.StripeRentPayments.Add(HeldPayment(DateTimeOffset.UtcNow.AddDays(-1)));
        await context.SaveChangesAsync();
        var gateway = new Mock<IStripeRentGateway>();
        var service = CreateService(context, gateway.Object, Mock.Of<IStripeRentRiskService>(), transfersEnabled: null);

        var count = await service.ProcessEligibleTransfersAsync();

        count.Should().Be(0);
        gateway.VerifyNoOtherCalls();
        (await context.StripeRentPayments.SingleAsync()).Status.Should().Be(StripeRentPaymentStatus.Held);
    }

    [Fact]
    public async Task ProcessEligibleAsync_BeforeEligibility_DoesNotTransfer()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.StripeRentPayments.Add(HeldPayment(DateTimeOffset.UtcNow.AddDays(1)));
        await context.SaveChangesAsync();
        var gateway = new Mock<IStripeRentGateway>();
        var service = CreateService(context, gateway.Object, Mock.Of<IStripeRentRiskService>(), transfersEnabled: true);

        var count = await service.ProcessEligibleTransfersAsync();

        count.Should().Be(0);
        gateway.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task ProcessEligibleAsync_WhenRiskDenied_PersistsBlockedWithoutTransfer()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.StripeRentPayments.Add(HeldPayment(DateTimeOffset.UtcNow.AddDays(-1)));
        await context.SaveChangesAsync();
        var gateway = new Mock<IStripeRentGateway>();
        var risk = new Mock<IStripeRentRiskService>();
        risk.Setup(x => x.EvaluateAsync(It.IsAny<StripeRentPayment>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RentTransferRiskDecision.Deny("open dispute"));
        var service = CreateService(context, gateway.Object, risk.Object, transfersEnabled: true);

        var count = await service.ProcessEligibleTransfersAsync();

        count.Should().Be(0);
        var payment = await context.StripeRentPayments.SingleAsync();
        payment.Status.Should().Be(StripeRentPaymentStatus.Blocked);
        payment.RiskReason.Should().Be("open dispute");
        gateway.Verify(x => x.CreateTransferAsync(It.IsAny<StripeRentTransferRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ProcessEligibleAsync_PersistsPendingThenCreatesIdempotentTransferAndMarksTransferred()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.StripeRentPayments.Add(HeldPayment(DateTimeOffset.UtcNow.AddDays(-1)));
        await context.SaveChangesAsync();
        var risk = new Mock<IStripeRentRiskService>();
        risk.Setup(x => x.EvaluateAsync(It.IsAny<StripeRentPayment>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RentTransferRiskDecision.Allow());
        var gateway = new Mock<IStripeRentGateway>();
        SetupHealthySource(gateway);
        StripeRentTransferRequest? captured = null;
        gateway.Setup(x => x.CreateTransferAsync(It.IsAny<StripeRentTransferRequest>(), It.IsAny<CancellationToken>()))
            .Callback<StripeRentTransferRequest, CancellationToken>((request, _) =>
            {
                captured = request;
                context.StripeRentPayments.Single().Status.Should().Be(StripeRentPaymentStatus.TransferPending,
                    "the durable attempt must be saved before the network call");
            })
            .ReturnsAsync("tr_123");
        var service = CreateService(context, gateway.Object, risk.Object, transfersEnabled: true);

        var count = await service.ProcessEligibleTransfersAsync();

        count.Should().Be(1);
        captured.Should().NotBeNull();
        captured!.DestinationStripeAccountId.Should().Be("acct_landlord");
        captured.SourceTransaction.Should().Be("ch_123");
        captured.IdempotencyKey.Should().Be("rent-transfer:pi_transfer:attempt:1");
        captured.AmountCents.Should().Be(100_00);
        var payment = await context.StripeRentPayments.SingleAsync();
        payment.Status.Should().Be(StripeRentPaymentStatus.Transferred);
        payment.StripeTransferId.Should().Be("tr_123");
        payment.TransferAttemptCount.Should().Be(1);
        payment.TransferredAt.Should().NotBeNull();
    }

    [Fact]
    public async Task ProcessEligibleAsync_WhenAttemptWasInterrupted_RetriesWithSameIdempotencyKey()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var payment = HeldPayment(DateTimeOffset.UtcNow.AddDays(-1));
        payment.Status = StripeRentPaymentStatus.TransferPending;
        payment.TransferAttemptCount = 1;
        context.StripeRentPayments.Add(payment);
        await context.SaveChangesAsync();
        var gateway = new Mock<IStripeRentGateway>();
        SetupHealthySource(gateway);
        gateway.Setup(x => x.CreateTransferAsync(
                It.Is<StripeRentTransferRequest>(r => r.IdempotencyKey == "rent-transfer:pi_transfer"),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync("tr_recovered");
        var risk = new Mock<IStripeRentRiskService>();
        risk.Setup(x => x.EvaluateAsync(It.IsAny<StripeRentPayment>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RentTransferRiskDecision.Allow());
        var service = CreateService(context, gateway.Object, risk.Object, transfersEnabled: true);

        var count = await service.ProcessEligibleTransfersAsync();

        count.Should().Be(1);
        var stored = await context.StripeRentPayments.SingleAsync();
        stored.StripeTransferId.Should().Be("tr_recovered");
        stored.TransferAttemptCount.Should().Be(1);
        stored.TransferIdempotencyKey.Should().Be("rent-transfer:pi_transfer");
    }

    [Fact]
    public async Task ProcessEligibleAsync_WhenStripeDefinitivelyRejectsForInsufficientBalance_RotatesIdempotencyKeyOnRetry()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.StripeRentPayments.Add(HeldPayment(DateTimeOffset.UtcNow.AddDays(-1)));
        await context.SaveChangesAsync();
        var risk = new Mock<IStripeRentRiskService>();
        risk.Setup(x => x.EvaluateAsync(It.IsAny<StripeRentPayment>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RentTransferRiskDecision.Allow());
        var gateway = new Mock<IStripeRentGateway>();
        SetupHealthySource(gateway);
        var keys = new List<string>();
        gateway.Setup(x => x.CreateTransferAsync(
                It.Is<StripeRentTransferRequest>(r => r.IdempotencyKey == "rent-transfer:pi_transfer:attempt:1"),
                It.IsAny<CancellationToken>()))
            .Callback<StripeRentTransferRequest, CancellationToken>((request, _) => keys.Add(request.IdempotencyKey))
            .ThrowsAsync(new StripeRentTransferDefinitiveException("balance_insufficient", "insufficient available funds"));
        gateway.Setup(x => x.CreateTransferAsync(
                It.Is<StripeRentTransferRequest>(r => r.IdempotencyKey == "rent-transfer:pi_transfer:attempt:2"),
                It.IsAny<CancellationToken>()))
            .Callback<StripeRentTransferRequest, CancellationToken>((request, _) => keys.Add(request.IdempotencyKey))
            .ReturnsAsync("tr_after_funding");
        var service = CreateService(context, gateway.Object, risk.Object, transfersEnabled: true);

        await service.ProcessEligibleTransfersAsync();
        var afterFailure = await context.StripeRentPayments.SingleAsync();
        afterFailure.Status.Should().Be(StripeRentPaymentStatus.TransferPending);
        afterFailure.NextTransferAttemptAt.Should().NotBeNull();
        afterFailure.TransferAttemptCount.Should().Be(1);
        afterFailure.NextTransferAttemptAt = DateTimeOffset.UtcNow.AddMinutes(-1);
        await context.SaveChangesAsync();

        await service.ProcessEligibleTransfersAsync();

        var final = await context.StripeRentPayments.SingleAsync();
        final.Status.Should().Be(StripeRentPaymentStatus.Transferred);
        final.StripeTransferId.Should().Be("tr_after_funding");
        final.TransferAttemptCount.Should().Be(2);
        keys.Should().Equal("rent-transfer:pi_transfer:attempt:1", "rent-transfer:pi_transfer:attempt:2");
    }

    [Fact]
    public async Task ProcessEligibleAsync_WhenAmbiguousReplayBecomesDefinitive_SchedulesNewGenerationWithNewKey()
    {
        var now = new DateTimeOffset(2026, 8, 3, 8, 0, 0, TimeSpan.Zero);
        var time = new ManualTimeProvider(now);
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.Add(HeldPayment(now.AddDays(-1)));
        await context.SaveChangesAsync();
        var risk = new Mock<IStripeRentRiskService>();
        risk.Setup(x => x.EvaluateAsync(It.IsAny<StripeRentPayment>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RentTransferRiskDecision.Allow());
        var gateway = new Mock<IStripeRentGateway>();
        SetupHealthySource(gateway);
        var keys = new List<string>();
        var invocation = 0;
        gateway.Setup(x => x.CreateTransferAsync(It.IsAny<StripeRentTransferRequest>(), It.IsAny<CancellationToken>()))
            .Returns<StripeRentTransferRequest, CancellationToken>((request, _) =>
            {
                keys.Add(request.IdempotencyKey);
                invocation++;
                return invocation switch
                {
                    1 => Task.FromException<string>(new IOException("connection reset after dispatch")),
                    2 => Task.FromException<string>(new StripeRentTransferDefinitiveException("balance_insufficient", "insufficient available funds")),
                    _ => Task.FromResult("tr_after_reconciliation")
                };
            });
        var config = new Dictionary<string, string?> { ["Stripe:TransferMaxAttempts"] = "5", ["Stripe:TransferRetryBaseMinutes"] = "1" };
        var service = StripeRentPaymentFlowTests.CreateService(context, gateway.Object, true, risk.Object, true, time, config);

        await service.ProcessEligibleTransfersAsync();
        time.Advance(TimeSpan.FromMinutes(1));
        await service.ProcessEligibleTransfersAsync();
        var afterDefinitiveReplay = await context.StripeRentPayments.SingleAsync();
        afterDefinitiveReplay.Status.Should().Be(StripeRentPaymentStatus.TransferPending);
        afterDefinitiveReplay.TransferIdempotencyKey.Should().Be("rent-transfer:pi_transfer:attempt:1");
        time.Advance(TimeSpan.FromMinutes(1));
        await service.ProcessEligibleTransfersAsync();

        var final = await context.StripeRentPayments.SingleAsync();
        final.Status.Should().Be(StripeRentPaymentStatus.Transferred);
        final.TransferAttemptCount.Should().Be(2);
        keys.Should().Equal(
            "rent-transfer:pi_transfer:attempt:1",
            "rent-transfer:pi_transfer:attempt:1",
            "rent-transfer:pi_transfer:attempt:2");
    }

    [Fact]
    public async Task ProcessEligibleAsync_InterruptedFinalGeneration_ReplaysStoredKeyAtAttemptLimit()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var payment = HeldPayment(DateTimeOffset.UtcNow.AddDays(-1));
        payment.Status = StripeRentPaymentStatus.TransferPending;
        payment.TransferAttemptCount = 3;
        payment.TransferIdempotencyKey = "rent-transfer:pi_transfer:attempt:3";
        context.Add(payment);
        await context.SaveChangesAsync();
        var risk = new Mock<IStripeRentRiskService>();
        risk.Setup(x => x.EvaluateAsync(It.IsAny<StripeRentPayment>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RentTransferRiskDecision.Allow());
        var gateway = new Mock<IStripeRentGateway>();
        SetupHealthySource(gateway);
        gateway.Setup(x => x.CreateTransferAsync(
                It.Is<StripeRentTransferRequest>(r => r.IdempotencyKey == "rent-transfer:pi_transfer:attempt:3"),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync("tr_final_generation");
        var config = new Dictionary<string, string?> { ["Stripe:TransferMaxAttempts"] = "3" };
        var service = StripeRentPaymentFlowTests.CreateService(context, gateway.Object, true, risk.Object, true,
            TimeProvider.System, config);

        var count = await service.ProcessEligibleTransfersAsync();

        count.Should().Be(1);
        var stored = await context.StripeRentPayments.SingleAsync();
        stored.Status.Should().Be(StripeRentPaymentStatus.Transferred);
        stored.TransferAttemptCount.Should().Be(3);
    }

    [Fact]
    public async Task ProcessEligibleAsync_LegacyReconciliation_ReplaysAndPersistsLegacyKey()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var payment = HeldPayment(DateTimeOffset.UtcNow.AddDays(-1));
        payment.Status = StripeRentPaymentStatus.TransferReconciliationPending;
        payment.TransferAttemptCount = 1;
        payment.NextTransferAttemptAt = DateTimeOffset.UtcNow.AddMinutes(-1);
        context.Add(payment);
        await context.SaveChangesAsync();
        var risk = new Mock<IStripeRentRiskService>();
        risk.Setup(x => x.EvaluateAsync(It.IsAny<StripeRentPayment>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RentTransferRiskDecision.Allow());
        var gateway = new Mock<IStripeRentGateway>();
        SetupHealthySource(gateway);
        gateway.Setup(x => x.CreateTransferAsync(
                It.Is<StripeRentTransferRequest>(r => r.IdempotencyKey == "rent-transfer:pi_transfer"),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync("tr_legacy_reconciled");
        var service = CreateService(context, gateway.Object, risk.Object, transfersEnabled: true);

        await service.ProcessEligibleTransfersAsync();

        var stored = await context.StripeRentPayments.SingleAsync();
        stored.Status.Should().Be(StripeRentPaymentStatus.Transferred);
        stored.TransferIdempotencyKey.Should().Be("rent-transfer:pi_transfer");
    }

    [Fact]
    public async Task ProcessEligibleAsync_WhenStripeReportsIdempotencyParameterMismatch_PausesWithoutRotatingKey()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.StripeRentPayments.Add(HeldPayment(DateTimeOffset.UtcNow.AddDays(-1)));
        await context.SaveChangesAsync();
        var risk = new Mock<IStripeRentRiskService>();
        risk.Setup(x => x.EvaluateAsync(It.IsAny<StripeRentPayment>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RentTransferRiskDecision.Allow());
        var gateway = new Mock<IStripeRentGateway>();
        SetupHealthySource(gateway);
        gateway.Setup(x => x.CreateTransferAsync(It.IsAny<StripeRentTransferRequest>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new StripeRentTransferOperatorReviewException("idempotency_error", "parameters differ"));
        var service = CreateService(context, gateway.Object, risk.Object, transfersEnabled: true);

        await service.ProcessEligibleTransfersAsync();
        await service.ProcessEligibleTransfersAsync();

        context.ChangeTracker.Clear();
        var stored = await context.StripeRentPayments.SingleAsync();
        stored.Status.Should().Be(StripeRentPaymentStatus.TransferReconciliationPending);
        stored.TransferReconciliationPaused.Should().BeTrue();
        stored.TransferAttemptCount.Should().Be(1);
        stored.TransferIdempotencyKey.Should().Be("rent-transfer:pi_transfer:attempt:1");
        stored.NextTransferAttemptAt.Should().BeNull();
        gateway.Verify(x => x.CreateTransferAsync(It.IsAny<StripeRentTransferRequest>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessEligibleAsync_WhenBlockArrivesDuringTransfer_PersistsTransferAndQueuesReversal()
    {
        var database = Guid.NewGuid().ToString();
        await using (var setup = StripeRentPaymentFlowTests.CreateContext(database))
        {
            setup.Add(HeldPayment(DateTimeOffset.UtcNow.AddDays(-1)));
            await setup.SaveChangesAsync();
        }
        var risk = new Mock<IStripeRentRiskService>();
        risk.Setup(x => x.EvaluateAsync(It.IsAny<StripeRentPayment>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RentTransferRiskDecision.Allow());
        var gateway = new Mock<IStripeRentGateway>();
        SetupHealthySource(gateway);
        gateway.Setup(x => x.CreateTransferAsync(It.IsAny<StripeRentTransferRequest>(), It.IsAny<CancellationToken>()))
            .Returns(async () =>
            {
                await using var concurrent = StripeRentPaymentFlowTests.CreateContext(database);
                var concurrentService = CreateService(concurrent, gateway.Object, risk.Object, transfersEnabled: true);
                await concurrentService.MarkBlockedAsync("pi_transfer", "ch_123", StripeRentPaymentBlockKind.Refund,
                    "re_race", "refund arrived during transfer", 10_000);
                return "tr_race";
            });
        await using var context = StripeRentPaymentFlowTests.CreateContext(database);
        var service = CreateService(context, gateway.Object, risk.Object, transfersEnabled: true);

        await service.ProcessEligibleTransfersAsync();

        context.ChangeTracker.Clear();
        var stored = await context.StripeRentPayments.SingleAsync();
        stored.StripeTransferId.Should().Be("tr_race");
        stored.Status.Should().Be(StripeRentPaymentStatus.ReversalPending);
    }

    [Fact]
    public async Task ProcessEligibleAsync_WhenTransferOutcomeIsAmbiguousThenRefunded_ReconcilesAndReversesSameIdempotentTransfer()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.StripeRentPayments.Add(HeldPayment(DateTimeOffset.UtcNow.AddDays(-1)));
        await context.SaveChangesAsync();
        var risk = new Mock<IStripeRentRiskService>();
        risk.Setup(x => x.EvaluateAsync(It.IsAny<StripeRentPayment>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RentTransferRiskDecision.Allow());
        var gateway = new Mock<IStripeRentGateway>();
        SetupHealthySource(gateway);
        gateway.SetupSequence(x => x.CreateTransferAsync(
                It.Is<StripeRentTransferRequest>(r => r.IdempotencyKey == "rent-transfer:pi_transfer:attempt:1"),
                It.IsAny<CancellationToken>()))
            .ThrowsAsync(new TimeoutException("response lost after Stripe accepted the transfer"))
            .ReturnsAsync("tr_ambiguous");
        gateway.Setup(x => x.CreateTransferReversalAsync("tr_ambiguous", 10_000, "rent-transfer-reversal:pi_transfer:10000", It.IsAny<CancellationToken>()))
            .ReturnsAsync("trr_recovered");
        var service = CreateService(context, gateway.Object, risk.Object, transfersEnabled: true);

        await service.ProcessEligibleTransfersAsync();
        (await context.StripeRentPayments.SingleAsync()).Status.Should().Be(StripeRentPaymentStatus.TransferReconciliationPending);
        await service.MarkBlockedAsync("pi_transfer", "ch_123", StripeRentPaymentBlockKind.Refund, "re_ambiguous", "refund during ambiguous transfer", 10_000);
        await service.ProcessEligibleTransfersAsync();

        var stored = await context.StripeRentPayments.SingleAsync();
        stored.StripeTransferId.Should().Be("tr_ambiguous");
        stored.Status.Should().Be(StripeRentPaymentStatus.Reversed);
        stored.StripeTransferReversalId.Should().Be("trr_recovered");
        gateway.Verify(x => x.CreateTransferAsync(It.Is<StripeRentTransferRequest>(r => r.IdempotencyKey == "rent-transfer:pi_transfer:attempt:1"),
            It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    [Fact]
    public async Task ProcessEligibleAsync_ReconciliationExceptionAfterConcurrentReversal_DoesNotRegressReversedState()
    {
        var database = Guid.NewGuid().ToString();
        await using (var setup = StripeRentPaymentFlowTests.CreateContext(database))
        {
            var payment = HeldPayment(DateTimeOffset.UtcNow.AddDays(-1));
            payment.Status = StripeRentPaymentStatus.TransferReconciliationPending;
            payment.TransferAttemptCount = 1;
            payment.TransferIdempotencyKey = "rent-transfer:pi_transfer:attempt:1";
            setup.Add(payment);
            await setup.SaveChangesAsync();
        }
        var risk = new Mock<IStripeRentRiskService>();
        risk.Setup(x => x.EvaluateAsync(It.IsAny<StripeRentPayment>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RentTransferRiskDecision.Allow());
        var gateway = new Mock<IStripeRentGateway>();
        SetupHealthySource(gateway);
        gateway.Setup(x => x.CreateTransferAsync(It.IsAny<StripeRentTransferRequest>(), It.IsAny<CancellationToken>()))
            .Returns(async () =>
            {
                await using var concurrent = StripeRentPaymentFlowTests.CreateContext(database);
                var terminal = await concurrent.StripeRentPayments.SingleAsync();
                terminal.StripeTransferId = "tr_terminal";
                terminal.Status = StripeRentPaymentStatus.Reversed;
                terminal.ReversedAmountCents = terminal.AmountCents;
                await concurrent.SaveChangesAsync();
                throw new IOException("late timeout from concurrent replay");
            });
        await using var context = StripeRentPaymentFlowTests.CreateContext(database);
        var service = CreateService(context, gateway.Object, risk.Object, transfersEnabled: true);

        await service.ProcessEligibleTransfersAsync();

        context.ChangeTracker.Clear();
        var stored = await context.StripeRentPayments.SingleAsync();
        stored.Status.Should().Be(StripeRentPaymentStatus.Reversed);
        stored.StripeTransferId.Should().Be("tr_terminal");
    }

    [Fact]
    public async Task ProcessEligibleAsync_ReconciliationSuccessAfterConcurrentReversal_DoesNotRegressReversedState()
    {
        var database = Guid.NewGuid().ToString();
        await using (var setup = StripeRentPaymentFlowTests.CreateContext(database))
        {
            var payment = HeldPayment(DateTimeOffset.UtcNow.AddDays(-1));
            payment.Status = StripeRentPaymentStatus.TransferReconciliationPending;
            payment.TransferAttemptCount = 1;
            payment.TransferIdempotencyKey = "rent-transfer:pi_transfer:attempt:1";
            setup.Add(payment);
            await setup.SaveChangesAsync();
        }
        var risk = new Mock<IStripeRentRiskService>();
        risk.Setup(x => x.EvaluateAsync(It.IsAny<StripeRentPayment>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RentTransferRiskDecision.Allow());
        var gateway = new Mock<IStripeRentGateway>();
        SetupHealthySource(gateway);
        gateway.Setup(x => x.CreateTransferAsync(It.IsAny<StripeRentTransferRequest>(), It.IsAny<CancellationToken>()))
            .Returns(async () =>
            {
                await using var concurrent = StripeRentPaymentFlowTests.CreateContext(database);
                var terminal = await concurrent.StripeRentPayments.SingleAsync();
                terminal.StripeTransferId = "tr_terminal";
                terminal.Status = StripeRentPaymentStatus.Reversed;
                terminal.ReversedAmountCents = terminal.AmountCents;
                await concurrent.SaveChangesAsync();
                return "tr_terminal";
            });
        await using var context = StripeRentPaymentFlowTests.CreateContext(database);
        var service = CreateService(context, gateway.Object, risk.Object, transfersEnabled: true);

        await service.ProcessEligibleTransfersAsync();

        context.ChangeTracker.Clear();
        var stored = await context.StripeRentPayments.SingleAsync();
        stored.Status.Should().Be(StripeRentPaymentStatus.Reversed);
        stored.StripeTransferId.Should().Be("tr_terminal");
    }

    [Fact]
    public async Task ProcessEligibleAsync_WhenTransfersDisabled_DoesNotReplayAmbiguousTransfer()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var payment = HeldPayment(DateTimeOffset.UtcNow.AddDays(-1));
        payment.Status = StripeRentPaymentStatus.TransferReconciliationPending;
        payment.NextTransferAttemptAt = null;
        context.Add(payment);
        await context.SaveChangesAsync();
        var gateway = new Mock<IStripeRentGateway>();
        var risk = new Mock<IStripeRentRiskService>();
        var service = CreateService(context, gateway.Object, risk.Object, transfersEnabled: false);

        await service.ProcessEligibleTransfersAsync();

        gateway.Verify(x => x.CreateTransferAsync(It.IsAny<StripeRentTransferRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        risk.Verify(x => x.EvaluateAsync(It.IsAny<StripeRentPayment>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ProcessEligibleAsync_WhenFreshRiskDeniesReconciliation_DoesNotReplayAmbiguousTransfer()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var payment = HeldPayment(DateTimeOffset.UtcNow.AddDays(-1));
        payment.Status = StripeRentPaymentStatus.TransferReconciliationPending;
        payment.NextTransferAttemptAt = null;
        context.Add(payment);
        await context.SaveChangesAsync();
        var gateway = new Mock<IStripeRentGateway>();
        var risk = new Mock<IStripeRentRiskService>();
        risk.Setup(x => x.EvaluateAsync(It.IsAny<StripeRentPayment>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RentTransferRiskDecision.Deny("payee suspended"));
        var service = CreateService(context, gateway.Object, risk.Object, transfersEnabled: true);

        await service.ProcessEligibleTransfersAsync();

        gateway.Verify(x => x.CreateTransferAsync(It.IsAny<StripeRentTransferRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        var stored = await context.StripeRentPayments.SingleAsync();
        stored.Status.Should().Be(StripeRentPaymentStatus.TransferReconciliationPending);
        stored.RiskReason.Should().Contain("operator review").And.Contain("payee suspended");
    }

    [Fact]
    public async Task ProcessEligibleAsync_RevalidatesAuthorityImmediatelyBeforeReconciliationReplay()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var payment = HeldPayment(DateTimeOffset.UtcNow.AddDays(-1));
        payment.Status = StripeRentPaymentStatus.TransferReconciliationPending;
        payment.NextTransferAttemptAt = null;
        context.Add(payment);
        await context.SaveChangesAsync();
        var gateway = new Mock<IStripeRentGateway>();
        SetupHealthySource(gateway);
        var risk = new Mock<IStripeRentRiskService>();
        risk.SetupSequence(x => x.EvaluateAsync(It.IsAny<StripeRentPayment>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RentTransferRiskDecision.Allow())
            .ReturnsAsync(RentTransferRiskDecision.Deny("Current organization payout authority was revoked."));
        var service = CreateService(context, gateway.Object, risk.Object, transfersEnabled: true);

        await service.ProcessEligibleTransfersAsync();

        risk.Verify(x => x.EvaluateAsync(It.IsAny<StripeRentPayment>(), It.IsAny<CancellationToken>()), Times.Exactly(2));
        gateway.Verify(x => x.CreateTransferAsync(It.IsAny<StripeRentTransferRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        var stored = await context.StripeRentPayments.SingleAsync();
        stored.Status.Should().Be(StripeRentPaymentStatus.TransferReconciliationPending);
        stored.RiskReason.Should().Contain("operator review").And.Contain("authority was revoked");
    }

    [Fact]
    public async Task RiskService_WhenAuthoritativeCompletedAllocationIsMissing_DeniesTransfer()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var payment = HeldPayment(DateTimeOffset.UtcNow.AddDays(-1));
        context.StripeRentPayments.Add(payment);
        await context.SaveChangesAsync();
        var risk = new StripeRentRiskService(context);

        var decision = await risk.EvaluateAsync(payment);

        decision.Approved.Should().BeFalse();
        decision.Reason.Should().Contain("completed allocation");
    }

    [Fact]
    public async Task RiskService_WhenCompletedAllocationsMatchAndNoNegativeState_AllowsTransfer()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var payment = HeldPayment(DateTimeOffset.UtcNow.AddDays(-1));
        context.StripeRentPayments.Add(payment);
        await SeedDestinationAsync(context);
        context.Payments.Add(new Payment
        {
            LeaseId = payment.LeaseId,
            PropertyId = 1,
            OrganizationId = payment.OrganizationId,
            Amount = 100m,
            PaymentDate = DateTime.UtcNow,
            Reference = payment.PaymentIntentId,
            StripePaymentIntentId = payment.PaymentIntentId,
            Status = "Completed"
        });
        await context.SaveChangesAsync();
        var risk = new StripeRentRiskService(context);

        var decision = await risk.EvaluateAsync(payment);

        decision.Approved.Should().BeTrue();
    }

    [Fact]
    public async Task RiskService_WhenDestinationSnapshotIsStale_DeniesTransfer()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var payment = HeldPayment(DateTimeOffset.UtcNow.AddDays(-1));
        context.StripeRentPayments.Add(payment);
        await SeedDestinationAsync(context, "acct_new_owner");
        context.Payments.Add(new Payment { LeaseId = 1, PropertyId = 1, OrganizationId = 2, Amount = 100m,
            PaymentDate = DateTime.UtcNow, Reference = payment.PaymentIntentId, Status = "Completed" });
        await context.SaveChangesAsync();

        var decision = await new StripeRentRiskService(context).EvaluateAsync(payment);

        decision.Approved.Should().BeFalse();
        decision.Reason.Should().Contain("no longer owned");
    }

    [Fact]
    public async Task ProcessEligibleAsync_UsesBackoffAndNeverDropsAnAmbiguousTransferOutcome()
    {
        var now = new DateTimeOffset(2026, 7, 29, 12, 0, 0, TimeSpan.Zero);
        var time = new ManualTimeProvider(now);
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var payment = HeldPayment(now.AddDays(-1));
        payment.TransferAttemptCount = 1;
        context.Add(payment); await context.SaveChangesAsync();
        var risk = new Mock<IStripeRentRiskService>();
        risk.Setup(x => x.EvaluateAsync(It.IsAny<StripeRentPayment>(), It.IsAny<CancellationToken>())).ReturnsAsync(RentTransferRiskDecision.Allow());
        var gateway = new Mock<IStripeRentGateway>();
        SetupHealthySource(gateway);
        gateway.Setup(x => x.CreateTransferAsync(It.IsAny<StripeRentTransferRequest>(), It.IsAny<CancellationToken>())).ThrowsAsync(new Exception("network"));
        var config = new Dictionary<string, string?> { ["Stripe:TransferMaxAttempts"] = "3", ["Stripe:TransferRetryBaseMinutes"] = "5" };
        var service = StripeRentPaymentFlowTests.CreateService(context, gateway.Object, true, risk.Object, true, time, config);

        await service.ProcessEligibleTransfersAsync();
        var stored = await context.StripeRentPayments.SingleAsync();
        stored.TransferAttemptCount.Should().Be(2);
        stored.TransferReplayFailureCount.Should().Be(1);
        stored.NextTransferAttemptAt.Should().Be(now.AddMinutes(5));
        await service.ProcessEligibleTransfersAsync();
        gateway.Verify(x => x.CreateTransferAsync(It.IsAny<StripeRentTransferRequest>(), It.IsAny<CancellationToken>()), Times.Once,
            "a retry before NextTransferAttemptAt must be suppressed");

        time.Advance(TimeSpan.FromMinutes(5));
        await service.ProcessEligibleTransfersAsync();
        stored.Status.Should().Be(StripeRentPaymentStatus.TransferReconciliationPending);
        stored.TransferAttemptCount.Should().Be(2,
            "ambiguous replays must retain the creation-attempt generation and its idempotency key");
        stored.TransferReplayFailureCount.Should().Be(2);
        stored.NextTransferAttemptAt.Should().Be(now.AddMinutes(15));
        stored.TransferReconciliationPaused.Should().BeFalse();

        time.Advance(TimeSpan.FromMinutes(10));
        await service.ProcessEligibleTransfersAsync();
        stored.TransferReplayFailureCount.Should().Be(3);
        stored.NextTransferAttemptAt.Should().BeNull();
        stored.TransferReconciliationPaused.Should().BeTrue();
        stored.RiskReason.Should().Contain("automatic reconciliation stopped");
        await service.ProcessEligibleTransfersAsync();
        gateway.Verify(x => x.CreateTransferAsync(
            It.Is<StripeRentTransferRequest>(r => r.IdempotencyKey == "rent-transfer:pi_transfer:attempt:2"),
            It.IsAny<CancellationToken>()), Times.Exactly(3));
    }

    [Fact]
    public async Task ProcessEligibleAsync_RevalidatesAuthorityImmediatelyBeforeTransferSideEffect()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.Add(HeldPayment(DateTimeOffset.UtcNow.AddDays(-1)));
        await context.SaveChangesAsync();

        var risk = new Mock<IStripeRentRiskService>();
        risk.SetupSequence(x => x.EvaluateAsync(It.IsAny<StripeRentPayment>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RentTransferRiskDecision.Allow())
            .ReturnsAsync(RentTransferRiskDecision.Deny("Current organization payout authority was revoked."));
        var gateway = new Mock<IStripeRentGateway>();
        SetupHealthySource(gateway);
        var service = CreateService(context, gateway.Object, risk.Object, transfersEnabled: true);

        var transferred = await service.ProcessEligibleTransfersAsync();

        transferred.Should().Be(0);
        var stored = await context.StripeRentPayments.SingleAsync();
        stored.Status.Should().Be(StripeRentPaymentStatus.Blocked);
        stored.RiskReason.Should().Contain("authority was revoked");
        risk.Verify(x => x.EvaluateAsync(It.IsAny<StripeRentPayment>(), It.IsAny<CancellationToken>()), Times.Exactly(2));
        gateway.Verify(x => x.CreateTransferAsync(It.IsAny<StripeRentTransferRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ProcessEligibleAsync_ConcurrentWorkersCreateOnlyOneIdempotentTransfer()
    {
        var database = Guid.NewGuid().ToString();
        await using (var setup = StripeRentPaymentFlowTests.CreateContext(database))
        { setup.Add(HeldPayment(DateTimeOffset.UtcNow.AddDays(-1))); await setup.SaveChangesAsync(); }
        var risk = new Mock<IStripeRentRiskService>();
        risk.Setup(x => x.EvaluateAsync(It.IsAny<StripeRentPayment>(), It.IsAny<CancellationToken>())).ReturnsAsync(RentTransferRiskDecision.Allow());
        var gateway = new Mock<IStripeRentGateway>();
        SetupHealthySource(gateway);
        gateway.Setup(x => x.CreateTransferAsync(It.IsAny<StripeRentTransferRequest>(), It.IsAny<CancellationToken>())).ReturnsAsync("tr_once");
        await using var c1 = StripeRentPaymentFlowTests.CreateContext(database);
        await using var c2 = StripeRentPaymentFlowTests.CreateContext(database);

        var counts = await Task.WhenAll(
            StripeRentPaymentFlowTests.CreateService(c1, gateway.Object, true, risk.Object, true).ProcessEligibleTransfersAsync(),
            StripeRentPaymentFlowTests.CreateService(c2, gateway.Object, true, risk.Object, true).ProcessEligibleTransfersAsync());

        counts.Sum().Should().Be(1);
        gateway.Verify(x => x.CreateTransferAsync(It.Is<StripeRentTransferRequest>(r => r.IdempotencyKey == "rent-transfer:pi_transfer:attempt:1"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    private static void SetupHealthySource(Mock<IStripeRentGateway> gateway) =>
        gateway.Setup(x => x.GetSourceStateAsync("ch_123", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripeRentSourceState(true, true, false, false, null, "pi_transfer", 100_00, "usd"));

    private static async Task SeedDestinationAsync(brownstone_hub_api.Data.DataContext context, string account = "acct_landlord")
    {
        context.Users.Add(new User { Id = 10, SettingId = 10, StripeAccountId = account, StripeAccountEnabled = true });
        context.Properties.Add(new Property { Id = 20, LandlordId = 10, OrganizationId = 2 });
        context.Units.Add(new Unit { Id = 30, PropertyId = 20, OrganizationId = 2 });
        context.Leases.Add(new Lease { Id = 1, UnitId = 30, OrganizationId = 2, IsActive = true,
            StartDate = DateTime.Today.AddMonths(-1), EndDate = DateTime.Today.AddYears(1), RentAmount = 100m });
        await context.SaveChangesAsync();
    }

    private sealed class ManualTimeProvider(DateTimeOffset now) : TimeProvider
    {
        private DateTimeOffset _now = now;
        public override DateTimeOffset GetUtcNow() => _now;
        public void Advance(TimeSpan value) => _now = _now.Add(value);
    }

    private static StripeRentPaymentService CreateService(
        brownstone_hub_api.Data.DataContext context,
        IStripeRentGateway gateway,
        IStripeRentRiskService risk,
        bool? transfersEnabled,
        IReadOnlyDictionary<string, string?>? config = null)
    {
        var values = new Dictionary<string, string?> { ["Stripe:RentPaymentsEnabled"] = "true" };
        if (transfersEnabled.HasValue)
            values["Stripe:TransfersEnabled"] = transfersEnabled.Value.ToString();
        if (config != null)
            foreach (var pair in config) values[pair.Key] = pair.Value;
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(values).Build();
        return new StripeRentPaymentService(
            context,
            gateway,
            risk,
            configuration,
            TimeProvider.System,
            Mock.Of<ILogger<StripeRentPaymentService>>());
    }

    private static StripeRentPayment HeldPayment(DateTimeOffset eligibleAt)
    {
        var payment = StripeRentPaymentFlowTests.NewPayment("pi_transfer");
        payment.Status = StripeRentPaymentStatus.Held;
        payment.StripeChargeId = "ch_123";
        payment.PaymentMethodType = "card";
        payment.HeldAt = eligibleAt.AddDays(-3);
        payment.TransferEligibleAt = eligibleAt;
        return payment;
    }
}
