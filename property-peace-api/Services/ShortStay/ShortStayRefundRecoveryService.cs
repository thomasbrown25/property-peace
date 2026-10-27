using System.Data;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.ShortStayStripe;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace brownstone_hub_api.Services.ShortStay;

public sealed class ShortStayRefundRecoveryService(DataContext db, IShortStayDirectChargeGateway gateway,
    TimeProvider clock, ILogger<ShortStayRefundRecoveryService>? logger = null)
{
    private static readonly TimeSpan ReplayWindow = TimeSpan.FromHours(12);

    public async Task<int> RunBatchAsync(int limit = 10, CancellationToken ct = default)
    {
        if (limit is < 1 or > 25) throw new ArgumentOutOfRangeException(nameof(limit));
        var ids = await db.ShortStayReservations.AsNoTracking()
            .Where(r => r.Status == ShortStayReservationStatus.RefundRequired)
            .OrderBy(r => r.Id).Select(r => r.Id).Take(limit).ToListAsync(ct);
        var handled = 0;
        foreach (var id in ids)
        {
            try { if (await RecoverAsync(id, ct)) handled++; }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                db.ChangeTracker.Clear();
                logger?.LogWarning("Short-stay refund recovery deferred for reservation {ReservationId} ({ErrorType})", id, ex.GetType().Name);
            }
        }
        var review = await db.ShortStayRefundAttempts.AsNoTracking()
            .CountAsync(x => x.Status == ShortStayRefundAttemptStatus.ManualReview &&
                x.Reservation.Status == ShortStayReservationStatus.RefundRequired, ct);
        if (review > 0) logger?.LogError("Short-stay refunds require manual review: {Count} unresolved reservations; occupancy claims remain held", review);
        return handled;
    }

    private async Task LockUnit(long unitId, CancellationToken ct)
    {
        if (db.Database.IsSqlServer())
            await db.Database.SqlQueryRaw<long>(
                "SELECT Id AS Value FROM [property].[Units] WITH (UPDLOCK, HOLDLOCK) WHERE Id = {0}", unitId)
                .SingleOrDefaultAsync(ct);
    }

    public async Task<bool> RecoverAsync(long id, CancellationToken ct = default)
    {
        var preliminary = await db.ShortStayReservations.AsNoTracking().SingleOrDefaultAsync(r => r.Id == id, ct);
        if (preliminary?.Status != ShortStayReservationStatus.RefundRequired) return false;
        // Commit the identity BEFORE even considering an external POST. The unit lock serializes
        // this insert against other workers and the unique indexes defend the database boundary.
        db.ChangeTracker.Clear();
        await using (var seed = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct))
        {
            await LockUnit(preliminary.UnitId, ct);
            var r = await db.ShortStayReservations.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (r?.Status != ShortStayReservationStatus.RefundRequired || r.UnitId != preliminary.UnitId ||
                string.IsNullOrWhiteSpace(r.StripePaymentIntentId) || string.IsNullOrWhiteSpace(r.OperationId)) return false;
            if (!await db.ShortStayRefundAttempts.AnyAsync(a => a.ReservationId == id, ct))
            {
                db.ShortStayRefundAttempts.Add(new ShortStayRefundAttempt
                {
                    ReservationId = id, PaymentIntentId = r.StripePaymentIntentId,
                    IdempotencyKey = $"shortstay:{r.OperationId}:refund:v1",
                    CreatedAtUtc = clock.GetUtcNow(), Status = ShortStayRefundAttemptStatus.Ready
                });
                await db.SaveChangesAsync(ct);
            }
            await seed.CommitAsync(ct);
        }
        db.ChangeTracker.Clear();
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        await LockUnit(preliminary.UnitId, ct);
        var reservation = await db.ShortStayReservations.SingleOrDefaultAsync(x => x.Id == id, ct);
        var attempt = await db.ShortStayRefundAttempts.SingleAsync(x => x.ReservationId == id, ct);
        if (reservation?.Status != ShortStayReservationStatus.RefundRequired || reservation.UnitId != preliminary.UnitId ||
            reservation.StripePaymentIntentId != attempt.PaymentIntentId ||
            attempt.Status == ShortStayRefundAttemptStatus.Succeeded) return false;
        var account = reservation.DestinationStripeAccountId;
        var intent = attempt.PaymentIntentId;
        var snapshot = await gateway.RetrieveAsync(account, intent, ct);
        if (snapshot.AccountId != account || snapshot.PaymentIntentId != intent || snapshot.ClientSecret is not null ||
            snapshot.AmountCents != reservation.TotalCents || snapshot.Currency != reservation.Currency ||
            snapshot.ReservationCode != reservation.PublicCode || snapshot.Status != "succeeded") return false;

        var refunds = await gateway.ListRefundsAsync(account, intent, ct);
        if (refunds.Count == 1 && refunds[0].Status == "succeeded" &&
            refunds[0].AmountCents == reservation.TotalCents && refunds[0].AccountId == account &&
            refunds[0].PaymentIntentId == intent && !string.IsNullOrWhiteSpace(refunds[0].RefundId))
        {
            db.ShortStayOccupancyClaims.RemoveRange(await db.ShortStayOccupancyClaims.Where(c => c.ReservationId == id).ToListAsync(ct));
            reservation.MarkRefunded(clock.GetUtcNow());
            attempt.Status = ShortStayRefundAttemptStatus.Succeeded;
            attempt.ManualReviewAtUtc = null;
        }
        else if (refunds.Count == 1 && refunds[0].Status == "pending" &&
            refunds[0].AmountCents == reservation.TotalCents && refunds[0].AccountId == account &&
            refunds[0].PaymentIntentId == intent && !string.IsNullOrWhiteSpace(refunds[0].RefundId))
        {
            if (attempt.Status != ShortStayRefundAttemptStatus.ManualReview)
                attempt.Status = ShortStayRefundAttemptStatus.Pending;
        }
        else if (refunds.Count != 0)
            Review();
        else if (attempt.Status == ShortStayRefundAttemptStatus.ManualReview)
            return false;
        else if (attempt.FirstAttemptAtUtc is { } first &&
                 (clock.GetUtcNow() < first || clock.GetUtcNow() - first >= ReplayWindow))
            Review();
        else
        {
            var now = clock.GetUtcNow();
            attempt.FirstAttemptAtUtc ??= now;
            attempt.LastAttemptAtUtc = now;
            attempt.AttemptCount++;
            // Persist the dispatch timestamp before the POST. Releasing the lock here would permit
            // two replicas to POST concurrently, so keep the unit lock through the provider call;
            // commit the timestamp in a separate transaction first, then reacquire it.
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            db.ChangeTracker.Clear();
            await using var dispatch = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            await LockUnit(preliminary.UnitId, ct);
            var current = await db.ShortStayReservations.SingleAsync(x => x.Id == id, ct);
            var persisted = await db.ShortStayRefundAttempts.SingleAsync(x => x.ReservationId == id, ct);
            if (current.Status != ShortStayReservationStatus.RefundRequired || current.StripePaymentIntentId != persisted.PaymentIntentId ||
                persisted.Status is ShortStayRefundAttemptStatus.ManualReview or ShortStayRefundAttemptStatus.Succeeded ||
                clock.GetUtcNow() < persisted.FirstAttemptAtUtc || clock.GetUtcNow() - persisted.FirstAttemptAtUtc >= ReplayWindow)
                return false;
            // Reinspect after reacquiring: another worker may have posted during the commit gap.
            var latest = await gateway.ListRefundsAsync(account, intent, ct);
            if (latest.Count != 0)
            {
                await dispatch.CommitAsync(ct);
                db.ChangeTracker.Clear();
                return true;
            }
            await gateway.RefundAsync(account, intent, current.TotalCents, persisted.IdempotencyKey, ct);
            await dispatch.CommitAsync(ct);
            db.ChangeTracker.Clear();
            return true;
        }
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        if (attempt.Status == ShortStayRefundAttemptStatus.ManualReview)
            logger?.LogError("Short-stay refund requires manual review for reservation {ReservationId}; claims remain held", id);
        return true;

        void Review()
        {
            attempt.Status = ShortStayRefundAttemptStatus.ManualReview;
            attempt.ManualReviewAtUtc = clock.GetUtcNow();
        }
    }
}
