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

public interface IStripeRentLossAccountingService
{
    Task ApplyAsync(StripeRentLossAccountingCommand command, CancellationToken cancellationToken = default);
}

/// <summary>
/// Reopens rent and reverses its ledger recognition by the exact cumulative Stripe loss.
/// One negative payment and one negative ledger row are updated idempotently under a
/// cross-instance database lock, covering partial refunds and refund/dispute sequences.
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

            var cumulativeLossCents = Math.Min(aggregate.AmountCents,
                checked(aggregate.RefundedAmountCents + aggregate.DisputedAmountCents));
            if (cumulativeLossCents <= 0)
                throw new InvalidOperationException("Stripe did not report a positive refunded or disputed amount.");

            var original = await context.Payments.SingleOrDefaultAsync(x =>
                x.LeaseId == aggregate.LeaseId
                && (x.StripePaymentIntentId == aggregate.PaymentIntentId || x.Reference == aggregate.PaymentIntentId)
                && x.Amount > 0 && x.FeeId == null && x.DepositId == null, cancellationToken);

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

            original.Status = command.Kind == StripeRentPaymentBlockKind.Dispute
                ? "Disputed"
                : cumulativeLossCents >= aggregate.AmountCents ? "Refunded" : "PartiallyRefunded";
            original.UpdatedAt = command.OccurredAt.UtcDateTime;

            var reversal = await context.GeneralLedgerEntries.SingleOrDefaultAsync(x =>
                x.OrganizationId == aggregate.OrganizationId && x.TransactionId == original.Id
                && x.TransactionType == "PaymentLossReversal" && x.Reference == lossReference, cancellationToken);
            if (reversal == null)
            {
                reversal = new GeneralLedgerEntry
                {
                    OrganizationId = aggregate.OrganizationId,
                    AccountId = originalLedger.AccountId,
                    TransactionId = original.Id,
                    TransactionType = "PaymentLossReversal",
                    Amount = -(cumulativeLossCents / 100m),
                    TransactionDate = command.OccurredAt.UtcDateTime,
                    Description = "Cumulative refund/dispute reversal for Stripe rent payment",
                    Reference = lossReference,
                    CreatedAt = command.OccurredAt.UtcDateTime
                };
                context.GeneralLedgerEntries.Add(reversal);
            }
            else
            {
                reversal.Amount = -(cumulativeLossCents / 100m);
                reversal.TransactionDate = command.OccurredAt.UtcDateTime;
                reversal.UpdatedAt = command.OccurredAt.UtcDateTime;
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
