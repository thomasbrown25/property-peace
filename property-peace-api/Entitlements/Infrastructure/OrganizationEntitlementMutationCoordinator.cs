using System.Data;
using brownstone_hub_api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace brownstone_hub_api.Entitlements.Infrastructure;

/// <summary>
/// Serializes an organization-scoped entitlement decision and its mutation in the
/// same DataContext transaction. The callback must use services/repositories from
/// the same DI scope so their SaveChanges calls enlist in this transaction.
/// </summary>
public interface IOrganizationEntitlementMutationCoordinator
{
    Task<EntitlementMutationOutcome<T>> ExecuteAsync<T>(
        long organizationId,
        Func<CancellationToken, Task<EntitlementMutationOutcome<T>>> operation,
        CancellationToken cancellationToken = default);
}

public sealed record EntitlementMutationOutcome<T>(T Value, bool MutationSucceeded)
{
    public static EntitlementMutationOutcome<T> Commit(T value) => new(value, true);
    public static EntitlementMutationOutcome<T> Rollback(T value) => new(value, false);
}

public sealed class EfOrganizationEntitlementMutationCoordinator(DataContext context)
    : IOrganizationEntitlementMutationCoordinator
{
    private readonly DataContext _context = context;

    public async Task<EntitlementMutationOutcome<T>> ExecuteAsync<T>(
        long organizationId,
        Func<CancellationToken, Task<EntitlementMutationOutcome<T>>> operation,
        CancellationToken cancellationToken = default)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(organizationId);
        ArgumentNullException.ThrowIfNull(operation);
        cancellationToken.ThrowIfCancellationRequested();

        await using var transaction = await _context.Database.BeginTransactionAsync(
            IsolationLevel.Serializable,
            cancellationToken);

        try
        {
            var outcome = await operation(cancellationToken);
            cancellationToken.ThrowIfCancellationRequested();

            if (outcome.MutationSucceeded)
            {
                await transaction.CommitAsync(cancellationToken);
            }
            else
            {
                await transaction.RollbackAsync(cancellationToken);
            }

            return outcome;
        }
        catch
        {
            await RollbackWithoutMaskingOriginalAsync(transaction);
            throw;
        }
    }

    private static async Task RollbackWithoutMaskingOriginalAsync(IDbContextTransaction transaction)
    {
        try
        {
            await transaction.RollbackAsync(CancellationToken.None);
        }
        catch
        {
            // Preserve the operation/cancellation exception. Disposal is the final safeguard.
        }
    }
}
