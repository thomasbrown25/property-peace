using brownstone_hub_api.Dtos.LeaseGeneration;

namespace brownstone_hub_api.Services.PolicyAIService
{
    public interface IPolicyAIService
    {
        Task<ServiceResponse<FormatPoliciesResponseDto>> FormatPoliciesAsync(FormatPoliciesDto dto);
        Task<ServiceResponse<List<string>>> SuggestPoliciesAsync(SuggestPoliciesDto dto);
        Task<ServiceResponse<List<string>>> NormalizePoliciesAsync(List<string> policies);
    }
}
