using brownstone_hub_api.Models;

namespace brownstone_hub_api.Repositories.LeaseInstances
{
    public interface ILeaseInstanceRepository
    {
        Task<LeaseInstance?> GetLeaseInstanceByIdAsync(long id, long? organizationId = null);
        Task<LeaseInstance> CreateLeaseInstanceAsync(LeaseInstance instance);
        Task<LeaseInstance> UpdateLeaseInstanceAsync(LeaseInstance instance);
        Task<List<LeaseInstance>> GetLeaseInstancesByLeaseIdAsync(long leaseId);
        Task AddVariablesToInstanceAsync(long instanceId, IEnumerable<LeaseVariable> variables);
    }
}
