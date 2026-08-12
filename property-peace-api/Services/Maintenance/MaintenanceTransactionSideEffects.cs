namespace brownstone_hub_api.Services.Maintenance;

/// <summary>
/// Coordinates best-effort cross-resource effects with the SQL command transaction. This does not
/// make blob storage and SQL atomic: rollback actions limit orphans, while durable attachment state
/// and the lifecycle worker close crash windows after a successful SQL commit.
/// </summary>
public interface IMaintenanceTransactionSideEffects
{
    bool IsActive { get; }
    IDisposable BeginScope();
    void OnRollback(Func<CancellationToken, Task> action);
    void AfterCommit(Func<CancellationToken, Task> action);
    Task CommitCompletedAsync(CancellationToken cancellationToken = default);
    Task RollbackAsync(CancellationToken cancellationToken = default);
}

public sealed class MaintenanceTransactionSideEffects : IMaintenanceTransactionSideEffects
{
    private readonly List<Func<CancellationToken, Task>> rollback = [];
    private readonly List<Func<CancellationToken, Task>> afterCommit = [];
    private bool active;
    private bool completed;

    public bool IsActive => active && !completed;

    public IDisposable BeginScope()
    {
        if (active) throw new InvalidOperationException("A maintenance transaction side-effect scope is already active.");
        active = true;
        completed = false;
        rollback.Clear();
        afterCommit.Clear();
        return new Scope(this);
    }

    public void OnRollback(Func<CancellationToken, Task> action)
    {
        if (!IsActive) throw new InvalidOperationException("Rollback effects require an active maintenance command transaction.");
        rollback.Add(action);
    }

    public void AfterCommit(Func<CancellationToken, Task> action)
    {
        if (!IsActive) throw new InvalidOperationException("Post-commit effects require an active maintenance command transaction.");
        afterCommit.Add(action);
    }

    public async Task CommitCompletedAsync(CancellationToken cancellationToken = default)
    {
        if (!IsActive) return;
        completed = true;
        rollback.Clear();
        var actions = afterCommit.ToArray();
        afterCommit.Clear();
        foreach (var action in actions)
        {
            try { await action(cancellationToken); }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                // SQL is already committed. Durable PendingUpload/PendingDeletion state is the retry.
            }
        }
    }

    public async Task RollbackAsync(CancellationToken cancellationToken = default)
    {
        if (!IsActive) return;
        completed = true;
        afterCommit.Clear();
        var actions = rollback.AsEnumerable().Reverse().ToArray();
        rollback.Clear();
        foreach (var action in actions)
        {
            try { await action(cancellationToken); }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                // Stale staging blobs are also scavenged by the durable lifecycle worker.
            }
        }
    }

    private void End()
    {
        rollback.Clear();
        afterCommit.Clear();
        active = false;
        completed = false;
    }

    private sealed class Scope(MaintenanceTransactionSideEffects owner) : IDisposable
    {
        private bool disposed;
        public void Dispose()
        {
            if (disposed) return;
            disposed = true;
            owner.End();
        }
    }
}
