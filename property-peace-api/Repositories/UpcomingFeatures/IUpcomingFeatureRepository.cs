using brownstone_hub_api.Dtos.UpcomingFeature;

namespace brownstone_hub_api.Repositories.UpcomingFeatures
{
    public interface IUpcomingFeatureRepository
    {
        Task<UpcomingFeatureDto> AddUpcomingFeature(AddUpcomingFeatureDto feature);
        Task<UpcomingFeatureDto> UpdateUpcomingFeature(UpdateUpcomingFeatureDto feature);
        Task<bool> DeleteUpcomingFeature(long featureId);
        Task<UpcomingFeatureDto?> GetUpcomingFeatureById(long featureId);
        Task<List<UpcomingFeatureDto>> GetAllUpcomingFeatures();
        Task<List<UpcomingFeatureDto>> GetActiveUpcomingFeatures();
    }
}

