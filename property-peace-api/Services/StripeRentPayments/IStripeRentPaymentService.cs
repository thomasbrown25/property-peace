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
        Task MarkSucceededAsync(StripeRentPaymentSucceeded succeeded, CancellationToken cancellationToken = default);
        Task MarkFailedAsync(string paymentIntentId, string reason, CancellationToken cancellationToken = default);
        Task MarkCanceledAsync(string paymentIntentId, string reason, CancellationToken cancellationToken = default);
        Task MarkBlockedAsync(string? paymentIntentId, string? stripeChargeId, StripeRentPaymentBlockKind kind,
            string eventObjectId, string reason, long? blockedAmountCents = null, CancellationToken cancellationToken = default);
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
    }

    public sealed class StripeRentRiskService(DataContext context) : IStripeRentRiskService
    {
        public async Task<RentTransferRiskDecision> EvaluateAsync(StripeRentPayment payment, CancellationToken cancellationToken = default)
        {
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
    }
}
