using System.Data;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.ShortStayStripe;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.ShortStay;

// Construct only after authenticating the webhook signature against the appropriate Stripe endpoint.
// This is NOT an HTTP request DTO. Event type is a hint; retrieved provider state is authoritative.
public enum VerifiedShortStayPaymentKind { Succeeded, Canceled, PaymentFailed, Processing, Disputed }
public sealed record VerifiedShortStayPaymentEvent(VerifiedShortStayPaymentKind Kind, string AccountId,
    string PaymentIntentId, string ReservationCode);
public sealed record ShortStayReconciliationOutcome(int StatusCode, string Reason);

public sealed class ShortStayPaymentReconciliationService(DataContext db,
    IShortStayDirectChargeGateway gateway, TimeProvider clock)
{
    public async Task<ShortStayReconciliationOutcome> ReconcileAsync(VerifiedShortStayPaymentEvent e,
        CancellationToken ct = default)
    {
        if (e is null || !Enum.IsDefined(e.Kind) || string.IsNullOrWhiteSpace(e.AccountId) ||
            string.IsNullOrWhiteSpace(e.PaymentIntentId) || string.IsNullOrWhiteSpace(e.ReservationCode))
            return new(409, "payment_mismatch");
        try
        {
            // Never retrieve against an account supplied by an event until it matches the stored account.
            var matches = await db.ShortStayReservations.AsNoTracking()
                .Where(r => r.PublicCode == e.ReservationCode && r.DestinationStripeAccountId == e.AccountId)
                .Take(2).ToListAsync(ct);
            if (matches.Count != 1) return new(409, "payment_mismatch");
            var preliminary = matches[0];
            if (preliminary.StripePaymentIntentId is not null && preliminary.StripePaymentIntentId != e.PaymentIntentId)
                return new(409, "payment_mismatch");
            var snapshot = await gateway.RetrieveAsync(preliminary.DestinationStripeAccountId, e.PaymentIntentId, ct);
            if (snapshot.PaymentIntentId != e.PaymentIntentId || snapshot.AccountId != preliminary.DestinationStripeAccountId ||
                snapshot.AmountCents != preliminary.TotalCents || snapshot.Currency != preliminary.Currency ||
                snapshot.ReservationCode != preliminary.PublicCode || snapshot.ClientSecret is not null ||
                snapshot.Status is not ("succeeded" or "canceled" or "requires_payment_method" or "requires_action" or "processing"))
                return new(409, "payment_mismatch");
            // Provider status must be compatible with the claimed kind. Stale events cannot undo a success.
            if (e.Kind switch
                {
                    VerifiedShortStayPaymentKind.Succeeded => snapshot.Status != "succeeded",
                    VerifiedShortStayPaymentKind.Canceled => snapshot.Status != "canceled",
                    VerifiedShortStayPaymentKind.PaymentFailed => snapshot.Status is not ("requires_payment_method" or "requires_action" or "processing"),
                    VerifiedShortStayPaymentKind.Processing => snapshot.Status is not ("processing" or "requires_action"),
                    _ => true // Disputes require a separate authoritative charge/dispute retrieval boundary.
                }) return new(409, "payment_mismatch");

            db.ChangeTracker.Clear();
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            if (db.Database.IsSqlServer())
                await db.Database.SqlQueryRaw<long>(
                    "SELECT Id AS Value FROM [property].[Units] WITH (UPDLOCK, HOLDLOCK) WHERE Id = {0}", preliminary.UnitId)
                    .SingleOrDefaultAsync(ct);
            var r = await db.ShortStayReservations.SingleOrDefaultAsync(x => x.Id == preliminary.Id, ct);
            if (r is null || r.PublicCode != preliminary.PublicCode || r.DestinationStripeAccountId != snapshot.AccountId ||
                r.TotalCents != snapshot.AmountCents || r.Currency != snapshot.Currency ||
                r.StripePaymentIntentId is not null && r.StripePaymentIntentId != snapshot.PaymentIntentId)
                return new(409, "payment_mismatch");
            // Recovery from create->DB attach race is allowed only for this uniquely correlated pending operation.
            if (r.StripePaymentIntentId is null)
            {
                if (r.Status != ShortStayReservationStatus.PendingPayment ||
                    await db.ShortStayReservations.CountAsync(x => x.PublicCode == r.PublicCode &&
                        x.DestinationStripeAccountId == r.DestinationStripeAccountId && x.TotalCents == r.TotalCents, ct) != 1 ||
                    await db.ShortStayReservations.AnyAsync(x => x.StripePaymentIntentId == snapshot.PaymentIntentId, ct))
                    return new(409, "payment_mismatch");
                r.AttachPaymentIntent(snapshot.PaymentIntentId, clock.GetUtcNow());
            }
            var claims = await db.ShortStayOccupancyClaims.Where(c => c.ReservationId == r.Id).ToListAsync(ct);
            var nights = r.CheckOutDate.DayNumber - r.CheckInDate.DayNumber;
            var exactClaims = nights is >= 1 and <= 30 && claims.Count == nights &&
                claims.All(c => c.UnitId == r.UnitId && c.Date >= r.CheckInDate && c.Date < r.CheckOutDate) &&
                claims.Select(c => c.Date).Distinct().Count() == nights;
            var now = clock.GetUtcNow();
            ShortStayReconciliationOutcome outcome;
            if (snapshot.Status == "succeeded")
            {
                if (r.Status == ShortStayReservationStatus.Confirmed)
                    outcome = exactClaims ? new(200, "confirmed") : new(409, "claim_conflict");
                // The retrieved intent establishes current success, not *when* it succeeded. Stripe's
                // intent creation time is not a paid-at time. Without authoritative paid-at evidence,
                // only reconciliation before hold expiry may confirm; delayed webhooks fail closed.
                else if (r.Status is ShortStayReservationStatus.PendingPayment or ShortStayReservationStatus.Processing &&
                         exactClaims && now < r.HoldExpiresAtUtc)
                { r.Reconcile(ShortStayReservationStatus.Confirmed, now); outcome = new(200, "confirmed"); }
                else if (r.Status is ShortStayReservationStatus.PendingPayment or ShortStayReservationStatus.Processing or
                         ShortStayReservationStatus.Failed or ShortStayReservationStatus.Expired)
                {
                    // No blind refund: a durable RefundRequired flag holds manual review/retry responsibility.
                    // Never reclaim nights or confirm a payment after release/conflict.
                    r.Reconcile(ShortStayReservationStatus.RefundRequired, now);
                    outcome = new(202, "refund_required");
                }
                else outcome = new(202, "refund_required");
            }
            else if (snapshot.Status == "canceled")
            {
                if (r.Status is ShortStayReservationStatus.PendingPayment or ShortStayReservationStatus.Processing && exactClaims)
                {
                    r.Reconcile(ShortStayReservationStatus.Failed, now);
                    db.ShortStayOccupancyClaims.RemoveRange(claims);
                }
                outcome = r.Status == ShortStayReservationStatus.Failed ? new(200, "failed") : new(409, "terminal_state");
            }
            else
            {
                if (r.Status is ShortStayReservationStatus.PendingPayment && e.Kind == VerifiedShortStayPaymentKind.Processing)
                    r.Reconcile(ShortStayReservationStatus.Processing, now);
                outcome = r.Status is ShortStayReservationStatus.PendingPayment or ShortStayReservationStatus.Processing
                    ? new(200, "retryable") : new(409, "terminal_state");
            }
            if (outcome.StatusCode is 200 or 202)
            {
                await db.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);
            }
            return outcome;
        }
        catch (Exception) when (!ct.IsCancellationRequested)
        {
            db.ChangeTracker.Clear();
            return new(503, "reconciliation_unavailable");
        }
    }
}
