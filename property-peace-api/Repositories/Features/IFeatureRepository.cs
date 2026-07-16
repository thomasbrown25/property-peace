using brownstone_hub_api.Dtos.Feature;

namespace brownstone_hub_api.Repositories.Features
{
    public interface IFeatureRepository
    {
        Task<List<LoadDefaultFeatureDto>> GetDefaultFeatures();
        Task<List<LoadCustomFeatureDto>> GetCustomFeaturesByOrganizationId(long organizationId);
        Task<LoadCustomFeatureDto> CreateCustomFeature(CreateCustomFeatureDto dto, long organizationId, long createdBy);
        Task<bool> DeleteCustomFeature(long featureId, long organizationId);
        /// <summary>Resolve default feature name to id (for fallback when UI sends name). Returns null if not found.</summary>
        Task<long?> GetDefaultFeatureIdByName(string name);
    }
}
