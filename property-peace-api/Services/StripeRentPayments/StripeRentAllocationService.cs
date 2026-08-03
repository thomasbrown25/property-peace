using System.Collections.Concurrent;
using System.Data;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Services.PaymentService;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace brownstone_hub_api.Services.StripeRentPayments;

public sealed record StripeRentAllocationCommand(
    StripeRentPaymentSettlementAuthority Authority,
    string? PaymentMethodId,
    string PaymentMethodType,
    DateTimeOffset PaidAt);

public interface IStripeRentAllocationService
{
    Task AllocateAsync(StripeRentAllocationCommand command, CancellationToken cancellationToken = default);
}

/// <summary>
/// Atomically converts one verified rent-only platform charge into accounting rows.
/// Fees and deposits are intentionally excluded from this payment flow; the entire charge
/// is recorded as rent so the reservation and allocation obligation models remain identical.
/// </summary>
public sealed class StripeRentAllocationService(
    DataContext context,
    IPaymentService paymentService,
    ILogger<StripeRentAllocationService> logger) : IStripeRentAllocationService
{
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> Gates = new();

    public async Task AllocateAsync(StripeRentAllocationCommand command, CancellationToken cancellationToken = default)
    {
        var authority = command.Authority;
        var gate = Gates.GetOrAdd(authority.PaymentIntentId, static _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken);
        try
        {
            await using var transaction = await BeginAllocationTransactionAsync(authority.PaymentIntentId, cancellationToken);
            var aggregate = await context.StripeRentPayments.SingleOrDefaultAsync(
                x => x.PaymentIntentId == authority.PaymentIntentId, cancellationToken)
                ?? throw new InvalidOperationException("The Stripe rent payment is not registered.");
            ValidateAggregate(aggregate, authority);

            var existing = await context.Payments.Where(x => x.LeaseId == aggregate.LeaseId
                    && (x.StripePaymentIntentId == aggregate.PaymentIntentId || x.Reference == aggregate.PaymentIntentId)
                    && x.Status == "Completed")
                .ToListAsync(cancellationToken);
            var existingDeposits = await context.Deposits.AnyAsync(x => x.LeaseId == aggregate.LeaseId
                && x.Notes != null && x.Notes.Contains(aggregate.PaymentIntentId), cancellationToken);

            if (aggregate.AllocationCompletedAt != null)
            {
                EnsureExactRentOnlyAllocation(existing, existingDeposits, aggregate);
                if (transaction != null) await transaction.CommitAsync(cancellationToken);
                return;
            }

            if (existing.Count != 0 || existingDeposits)
                throw new InvalidOperationException("A partial or unmarked Stripe allocation requires manual recovery.");

            var activeMembership = await context.TenantLeases.AnyAsync(x => x.LeaseId == aggregate.LeaseId
                && x.Tenant.UserId == aggregate.TenantUserId && x.Tenant.OrganizationId == aggregate.OrganizationId
                && !x.Tenant.IsDeleted, cancellationToken);
            if (!activeMembership)
                throw new UnauthorizedAccessException("The tenant-to-lease relationship was revoked before settlement.");

            var result = await paymentService.AddPayment(new AddPaymentDto
            {
                LeaseId = aggregate.LeaseId,
                Amount = aggregate.AmountCents / 100m,
                PaymentDate = command.PaidAt.UtcDateTime,
                Reference = aggregate.PaymentIntentId,
                Method = command.PaymentMethodType,
                Status = "Completed",
                StripePaymentIntentId = aggregate.PaymentIntentId,
                StripePaymentMethodId = command.PaymentMethodId,
                CreatedByUserId = aggregate.TenantUserId,
                FeeId = null,
                DepositId = null
            });
            if (!result.Success)
                throw new InvalidOperationException($"Rent allocation failed: {result.Message}");

            var allocatedPayment = await context.Payments.SingleOrDefaultAsync(x => x.LeaseId == aggregate.LeaseId
                && x.StripePaymentIntentId == aggregate.PaymentIntentId && x.Status == "Completed"
                && x.FeeId == null && x.DepositId == null, cancellationToken)
                ?? throw new InvalidOperationException("The completed rent payment row was not persisted.");
            var ledgerSynchronized = await context.GeneralLedgerEntries.AnyAsync(x =>
                x.OrganizationId == aggregate.OrganizationId
                && x.TransactionId == allocatedPayment.Id
                && x.TransactionType == "Payment"
                && x.Amount == aggregate.AmountCents / 100m, cancellationToken);
            if (!ledgerSynchronized)
                throw new InvalidOperationException("The required rent-payment ledger entry was not persisted.");

            aggregate.AllocationCompletedAt = DateTimeOffset.UtcNow;
            aggregate.UpdatedAt = aggregate.AllocationCompletedAt.Value;
            await context.SaveChangesAsync(cancellationToken);
            if (transaction != null) await transaction.CommitAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Atomic rent allocation failed for {PaymentIntentId}", command.Authority.PaymentIntentId);
            throw;
        }
        finally
        {
            gate.Release();
            if (gate.CurrentCount == 1) Gates.TryRemove(new KeyValuePair<string, SemaphoreSlim>(authority.PaymentIntentId, gate));
        }
    }

    private async Task<IDbContextTransaction?> BeginAllocationTransactionAsync(string paymentIntentId, CancellationToken cancellationToken)
    {
        if (!context.Database.IsRelational()) return null;
        var transaction = await context.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        try
        {
            if (context.Database.IsSqlServer())
            {
                var resource = $"stripe-rent-allocation:{paymentIntentId}";
                await context.Database.ExecuteSqlInterpolatedAsync($@"
DECLARE @lockResult int;
EXEC @lockResult = sys.sp_getapplock
    @Resource = {resource},
    @LockMode = 'Exclusive',
    @LockOwner = 'Transaction',
    @LockTimeout = 15000;
IF @lockResult < 0
    THROW 51000, 'Could not acquire the rent-payment allocation lock.', 1;", cancellationToken);
            }
            return transaction;
        }
        catch
        {
            await transaction.DisposeAsync();
            throw;
        }
    }

    private static void ValidateAggregate(Models.StripeRentPayment payment, StripeRentPaymentSettlementAuthority authority)
    {
        if (payment.AmountCents != authority.AmountCents
            || !string.Equals(payment.Currency, authority.Currency, StringComparison.OrdinalIgnoreCase)
            || payment.LeaseId != authority.LeaseId
            || payment.OrganizationId != authority.OrganizationId
            || payment.TenantUserId != authority.TenantUserId
            || payment.OperationId != authority.OperationId)
            throw new InvalidOperationException("Stripe settlement authority does not match the durable rent-payment aggregate.");
        if (payment.Status is Models.StripeRentPaymentStatus.Blocked or Models.StripeRentPaymentStatus.Failed
            or Models.StripeRentPaymentStatus.Canceled or Models.StripeRentPaymentStatus.TransferReconciliationPending
            or Models.StripeRentPaymentStatus.ReversalPending
            or Models.StripeRentPaymentStatus.Reversed or Models.StripeRentPaymentStatus.RecoveryFailed)
            throw new InvalidOperationException("A blocked or terminal rent payment cannot be allocated.");
    }

    private static void EnsureExactRentOnlyAllocation(
        IReadOnlyCollection<Models.Payment> existing,
        bool existingDeposits,
        Models.StripeRentPayment aggregate)
    {
        if (existingDeposits || existing.Count != 1 || existing.Single().FeeId != null || existing.Single().DepositId != null
            || existing.Sum(x => x.Amount) != aggregate.AmountCents / 100m)
            throw new InvalidOperationException("The completed Stripe allocation does not exactly match the durable aggregate.");
    }
}
