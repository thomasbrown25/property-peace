using brownstone_hub_api.Dtos.PolicyPack;

namespace brownstone_hub_api.Services.PolicyPackService
{
    public interface IPolicyPackService
    {
        Task<ServiceResponse<LoadPolicyPackDto>> GetDefaultPolicyPackAsync();
        Task<ServiceResponse<List<LoadPolicyPackDto>>> GetPolicyPacksByOrganizationAsync();
        Task<ServiceResponse<LoadPolicyPackDto>> GetPolicyPackByIdAsync(long id);
        Task<ServiceResponse<LoadPolicyPackDto>> CreatePolicyPackAsync(CreatePolicyPackDto dto);
        Task<ServiceResponse<LoadPolicyPackDto>> UpdatePolicyPackAsync(UpdatePolicyPackDto dto);
        Task<ServiceResponse<bool>> DeletePolicyPackAsync(long id);
    }
}
