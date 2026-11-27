using System.Security.Cryptography;
using System.Text;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.StripeRentPayments;

public interface IStripeConnectOAuthReplayStore
{
    /// <summary>
    /// Records an OAuth response exactly once. Returns false when either its code or state nonce was previously used.
    /// </summary>
    Task<bool> TryConsumeAsync(string code, string stateNonce, CancellationToken cancellationToken);
}

public sealed class StripeConnectOAuthReplayStore(DataContext db, TimeProvider timeProvider) : IStripeConnectOAuthReplayStore
{
    private static readonly TimeSpan Retention = TimeSpan.FromHours(1);
    private static readonly TimeSpan PruneGracePeriod = TimeSpan.FromDays(1);

    public async Task<bool> TryConsumeAsync(string code, string stateNonce, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(stateNonce))
            return false;

        var now = timeProvider.GetUtcNow().UtcDateTime;
        await PruneExpiredAsync(now, cancellationToken);

        var replay = new StripeConnectOAuthReplay
        {
            CodeHash = Hash(code),
            StateNonceHash = Hash(stateNonce),
            ConsumedAt = now,
            // Retain consumed fingerprints for at least an hour even though Stripe codes expire sooner.
            ExpiresAt = now.Add(Retention)
        };

        db.StripeConnectOAuthReplays.Add(replay);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (DbUpdateException exception) when (IsUniqueConstraintViolation(exception))
        {
            db.Entry(replay).State = EntityState.Detached;
            return false;
        }
    }

    private async Task PruneExpiredAsync(DateTime now, CancellationToken cancellationToken)
    {
        // Leave an extra day of history beyond the one-hour replay window. This bounds storage without
        // weakening replay protection during a transient clock or cleanup issue.
        var cutoff = now.Subtract(PruneGracePeriod);
        if (db.Database.IsRelational())
        {
            await db.StripeConnectOAuthReplays
                .Where(x => x.ExpiresAt < cutoff)
                .ExecuteDeleteAsync(cancellationToken);
            return;
        }

        var expired = await db.StripeConnectOAuthReplays
            .Where(x => x.ExpiresAt < cutoff)
            .ToListAsync(cancellationToken);
        if (expired.Count == 0) return;

        db.StripeConnectOAuthReplays.RemoveRange(expired);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // A different server already cleaned the same expired records. They are deliberately
            // outside the replay window, so continue with the durable claim below.
            db.ChangeTracker.Clear();
        }
    }

    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    private static bool IsUniqueConstraintViolation(DbUpdateException exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
        {
            if (current is SqlException { Number: 2601 or 2627 }) return true;
            // Keep the runtime service free of a SQLite dependency while allowing relational test coverage.
            if (current.GetType().FullName == "Microsoft.Data.Sqlite.SqliteException" &&
                current.Message.Contains("UNIQUE constraint failed", StringComparison.OrdinalIgnoreCase)) return true;
        }

        return false;
    }
}
