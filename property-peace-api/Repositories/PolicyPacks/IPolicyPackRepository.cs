using brownstone_hub_api.Models;

namespace brownstone_hub_api.Repositories.PolicyPacks
{
    public interface IPolicyPackRepository
    {
        Task<PolicyPack?> GetDefaultPolicyPackAsync();
        Task<PolicyPack?> GetPolicyPackByIdAsync(long id, long? organizationId = null);
        Task<List<PolicyPack>> GetPolicyPacksByOrganizationAsync(long organizationId);
        Task<PolicyPack> CreatePolicyPackAsync(PolicyPack pack);
        Task<PolicyPack> UpdatePolicyPackAsync(PolicyPack pack);
        Task<bool> DeletePolicyPackAsync(long id, long? organizationId);
    }
}
