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
/// Atomically converts a verified platform charge into a rent or selected-fee receipt.
/// Selected rent remains oldest-first; stale selections fail closed without a receipt.
/// </summary>
public sealed class StripeRentAllocationService(
    DataContext context,
    IPaymentService paymentService,
    ILogger<StripeRentAllocationService> logger) : IStripeRentAllocationService
{
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> Gates = new();
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> FeeGates = new();
    private static readonly ConcurrentDictionary<long, SemaphoreSlim> RentLeaseGates = new();

    public async Task AllocateAsync(StripeRentAllocationCommand command, CancellationToken cancellationToken = default)
    {
        var authority = command.Authority;
        var gate = Gates.GetOrAdd(authority.PaymentIntentId, static _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken);
        SemaphoreSlim? feeGate = null;
        SemaphoreSlim? rentGate = null;
        var feeGateAcquired = false;
        var rentGateAcquired = false;
        try
        {
            // Different intents for one fee must serialize their balance read and payment write.
            // The SQL serializable transaction below provides the corresponding cross-instance boundary.
            var feeTarget = await context.StripeRentPayments.AsNoTracking()
                .Where(x => x.PaymentIntentId == authority.PaymentIntentId)
                .Select(x => new { x.LeaseId, x.OrganizationId, x.ChargeId })
                .SingleOrDefaultAsync(cancellationToken);
            if (feeTarget?.ChargeId?.StartsWith("fee:", StringComparison.Ordinal) == true)
            {
                feeGate = FeeGates.GetOrAdd($"{feeTarget.OrganizationId}:{feeTarget.LeaseId}:{feeTarget.ChargeId}",
                    static _ => new SemaphoreSlim(1, 1));
                await feeGate.WaitAsync(cancellationToken);
                feeGateAcquired = true;
            }
            if (feeTarget?.ChargeId == null || SelectedRentCharge.IsRent(feeTarget.ChargeId))
            {
                rentGate = RentLeaseGates.GetOrAdd(authority.LeaseId, static _ => new SemaphoreSlim(1, 1));
                await rentGate.WaitAsync(cancellationToken);
                rentGateAcquired = true;
            }
            await using var transaction = await BeginAllocationTransactionAsync(authority.PaymentIntentId,
                feeTarget?.ChargeId?.StartsWith("fee:", StringComparison.Ordinal) == true
                    ? $"stripe-fee-allocation:{feeTarget.OrganizationId}:{feeTarget.LeaseId}:{feeTarget.ChargeId}" : null,
                rentGateAcquired ? authority.LeaseId : null,
                cancellationToken);
            var aggregate = await context.StripeRentPayments.SingleOrDefaultAsync(
                x => x.PaymentIntentId == authority.PaymentIntentId, cancellationToken)
                ?? throw new InvalidOperationException("The Stripe rent payment is not registered.");
            await context.Entry(aggregate).ReloadAsync(cancellationToken);
            if (feeTarget != null && (feeTarget.ChargeId != aggregate.ChargeId
                || feeTarget.LeaseId != aggregate.LeaseId || feeTarget.OrganizationId != aggregate.OrganizationId))
                throw new InvalidOperationException("Stripe charge authorization changed during allocation.");
            ValidateAggregate(aggregate, authority);
            var feeId = SelectedRentCharge.IsRent(aggregate.ChargeId) ? null : ParseFeeId(aggregate.ChargeId);

            var existing = await context.Payments.Where(x =>
                    (x.StripePaymentIntentId == aggregate.PaymentIntentId || x.Reference == aggregate.PaymentIntentId)
                    && x.Status == "Completed")
                .ToListAsync(cancellationToken);
            var existingDeposits = await context.Deposits.AnyAsync(x => x.LeaseId == aggregate.LeaseId
                && x.Notes != null && x.Notes.Contains(aggregate.PaymentIntentId), cancellationToken);

            if (aggregate.AllocationCompletedAt != null)
            {
                await EnsureExactAllocationAsync(existing, existingDeposits, aggregate, feeId, cancellationToken);
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

            if (SelectedRentCharge.IsRent(aggregate.ChargeId))
            {
                var selected = await SelectedRentCharge.OldestUnpaidAsync(context, aggregate.ChargeId!,
                    aggregate.LeaseId, aggregate.OrganizationId, cancellationToken);
                if (aggregate.AmountCents > checked((long)(selected.Remaining * 100m)))
                    throw new InvalidOperationException("Selected rent exceeds the oldest unpaid installment at capture; manual reconciliation required.");
            }
            if (feeId.HasValue)
            {
                var activeLease = await context.Leases.AsNoTracking().AnyAsync(l => l.Id == aggregate.LeaseId
                    && l.OrganizationId == aggregate.OrganizationId && l.IsActive && !l.IsDeleted,
                    cancellationToken);
                if (!activeLease)
                    throw new InvalidOperationException("The selected fee's lease is no longer active in this organization.");
                var fee = await context.LeaseFees.AsNoTracking().SingleOrDefaultAsync(f =>
                    f.Id == feeId.Value && f.LeaseId == aggregate.LeaseId
                    && f.OrganizationId == aggregate.OrganizationId && f.Amount > 0, cancellationToken)
                    ?? throw new InvalidOperationException("The selected fee is no longer valid for this lease and organization.");
                var feePayments = await context.Payments.AsNoTracking().Where(p => p.FeeId == feeId.Value
                        && p.LeaseId == aggregate.LeaseId && p.OrganizationId == aggregate.OrganizationId)
                    .ToListAsync(cancellationToken);
                var credited = brownstone_hub_api.Services.Payments.FeeCollection.Credited(feePayments);
                if (aggregate.AmountCents <= 0 || aggregate.AmountCents / 100m > fee.Amount - credited)
                    throw new InvalidOperationException("Selected fee payment exceeds the outstanding balance.");
            }

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
                FeeId = feeId,
                DepositId = null
            });
            if (!result.Success)
                throw new InvalidOperationException($"Stripe allocation failed: {result.Message}");

            var allocatedPayment = await context.Payments.SingleOrDefaultAsync(x => x.LeaseId == aggregate.LeaseId
                && x.OrganizationId == aggregate.OrganizationId
                && x.StripePaymentIntentId == aggregate.PaymentIntentId && x.Status == "Completed"
                && x.FeeId == feeId && x.DepositId == null && x.Amount == aggregate.AmountCents / 100m, cancellationToken)
                ?? throw new InvalidOperationException("The completed Stripe payment row was not persisted.");
            if (!await HasExactLedgerAsync(allocatedPayment.Id, aggregate, feeId, cancellationToken))
                throw new InvalidOperationException("The required Stripe payment ledger entry was not persisted.");

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
            if (rentGateAcquired) rentGate!.Release();
            if (feeGateAcquired) feeGate!.Release();
            gate.Release();
            if (gate.CurrentCount == 1) Gates.TryRemove(new KeyValuePair<string, SemaphoreSlim>(authority.PaymentIntentId, gate));
        }
    }

    private async Task<IDbContextTransaction?> BeginAllocationTransactionAsync(string paymentIntentId,
        string? feeLockResource, long? rentLeaseId, CancellationToken cancellationToken)
    {
        if (!context.Database.IsRelational()) return null;
        var transaction = await context.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        try
        {
            if (context.Database.IsSqlServer())
            {
                var resource = $"stripe-rent-allocation:{paymentIntentId}";
                if (rentLeaseId.HasValue)
                    await AcquireSqlLockAsync($"stripe-rent-reservation:lease:{rentLeaseId.Value}", cancellationToken);
                if (feeLockResource != null)
                    await AcquireSqlLockAsync(feeLockResource, cancellationToken);
                await AcquireSqlLockAsync(resource, cancellationToken);
            }
            return transaction;
        }
        catch
        {
            await transaction.DisposeAsync();
            throw;
        }
    }

    private async Task AcquireSqlLockAsync(string resource, CancellationToken cancellationToken)
    {
        await context.Database.ExecuteSqlInterpolatedAsync($@"
DECLARE @lockResult int;
EXEC @lockResult = sys.sp_getapplock
    @Resource = {resource},
    @LockMode = 'Exclusive',
    @LockOwner = 'Transaction',
    @LockTimeout = 15000;
IF @lockResult < 0
    THROW 51000, 'Could not acquire the payment allocation lock.', 1;", cancellationToken);
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

    private static long? ParseFeeId(string? chargeId)
    {
        if (chargeId == null) return null; // Legacy rent payment.
        if (!chargeId.StartsWith("fee:", StringComparison.Ordinal)
            || !long.TryParse(chargeId.AsSpan(4), System.Globalization.NumberStyles.None,
                System.Globalization.CultureInfo.InvariantCulture, out var feeId)
            || feeId <= 0 || chargeId != $"fee:{feeId}")
            throw new InvalidOperationException("Unsupported Stripe charge identity.");
        return feeId;
    }

    private async Task<bool> HasExactLedgerAsync(long paymentId, Models.StripeRentPayment aggregate,
        long? feeId, CancellationToken cancellationToken)
    {
        var entries = await context.GeneralLedgerEntries.AsNoTracking()
            .Where(x => x.TransactionId == paymentId && x.TransactionType == "Payment")
            .ToListAsync(cancellationToken);
        if (entries.Count != 1 || entries[0].OrganizationId != aggregate.OrganizationId
            || entries[0].Amount != aggregate.AmountCents / 100m) return false;
        if (!feeId.HasValue) return true; // Preserve the legacy rent ledger contract.
        return await context.Accounts.AsNoTracking().AnyAsync(a => a.Id == entries[0].AccountId
            && a.OrganizationId == aggregate.OrganizationId && a.IsActive
            && a.AccountCode == "4400" && a.AccountType == brownstone_hub_api.Enums.EAccountType.Income,
            cancellationToken);
    }

    private async Task EnsureExactAllocationAsync(
        IReadOnlyCollection<Models.Payment> existing,
        bool existingDeposits,
        Models.StripeRentPayment aggregate,
        long? feeId,
        CancellationToken cancellationToken)
    {
        if (existingDeposits || existing.Count != 1 || existing.Single().LeaseId != aggregate.LeaseId
            || existing.Single().OrganizationId != aggregate.OrganizationId
            || existing.Single().FeeId != feeId || existing.Single().DepositId != null
            || existing.Single().Amount != aggregate.AmountCents / 100m
            || !await HasExactLedgerAsync(existing.Single().Id, aggregate, feeId, cancellationToken))
            throw new InvalidOperationException("The completed Stripe allocation does not exactly match the durable aggregate.");
    }
}
