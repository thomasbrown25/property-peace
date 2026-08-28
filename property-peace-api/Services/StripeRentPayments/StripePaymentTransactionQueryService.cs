using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Stripe;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.StripeRentPayments
{
    public interface IStripePaymentTransactionQueryService
    {
        Task<IReadOnlyList<StripePaymentTransactionDto>> ListAsync(
            long organizationId,
            long? propertyId,
            CancellationToken cancellationToken = default);
    }

    /// <summary>
    /// Reads the durable, webhook-maintained Property Peace payment ledger. The list endpoint intentionally
    /// does not issue one Stripe API request per row: provider events update StripeRentPayment, and a single
    /// unavailable historical PaymentIntent must never make the organization's complete history unavailable.
    /// </summary>
    public sealed class StripePaymentTransactionQueryService(DataContext context) : IStripePaymentTransactionQueryService
    {
        public async Task<IReadOnlyList<StripePaymentTransactionDto>> ListAsync(
            long organizationId,
            long? propertyId,
            CancellationToken cancellationToken = default)
        {
            var query = context.StripeRentPayments
                .AsNoTracking()
                .Include(payment => payment.Lease!)
                    .ThenInclude(lease => lease.Unit)
                    .ThenInclude(unit => unit.Property)
                .Include(payment => payment.Lease!)
                    .ThenInclude(lease => lease.TenantLeases)
                    .ThenInclude(tenantLease => tenantLease.Tenant)
                .Where(payment => payment.OrganizationId == organizationId
                    && payment.Lease != null
                    && payment.Lease.Unit.Property.OrganizationId == organizationId);

            if (propertyId.HasValue)
                query = query.Where(payment => payment.Lease!.Unit.PropertyId == propertyId.Value);

            var localPayments = await query
                .OrderByDescending(payment => payment.CreatedAt)
                .ToListAsync(cancellationToken);

            return localPayments.Select(payment =>
            {
                var lease = payment.Lease!;
                var property = lease.Unit.Property;
                var tenant = lease.TenantLeases
                    .OrderByDescending(tenantLease => tenantLease.Tenant.UserId == payment.TenantUserId)
                    .ThenBy(tenantLease => tenantLease.TenantId)
                    .Select(tenantLease => $"{tenantLease.Tenant.Firstname} {tenantLease.Tenant.Lastname}".Trim())
                    .FirstOrDefault(name => !string.IsNullOrWhiteSpace(name)) ?? "Renter";

                return new StripePaymentTransactionDto
                {
                    PaymentIntentId = payment.PaymentIntentId,
                    LeaseId = payment.LeaseId,
                    PropertyId = property.Id,
                    PropertyName = string.IsNullOrWhiteSpace(property.Name)
                        ? property.StreetAddress ?? $"Property {property.Id}"
                        : property.Name,
                    UnitName = lease.Unit.Name,
                    TenantName = tenant,
                    AmountCents = payment.AmountCents,
                    Currency = payment.Currency,
                    Status = GetDisplayStatus(payment),
                    PaidAt = payment.HeldAt ?? payment.CreatedAt,
                    ProcessedAt = payment.HeldAt,
                    PaymentMethodType = payment.PaymentMethodType
                };
            }).OrderByDescending(row => row.PaidAt).ToList();
        }

        private static string GetDisplayStatus(StripeRentPayment payment)
        {
            if (payment.DisputedAmountCents > payment.DisputeRecoveredAmountCents) return "disputed";
            if (payment.RefundedAmountCents >= payment.AmountCents) return "refunded";
            if (payment.RefundedAmountCents > 0) return "partially_refunded";

            return payment.Status switch
            {
                StripeRentPaymentStatus.Failed => "failed",
                StripeRentPaymentStatus.Canceled => "canceled",
                StripeRentPaymentStatus.Blocked => "failed",
                StripeRentPaymentStatus.Created => "requires_payment_method",
                StripeRentPaymentStatus.Processing => "processing",
                _ => "succeeded"
            };
        }
    }
}
