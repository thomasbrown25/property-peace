using brownstone_hub_api.Dtos.RentEstimate;

namespace brownstone_hub_api.Services.RentEstimateService
{
    public interface IRentEstimateService
    {
        Task<RentEstimateDto?> GetRentEstimateAsync(long propertyId, long? unitId = null, bool forceRefresh = false, CancellationToken cancellationToken = default);
    }
}
