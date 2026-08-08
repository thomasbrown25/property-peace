using System.Collections.Concurrent;
using System.Data;
using System.Security.Cryptography;
using System.Text;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Utils;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace brownstone_hub_api.Services.StripeRentPayments
{
    public sealed class StripeRentPaymentService : IStripeRentPaymentService
    {
        private static readonly ConcurrentDictionary<string, SemaphoreSlim> PaymentLocks = new();
        private readonly DataContext _context;
        private readonly IStripeRentGateway _gateway;
        private readonly IStripeRentRiskService _risk;
        private readonly IConfiguration _configuration;
        private readonly TimeProvider _timeProvider;
        private readonly ILogger<StripeRentPaymentService> _logger;

        public StripeRentPaymentService(DataContext context, IStripeRentGateway gateway, IStripeRentRiskService risk,
            IConfiguration configuration, TimeProvider timeProvider, ILogger<StripeRentPaymentService> logger)
        {
            _context = context;
            _gateway = gateway;
            _risk = risk;
            _configuration = configuration;
            _timeProvider = timeProvider;
            _logger = logger;
        }

        public async Task<StripeRentPaymentClientResult> CreateAsync(CreateStripeRentPaymentCommand command, CancellationToken cancellationToken = default)
        {
            EnsurePaymentsEnabled();
            ValidateMoney(command.AmountCents, command.Currency);
            if (command.LeaseId <= 0 || command.OrganizationId <= 0 || command.TenantUserId <= 0)
                throw new ArgumentException("Lease, organization, and tenant are required.");
            if (string.IsNullOrWhiteSpace(command.OperationId) || command.OperationId.Length > 64)
                throw new ArgumentException("A payment operation ID is required.");
            if (string.IsNullOrWhiteSpace(command.DestinationStripeAccountId))
                throw new ArgumentException("A destination account is required.");

            var leaseGate = PaymentLocks.GetOrAdd($"lease:{command.LeaseId}", _ => new SemaphoreSlim(1, 1));
            var payeeGate = PaymentLocks.GetOrAdd($"payee:{command.DestinationStripeAccountId}", _ => new SemaphoreSlim(1, 1));
            await leaseGate.WaitAsync(cancellationToken);
            var payeeGateAcquired = false;
            IDbContextTransaction? transaction = null;
            try
            {
                await payeeGate.WaitAsync(cancellationToken);
                payeeGateAcquired = true;
                transaction = await BeginCollectionReservationTransactionAsync(command.LeaseId,
                    command.DestinationStripeAccountId, cancellationToken);
                var existing = await _context.StripeRentPayments.SingleOrDefaultAsync(x => x.OperationId == command.OperationId, cancellationToken);
                var request = BuildIntentRequest(command.OperationId, command.LeaseId, command.OrganizationId, command.TenantUserId,
                    command.AmountCents, command.Currency, command.Description);
                if (existing != null)
                {
                    EnsureReplayMatches(existing, command);
                    await EnsureCollectionPayeeEligibleAsync(existing.Id, existing.LeaseId, existing.OrganizationId,
                        existing.TenantUserId, existing.AmountCents, existing.Currency,
                        existing.DestinationStripeAccountId, cancellationToken);
                    var replay = await _gateway.CreatePaymentIntentAsync(request, cancellationToken);
                    if (replay.PaymentIntentId != existing.PaymentIntentId)
                        throw new InvalidOperationException("Stripe idempotency response does not match the registered payment intent.");
                    if (transaction != null) await transaction.CommitAsync(cancellationToken);
                    return new StripeRentPaymentClientResult(replay.PaymentIntentId, replay.ClientSecret);
                }

                await EnsureAmountAvailableAsync(command.LeaseId, command.OrganizationId, command.TenantUserId,
                    command.AmountCents, null, cancellationToken);
                await EnsureCollectionPayeeEligibleAsync(0, command.LeaseId, command.OrganizationId,
                    command.TenantUserId, command.AmountCents, command.Currency,
                    command.DestinationStripeAccountId, cancellationToken);
                var result = await _gateway.CreatePaymentIntentAsync(request, cancellationToken);
                var now = _timeProvider.GetUtcNow();
                _context.StripeRentPayments.Add(new StripeRentPayment
                {
                    OperationId = command.OperationId,
                    PaymentIntentId = result.PaymentIntentId,
                    LeaseId = command.LeaseId,
                    OrganizationId = command.OrganizationId,
                    TenantUserId = command.TenantUserId,
                    AmountCents = command.AmountCents,
                    Currency = command.Currency.ToLowerInvariant(),
                    DestinationStripeAccountId = command.DestinationStripeAccountId,
                    Status = StripeRentPaymentStatus.Created,
                    CreatedAt = now,
                    UpdatedAt = now
                });
                await _context.SaveChangesAsync(cancellationToken);
                if (transaction != null) await transaction.CommitAsync(cancellationToken);
                return new StripeRentPaymentClientResult(result.PaymentIntentId, result.ClientSecret);
            }
            finally
            {
                if (transaction != null) await transaction.DisposeAsync();
                if (payeeGateAcquired) payeeGate.Release();
                leaseGate.Release();
            }
        }

        public async Task<StripeRentPaymentClientResult> UpdateAsync(UpdateStripeRentPaymentCommand command, CancellationToken cancellationToken = default)
        {
            EnsurePaymentsEnabled();
            ValidateMoney(command.AmountCents, "usd");
            var registered = await _context.StripeRentPayments.AsNoTracking()
                .SingleOrDefaultAsync(x => x.PaymentIntentId == command.PaymentIntentId, cancellationToken)
                ?? throw new InvalidOperationException("Rent PaymentIntent is not registered.");
            if (registered.LeaseId != command.LeaseId || registered.TenantUserId != command.TenantUserId)
                throw new UnauthorizedAccessException("Rent PaymentIntent does not belong to this tenant and lease.");

            var leaseGate = PaymentLocks.GetOrAdd($"lease:{registered.LeaseId}", _ => new SemaphoreSlim(1, 1));
            var payeeGate = PaymentLocks.GetOrAdd($"payee:{registered.DestinationStripeAccountId}", _ => new SemaphoreSlim(1, 1));
            await leaseGate.WaitAsync(cancellationToken);
            var payeeGateAcquired = false;
            IDbContextTransaction? transaction = null;
            try
            {
                await payeeGate.WaitAsync(cancellationToken);
                payeeGateAcquired = true;
                transaction = await BeginCollectionReservationTransactionAsync(registered.LeaseId,
                    registered.DestinationStripeAccountId, cancellationToken);
                var payment = await _context.StripeRentPayments.SingleOrDefaultAsync(x => x.PaymentIntentId == command.PaymentIntentId, cancellationToken)
                    ?? throw new InvalidOperationException("Rent PaymentIntent is not registered.");
                if (payment.LeaseId != command.LeaseId || payment.TenantUserId != command.TenantUserId)
                    throw new UnauthorizedAccessException("Rent PaymentIntent does not belong to this tenant and lease.");
                if (payment.Status != StripeRentPaymentStatus.Created)
                    throw new InvalidOperationException("Only an uncompleted rent PaymentIntent can be updated.");

                await EnsureAmountAvailableAsync(payment.LeaseId, payment.OrganizationId, payment.TenantUserId,
                    command.AmountCents, payment.Id, cancellationToken);
                await EnsureCollectionPayeeEligibleAsync(payment.Id, payment.LeaseId, payment.OrganizationId,
                    payment.TenantUserId, command.AmountCents, payment.Currency,
                    payment.DestinationStripeAccountId, cancellationToken);
                var request = BuildIntentRequest(payment.OperationId, payment.LeaseId, payment.OrganizationId, payment.TenantUserId,
                    command.AmountCents, payment.Currency, command.Description);
                var result = await _gateway.UpdatePaymentIntentAsync(payment.PaymentIntentId, request, cancellationToken);
                if (result.PaymentIntentId != payment.PaymentIntentId)
                    throw new InvalidOperationException("Stripe update returned a different PaymentIntent.");
                payment.AmountCents = command.AmountCents;
                payment.UpdatedAt = _timeProvider.GetUtcNow();
                await _context.SaveChangesAsync(cancellationToken);
                if (transaction != null) await transaction.CommitAsync(cancellationToken);
                return new StripeRentPaymentClientResult(result.PaymentIntentId, result.ClientSecret);
            }
            finally
            {
                if (transaction != null) await transaction.DisposeAsync();
                if (payeeGateAcquired) payeeGate.Release();
                leaseGate.Release();
            }
        }

        public async Task ValidateSucceededAsync(StripeRentPaymentSettlementAuthority authority, CancellationToken cancellationToken = default)
        {
            var payment = await _context.StripeRentPayments.AsNoTracking()
                .SingleOrDefaultAsync(x => x.PaymentIntentId == authority.PaymentIntentId, cancellationToken)
                ?? throw new InvalidOperationException("Succeeded rent PaymentIntent has no durable aggregate.");

            if (payment.Status is StripeRentPaymentStatus.Blocked or StripeRentPaymentStatus.Failed
                or StripeRentPaymentStatus.Canceled or StripeRentPaymentStatus.TransferReconciliationPending
                or StripeRentPaymentStatus.ReversalPending
                or StripeRentPaymentStatus.Reversed or StripeRentPaymentStatus.RecoveryFailed)
                throw new InvalidOperationException("Succeeded rent PaymentIntent is in a blocked or terminal recovery state.");
            if (payment.AmountCents != authority.AmountCents
                || !string.Equals(payment.Currency, authority.Currency, StringComparison.OrdinalIgnoreCase)
                || payment.LeaseId != authority.LeaseId
                || payment.OrganizationId != authority.OrganizationId
                || payment.TenantUserId != authority.TenantUserId
                || !string.Equals(payment.OperationId, authority.OperationId, StringComparison.Ordinal)
                || string.IsNullOrWhiteSpace(authority.StripeChargeId))
                throw new InvalidOperationException("Succeeded rent PaymentIntent does not match its durable server authority.");
        }

        public async Task<string> ResolveSucceededPaymentMethodTypeAsync(string paymentIntentId,
            CancellationToken cancellationToken = default)
        {
            var payment = await _context.StripeRentPayments.SingleOrDefaultAsync(
                x => x.PaymentIntentId == paymentIntentId, cancellationToken)
                ?? throw new InvalidOperationException("Succeeded rent PaymentIntent has no durable aggregate.");
            if (!string.IsNullOrWhiteSpace(payment.PaymentMethodType))
                return payment.PaymentMethodType;

            var paymentMethodType = await _gateway.GetPaymentMethodTypeAsync(paymentIntentId, cancellationToken);
            if (paymentMethodType is not ("card" or "us_bank_account"))
            {
                payment.Status = StripeRentPaymentStatus.Blocked;
                payment.RiskReason = $"Unsupported or unknown authoritative payment method '{paymentMethodType ?? "unknown"}'.";
                payment.TransferEligibleAt = null;
                payment.NextTransferAttemptAt = null;
                payment.UpdatedAt = _timeProvider.GetUtcNow();
                await _context.SaveChangesAsync(cancellationToken);
                throw new InvalidOperationException("Succeeded rent PaymentIntent has an unsupported or unknown authoritative payment method.");
            }

            payment.PaymentMethodType = paymentMethodType;
            payment.UpdatedAt = _timeProvider.GetUtcNow();
            await _context.SaveChangesAsync(cancellationToken);
            return paymentMethodType;
        }

        public async Task MarkSucceededAsync(StripeRentPaymentSucceeded succeeded, CancellationToken cancellationToken = default)
        {
            var payment = await _context.StripeRentPayments.SingleOrDefaultAsync(x => x.PaymentIntentId == succeeded.PaymentIntentId, cancellationToken);
            if (payment == null)
            {
                _logger.LogWarning("Ignoring succeeded rent PaymentIntent {PaymentIntentId} because no durable aggregate exists", succeeded.PaymentIntentId);
                return;
            }
            if (payment.Status != StripeRentPaymentStatus.Created)
                return; // Never resurrect Blocked/Failed/Canceled or duplicate a held/pending/terminal success.

            var allocated = await GetAllocatedAmountAsync(payment, cancellationToken);
            if (allocated != payment.AmountCents / 100m)
                throw new InvalidOperationException("Succeeded rent payment cannot be held until its authoritative allocation is complete.");

            var actualPaymentMethodType = payment.PaymentMethodType
                ?? await _gateway.GetPaymentMethodTypeAsync(payment.PaymentIntentId, cancellationToken)
                ?? "unknown";
            payment.StripeChargeId = succeeded.StripeChargeId;
            payment.PaymentMethodType = actualPaymentMethodType;
            payment.HeldAt = succeeded.SucceededAt;
            payment.AllocationCompletedAt = _timeProvider.GetUtcNow();
            payment.UpdatedAt = payment.AllocationCompletedAt.Value;
            // Conservative elapsed holds guarantee at least the policy minimum across weekends and
            // ordinary U.S. banking holidays without pretending a weekends-only helper is a bank calendar.
            var holdDays = actualPaymentMethodType switch { "card" => 7, "us_bank_account" => 14, _ => 0 };
            if (holdDays == 0 || string.IsNullOrWhiteSpace(succeeded.StripeChargeId))
            {
                payment.Status = StripeRentPaymentStatus.Blocked;
                payment.RiskReason = holdDays == 0 ? $"Unsupported payment method '{actualPaymentMethodType}'." : "Succeeded PaymentIntent has no source charge.";
                payment.TransferEligibleAt = null;
            }
            else
            {
                payment.Status = StripeRentPaymentStatus.Held;
                payment.TransferEligibleAt = succeeded.SucceededAt.AddDays(holdDays);
                payment.RiskReason = null;
            }
            await _context.SaveChangesAsync(cancellationToken);
        }

        public Task MarkFailedAsync(string paymentIntentId, string reason, CancellationToken cancellationToken = default) =>
            MarkTerminalAsync(paymentIntentId, StripeRentPaymentStatus.Failed, reason, cancellationToken);

        public Task MarkCanceledAsync(string paymentIntentId, string reason, CancellationToken cancellationToken = default) =>
            MarkTerminalAsync(paymentIntentId, StripeRentPaymentStatus.Canceled, reason, cancellationToken);

        private async Task MarkTerminalAsync(string paymentIntentId, StripeRentPaymentStatus status, string reason, CancellationToken cancellationToken)
        {
            var payment = await _context.StripeRentPayments.SingleOrDefaultAsync(x => x.PaymentIntentId == paymentIntentId, cancellationToken);
            if (payment == null || payment.Status is StripeRentPaymentStatus.Transferred
                or StripeRentPaymentStatus.TransferReconciliationPending or StripeRentPaymentStatus.ReversalPending
                or StripeRentPaymentStatus.Reversed or StripeRentPaymentStatus.RecoveryFailed or StripeRentPaymentStatus.Blocked
                or StripeRentPaymentStatus.Failed or StripeRentPaymentStatus.Canceled)
                return;
            payment.Status = status;
            payment.RiskReason = reason;
            payment.TransferEligibleAt = null;
            payment.NextTransferAttemptAt = null;
            payment.UpdatedAt = _timeProvider.GetUtcNow();
            await _context.SaveChangesAsync(cancellationToken);
        }

        public async Task MarkBlockedAsync(string? paymentIntentId, string? stripeChargeId, StripeRentPaymentBlockKind kind,
            string eventObjectId, string reason, long? blockedAmountCents = null, CancellationToken cancellationToken = default)
        {
            var payment = await _context.StripeRentPayments.SingleOrDefaultAsync(x =>
                (!string.IsNullOrEmpty(paymentIntentId) && x.PaymentIntentId == paymentIntentId)
                || (!string.IsNullOrEmpty(stripeChargeId) && x.StripeChargeId == stripeChargeId), cancellationToken);
            if (payment == null) return;
            var now = _timeProvider.GetUtcNow();
            if (kind == StripeRentPaymentBlockKind.Refund)
            {
                payment.RefundedAt ??= now;
                if (!string.IsNullOrWhiteSpace(eventObjectId))
                    payment.StripeRefundId ??= eventObjectId;
                if (blockedAmountCents > 0)
                    payment.RefundedAmountCents = Math.Max(payment.RefundedAmountCents, blockedAmountCents.Value);
            }
            else
            {
                payment.DisputedAt ??= now;
                if (!string.IsNullOrWhiteSpace(eventObjectId))
                    payment.StripeDisputeId ??= eventObjectId;
                if (blockedAmountCents > 0)
                    payment.DisputedAmountCents = Math.Max(payment.DisputedAmountCents, blockedAmountCents.Value);
            }
            var targetReversalAmount = Math.Min(payment.AmountCents,
                checked(payment.RefundedAmountCents + payment.DisputedAmountCents));
            if (!string.IsNullOrWhiteSpace(payment.StripeTransferId)
                && targetReversalAmount > payment.ReversedAmountCents)
            {
                if (payment.Status != StripeRentPaymentStatus.ReversalPending)
                {
                    payment.ReversalAttemptCount = 0;
                    payment.LastReversalError = null;
                }
                payment.Status = StripeRentPaymentStatus.ReversalPending;
            }
            else if (payment.Status is StripeRentPaymentStatus.TransferPending or StripeRentPaymentStatus.TransferReconciliationPending)
                payment.Status = StripeRentPaymentStatus.TransferReconciliationPending;
            else if (payment.Status is not StripeRentPaymentStatus.ReversalPending
                and not StripeRentPaymentStatus.Reversed and not StripeRentPaymentStatus.RecoveryFailed)
                payment.Status = StripeRentPaymentStatus.Blocked;
            payment.RiskReason = reason;
            payment.TransferEligibleAt = null;
            payment.NextTransferAttemptAt = null;
            payment.UpdatedAt = now;
            await _context.SaveChangesAsync(cancellationToken);
        }

        public async Task ReconcileRefundExposureAsync(string paymentIntentId, string stripeChargeId, string refundId,
            string reason, long authoritativeRefundedAmountCents, CancellationToken cancellationToken = default)
        {
            var gate = PaymentLocks.GetOrAdd($"refund:{paymentIntentId}", _ => new SemaphoreSlim(1, 1));
            await gate.WaitAsync(cancellationToken);
            try
            {
                await using var transaction = await BeginRefundReconciliationTransactionAsync(paymentIntentId,
                    cancellationToken);
                var payment = await _context.StripeRentPayments.SingleOrDefaultAsync(
                    x => x.PaymentIntentId == paymentIntentId, cancellationToken)
                    ?? throw new InvalidOperationException("The Stripe rent payment is not registered.");
                await _context.Entry(payment).ReloadAsync(cancellationToken);
                if (string.IsNullOrWhiteSpace(payment.StripeChargeId)
                    || !string.Equals(payment.StripeChargeId, stripeChargeId, StringComparison.Ordinal))
                    throw new InvalidOperationException("Refund charge provenance does not match the durable rent payment.");
                if (authoritativeRefundedAmountCents < 0 || authoritativeRefundedAmountCents > payment.AmountCents)
                    throw new InvalidOperationException("Authoritative refunded exposure is outside the durable payment amount.");

                var reconciledRefundedAmountCents = authoritativeRefundedAmountCents;
                if (reconciledRefundedAmountCents < payment.RefundedAmountCents)
                {
                    // A refund can legitimately fail after initially succeeding, but a delayed successful-refund
                    // handler may also carry an older cumulative charge snapshot. Re-read Stripe while holding the
                    // durable per-PaymentIntent lock before allowing exposure or ledger state to move backward.
                    var latestSource = await _gateway.GetSourceStateAsync(stripeChargeId, cancellationToken);
                    if (!latestSource.Exists || !latestSource.Paid || latestSource.RefundedAmountCents == null
                        || !string.Equals(latestSource.PaymentIntentId, paymentIntentId, StringComparison.Ordinal)
                        || latestSource.AmountCents != payment.AmountCents
                        || !string.Equals(latestSource.Currency, payment.Currency, StringComparison.OrdinalIgnoreCase)
                        || latestSource.RefundedAmountCents < 0
                        || latestSource.RefundedAmountCents > payment.AmountCents)
                        throw new InvalidOperationException("Could not revalidate decreasing authoritative refund exposure.");
                    reconciledRefundedAmountCents = latestSource.RefundedAmountCents.Value;
                }

                var now = _timeProvider.GetUtcNow();
                if (reconciledRefundedAmountCents > 0)
                {
                    payment.RefundedAt ??= now;
                    if (!string.IsNullOrWhiteSpace(refundId)) payment.StripeRefundId ??= refundId;
                }
                payment.RefundedAmountCents = reconciledRefundedAmountCents;
                var target = Math.Min(payment.AmountCents,
                    checked(payment.RefundedAmountCents + payment.DisputedAmountCents));
                if (!string.IsNullOrWhiteSpace(payment.StripeTransferId) && target > payment.ReversedAmountCents)
                    payment.Status = StripeRentPaymentStatus.ReversalPending;
                else if (payment.Status is not StripeRentPaymentStatus.Reversed and not StripeRentPaymentStatus.RecoveryFailed)
                    payment.Status = StripeRentPaymentStatus.Blocked;
                if (target <= payment.ReversedAmountCents)
                {
                    payment.ReversalTargetAmountCents = 0;
                    payment.ReversalIncrementAmountCents = 0;
                }
                payment.RiskReason = reason;
                payment.TransferEligibleAt = null;
                payment.NextTransferAttemptAt = null;
                payment.UpdatedAt = now;
                await _context.SaveChangesAsync(cancellationToken);
                if (transaction != null) await transaction.CommitAsync(cancellationToken);
            }
            finally
            {
                gate.Release();
                if (gate.CurrentCount == 1)
                    PaymentLocks.TryRemove(new KeyValuePair<string, SemaphoreSlim>($"refund:{paymentIntentId}", gate));
            }
        }

        public async Task<int> ProcessEligibleTransfersAsync(CancellationToken cancellationToken = default)
        {
            await ProcessPendingReversalsAsync(cancellationToken);
            if (_configuration.GetValue<bool?>("Stripe:TransfersEnabled") != true) return 0;
            await ProcessPendingTransferReconciliationsAsync(cancellationToken);
            // A successful ambiguous-transfer reconciliation can reveal an already-created transfer
            // that must be reversed immediately because a refund/dispute arrived while its result was unknown.
            await ProcessPendingReversalsAsync(cancellationToken);
            var now = _timeProvider.GetUtcNow();
            var maxAttempts = Math.Max(1, _configuration.GetValue<int?>("Stripe:TransferMaxAttempts") ?? 5);
            var candidates = await _context.StripeRentPayments
                .Where(x =>
                    (x.Status == StripeRentPaymentStatus.Held && x.TransferAttemptCount < maxAttempts
                        && x.TransferEligibleAt != null && x.TransferEligibleAt <= now)
                    || (x.Status == StripeRentPaymentStatus.TransferPending
                        && (x.NextTransferAttemptAt == null
                            || (x.TransferAttemptCount < maxAttempts && x.NextTransferAttemptAt <= now))))
                .OrderBy(x => x.TransferEligibleAt).Take(100).ToListAsync(cancellationToken);
            var transferred = 0;
            foreach (var candidate in candidates)
            {
                var gate = PaymentLocks.GetOrAdd($"transfer:{candidate.PaymentIntentId}", _ => new SemaphoreSlim(1, 1));
                await gate.WaitAsync(cancellationToken);
                var payeeGate = PaymentLocks.GetOrAdd($"transfer-payee:{candidate.DestinationStripeAccountId}", _ => new SemaphoreSlim(1, 1));
                var payeeGateHeld = false;
                var sqlPayeeLockHeld = false;
                var relationalConnectionOpened = false;
                try
                {
                    await payeeGate.WaitAsync(cancellationToken);
                    payeeGateHeld = true;
                    if (_context.Database.IsRelational())
                    {
                        await _context.Database.OpenConnectionAsync(cancellationToken);
                        relationalConnectionOpened = true;
                        var lockResource = $"stripe-transfer-payee:{candidate.DestinationStripeAccountId}";
                        await _context.Database.ExecuteSqlInterpolatedAsync($@"
DECLARE @result int;
EXEC @result = sys.sp_getapplock @Resource={lockResource}, @LockMode='Exclusive', @LockOwner='Session', @LockTimeout=30000;
IF @result < 0 THROW 51000, 'Unable to acquire connected-payee transfer lock.', 1;", cancellationToken);
                        sqlPayeeLockHeld = true;
                    }

                    await _context.Entry(candidate).ReloadAsync(cancellationToken);
                    now = _timeProvider.GetUtcNow();
                    if (candidate.Status == StripeRentPaymentStatus.Transferred
                        || (candidate.Status == StripeRentPaymentStatus.Held && candidate.TransferAttemptCount >= maxAttempts)
                        || (candidate.Status == StripeRentPaymentStatus.TransferPending
                            && (candidate.NextTransferAttemptAt > now
                                || (candidate.NextTransferAttemptAt != null && candidate.TransferAttemptCount >= maxAttempts)))) continue;

                    var decision = await _risk.EvaluateAsync(candidate, cancellationToken);
                    if (!decision.Approved)
                    {
                        candidate.Status = StripeRentPaymentStatus.Blocked;
                        candidate.RiskReason = decision.Reason ?? "Risk check denied transfer.";
                        candidate.UpdatedAt = now;
                        await _context.SaveChangesAsync(cancellationToken);
                        continue;
                    }

                    var source = await _gateway.GetSourceStateAsync(candidate.StripeChargeId!, cancellationToken);
                    if (!source.Exists || !source.Paid || source.Refunded || source.Disputed
                        || source.PaymentIntentId != candidate.PaymentIntentId
                        || source.AmountCents != candidate.AmountCents
                        || !string.Equals(source.Currency, candidate.Currency, StringComparison.OrdinalIgnoreCase))
                    {
                        candidate.Status = StripeRentPaymentStatus.Blocked;
                        candidate.RiskReason = source.Refunded ? "Stripe source charge was refunded."
                            : source.Disputed ? "Stripe source charge is disputed."
                            : source.PaymentIntentId != candidate.PaymentIntentId || source.AmountCents != candidate.AmountCents
                                || !string.Equals(source.Currency, candidate.Currency, StringComparison.OrdinalIgnoreCase)
                                ? "Stripe source charge provenance does not match the durable rent payment."
                            : source.FailureReason ?? "Stripe source charge is not eligible for transfer.";
                        candidate.TransferEligibleAt = null;
                        candidate.UpdatedAt = now;
                        await _context.SaveChangesAsync(cancellationToken);
                        continue;
                    }

                    var startsNewTransferRequest = candidate.Status == StripeRentPaymentStatus.Held
                        || candidate.NextTransferAttemptAt != null;
                    candidate.Status = StripeRentPaymentStatus.TransferPending;
                    if (startsNewTransferRequest)
                    {
                        candidate.TransferAttemptCount++;
                        candidate.TransferReplayFailureCount = 0;
                        candidate.TransferReconciliationPaused = false;
                        candidate.TransferIdempotencyKey = NewTransferIdempotencyKey(candidate);
                    }
                    else
                    {
                        candidate.TransferIdempotencyKey ??= LegacyTransferIdempotencyKey(candidate);
                    }
                    candidate.LastTransferAttemptAt = now;
                    candidate.NextTransferAttemptAt = null;
                    candidate.LastTransferError = null;
                    candidate.UpdatedAt = now;
                    try { await _context.SaveChangesAsync(cancellationToken); }
                    catch (DbUpdateConcurrencyException) { _context.Entry(candidate).State = EntityState.Detached; continue; }

                    // Re-run the complete fail-closed gate after source validation and reservation.
                    // EvaluatePayeeAsync deliberately makes current active Owner/Manager authority
                    // its final database query, so revocation is checked immediately before Stripe.
                    var finalDecision = await _risk.EvaluateAsync(candidate, cancellationToken);
                    if (!finalDecision.Approved)
                    {
                        candidate.Status = StripeRentPaymentStatus.Blocked;
                        candidate.RiskReason = finalDecision.Reason ?? "Final pre-transfer risk check denied transfer.";
                        candidate.NextTransferAttemptAt = null;
                        candidate.UpdatedAt = _timeProvider.GetUtcNow();
                        await _context.SaveChangesAsync(cancellationToken);
                        continue;
                    }

                    try
                    {
                        var transferId = await _gateway.CreateTransferAsync(new StripeRentTransferRequest(
                            candidate.AmountCents, candidate.Currency, candidate.DestinationStripeAccountId, candidate.StripeChargeId!,
                            $"rent:{candidate.PaymentIntentId}", TransferIdempotencyKey(candidate),
                            new Dictionary<string, string> { ["paymentIntentId"] = candidate.PaymentIntentId,
                                ["leaseId"] = candidate.LeaseId.ToString(), ["organizationId"] = candidate.OrganizationId.ToString() }), cancellationToken);

                        // Re-read after the external side effect. A refund/dispute webhook may have blocked the
                        // aggregate while Stripe was creating the transfer; if so, persist the transfer identity
                        // and immediately queue the deterministic reversal rather than overwriting the block.
                        await _context.Entry(candidate).ReloadAsync(cancellationToken);
                        candidate.StripeTransferId = transferId;
                        candidate.TransferredAt = _timeProvider.GetUtcNow();
                        var targetReversalAmount = Math.Min(candidate.AmountCents,
                            checked(candidate.RefundedAmountCents + candidate.DisputedAmountCents));
                        candidate.Status = targetReversalAmount > candidate.ReversedAmountCents
                            ? StripeRentPaymentStatus.ReversalPending
                            : candidate.RefundedAt != null || candidate.DisputedAt != null
                                ? StripeRentPaymentStatus.Blocked
                                : StripeRentPaymentStatus.Transferred;
                        candidate.UpdatedAt = candidate.TransferredAt.Value;
                        await _context.SaveChangesAsync(cancellationToken);
                        transferred++;
                    }
                    catch (StripeRentTransferOperatorReviewException ex)
                    {
                        await _context.Entry(candidate).ReloadAsync(cancellationToken);
                        candidate.LastTransferError = ex.Message;
                        candidate.UpdatedAt = _timeProvider.GetUtcNow();
                        if (string.IsNullOrWhiteSpace(candidate.StripeTransferId)
                            && !IsTerminalTransferRecoveryState(candidate.Status))
                        {
                            candidate.Status = StripeRentPaymentStatus.TransferReconciliationPending;
                            candidate.TransferReconciliationPaused = true;
                            candidate.NextTransferAttemptAt = null;
                            candidate.RiskReason = "Stripe rejected the durable idempotency key because request parameters differ; the original outcome is unknown and requires operator reconciliation.";
                        }
                        await _context.SaveChangesAsync(cancellationToken);
                        _logger.LogCritical(ex,
                            "Paused Stripe transfer {PaymentIntentId} because its durable idempotency key requires operator reconciliation",
                            candidate.PaymentIntentId);
                    }
                    catch (StripeRentTransferDefinitiveException ex)
                    {
                        await _context.Entry(candidate).ReloadAsync(cancellationToken);
                        candidate.LastTransferError = ex.Message;
                        candidate.UpdatedAt = _timeProvider.GetUtcNow();
                        if (candidate.Status != StripeRentPaymentStatus.TransferPending)
                        {
                            await _context.SaveChangesAsync(cancellationToken);
                            continue;
                        }
                        if (candidate.TransferAttemptCount >= maxAttempts)
                        {
                            candidate.Status = StripeRentPaymentStatus.Blocked;
                            candidate.TransferReconciliationPaused = true;
                            candidate.RiskReason = $"Transfer failed definitively after {maxAttempts} attempts and requires operator review: {ex.Code}.";
                            candidate.NextTransferAttemptAt = null;
                        }
                        else
                        {
                            candidate.Status = StripeRentPaymentStatus.TransferPending;
                            candidate.TransferReconciliationPaused = false;
                            var baseMinutes = Math.Max(1, _configuration.GetValue<int?>("Stripe:TransferRetryBaseMinutes") ?? 5);
                            var exponent = Math.Min(candidate.TransferAttemptCount - 1, 10);
                            candidate.NextTransferAttemptAt = candidate.UpdatedAt.AddMinutes(baseMinutes * Math.Pow(2, exponent));
                        }
                        await _context.SaveChangesAsync(cancellationToken);
                        _logger.LogWarning(ex,
                            "Stripe definitively rejected rent transfer {PaymentIntentId}; a new idempotency key will be used after the retry delay",
                            candidate.PaymentIntentId);
                    }
                    catch (Exception ex)
                    {
                        // The network may have failed after Stripe accepted the idempotent request.
                        // Never rotate the durable key until Stripe positively proves no transfer was created.
                        await _context.Entry(candidate).ReloadAsync(cancellationToken);
                        candidate.Status = StripeRentPaymentStatus.TransferReconciliationPending;
                        candidate.TransferReconciliationPaused = false;
                        candidate.TransferReplayFailureCount++;
                        candidate.LastTransferError = ex.Message;
                        candidate.UpdatedAt = _timeProvider.GetUtcNow();
                        var baseMinutes = Math.Max(1, _configuration.GetValue<int?>("Stripe:TransferRetryBaseMinutes") ?? 5);
                        if (candidate.TransferReplayFailureCount >= maxAttempts)
                        {
                            candidate.TransferReconciliationPaused = true;
                            candidate.NextTransferAttemptAt = null;
                            candidate.RiskReason = $"Transfer outcome remained ambiguous after {maxAttempts} replay failures; automatic reconciliation stopped for operator review.";
                        }
                        else
                        {
                            var exponent = Math.Min(candidate.TransferReplayFailureCount - 1, 10);
                            candidate.NextTransferAttemptAt = candidate.UpdatedAt.AddMinutes(baseMinutes * Math.Pow(2, exponent));
                        }
                        await _context.SaveChangesAsync(cancellationToken);
                        _logger.LogCritical(ex, "Stripe transfer outcome is ambiguous for rent PaymentIntent {PaymentIntentId}; deterministic reconciliation is required", candidate.PaymentIntentId);
                    }
                }
                finally
                {
                    try
                    {
                        if (sqlPayeeLockHeld)
                        {
                            var lockResource = $"stripe-transfer-payee:{candidate.DestinationStripeAccountId}";
                            try
                            {
                                await _context.Database.ExecuteSqlInterpolatedAsync(
                                    $"EXEC sys.sp_releaseapplock @Resource={lockResource}, @LockOwner='Session';", CancellationToken.None);
                            }
                            catch (Exception ex)
                            {
                                _logger.LogCritical(ex,
                                    "Failed to explicitly release the SQL connected-payee transfer lock for {StripeAccountId}; closing the dedicated connection",
                                    candidate.DestinationStripeAccountId);
                            }
                        }
                    }
                    finally
                    {
                        try
                        {
                            if (relationalConnectionOpened)
                                await _context.Database.CloseConnectionAsync();
                        }
                        finally
                        {
                            if (payeeGateHeld) payeeGate.Release();
                            gate.Release();
                        }
                    }
                }
            }
            return transferred;
        }

        private async Task ProcessPendingTransferReconciliationsAsync(CancellationToken cancellationToken)
        {
            var now = _timeProvider.GetUtcNow();
            var maxReplayFailures = Math.Max(1, _configuration.GetValue<int?>("Stripe:TransferMaxAttempts") ?? 5);
            var candidates = await _context.StripeRentPayments
                .Where(x => x.Status == StripeRentPaymentStatus.TransferReconciliationPending
                    && x.TransferReplayFailureCount < maxReplayFailures
                    && !x.TransferReconciliationPaused
                    && (x.NextTransferAttemptAt == null || x.NextTransferAttemptAt <= now))
                .OrderBy(x => x.UpdatedAt).Take(100).ToListAsync(cancellationToken);

            foreach (var candidate in candidates)
            {
                var gate = PaymentLocks.GetOrAdd($"transfer:{candidate.PaymentIntentId}", _ => new SemaphoreSlim(1, 1));
                await gate.WaitAsync(cancellationToken);
                var payeeGate = PaymentLocks.GetOrAdd($"transfer-payee:{candidate.DestinationStripeAccountId}", _ => new SemaphoreSlim(1, 1));
                var payeeGateHeld = false;
                var sqlPayeeLockHeld = false;
                var relationalConnectionOpened = false;
                try
                {
                    await payeeGate.WaitAsync(cancellationToken);
                    payeeGateHeld = true;
                    if (_context.Database.IsRelational())
                    {
                        await _context.Database.OpenConnectionAsync(cancellationToken);
                        relationalConnectionOpened = true;
                        var lockResource = $"stripe-transfer-payee:{candidate.DestinationStripeAccountId}";
                        await _context.Database.ExecuteSqlInterpolatedAsync($@"
DECLARE @result int;
EXEC @result = sys.sp_getapplock @Resource={lockResource}, @LockMode='Exclusive', @LockOwner='Session', @LockTimeout=30000;
IF @result < 0 THROW 51000, 'Unable to acquire connected-payee transfer reconciliation lock.', 1;", cancellationToken);
                        sqlPayeeLockHeld = true;
                    }

                    await _context.Entry(candidate).ReloadAsync(cancellationToken);
                    if (candidate.Status != StripeRentPaymentStatus.TransferReconciliationPending
                        || candidate.TransferReplayFailureCount >= maxReplayFailures
                        || candidate.TransferReconciliationPaused
                        || candidate.NextTransferAttemptAt > _timeProvider.GetUtcNow()) continue;
                    candidate.TransferIdempotencyKey ??= LegacyTransferIdempotencyKey(candidate);
                    await _context.SaveChangesAsync(cancellationToken);

                    // Replaying an idempotent create can be the first request Stripe receives after an
                    // ambiguous network failure. Treat it as transfer creation, not a read-only lookup:
                    // every live risk, authority, hold, source-charge and destination check must pass again.
                    var decision = await _risk.EvaluateAsync(candidate, cancellationToken);
                    if (!decision.Approved)
                    {
                        candidate.RiskReason = $"Transfer reconciliation requires operator review: {decision.Reason ?? "fresh risk check denied replay."}";
                        candidate.TransferReconciliationPaused = true;
                        candidate.NextTransferAttemptAt = null;
                        candidate.UpdatedAt = _timeProvider.GetUtcNow();
                        await _context.SaveChangesAsync(cancellationToken);
                        _logger.LogCritical("Blocked replay of ambiguous Stripe transfer {PaymentIntentId}: {Reason}",
                            candidate.PaymentIntentId, candidate.RiskReason);
                        continue;
                    }

                    var source = await _gateway.GetSourceStateAsync(candidate.StripeChargeId!, cancellationToken);
                    if (!source.Exists || !source.Paid || source.Refunded || source.Disputed
                        || source.PaymentIntentId != candidate.PaymentIntentId
                        || source.AmountCents != candidate.AmountCents
                        || !string.Equals(source.Currency, candidate.Currency, StringComparison.OrdinalIgnoreCase))
                    {
                        candidate.RiskReason = "Transfer reconciliation requires operator review: Stripe source charge is no longer eligible or its provenance changed.";
                        candidate.TransferReconciliationPaused = true;
                        candidate.NextTransferAttemptAt = null;
                        candidate.UpdatedAt = _timeProvider.GetUtcNow();
                        await _context.SaveChangesAsync(cancellationToken);
                        _logger.LogCritical("Blocked replay of ambiguous Stripe transfer {PaymentIntentId}: source charge failed fresh validation",
                            candidate.PaymentIntentId);
                        continue;
                    }

                    candidate.LastTransferAttemptAt = _timeProvider.GetUtcNow();
                    candidate.NextTransferAttemptAt = null;
                    await _context.SaveChangesAsync(cancellationToken);

                    // The idempotent replay can still be the request that creates the transfer.
                    // Re-check authority and all live destination controls after source validation
                    // and immediately before invoking Stripe.
                    var finalDecision = await _risk.EvaluateAsync(candidate, cancellationToken);
                    if (!finalDecision.Approved)
                    {
                        candidate.RiskReason = $"Transfer reconciliation requires operator review: {finalDecision.Reason ?? "final pre-transfer risk check denied replay."}";
                        candidate.TransferReconciliationPaused = true;
                        candidate.NextTransferAttemptAt = null;
                        candidate.UpdatedAt = _timeProvider.GetUtcNow();
                        await _context.SaveChangesAsync(cancellationToken);
                        _logger.LogCritical("Blocked replay of ambiguous Stripe transfer {PaymentIntentId}: {Reason}",
                            candidate.PaymentIntentId, candidate.RiskReason);
                        continue;
                    }

                    try
                    {
                        var transferId = await _gateway.CreateTransferAsync(new StripeRentTransferRequest(
                            candidate.AmountCents, candidate.Currency, candidate.DestinationStripeAccountId, candidate.StripeChargeId!,
                            $"rent:{candidate.PaymentIntentId}", TransferIdempotencyKey(candidate),
                            new Dictionary<string, string> { ["paymentIntentId"] = candidate.PaymentIntentId,
                                ["leaseId"] = candidate.LeaseId.ToString(), ["organizationId"] = candidate.OrganizationId.ToString() }), cancellationToken);
                        await _context.Entry(candidate).ReloadAsync(cancellationToken);
                        if (!string.IsNullOrWhiteSpace(candidate.StripeTransferId)
                            && !string.Equals(candidate.StripeTransferId, transferId, StringComparison.Ordinal))
                        {
                            candidate.Status = StripeRentPaymentStatus.RecoveryFailed;
                            candidate.TransferReconciliationPaused = true;
                            candidate.RiskReason = $"Stripe reconciliation returned conflicting transfer IDs ({candidate.StripeTransferId} and {transferId}); operator review is required.";
                            candidate.NextTransferAttemptAt = null;
                            candidate.UpdatedAt = _timeProvider.GetUtcNow();
                            await _context.SaveChangesAsync(cancellationToken);
                            continue;
                        }
                        candidate.StripeTransferId ??= transferId;
                        candidate.TransferredAt ??= _timeProvider.GetUtcNow();
                        candidate.LastTransferError = null;
                        candidate.NextTransferAttemptAt = null;
                        var targetReversalAmount = Math.Min(candidate.AmountCents,
                            checked(candidate.RefundedAmountCents + candidate.DisputedAmountCents));
                        if (!IsTerminalTransferRecoveryState(candidate.Status))
                        {
                            candidate.Status = targetReversalAmount > candidate.ReversedAmountCents
                                ? StripeRentPaymentStatus.ReversalPending
                                : candidate.RefundedAt != null || candidate.DisputedAt != null
                                    ? StripeRentPaymentStatus.Blocked
                                    : StripeRentPaymentStatus.Transferred;
                        }
                        candidate.UpdatedAt = _timeProvider.GetUtcNow();
                        await _context.SaveChangesAsync(cancellationToken);
                    }
                    catch (StripeRentTransferOperatorReviewException ex)
                    {
                        await _context.Entry(candidate).ReloadAsync(cancellationToken);
                        candidate.LastTransferError = ex.Message;
                        candidate.UpdatedAt = _timeProvider.GetUtcNow();
                        if (string.IsNullOrWhiteSpace(candidate.StripeTransferId)
                            && !IsTerminalTransferRecoveryState(candidate.Status))
                        {
                            candidate.Status = StripeRentPaymentStatus.TransferReconciliationPending;
                            candidate.TransferReconciliationPaused = true;
                            candidate.NextTransferAttemptAt = null;
                            candidate.RiskReason = "Stripe rejected the durable idempotency key because request parameters differ; the original outcome is unknown and requires operator reconciliation.";
                        }
                        await _context.SaveChangesAsync(cancellationToken);
                        _logger.LogCritical(ex,
                            "Paused Stripe transfer reconciliation {PaymentIntentId} because its durable idempotency key has an unknown original outcome",
                            candidate.PaymentIntentId);
                    }
                    catch (StripeRentTransferDefinitiveException ex)
                    {
                        await _context.Entry(candidate).ReloadAsync(cancellationToken);
                        candidate.LastTransferError = ex.Message;
                        candidate.UpdatedAt = _timeProvider.GetUtcNow();
                        if (candidate.Status == StripeRentPaymentStatus.TransferReconciliationPending)
                        {
                            var maxGenerations = Math.Max(1, _configuration.GetValue<int?>("Stripe:TransferMaxAttempts") ?? 5);
                            if (candidate.TransferAttemptCount >= maxGenerations)
                            {
                                candidate.Status = StripeRentPaymentStatus.Blocked;
                                candidate.TransferReconciliationPaused = true;
                                candidate.RiskReason = $"Transfer failed definitively after {maxGenerations} generations and requires operator review: {ex.Code}.";
                                candidate.NextTransferAttemptAt = null;
                            }
                            else
                            {
                                candidate.Status = StripeRentPaymentStatus.TransferPending;
                                candidate.TransferReplayFailureCount = 0;
                                candidate.TransferReconciliationPaused = false;
                                candidate.RiskReason = null;
                                var baseMinutes = Math.Max(1, _configuration.GetValue<int?>("Stripe:TransferRetryBaseMinutes") ?? 5);
                                candidate.NextTransferAttemptAt = candidate.UpdatedAt.AddMinutes(baseMinutes);
                            }
                        }
                        await _context.SaveChangesAsync(cancellationToken);
                        _logger.LogWarning(ex,
                            "Stripe definitively rejected reconciliation for {PaymentIntentId}; a new transfer generation is scheduled only if still eligible",
                            candidate.PaymentIntentId);
                    }
                    catch (Exception ex)
                    {
                        await _context.Entry(candidate).ReloadAsync(cancellationToken);
                        candidate.LastTransferError = ex.Message;
                        candidate.UpdatedAt = _timeProvider.GetUtcNow();
                        if (!string.IsNullOrWhiteSpace(candidate.StripeTransferId)
                            || IsTerminalTransferRecoveryState(candidate.Status))
                        {
                            await _context.SaveChangesAsync(cancellationToken);
                            _logger.LogWarning(ex,
                                "Ignored late ambiguous reconciliation failure for {PaymentIntentId} because a durable transfer/recovery outcome is already known",
                                candidate.PaymentIntentId);
                            continue;
                        }
                        candidate.Status = StripeRentPaymentStatus.TransferReconciliationPending;
                        candidate.TransferReconciliationPaused = false;
                        candidate.TransferReplayFailureCount++;
                        var baseMinutes = Math.Max(1, _configuration.GetValue<int?>("Stripe:TransferRetryBaseMinutes") ?? 5);
                        if (candidate.TransferReplayFailureCount >= maxReplayFailures)
                        {
                            candidate.TransferReconciliationPaused = true;
                            candidate.NextTransferAttemptAt = null;
                            candidate.RiskReason = $"Transfer outcome remained ambiguous after {maxReplayFailures} replay failures; automatic reconciliation stopped for operator review.";
                        }
                        else
                        {
                            var exponent = Math.Min(candidate.TransferReplayFailureCount - 1, 10);
                            candidate.NextTransferAttemptAt = candidate.UpdatedAt.AddMinutes(baseMinutes * Math.Pow(2, exponent));
                        }
                        await _context.SaveChangesAsync(cancellationToken);
                        _logger.LogCritical(ex, "Stripe transfer reconciliation remains ambiguous for {PaymentIntentId}", candidate.PaymentIntentId);
                    }
                }
                finally
                {
                    try
                    {
                        if (sqlPayeeLockHeld)
                        {
                            var lockResource = $"stripe-transfer-payee:{candidate.DestinationStripeAccountId}";
                            try
                            {
                                await _context.Database.ExecuteSqlInterpolatedAsync(
                                    $"EXEC sys.sp_releaseapplock @Resource={lockResource}, @LockOwner='Session';", CancellationToken.None);
                            }
                            catch (Exception ex)
                            {
                                _logger.LogCritical(ex,
                                    "Failed to explicitly release the SQL connected-payee reconciliation lock for {StripeAccountId}; closing the dedicated connection",
                                    candidate.DestinationStripeAccountId);
                            }
                        }
                    }
                    finally
                    {
                        try
                        {
                            if (relationalConnectionOpened)
                                await _context.Database.CloseConnectionAsync();
                        }
                        finally
                        {
                            if (payeeGateHeld) payeeGate.Release();
                            gate.Release();
                        }
                    }
                }
            }
        }

        private static string TransferIdempotencyKey(StripeRentPayment payment) =>
            payment.TransferIdempotencyKey ?? LegacyTransferIdempotencyKey(payment);

        private static string NewTransferIdempotencyKey(StripeRentPayment payment) =>
            $"rent-transfer:{payment.PaymentIntentId}:attempt:{Math.Max(1, payment.TransferAttemptCount)}";

        private static string LegacyTransferIdempotencyKey(StripeRentPayment payment) =>
            $"rent-transfer:{payment.PaymentIntentId}";

        private static bool IsTerminalTransferRecoveryState(StripeRentPaymentStatus status) =>
            status is StripeRentPaymentStatus.ReversalPending
                or StripeRentPaymentStatus.Reversed
                or StripeRentPaymentStatus.RecoveryFailed;

        private async Task ProcessPendingReversalsAsync(CancellationToken cancellationToken)
        {
            var maxAttempts = Math.Max(1, _configuration.GetValue<int?>("Stripe:ReversalMaxAttempts") ?? 10);
            var candidates = await _context.StripeRentPayments
                .Where(x => x.Status == StripeRentPaymentStatus.ReversalPending
                    && x.StripeTransferId != null && x.ReversalAttemptCount < maxAttempts)
                .OrderBy(x => x.UpdatedAt).Take(100).ToListAsync(cancellationToken);

            foreach (var candidate in candidates)
            {
                var gate = PaymentLocks.GetOrAdd($"reversal:{candidate.PaymentIntentId}", _ => new SemaphoreSlim(1, 1));
                await gate.WaitAsync(cancellationToken);
                var sqlLossLockHeld = false;
                var relationalConnectionOpened = false;
                try
                {
                    if (_context.Database.IsSqlServer())
                    {
                        await _context.Database.OpenConnectionAsync(cancellationToken);
                        relationalConnectionOpened = true;
                        var lockResource = $"stripe-rent-loss:{candidate.PaymentIntentId}";
                        await _context.Database.ExecuteSqlInterpolatedAsync($@"
DECLARE @lockResult int;
EXEC @lockResult = sys.sp_getapplock
    @Resource = {lockResource},
    @LockMode = 'Exclusive',
    @LockOwner = 'Session',
    @LockTimeout = 30000;
IF @lockResult < 0
    THROW 51000, 'Could not acquire the Stripe rent reversal lock.', 1;", cancellationToken);
                        sqlLossLockHeld = true;
                    }
                    await _context.Entry(candidate).ReloadAsync(cancellationToken);
                    if (candidate.Status != StripeRentPaymentStatus.ReversalPending
                        || string.IsNullOrWhiteSpace(candidate.StripeTransferId)) continue;

                    var targetReversalAmount = candidate.ReversalTargetAmountCents;
                    var incrementalReversalAmount = candidate.ReversalIncrementAmountCents;
                    if (targetReversalAmount <= candidate.ReversedAmountCents || incrementalReversalAmount <= 0)
                    {
                        targetReversalAmount = Math.Min(candidate.AmountCents,
                            checked(candidate.RefundedAmountCents + candidate.DisputedAmountCents));
                        incrementalReversalAmount = targetReversalAmount - candidate.ReversedAmountCents;
                        if (incrementalReversalAmount <= 0)
                        {
                            candidate.Status = candidate.ReversedAmountCents >= candidate.AmountCents
                                ? StripeRentPaymentStatus.Reversed
                                : StripeRentPaymentStatus.Blocked;
                            candidate.UpdatedAt = _timeProvider.GetUtcNow();
                            await _context.SaveChangesAsync(cancellationToken);
                            continue;
                        }

                        // Persist the exact Stripe operation before the external side effect. If the response is
                        // ambiguous, every retry must replay this target/key before considering a later refund delta.
                        candidate.ReversalTargetAmountCents = targetReversalAmount;
                        candidate.ReversalIncrementAmountCents = incrementalReversalAmount;
                        candidate.ReversalAttemptCount = 0;
                    }

                    candidate.ReversalAttemptCount++;
                    candidate.LastReversalAttemptAt = _timeProvider.GetUtcNow();
                    candidate.LastReversalError = null;
                    candidate.UpdatedAt = candidate.LastReversalAttemptAt.Value;
                    await _context.SaveChangesAsync(cancellationToken);

                    string? completedReversalId = null;
                    try
                    {
                        completedReversalId = await _gateway.CreateTransferReversalAsync(candidate.StripeTransferId,
                            incrementalReversalAmount,
                            $"rent-transfer-reversal:{candidate.PaymentIntentId}:{targetReversalAmount}", cancellationToken);
                        await PersistSuccessfulReversalAsync(candidate, completedReversalId,
                            targetReversalAmount, cancellationToken);
                    }
                    catch (DbUpdateConcurrencyException ex) when (!string.IsNullOrWhiteSpace(completedReversalId))
                    {
                        // The provider side effect succeeded. Never misclassify a local merge conflict as a
                        // failed reversal; reload and idempotently merge the confirmed provider result.
                        _logger.LogWarning(ex,
                            "Retrying persistence of successful Stripe reversal for PaymentIntent {PaymentIntentId}",
                            candidate.PaymentIntentId);
                        await PersistSuccessfulReversalAsync(candidate, completedReversalId,
                            targetReversalAmount, cancellationToken);
                    }
                    catch (Exception ex)
                    {
                        candidate.LastReversalError = ex.Message;
                        candidate.UpdatedAt = _timeProvider.GetUtcNow();
                        if (candidate.ReversalAttemptCount >= maxAttempts)
                            candidate.Status = StripeRentPaymentStatus.RecoveryFailed;
                        await _context.SaveChangesAsync(cancellationToken);
                        _logger.LogCritical(ex, "Stripe transfer reversal failed for rent PaymentIntent {PaymentIntentId}; manual recovery may be required", candidate.PaymentIntentId);
                    }
                }
                finally
                {
                    try
                    {
                        if (sqlLossLockHeld)
                        {
                            var lockResource = $"stripe-rent-loss:{candidate.PaymentIntentId}";
                            await _context.Database.ExecuteSqlInterpolatedAsync($@"
DECLARE @releaseResult int;
EXEC @releaseResult = sys.sp_releaseapplock
    @Resource = {lockResource},
    @LockOwner = 'Session';", cancellationToken);
                        }
                    }
                    finally
                    {
                        if (relationalConnectionOpened)
                            await _context.Database.CloseConnectionAsync();
                        gate.Release();
                    }
                }
            }
        }

        private async Task PersistSuccessfulReversalAsync(StripeRentPayment candidate, string reversalId,
            long targetReversalAmount, CancellationToken cancellationToken)
        {
            // Reload after Stripe returns so a concurrent larger refund/dispute cannot be overwritten.
            await _context.Entry(candidate).ReloadAsync(cancellationToken);
            candidate.StripeTransferReversalId = reversalId;
            candidate.ReversedAmountCents = Math.Max(candidate.ReversedAmountCents, targetReversalAmount);
            candidate.ReversalTargetAmountCents = 0;
            candidate.ReversalIncrementAmountCents = 0;
            candidate.ReversalAttemptCount = 0;
            var latestTarget = Math.Min(candidate.AmountCents,
                checked(candidate.RefundedAmountCents + candidate.DisputedAmountCents));
            var reversalFundedRecoveredDispute = candidate.DisputeRecoveredAmountCents > 0
                && targetReversalAmount > candidate.RefundedAmountCents;
            if (reversalFundedRecoveredDispute)
            {
                candidate.Status = StripeRentPaymentStatus.RecoveryFailed;
                candidate.RiskReason = "Won dispute recovery followed a transfer reversal; manual destination funding and reconciliation are required.";
            }
            else
            {
                candidate.Status = latestTarget > candidate.ReversedAmountCents
                    ? StripeRentPaymentStatus.ReversalPending
                    : candidate.ReversedAmountCents >= candidate.AmountCents
                        ? StripeRentPaymentStatus.Reversed
                        : StripeRentPaymentStatus.Blocked;
            }
            candidate.UpdatedAt = _timeProvider.GetUtcNow();
            await _context.SaveChangesAsync(cancellationToken);
        }

        private async Task<IDbContextTransaction?> BeginRefundReconciliationTransactionAsync(
            string paymentIntentId, CancellationToken cancellationToken)
        {
            if (!_context.Database.IsRelational()) return null;
            var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable,
                cancellationToken);
            try
            {
                if (_context.Database.IsSqlServer())
                {
                    var resource = $"stripe-rent-loss:{paymentIntentId}";
                    await _context.Database.ExecuteSqlInterpolatedAsync($@"
DECLARE @lockResult int;
EXEC @lockResult = sys.sp_getapplock
    @Resource = {resource},
    @LockMode = 'Exclusive',
    @LockOwner = 'Transaction',
    @LockTimeout = 15000;
IF @lockResult < 0
    THROW 51000, 'Could not acquire the Stripe rent refund-reconciliation lock.', 1;", cancellationToken);
                }
                return transaction;
            }
            catch
            {
                await transaction.DisposeAsync();
                throw;
            }
        }

        private async Task<IDbContextTransaction?> BeginCollectionReservationTransactionAsync(long leaseId,
            string destinationStripeAccountId, CancellationToken cancellationToken)
        {
            if (!_context.Database.IsRelational()) return null;

            var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
            try
            {
                var resources = new[]
                {
                    $"stripe-rent-reservation:lease:{leaseId}",
                    $"stripe-rent-reservation:payee:{Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(destinationStripeAccountId)))}"
                };
                foreach (var resource in resources)
                {
                    await _context.Database.ExecuteSqlInterpolatedAsync($@"
DECLARE @lockResult int;
EXEC @lockResult = sys.sp_getapplock
    @Resource = {resource},
    @LockMode = 'Exclusive',
    @LockOwner = 'Transaction',
    @LockTimeout = 15000;
IF @lockResult < 0
    THROW 51000, 'Could not acquire the rent-payment reservation lock.', 1;", cancellationToken);
                }
                return transaction;
            }
            catch
            {
                await transaction.DisposeAsync();
                throw;
            }
        }

        private async Task EnsureAmountAvailableAsync(long leaseId, long organizationId, long tenantUserId,
            long requestedCents, long? excludedPaymentId, CancellationToken cancellationToken)
        {
            var validLease = await _context.Leases.AnyAsync(l => l.Id == leaseId && l.OrganizationId == organizationId
                && !l.IsDeleted && l.IsActive, cancellationToken);
            if (!validLease) throw new InvalidOperationException("Lease is not active in the authorized organization.");
            var activeMembership = await _context.TenantLeases.AnyAsync(x => x.LeaseId == leaseId
                && x.Tenant.UserId == tenantUserId && x.Tenant.OrganizationId == organizationId && !x.Tenant.IsDeleted,
                cancellationToken);
            if (!activeMembership) throw new UnauthorizedAccessException("The authenticated tenant is not linked to this active lease.");
            var outstanding = await RentCalculator.GetOutstandingForTenantAsync(_context, leaseId);
            // Created aggregates reserve rent not yet represented by authoritative accounting rows.
            // Held/pending aggregates already have completed allocations and must not be subtracted twice.
            var reserved = await _context.StripeRentPayments.Where(x => x.LeaseId == leaseId && x.Id != excludedPaymentId
                    && x.Status == StripeRentPaymentStatus.Created)
                .SumAsync(x => x.AmountCents, cancellationToken);
            var availableCents = Math.Max(0, checked((long)decimal.Round(outstanding * 100m, 0, MidpointRounding.AwayFromZero)) - reserved);
            if (requestedCents > availableCents)
                throw new InvalidOperationException("Requested rent payment exceeds the server-calculated outstanding balance after existing reservations.");
        }

        private async Task<decimal> GetAllocatedAmountAsync(StripeRentPayment payment, CancellationToken cancellationToken)
        {
            var allocatedPayments = await _context.Payments.Where(x => x.LeaseId == payment.LeaseId
                    && (x.StripePaymentIntentId == payment.PaymentIntentId || x.Reference == payment.PaymentIntentId) && x.Status == "Completed")
                .SumAsync(x => x.Amount, cancellationToken);
            var allocatedDeposits = await _context.Deposits.Where(x => x.LeaseId == payment.LeaseId && x.Notes != null
                    && x.Notes.Contains(payment.PaymentIntentId) && x.RefundedDate == null)
                .SumAsync(x => x.Amount, cancellationToken);
            return allocatedPayments + allocatedDeposits;
        }

        private static void EnsureReplayMatches(StripeRentPayment existing, CreateStripeRentPaymentCommand command)
        {
            if (existing.LeaseId != command.LeaseId || existing.OrganizationId != command.OrganizationId
                || existing.TenantUserId != command.TenantUserId || existing.AmountCents != command.AmountCents
                || existing.DestinationStripeAccountId != command.DestinationStripeAccountId)
                throw new InvalidOperationException("Payment operation ID was already used with different authorization data.");
        }

        private void EnsurePaymentsEnabled()
        {
            if (_configuration.GetValue<bool?>("Stripe:RentPaymentsEnabled") != true) throw new RentPaymentsDisabledException();
        }

        private async Task EnsureCollectionPayeeEligibleAsync(long paymentId, long leaseId, long organizationId,
            long tenantUserId, long amountCents, string currency, string destinationStripeAccountId,
            CancellationToken cancellationToken)
        {
            var decision = await _risk.EvaluateCollectionPayeeAsync(new StripeRentPayment
            {
                Id = paymentId,
                LeaseId = leaseId,
                OrganizationId = organizationId,
                TenantUserId = tenantUserId,
                AmountCents = amountCents,
                Currency = currency,
                DestinationStripeAccountId = destinationStripeAccountId
            }, cancellationToken);
            if (decision.Approved) return;

            _logger.LogWarning(
                "Blocked rent collection for lease {LeaseId}, organization {OrganizationId}, destination {DestinationStripeAccountId}: {Reason}",
                leaseId, organizationId, destinationStripeAccountId, decision.Reason ?? "Connected payee eligibility was denied.");
            throw new InvalidOperationException("The lease's connected payee is not eligible for rent collection.");
        }

        private static void ValidateMoney(long amountCents, string currency)
        {
            if (amountCents <= 0 || amountCents > 10_000_000) throw new ArgumentOutOfRangeException(nameof(amountCents));
            if (!string.Equals(currency, "usd", StringComparison.OrdinalIgnoreCase)) throw new ArgumentException("Only USD rent payments are supported.", nameof(currency));
        }

        private static StripeRentIntentRequest BuildIntentRequest(string operationId, long leaseId, long organizationId, long tenantUserId, long amountCents, string currency, string? description) =>
            new(amountCents, currency.ToLowerInvariant(), description ?? $"Payment for lease #{leaseId}", $"rent:{operationId}",
                $"rent-payment:{operationId}", new Dictionary<string, string> { ["operationId"] = operationId,
                    ["leaseId"] = leaseId.ToString(), ["organizationId"] = organizationId.ToString(),
                    ["tenantUserId"] = tenantUserId.ToString(), ["paymentFlow"] = "separate_charges_and_transfers" });
    }
}
