using brownstone_hub_api.Models;

namespace brownstone_hub_api.Repositories.LeaseInstances
{
    public interface ILeaseInstanceRepository
    {
        Task<LeaseInstance?> GetLeaseInstanceByIdAsync(long id, long organizationId);
        Task<LeaseInstance?> GetFinalizedLeaseInstanceByLeaseIdAsync(long leaseId, long organizationId);
        Task<LeaseInstance?> GetLatestDraftLeaseInstanceByLeaseIdAsync(long leaseId, long organizationId);
        Task<LeaseInstance> CreateLeaseInstanceAsync(LeaseInstance instance, long organizationId);
        Task<LeaseInstance> UpdateLeaseInstanceAsync(LeaseInstance instance, long organizationId);
        Task<List<LeaseInstance>> GetLeaseInstancesByLeaseIdAsync(long leaseId, long organizationId);
        Task AddVariablesToInstanceAsync(long instanceId, IEnumerable<LeaseVariable> variables, long organizationId);
        Task ReplaceStateDisclosureSnapshotAsync(long instanceId, IEnumerable<LeaseVariable> variables, long organizationId);
        Task<LeaseDocument> UpsertLeaseDocumentAsync(LeaseDocument document, long organizationId);
        Task<LeaseInstance> MarkFinalizedAsync(long instanceId, long organizationId);
    }
}
