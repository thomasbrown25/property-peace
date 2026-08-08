using System.Collections.Concurrent;
using System.Data;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace brownstone_hub_api.Services.StripeRentPayments;

public sealed record StripeRentLossAccountingCommand(
    string PaymentIntentId,
    StripeRentPaymentBlockKind Kind,
    DateTimeOffset OccurredAt);

public sealed record StripeRentDisputeCreatedCommand(
    string PaymentIntentId,
    string ChargeId,
    string DisputeId,
    long AmountCents,
    DateTimeOffset OccurredAt,
    string RiskReason);

public sealed record StripeRentDisputeCreatedResult(bool Applied, bool IsNewDispute,
    string? DestinationStripeAccountId);

public interface IStripeRentLossAccountingService
{
    Task ApplyAsync(StripeRentLossAccountingCommand command, CancellationToken cancellationToken = default);
    Task<StripeRentDisputeCreatedResult> ApplyDisputeCreatedAsync(StripeRentDisputeCreatedCommand command,
        CancellationToken cancellationToken = default);
    Task RecoverWonDisputeAsync(string paymentIntentId, string chargeId, string disputeId, long amountCents,
        string currency, DateTimeOffset occurredAt, CancellationToken cancellationToken = default);
}

/// <summary>
/// Reopens rent by the exact cumulative Stripe loss. The Payment adjustment is a current-state
/// projection, while immutable general-ledger delta rows preserve every accounting change under a
/// cross-instance database lock, including partial refunds and refund/dispute sequences.
/// </summary>
public sealed class StripeRentLossAccountingService(
    DataContext context,
    ILogger<StripeRentLossAccountingService> logger) : IStripeRentLossAccountingService
{
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> Gates = new();

    public async Task ApplyAsync(StripeRentLossAccountingCommand command, CancellationToken cancellationToken = default)
    {
        var gate = Gates.GetOrAdd(command.PaymentIntentId, static _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken);
        try
        {
            await using var transaction = await BeginTransactionAsync(command.PaymentIntentId, cancellationToken);
            var aggregate = await context.StripeRentPayments.SingleOrDefaultAsync(
                x => x.PaymentIntentId == command.PaymentIntentId, cancellationToken)
                ?? throw new InvalidOperationException("The Stripe rent payment is not registered.");
            // The context may have tracked refund/dispute state before waiting for the cross-instance
            // payment-intent lock. Reload only after acquiring it so cumulative accounting cannot regress.
            await context.Entry(aggregate).ReloadAsync(cancellationToken);

            var cumulativeLossCents = Math.Min(aggregate.AmountCents,
                checked(aggregate.RefundedAmountCents + aggregate.DisputedAmountCents));

            var original = await context.Payments.Where(x =>
                    x.LeaseId == aggregate.LeaseId
                    && (x.StripePaymentIntentId == aggregate.PaymentIntentId || x.Reference == aggregate.PaymentIntentId)
                    && x.Amount > 0 && x.FeeId == null && x.DepositId == null)
                .OrderByDescending(x => x.Reference == aggregate.PaymentIntentId)
                .ThenBy(x => x.Id)
                .FirstOrDefaultAsync(cancellationToken);

            // A block can arrive before authoritative settlement/allocation. In that case no local
            // obligation was reduced and there is nothing to reverse.
            if (original == null && aggregate.AllocationCompletedAt == null)
            {
                if (transaction != null) await transaction.CommitAsync(cancellationToken);
                return;
            }
            if (original == null)
                throw new InvalidOperationException("The allocated rent payment is missing during loss accounting.");

            var originalLedger = await context.GeneralLedgerEntries.SingleOrDefaultAsync(x =>
                x.OrganizationId == aggregate.OrganizationId && x.TransactionId == original.Id
                && x.TransactionType == "Payment", cancellationToken)
                ?? throw new InvalidOperationException("The original rent-payment ledger entry is missing.");

            var lossReference = $"{aggregate.PaymentIntentId}:loss";
            var adjustment = await context.Payments.SingleOrDefaultAsync(x =>
                x.LeaseId == aggregate.LeaseId && x.Reference == lossReference, cancellationToken);
            var previouslyAccountedLossCents = adjustment == null
                ? 0L
                : decimal.ToInt64(decimal.Round(-adjustment.Amount * 100m, 0, MidpointRounding.AwayFromZero));
            if (adjustment == null && cumulativeLossCents <= 0)
            {
                if (transaction != null) await transaction.CommitAsync(cancellationToken);
                return;
            }
            if (adjustment == null)
            {
                adjustment = new Payment
                {
                    LeaseId = original.LeaseId,
                    PropertyId = original.PropertyId,
                    OrganizationId = original.OrganizationId,
                    Amount = -(cumulativeLossCents / 100m),
                    PaymentDate = command.OccurredAt.UtcDateTime,
                    Reference = lossReference,
                    Method = "Stripe loss adjustment",
                    Status = "Completed",
                    StripePaymentIntentId = aggregate.PaymentIntentId,
                    StripeChargeId = aggregate.StripeChargeId,
                    CreatedByUserId = original.CreatedByUserId,
                    CreatedAt = command.OccurredAt.UtcDateTime,
                    UpdatedAt = command.OccurredAt.UtcDateTime
                };
                context.Payments.Add(adjustment);
            }
            else
            {
                adjustment.Amount = -(cumulativeLossCents / 100m);
                adjustment.PaymentDate = command.OccurredAt.UtcDateTime;
                adjustment.UpdatedAt = command.OccurredAt.UtcDateTime;
            }

            original.Status = aggregate.DisputedAmountCents > 0 ? "Disputed"
                : aggregate.RefundedAmountCents >= aggregate.AmountCents ? "Refunded"
                : aggregate.RefundedAmountCents > 0 ? "PartiallyRefunded" : "Completed";
            original.UpdatedAt = command.OccurredAt.UtcDateTime;

            // Payment is a current-state projection used by rent calculations. The general ledger is an
            // append-only series of deltas so prior financial facts are never rewritten.
            var ledgerDeltaCents = checked(cumulativeLossCents - previouslyAccountedLossCents);
            if (ledgerDeltaCents != 0)
            {
                context.GeneralLedgerEntries.Add(new GeneralLedgerEntry
                {
                    OrganizationId = aggregate.OrganizationId,
                    AccountId = originalLedger.AccountId,
                    TransactionId = original.Id,
                    TransactionType = "PaymentLossReversal",
                    Amount = -(ledgerDeltaCents / 100m),
                    TransactionDate = command.OccurredAt.UtcDateTime,
                    Description = "Stripe rent loss-accounting delta",
                    Reference = $"{lossReference}:{previouslyAccountedLossCents}:{cumulativeLossCents}:{command.OccurredAt.UtcTicks}",
                    CreatedAt = command.OccurredAt.UtcDateTime
                });
            }

            await context.SaveChangesAsync(cancellationToken);
            if (transaction != null) await transaction.CommitAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Stripe rent loss accounting failed for {PaymentIntentId}", command.PaymentIntentId);
            throw;
        }
        finally
        {
            gate.Release();
            if (gate.CurrentCount == 1)
                Gates.TryRemove(new KeyValuePair<string, SemaphoreSlim>(command.PaymentIntentId, gate));
        }
    }

    public async Task<StripeRentDisputeCreatedResult> ApplyDisputeCreatedAsync(
        StripeRentDisputeCreatedCommand command, CancellationToken cancellationToken = default)
    {
        var gate = Gates.GetOrAdd(command.PaymentIntentId, static _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken);
        try
        {
            await using var transaction = await BeginTransactionAsync(command.PaymentIntentId, cancellationToken);
            var aggregate = await context.StripeRentPayments.SingleOrDefaultAsync(
                x => x.PaymentIntentId == command.PaymentIntentId, cancellationToken)
                ?? throw new InvalidOperationException("The Stripe rent payment is not registered.");
            await context.Entry(aggregate).ReloadAsync(cancellationToken);
            if (string.IsNullOrWhiteSpace(aggregate.StripeChargeId)
                || !string.Equals(aggregate.StripeChargeId, command.ChargeId, StringComparison.Ordinal))
                throw new InvalidOperationException($"Dispute {command.DisputeId} charge provenance does not match the durable rent payment.");
            if (string.Equals(aggregate.StripeDisputeId, command.DisputeId, StringComparison.Ordinal)
                && aggregate.DisputeClosedAt.HasValue
                && string.Equals(aggregate.StripeDisputeStatus, "won", StringComparison.OrdinalIgnoreCase))
            {
                if (transaction != null) await transaction.CommitAsync(cancellationToken);
                return new StripeRentDisputeCreatedResult(false, false, aggregate.DestinationStripeAccountId);
            }

            var isNewDispute = !string.Equals(aggregate.StripeDisputeId, command.DisputeId, StringComparison.Ordinal);
            aggregate.DisputedAt ??= command.OccurredAt;
            aggregate.StripeDisputeId ??= command.DisputeId;
            if (command.AmountCents > 0)
                aggregate.DisputedAmountCents = Math.Max(aggregate.DisputedAmountCents, command.AmountCents);
            var targetReversalAmount = Math.Min(aggregate.AmountCents,
                checked(aggregate.RefundedAmountCents + aggregate.DisputedAmountCents));
            if (!string.IsNullOrWhiteSpace(aggregate.StripeTransferId)
                && targetReversalAmount > aggregate.ReversedAmountCents)
                aggregate.Status = StripeRentPaymentStatus.ReversalPending;
            else if (aggregate.Status is StripeRentPaymentStatus.TransferPending or StripeRentPaymentStatus.TransferReconciliationPending)
                aggregate.Status = StripeRentPaymentStatus.TransferReconciliationPending;
            else if (aggregate.Status is not StripeRentPaymentStatus.ReversalPending
                and not StripeRentPaymentStatus.Reversed and not StripeRentPaymentStatus.RecoveryFailed)
                aggregate.Status = StripeRentPaymentStatus.Blocked;
            aggregate.RiskReason = command.RiskReason;
            aggregate.TransferEligibleAt = null;
            aggregate.NextTransferAttemptAt = null;
            aggregate.UpdatedAt = command.OccurredAt;

            var original = await context.Payments.Where(x =>
                    x.LeaseId == aggregate.LeaseId
                    && (x.StripePaymentIntentId == aggregate.PaymentIntentId || x.Reference == aggregate.PaymentIntentId)
                    && x.Amount > 0 && x.FeeId == null && x.DepositId == null)
                .OrderByDescending(x => x.Reference == aggregate.PaymentIntentId).ThenBy(x => x.Id)
                .FirstOrDefaultAsync(cancellationToken);
            if (original == null && aggregate.AllocationCompletedAt != null)
                throw new InvalidOperationException("The allocated rent payment is missing during loss accounting.");
            if (original != null)
            {
                var originalLedger = await context.GeneralLedgerEntries.SingleOrDefaultAsync(x =>
                    x.OrganizationId == aggregate.OrganizationId && x.TransactionId == original.Id
                    && x.TransactionType == "Payment", cancellationToken)
                    ?? throw new InvalidOperationException("The original rent-payment ledger entry is missing.");
                var cumulativeLossCents = Math.Min(aggregate.AmountCents,
                    checked(aggregate.RefundedAmountCents + aggregate.DisputedAmountCents));
                var lossReference = $"{aggregate.PaymentIntentId}:loss";
                var adjustment = await context.Payments.SingleOrDefaultAsync(x =>
                    x.LeaseId == aggregate.LeaseId && x.Reference == lossReference, cancellationToken);
                var previouslyAccountedLossCents = adjustment == null ? 0L
                    : decimal.ToInt64(decimal.Round(-adjustment.Amount * 100m, 0, MidpointRounding.AwayFromZero));
                if (adjustment == null)
                {
                    adjustment = new Payment
                    {
                        LeaseId = original.LeaseId, PropertyId = original.PropertyId,
                        OrganizationId = original.OrganizationId, Amount = -(cumulativeLossCents / 100m),
                        PaymentDate = command.OccurredAt.UtcDateTime, Reference = lossReference,
                        Method = "Stripe loss adjustment", Status = "Completed",
                        StripePaymentIntentId = aggregate.PaymentIntentId, StripeChargeId = aggregate.StripeChargeId,
                        CreatedByUserId = original.CreatedByUserId, CreatedAt = command.OccurredAt.UtcDateTime,
                        UpdatedAt = command.OccurredAt.UtcDateTime
                    };
                    context.Payments.Add(adjustment);
                }
                else
                {
                    adjustment.Amount = -(cumulativeLossCents / 100m);
                    adjustment.PaymentDate = command.OccurredAt.UtcDateTime;
                    adjustment.UpdatedAt = command.OccurredAt.UtcDateTime;
                }
                original.Status = "Disputed";
                original.StripeDisputeId = command.DisputeId;
                original.StripeChargeId ??= command.ChargeId;
                original.DisputedAt ??= command.OccurredAt.UtcDateTime;
                original.StripeStatusChangedAt = command.OccurredAt.UtcDateTime;
                original.UpdatedAt = command.OccurredAt.UtcDateTime;
                var ledgerDeltaCents = checked(cumulativeLossCents - previouslyAccountedLossCents);
                if (ledgerDeltaCents != 0)
                {
                    context.GeneralLedgerEntries.Add(new GeneralLedgerEntry
                    {
                        OrganizationId = aggregate.OrganizationId, AccountId = originalLedger.AccountId,
                        TransactionId = original.Id, TransactionType = "PaymentLossReversal",
                        Amount = -(ledgerDeltaCents / 100m), TransactionDate = command.OccurredAt.UtcDateTime,
                        Description = "Stripe rent loss-accounting delta",
                        Reference = $"{lossReference}:{previouslyAccountedLossCents}:{cumulativeLossCents}:{command.OccurredAt.UtcTicks}",
                        CreatedAt = command.OccurredAt.UtcDateTime
                    });
                }
            }

            await context.SaveChangesAsync(cancellationToken);
            if (transaction != null) await transaction.CommitAsync(cancellationToken);
            return new StripeRentDisputeCreatedResult(true, isNewDispute, aggregate.DestinationStripeAccountId);
        }
        finally
        {
            gate.Release();
            if (gate.CurrentCount == 1)
                Gates.TryRemove(new KeyValuePair<string, SemaphoreSlim>(command.PaymentIntentId, gate));
        }
    }

    public async Task RecoverWonDisputeAsync(string paymentIntentId, string chargeId, string disputeId,
        long amountCents, string currency, DateTimeOffset occurredAt,
        CancellationToken cancellationToken = default)
    {
        var gate = Gates.GetOrAdd(paymentIntentId, static _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken);
        try
        {
            await using var transaction = await BeginTransactionAsync(paymentIntentId, cancellationToken);
            var aggregate = await context.StripeRentPayments.SingleOrDefaultAsync(
                x => x.PaymentIntentId == paymentIntentId, cancellationToken)
                ?? throw new InvalidOperationException("The Stripe rent payment is not registered.");
            await context.Entry(aggregate).ReloadAsync(cancellationToken);
            if (!string.Equals(aggregate.StripeChargeId, chargeId, StringComparison.Ordinal)
                || !string.Equals(aggregate.StripeDisputeId, disputeId, StringComparison.Ordinal)
                || !string.Equals(aggregate.Currency, currency, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Closed dispute provenance does not match the durable rent payment.");
            var durableDisputeAmount = checked(aggregate.DisputedAmountCents + aggregate.DisputeRecoveredAmountCents);
            if (amountCents <= 0 || amountCents != durableDisputeAmount)
                throw new InvalidOperationException("Closed dispute amount does not match durable dispute authority.");

            var disputedCents = aggregate.DisputedAmountCents;
            var reversalExposureBeforeRecovery = Math.Max(aggregate.ReversedAmountCents,
                aggregate.ReversalTargetAmountCents);
            if (disputedCents > 0)
            {
                var original = await context.Payments.SingleOrDefaultAsync(x =>
                    x.LeaseId == aggregate.LeaseId
                    && (x.StripePaymentIntentId == aggregate.PaymentIntentId || x.Reference == aggregate.PaymentIntentId)
                    && x.Amount > 0 && x.FeeId == null && x.DepositId == null, cancellationToken)
                    ?? throw new InvalidOperationException("The allocated rent payment is missing during dispute recovery.");
                var originalLedger = await context.GeneralLedgerEntries.SingleOrDefaultAsync(x =>
                    x.OrganizationId == aggregate.OrganizationId && x.TransactionId == original.Id
                    && x.TransactionType == "Payment", cancellationToken)
                    ?? throw new InvalidOperationException("The original rent-payment ledger entry is missing.");
                var lossReference = $"{aggregate.PaymentIntentId}:loss";
                var adjustment = await context.Payments.SingleOrDefaultAsync(x =>
                    x.LeaseId == aggregate.LeaseId && x.Reference == lossReference, cancellationToken)
                    ?? throw new InvalidOperationException("The dispute loss adjustment is missing during recovery.");
                var previouslyAccountedLossCents = decimal.ToInt64(decimal.Round(
                    -adjustment.Amount * 100m, 0, MidpointRounding.AwayFromZero));
                var remainingLossCents = Math.Min(aggregate.AmountCents, aggregate.RefundedAmountCents);
                var recoveredLossCents = Math.Max(0, previouslyAccountedLossCents - remainingLossCents);
                var recoveryReference = $"{aggregate.PaymentIntentId}:dispute-recovery";

                adjustment.Amount = -(remainingLossCents / 100m);
                adjustment.PaymentDate = occurredAt.UtcDateTime;
                adjustment.UpdatedAt = occurredAt.UtcDateTime;
                if (recoveredLossCents > 0 && !await context.GeneralLedgerEntries.AnyAsync(x =>
                    x.OrganizationId == aggregate.OrganizationId && x.TransactionId == original.Id
                    && x.TransactionType == "PaymentLossRecovery" && x.Reference == recoveryReference,
                    cancellationToken))
                {
                    context.GeneralLedgerEntries.Add(new GeneralLedgerEntry
                    {
                        OrganizationId = aggregate.OrganizationId, AccountId = originalLedger.AccountId,
                        TransactionId = original.Id, TransactionType = "PaymentLossRecovery",
                        Amount = recoveredLossCents / 100m, TransactionDate = occurredAt.UtcDateTime,
                        Description = "Won Stripe dispute recovery for rent payment",
                        Reference = recoveryReference, CreatedAt = occurredAt.UtcDateTime
                    });
                }
                aggregate.DisputeRecoveredAmountCents = Math.Min(aggregate.AmountCents,
                    checked(aggregate.DisputeRecoveredAmountCents + disputedCents));
                aggregate.DisputedAmountCents = 0;
                original.Status = aggregate.RefundedAmountCents <= 0 ? "Completed"
                    : aggregate.RefundedAmountCents >= aggregate.AmountCents ? "Refunded" : "PartiallyRefunded";
                original.UpdatedAt = occurredAt.UtcDateTime;
            }

            aggregate.StripeDisputeStatus = "won";
            aggregate.DisputeClosedAt ??= occurredAt;
            var requiresManualDestinationFunding = aggregate.DisputeRecoveredAmountCents > 0
                && reversalExposureBeforeRecovery > aggregate.RefundedAmountCents;
            aggregate.Status = requiresManualDestinationFunding
                ? StripeRentPaymentStatus.RecoveryFailed
                : StripeRentPaymentStatus.Blocked;
            aggregate.RiskReason = requiresManualDestinationFunding
                ? "Won dispute recovery followed a transfer reversal; manual destination funding and reconciliation are required."
                : aggregate.RiskReason;
            // Preserve an in-flight/ambiguous reversal replay handle until its worker records the
            // provider result. Erasing it here could hide a reversal that already reached Stripe.
            if (aggregate.ReversedAmountCents >= aggregate.ReversalTargetAmountCents)
            {
                aggregate.ReversalTargetAmountCents = 0;
                aggregate.ReversalIncrementAmountCents = 0;
            }
            aggregate.TransferEligibleAt = null;
            aggregate.NextTransferAttemptAt = null;
            aggregate.UpdatedAt = occurredAt;
            await context.SaveChangesAsync(cancellationToken);
            if (transaction != null) await transaction.CommitAsync(cancellationToken);
        }
        finally
        {
            gate.Release();
            if (gate.CurrentCount == 1)
                Gates.TryRemove(new KeyValuePair<string, SemaphoreSlim>(paymentIntentId, gate));
        }
    }

    private async Task<IDbContextTransaction?> BeginTransactionAsync(string paymentIntentId, CancellationToken cancellationToken)
    {
        if (!context.Database.IsRelational()) return null;
        var transaction = await context.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        try
        {
            if (context.Database.IsSqlServer())
            {
                var resource = $"stripe-rent-loss:{paymentIntentId}";
                await context.Database.ExecuteSqlInterpolatedAsync($@"
DECLARE @lockResult int;
EXEC @lockResult = sys.sp_getapplock
    @Resource = {resource},
    @LockMode = 'Exclusive',
    @LockOwner = 'Transaction',
    @LockTimeout = 15000;
IF @lockResult < 0
    THROW 51000, 'Could not acquire the Stripe rent loss-accounting lock.', 1;", cancellationToken);
            }
            return transaction;
        }
        catch
        {
            await transaction.DisposeAsync();
            throw;
        }
    }
}
