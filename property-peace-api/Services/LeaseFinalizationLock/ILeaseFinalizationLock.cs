namespace brownstone_hub_api.Services.LeaseFinalizationLock;

public interface ILeaseFinalizationLock
{
    Task<IAsyncDisposable> AcquireAsync(long organizationId, long leaseId, CancellationToken cancellationToken = default);
}
