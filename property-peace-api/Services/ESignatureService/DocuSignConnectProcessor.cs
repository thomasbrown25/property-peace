using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Repositories.Leases;

namespace brownstone_hub_api.Services.ESignatureService;

/// <summary>
/// Applies authenticated Connect facts only to the exact persisted envelope mapping. This processor is
/// deliberately separate from user-authorized reconciliation, and never contacts DocuSign, blob storage,
/// notification providers, or SignalR.
/// </summary>
public interface IDocuSignConnectProcessor
{
    Task<DocuSignConnectApplyResult> SynchronizeAsync(
        LeaseConnectInfoDto mapping,
        DocuSignConnectUpdate update,
        CancellationToken cancellationToken);
}

internal sealed class DocuSignConnectProcessor(ILeaseRepository leaseRepository) : IDocuSignConnectProcessor
{
    public Task<DocuSignConnectApplyResult> SynchronizeAsync(
        LeaseConnectInfoDto mapping,
        DocuSignConnectUpdate update,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!string.Equals(mapping.EnvelopeId, update.EnvelopeId, StringComparison.Ordinal))
            throw new UnauthorizedAccessException("Envelope mapping does not match.");

        return leaseRepository.ApplyDocuSignConnectUpdateAsync(mapping, update, cancellationToken);
    }
}
