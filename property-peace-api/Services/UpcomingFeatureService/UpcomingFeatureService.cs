using brownstone_hub_api.Dtos.UpcomingFeature;
using brownstone_hub_api.Repositories.UpcomingFeatures;

namespace brownstone_hub_api.Services.UpcomingFeatureService
{
    public class UpcomingFeatureService(
        IUpcomingFeatureRepository upcomingFeatureRepository,
        ILogger<UpcomingFeatureService> logger) : IUpcomingFeatureService
    {
        private readonly IUpcomingFeatureRepository _upcomingFeatureRepository = upcomingFeatureRepository;
        private readonly ILogger<UpcomingFeatureService> _logger = logger;

        public async Task<ServiceResponse<UpcomingFeatureDto>> AddUpcomingFeature(AddUpcomingFeatureDto feature)
        {
            var response = new ServiceResponse<UpcomingFeatureDto>();
            try
            {
                var result = await _upcomingFeatureRepository.AddUpcomingFeature(feature);
                response.Data = result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding upcoming feature");
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<UpcomingFeatureDto>> UpdateUpcomingFeature(UpdateUpcomingFeatureDto feature)
        {
            var response = new ServiceResponse<UpcomingFeatureDto>();
            try
            {
                var result = await _upcomingFeatureRepository.UpdateUpcomingFeature(feature);
                response.Data = result;
            }
            catch (KeyNotFoundException ex)
            {
                _logger.LogWarning(ex, "Upcoming feature not found for update");
                response.Success = false;
                response.Message = "Upcoming feature not found";
                response.StatusCode = 404;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating upcoming feature");
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<bool>> DeleteUpcomingFeature(long featureId)
        {
            var response = new ServiceResponse<bool>();
            try
            {
                var result = await _upcomingFeatureRepository.DeleteUpcomingFeature(featureId);
                response.Data = result;
                if (!result)
                {
                    response.Success = false;
                    response.Message = "Upcoming feature not found";
                    response.StatusCode = 404;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting upcoming feature {FeatureId}", featureId);
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<UpcomingFeatureDto>> GetUpcomingFeatureById(long featureId)
        {
            var response = new ServiceResponse<UpcomingFeatureDto>();
            try
            {
                var result = await _upcomingFeatureRepository.GetUpcomingFeatureById(featureId);
                if (result == null)
                {
                    response.Success = false;
                    response.Message = "Upcoming feature not found";
                    response.StatusCode = 404;
                }
                else
                {
                    response.Data = result;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting upcoming feature {FeatureId}", featureId);
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<List<UpcomingFeatureDto>>> GetAllUpcomingFeatures()
        {
            var response = new ServiceResponse<List<UpcomingFeatureDto>>();
            try
            {
                var result = await _upcomingFeatureRepository.GetAllUpcomingFeatures();
                response.Data = result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all upcoming features");
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<List<UpcomingFeatureDto>>> GetActiveUpcomingFeatures()
        {
            var response = new ServiceResponse<List<UpcomingFeatureDto>>();
            try
            {
                var result = await _upcomingFeatureRepository.GetActiveUpcomingFeatures();
                response.Data = result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting active upcoming features");
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }
    }
}

