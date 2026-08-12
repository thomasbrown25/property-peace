using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.StripeRentPayments
{
    public sealed record CreateStripeRentPaymentCommand(
        long LeaseId,
        long OrganizationId,
        long TenantUserId,
        string OperationId,
        long AmountCents,
        string Currency,
        string DestinationStripeAccountId,
        string? Description);

    public sealed record UpdateStripeRentPaymentCommand(
        string PaymentIntentId,
        long LeaseId,
        long TenantUserId,
        long AmountCents,
        string? Description);

    public sealed record StripeRentPaymentSucceeded(
        string PaymentIntentId,
        string? StripeChargeId,
        string PaymentMethodType,
        DateTimeOffset SucceededAt);

    public sealed record StripeRentPaymentSettlementAuthority(
        string PaymentIntentId,
        string? StripeChargeId,
        long AmountCents,
        string Currency,
        long LeaseId,
        long OrganizationId,
        long TenantUserId,
        string OperationId,
        DateTimeOffset SucceededAt);

    public enum StripeRentPaymentBlockKind { Refund, Dispute }

    public sealed record StripeRentPaymentClientResult(string PaymentIntentId, string ClientSecret);

    public sealed class RentPaymentsDisabledException : InvalidOperationException
    {
        public RentPaymentsDisabledException() : base("Online rent payments are disabled.") { }
    }

    public interface IStripeRentPaymentService
    {
        Task<StripeRentPaymentClientResult> CreateAsync(CreateStripeRentPaymentCommand command, CancellationToken cancellationToken = default);
        Task<StripeRentPaymentClientResult> UpdateAsync(UpdateStripeRentPaymentCommand command, CancellationToken cancellationToken = default);
        Task ValidateSucceededAsync(StripeRentPaymentSettlementAuthority authority, CancellationToken cancellationToken = default);
        Task<string> ResolveSucceededPaymentMethodTypeAsync(string paymentIntentId, CancellationToken cancellationToken = default);
        Task MarkSucceededAsync(StripeRentPaymentSucceeded succeeded, CancellationToken cancellationToken = default);
        Task MarkFailedAsync(string paymentIntentId, string reason, CancellationToken cancellationToken = default);
        Task MarkCanceledAsync(string paymentIntentId, string reason, CancellationToken cancellationToken = default);
        Task MarkBlockedAsync(string? paymentIntentId, string? stripeChargeId, StripeRentPaymentBlockKind kind,
            string eventObjectId, string reason, long? blockedAmountCents = null, CancellationToken cancellationToken = default);
        Task ReconcileRefundExposureAsync(string paymentIntentId, string stripeChargeId, string refundId,
            string reason, long authoritativeRefundedAmountCents, CancellationToken cancellationToken = default);
        Task<int> ProcessEligibleTransfersAsync(CancellationToken cancellationToken = default);
    }

    public sealed record RentTransferRiskDecision(bool Approved, string? Reason)
    {
        public static RentTransferRiskDecision Allow() => new(true, null);
        public static RentTransferRiskDecision Deny(string reason) => new(false, reason);
    }

    public interface IStripeRentRiskService
    {
        Task<RentTransferRiskDecision> EvaluateAsync(StripeRentPayment payment, CancellationToken cancellationToken = default);
        Task<RentTransferRiskDecision> EvaluatePayeeAsync(StripeRentPayment payment, CancellationToken cancellationToken = default);
        Task<RentTransferRiskDecision> EvaluateCollectionPayeeAsync(StripeRentPayment payment, CancellationToken cancellationToken = default);
    }

    public sealed class StripeRentRiskService : IStripeRentRiskService
    {
        private readonly DataContext context;
        private readonly IStripeConnectedAccountGateway? _connectedAccountGateway;
        private readonly IConfiguration? _configuration;
        private readonly TimeProvider _timeProvider;
        private readonly bool _enforceConnectedPayeeGate;

        // Retained for focused legacy accounting tests. Production DI resolves the fully injected
        // constructor below and always enforces the connected-payee gate.
        public StripeRentRiskService(DataContext context)
        {
            this.context = context;
            _timeProvider = TimeProvider.System;
        }

        public StripeRentRiskService(DataContext context, IStripeConnectedAccountGateway connectedAccountGateway,
            IConfiguration configuration, TimeProvider timeProvider)
        {
            this.context = context;
            _connectedAccountGateway = connectedAccountGateway;
            _configuration = configuration;
            _timeProvider = timeProvider;
            _enforceConnectedPayeeGate = true;
        }

        public async Task<RentTransferRiskDecision> EvaluateAsync(StripeRentPayment payment, CancellationToken cancellationToken = default)
        {
            if (_enforceConnectedPayeeGate)
            {
                var payeeDecision = await EvaluatePayeeAsync(payment, cancellationToken);
                if (!payeeDecision.Approved) return payeeDecision;
            }
            if (string.IsNullOrWhiteSpace(payment.DestinationStripeAccountId))
                return RentTransferRiskDecision.Deny("Destination account snapshot is missing.");
            if (string.IsNullOrWhiteSpace(payment.StripeChargeId))
                return RentTransferRiskDecision.Deny("Source charge is missing.");
            if (payment.RefundedAt.HasValue || payment.DisputedAt.HasValue)
                return RentTransferRiskDecision.Deny("The source charge was refunded, returned, or disputed.");
            if (payment.AmountCents <= 0 || !string.Equals(payment.Currency, "usd", StringComparison.OrdinalIgnoreCase))
                return RentTransferRiskDecision.Deny("Transfer amount or currency is invalid.");

            var relatedPayments = context.Payments.Where(
                x => x.StripePaymentIntentId == payment.PaymentIntentId || x.Reference == payment.PaymentIntentId);
            var disputed = await relatedPayments.AnyAsync(
                x => x.Status == "Disputed" || x.Status == "Failed" || x.Status == "Canceled" || x.Status == "Cancelled",
                cancellationToken);
            if (disputed)
                return RentTransferRiskDecision.Deny("Payment is failed, canceled, returned, or disputed.");

            var completedPaymentAmount = await relatedPayments
                .Where(x => x.Status == "Completed")
                .SumAsync(x => x.Amount, cancellationToken);
            var completedDepositAmount = await context.Deposits
                .Where(x => x.LeaseId == payment.LeaseId
                    && x.Notes != null
                    && x.Notes.Contains(payment.PaymentIntentId)
                    && x.RefundedDate == null)
                .SumAsync(x => x.Amount, cancellationToken);
            var expectedAmount = payment.AmountCents / 100m;
            if (completedPaymentAmount + completedDepositAmount != expectedAmount)
                return RentTransferRiskDecision.Deny("Authoritative completed allocation does not match the captured payment amount.");

            var leaseDestination = await context.Leases
                .Where(l => l.Id == payment.LeaseId && l.OrganizationId == payment.OrganizationId && !l.IsDeleted)
                .Select(l => l.OperatingAccount != null && l.OperatingAccount.IsActive
                    ? l.OperatingAccount.StripeAccountId
                    : l.Unit.Property.OperatingAccount != null && l.Unit.Property.OperatingAccount.IsActive
                        ? l.Unit.Property.OperatingAccount.StripeAccountId
                        : l.Unit.Property.Landlord.StripeAccountEnabled && !l.Unit.Property.Landlord.IsDeleted
                            ? l.Unit.Property.Landlord.StripeAccountId
                            : null)
                .SingleOrDefaultAsync(cancellationToken);
            if (string.IsNullOrWhiteSpace(leaseDestination)
                || !string.Equals(leaseDestination, payment.DestinationStripeAccountId, StringComparison.Ordinal))
                return RentTransferRiskDecision.Deny("The destination account is no longer owned by or eligible for this lease.");

            return RentTransferRiskDecision.Allow();
        }

        public async Task<RentTransferRiskDecision> EvaluateCollectionPayeeAsync(StripeRentPayment payment,
            CancellationToken cancellationToken = default)
        {
            var payeeDecision = await EvaluatePayeeAsync(payment, cancellationToken);
            if (!payeeDecision.Approved) return payeeDecision;

            var currentLeaseDestination = await context.Leases
                .Where(l => l.Id == payment.LeaseId && l.OrganizationId == payment.OrganizationId && !l.IsDeleted && l.IsActive)
                .Select(l => l.OperatingAccount != null && l.OperatingAccount.IsActive
                    ? l.OperatingAccount.StripeAccountId
                    : l.Unit.Property.OperatingAccount != null && l.Unit.Property.OperatingAccount.IsActive
                        ? l.Unit.Property.OperatingAccount.StripeAccountId
                        : l.Unit.Property.Landlord.StripeAccountEnabled && !l.Unit.Property.Landlord.IsDeleted
                            ? l.Unit.Property.Landlord.StripeAccountId
                            : null)
                .SingleOrDefaultAsync(cancellationToken);
            if (string.IsNullOrWhiteSpace(currentLeaseDestination)
                || !string.Equals(currentLeaseDestination, payment.DestinationStripeAccountId, StringComparison.Ordinal))
                return RentTransferRiskDecision.Deny("The connected payee is no longer the active destination for this lease.");

            return RentTransferRiskDecision.Allow();
        }

        public async Task<RentTransferRiskDecision> EvaluatePayeeAsync(StripeRentPayment payment, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(payment.DestinationStripeAccountId))
                return RentTransferRiskDecision.Deny("Destination account snapshot is missing.");

            var review = await context.StripeConnectedPayeeReviews.SingleOrDefaultAsync(
                x => x.StripeAccountId == payment.DestinationStripeAccountId, cancellationToken);
            if (review == null)
                return RentTransferRiskDecision.Deny("Connected payee has no internal review record.");
            if (review.Status != StripePayeeReviewStatus.PayoutApproved || review.ApprovedAt == null
                || !review.PropertyAuthorityAttested)
                return RentTransferRiskDecision.Deny("Connected payee is not internally payout-approved.");
            if (review.ApprovedOrganizationId != payment.OrganizationId)
                return RentTransferRiskDecision.Deny("Connected payee approval does not cover this organization.");
            if (review.InstantPayoutsAllowed || !string.Equals(review.PayoutSchedulePolicy, "manual", StringComparison.OrdinalIgnoreCase))
                return RentTransferRiskDecision.Deny("Connected payee payout policy is not fail-closed manual payout.");

            var hasInitialAuthority = review.UserId.HasValue && review.ApprovedOrganizationId.HasValue &&
                await context.OrganizationMembers.AsNoTracking().AnyAsync(m =>
                    m.UserId == review.UserId.Value &&
                    m.OrganizationId == review.ApprovedOrganizationId.Value &&
                    m.IsActive &&
                    (m.Role == "Owner" || m.Role == "Manager"), cancellationToken);
            if (!hasInitialAuthority)
            {
                await new StripeConnectedPayeeService(context, _timeProvider).SuspendAsync(
                    payment.DestinationStripeAccountId,
                    null,
                    "The approved payee no longer has active owner or manager authority for the approved organization.",
                    cancellationToken);
                return RentTransferRiskDecision.Deny("The approved payee must retain active owner or manager authority for the approved organization.");
            }

            if (_connectedAccountGateway == null)
                return RentTransferRiskDecision.Deny("A fresh Stripe connected-account snapshot is unavailable.");
            StripeConnectedAccountSnapshot snapshot;
            try
            {
                snapshot = await _connectedAccountGateway.GetSnapshotAsync(payment.DestinationStripeAccountId, cancellationToken);
            }
            catch
            {
                return RentTransferRiskDecision.Deny("A fresh Stripe connected-account snapshot could not be retrieved.");
            }
            var maxAgeMinutes = Math.Max(1, _configuration?.GetValue<int?>("Stripe:ConnectedPayeeRisk:SnapshotMaxAgeMinutes") ?? 5);
            var now = _timeProvider.GetUtcNow();
            if (snapshot.RetrievedAt > now.AddMinutes(1) || snapshot.RetrievedAt < now.AddMinutes(-maxAgeMinutes))
                return RentTransferRiskDecision.Deny("Stripe connected-account snapshot is stale.");

            await new StripeConnectedPayeeService(context, _timeProvider).SyncStripeSnapshotAsync(snapshot, null, cancellationToken);
            var restriction = StripeConnectedPayeeService.RestrictionReason(snapshot);
            if (restriction != null) return RentTransferRiskDecision.Deny(restriction);
            if (review.Status != StripePayeeReviewStatus.PayoutApproved)
                return RentTransferRiskDecision.Deny(review.SuspensionReason ?? "Connected payee was suspended during pre-transfer verification.");

            var first90Days = review.CreatedAt.AddDays(90) > now;
            if (first90Days)
            {
                var perPaymentLimit = Math.Max(1L,
                    _configuration?.GetValue<long?>("Stripe:ConnectedPayeeRisk:First90DaysPerPaymentLimitCents") ?? 500_000L);
                if (payment.AmountCents > perPaymentLimit)
                    return RentTransferRiskDecision.Deny("First-90-day connected-payee per-payment limit exceeded.");

                var rollingLimit = Math.Max(1L,
                    _configuration?.GetValue<long?>("Stripe:ConnectedPayeeRisk:First90DaysRollingVolumeLimitCents") ?? 2_000_000L);
                var rollingDays = Math.Max(1,
                    _configuration?.GetValue<int?>("Stripe:ConnectedPayeeRisk:RollingWindowDays") ?? 30);
                var windowStart = now.AddDays(-rollingDays);
                var transferredOrReservedVolume = await context.StripeRentPayments
                    .Where(x => x.Id != payment.Id
                        && x.DestinationStripeAccountId == payment.DestinationStripeAccountId
                        && (x.Status == StripeRentPaymentStatus.Created
                            || (x.StripeChargeId != null && x.HeldAt != null && x.HeldAt >= windowStart)
                            || (x.StripeTransferId != null && x.TransferredAt != null && x.TransferredAt >= windowStart)
                            || x.Status == StripeRentPaymentStatus.TransferPending
                            || x.Status == StripeRentPaymentStatus.TransferReconciliationPending))
                    .SumAsync(x => x.AmountCents, cancellationToken);
                if (checked(transferredOrReservedVolume + payment.AmountCents) > rollingLimit)
                    return RentTransferRiskDecision.Deny("First-90-day connected-payee rolling-volume limit exceeded.");
            }

            // Keep current organization authority as the final database decision in the risk gate.
            // The transfer worker invokes this gate again directly before the Stripe side effect,
            // minimizing the revocation TOCTOU window after all remote snapshot/source work.
            var hasCurrentAuthority = review.UserId.HasValue && await context.OrganizationMembers.AsNoTracking().AnyAsync(member =>
                member.UserId == review.UserId.Value
                && member.OrganizationId == payment.OrganizationId
                && member.IsActive
                && (member.Role == "Owner" || member.Role == "Manager"), cancellationToken);
            if (!hasCurrentAuthority)
            {
                const string reason = "Connected payee is no longer an active owner or manager in the approved organization.";
                await new StripeConnectedPayeeService(context, _timeProvider)
                    .SuspendAsync(review.StripeAccountId, null, reason, cancellationToken);
                return RentTransferRiskDecision.Deny(reason);
            }

            return RentTransferRiskDecision.Allow();
        }
    }
}
