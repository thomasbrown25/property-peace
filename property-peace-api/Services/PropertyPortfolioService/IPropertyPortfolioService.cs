using brownstone_hub_api.Dtos.PropertyPortfolio;

namespace brownstone_hub_api.Services.PropertyPortfolioService
{
    public interface IPropertyPortfolioService
    {
        Task<ServiceResponse<PropertyPortfolioAnalyticsDto>> GetPropertyPortfolioAnalytics(long landlordId, long? propertyId, string timeRange);
        Task<ServiceResponse<PropertyOccupancyDto>> GetPropertyOccupancyData(long landlordId, long? propertyId);
        Task<ServiceResponse<UnitAvailabilityCalendarDto>> GetUnitAvailabilityCalendar(long landlordId, long? propertyId, DateTime? startDate, DateTime? endDate);
    }
}

