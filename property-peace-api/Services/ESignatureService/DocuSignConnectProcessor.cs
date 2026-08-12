using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Services.ActivationFunnel;

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

internal sealed class DocuSignConnectProcessor(
    ILeaseRepository leaseRepository,
    IActivationOccurrenceRecorder activationRecorder) : IDocuSignConnectProcessor
{
    public async Task<DocuSignConnectApplyResult> SynchronizeAsync(
        LeaseConnectInfoDto mapping,
        DocuSignConnectUpdate update,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!string.Equals(mapping.EnvelopeId, update.EnvelopeId, StringComparison.Ordinal))
            throw new UnauthorizedAccessException("Envelope mapping does not match.");

        var result = await leaseRepository.ApplyDocuSignConnectUpdateAsync(mapping, update, cancellationToken);
        var persistedCompletion = result.AuthoritativeStatus == brownstone_hub_api.Enums.ESignatureStatus.Completed
            ? result.AuthoritativeCompletedAt
            : result.Applied && update.Status == brownstone_hub_api.Enums.ESignatureStatus.Completed
                ? update.CompletedAt ?? update.EventOccurredAt
                : null;
        if (persistedCompletion.HasValue)
        {
            await activationRecorder.RecordAsync(new ActivationOccurrenceRequest(
                mapping.OrganizationId, ActivationMilestones.LeaseSigned, $"lease:{mapping.LeaseId}",
                new DateTimeOffset(DateTime.SpecifyKind(persistedCompletion.Value, DateTimeKind.Utc)),
                SourceEventType: "docusign-envelope", SourceEventId: mapping.EnvelopeId), cancellationToken);
        }
        return result;
    }
}
