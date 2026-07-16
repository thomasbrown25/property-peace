using brownstone_hub_api.Dtos.Amenity;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Repositories.Amenities
{
    public interface IAmenityRepository
    {
        Task<List<LoadBasicAmenityDto>> GetBasicAmenities();
        Task<List<LoadDefaultAmenityDto>> GetDefaultAmenities();
        Task<List<LoadDefaultAmenityDto>> GetDefaultAmenitiesByCategory(string category);
        Task<List<LoadCustomAmenityDto>> GetCustomAmenitiesByOrganizationId(long organizationId);
        Task<LoadCustomAmenityDto> CreateCustomAmenity(CreateCustomAmenityDto amenityDto, long organizationId, long createdBy);
        Task<bool> DeleteCustomAmenity(long amenityId, long organizationId);
        Task<long> GetOrCreateBasicAmenity(string name, string category);
        Task<long> GetOrCreateDefaultAmenity(string name, EAmenityCategory category);
    }
}
