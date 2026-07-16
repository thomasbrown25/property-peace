

using brownstone_hub_api.Dtos.Property;

namespace brownstone_hub_api.Services.PropertyService
{
    public interface IPropertyService
    {
        Task<ServiceResponse<LoadPropertyDto>> AddOrUpdateProperty(UpdatePropertyDto propertyDto, List<IFormFile> files);
        Task<ServiceResponse<LoadPropertyDto>> GetPropertyById(long propertyId);
        Task<ServiceResponse<List<LoadPropertyDto>>> GetPropertiesByOrganizationId(long organizationId);
        Task<ServiceResponse<int>> GetOccupiedPropertiesCountAsync(long organizationId);
        Task<ServiceResponse<int>> GetVacantPropertiesCountAsync(long organizationId);
        Task<ServiceResponse<LoadPropertyDto>> DeleteProperty(long propertyId);
        Task<ServiceResponse<LoadPropertyDto>> InactivateProperty(long propertyId);
        Task<ServiceResponse<LoadPropertyDto>> ReactivateProperty(long propertyId);
        Task<ServiceResponse<bool>> IsSingleUnitPortfolio(long organizationId);
    }
}