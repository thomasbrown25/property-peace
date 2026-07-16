using brownstone_hub_api.Dtos.UpcomingFeature;

namespace brownstone_hub_api.Services.UpcomingFeatureService
{
    public interface IUpcomingFeatureService
    {
        Task<ServiceResponse<UpcomingFeatureDto>> AddUpcomingFeature(AddUpcomingFeatureDto feature);
        Task<ServiceResponse<UpcomingFeatureDto>> UpdateUpcomingFeature(UpdateUpcomingFeatureDto feature);
        Task<ServiceResponse<bool>> DeleteUpcomingFeature(long featureId);
        Task<ServiceResponse<UpcomingFeatureDto>> GetUpcomingFeatureById(long featureId);
        Task<ServiceResponse<List<UpcomingFeatureDto>>> GetAllUpcomingFeatures();
        Task<ServiceResponse<List<UpcomingFeatureDto>>> GetActiveUpcomingFeatures();
    }
}

