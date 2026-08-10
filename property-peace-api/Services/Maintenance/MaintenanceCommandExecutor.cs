using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace brownstone_hub_api.Services.Maintenance;

public interface IMaintenanceCommandExecutor
{
    Task<MaintenanceApiResult<T>> ExecuteAsync<T>(string idempotencyKey, string operation, string requestPayload,
        Func<CancellationToken, Task<MaintenanceApiResult<T>>> command, CancellationToken cancellationToken = default);
}

public sealed class MaintenanceCommandExecutor(
    DataContext db,
    IMaintenanceActorAccessor actors,
    TimeProvider clock,
    IMaintenanceTransactionSideEffects sideEffects) : IMaintenanceCommandExecutor
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<MaintenanceApiResult<T>> ExecuteAsync<T>(string idempotencyKey, string operation, string requestPayload,
        Func<CancellationToken, Task<MaintenanceApiResult<T>>> command, CancellationToken cancellationToken = default)
    {
        var actor = await actors.GetCurrentAsync(cancellationToken);
        if (actor is null)
            return MaintenanceApiResult<T>.Error(MaintenanceApiResultCode.Unauthorized, "Authentication is required.");
        if (string.IsNullOrWhiteSpace(idempotencyKey) || idempotencyKey.Length > 200)
            return MaintenanceApiResult<T>.Error(MaintenanceApiResultCode.BadRequest,
                "A valid Idempotency-Key header is required.", "maintenance.idempotency_key_required");

        var keyHash = Hash(idempotencyKey.Trim());
        var requestHash = Hash(requestPayload);
        var existing = await db.MaintenanceCommandReceipts.AsNoTracking().SingleOrDefaultAsync(x =>
            x.ActorUserId == actor.UserId && x.Operation == operation && x.IdempotencyKeyHash == keyHash, cancellationToken);
        if (existing is not null) return Replay<T>(existing, requestHash);

        using var effectScope = sideEffects.BeginScope();
        await using IDbContextTransaction? transaction = db.Database.IsRelational()
            ? await db.Database.BeginTransactionAsync(cancellationToken)
            : null;

        var receipt = new MaintenanceCommandReceipt
        {
            ActorUserId = actor.UserId,
            Operation = operation,
            IdempotencyKeyHash = keyHash,
            RequestHash = requestHash,
            CreatedAtUtc = clock.GetUtcNow()
        };
        db.MaintenanceCommandReceipts.Add(receipt);

        try
        {
            try
            {
                await db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException exception) when (transaction is not null && IsUniqueReceiptCollision(exception))
            {
                await RollbackTransactionAsync(transaction);
                await sideEffects.RollbackAsync(CancellationToken.None);
                db.ChangeTracker.Clear();
                var raced = await db.MaintenanceCommandReceipts.AsNoTracking().SingleOrDefaultAsync(x =>
                    x.ActorUserId == actor.UserId && x.Operation == operation && x.IdempotencyKeyHash == keyHash, cancellationToken);
                if (raced is null) throw;
                return Replay<T>(raced, requestHash);
            }

            MaintenanceApiResult<T> result;
            try
            {
                result = await command(cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                ResetFailedCommandChanges(receipt);
                result = MaintenanceApiResult<T>.Error(MaintenanceApiResultCode.Conflict,
                    "The maintenance resource changed. Refresh and retry with its current version.", "maintenance.version_conflict");
            }

            receipt.ResponseJson = JsonSerializer.Serialize(result, Json);
            receipt.CompletedAtUtc = clock.GetUtcNow();
            await db.SaveChangesAsync(cancellationToken);
            if (transaction is not null) await transaction.CommitAsync(cancellationToken);
            await sideEffects.CommitCompletedAsync(CancellationToken.None);
            return result;
        }
        catch
        {
            if (transaction is not null) await RollbackTransactionAsync(transaction);
            await sideEffects.RollbackAsync(CancellationToken.None);
            db.ChangeTracker.Clear();
            throw;
        }
    }

    private static async Task RollbackTransactionAsync(IDbContextTransaction transaction)
    {
        try { await transaction.RollbackAsync(CancellationToken.None); }
        catch (InvalidOperationException) { }
    }

    private void ResetFailedCommandChanges(MaintenanceCommandReceipt receipt)
    {
        foreach (var entry in db.ChangeTracker.Entries().Where(x => x.Entity != receipt).ToArray())
        {
            if (entry.State == EntityState.Added) entry.State = EntityState.Detached;
            else if (entry.State is EntityState.Modified or EntityState.Deleted) entry.State = EntityState.Unchanged;
        }
    }

    private static MaintenanceApiResult<T> Replay<T>(MaintenanceCommandReceipt receipt, string requestHash)
    {
        if (!CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(receipt.RequestHash), Encoding.ASCII.GetBytes(requestHash)))
            return MaintenanceApiResult<T>.Error(MaintenanceApiResultCode.Conflict,
                "The idempotency key was already used with a different request.", "maintenance.idempotency_payload_conflict");
        if (string.IsNullOrWhiteSpace(receipt.ResponseJson))
            return MaintenanceApiResult<T>.Error(MaintenanceApiResultCode.Conflict,
                "This command is already being processed.", "maintenance.idempotency_in_progress");
        return JsonSerializer.Deserialize<MaintenanceApiResult<T>>(receipt.ResponseJson, Json)
            ?? MaintenanceApiResult<T>.Error(MaintenanceApiResultCode.Conflict,
                "The stored command receipt could not be replayed.", "maintenance.idempotency_receipt_invalid");
    }

    private static bool IsUniqueReceiptCollision(DbUpdateException exception)
    {
        // Keep this provider-neutral: the API uses SQL Server while durability tests use SQLite.
        // Only duplicate-key errors may be interpreted as an idempotency race; every other
        // persistence error must take the normal rollback/compensation path and propagate.
        var providerException = exception.InnerException ?? exception.GetBaseException();
        var type = providerException.GetType();
        if (type.FullName == "Microsoft.Data.SqlClient.SqlException")
        {
            var number = type.GetProperty("Number")?.GetValue(providerException) as int?;
            return number is 2601 or 2627;
        }
        if (type.FullName == "Microsoft.Data.Sqlite.SqliteException")
        {
            var extended = type.GetProperty("SqliteExtendedErrorCode")?.GetValue(providerException) as int?;
            return extended is 1555 or 2067; // SQLITE_CONSTRAINT_PRIMARYKEY / UNIQUE
        }
        return false;
    }

    private static string Hash(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
}
