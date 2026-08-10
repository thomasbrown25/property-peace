

using brownstone_hub_api.Dtos.Property;

namespace brownstone_hub_api.Repositories.Properties
{
    public interface IPropertyRepository
    {
        Task<LoadPropertyDto> AddProperty(UpdatePropertyDto propertyDto);
        Task<LoadPropertyDto> AddProperty(UpdatePropertyDto propertyDto, CancellationToken cancellationToken);
        Task<LoadPropertyDto> UpdateProperty(UpdatePropertyDto updatePropertyDto);
        Task<LoadPropertyDto> UpdateProperty(UpdatePropertyDto updatePropertyDto, CancellationToken cancellationToken);
        Task<LoadPropertyDto?> UpdatePropertyForMutationAsync(UpdatePropertyDto updatePropertyDto, long organizationId, CancellationToken cancellationToken);
        Task<LoadPropertyDto?> GetPropertyById(long propertyId);
        Task<LoadPropertyDto?> GetPropertyById(long propertyId, long organizationId);
        Task<LoadPropertyDto?> GetPropertyByIdForMutationAsync(long propertyId, long organizationId, CancellationToken cancellationToken);
        Task<LoadPropertyDto?> GetInactivePropertyByIdForMutationAsync(long propertyId, long organizationId, CancellationToken cancellationToken);
        Task<List<LoadPropertyDto>> GetPropertiesByLandlordId(long landlordId, long? organizationId = null);
        Task<List<LoadPropertyDto>> GetPropertiesByOrganizationId(long organizationId);
        Task<int> GetOccupiedPropertiesCountAsync(long organizationId);
        Task<int> GetVacantPropertiesCountAsync(long organizationId);
        Task<LoadPropertyDto> DeleteProperty(long propertyId);
        Task<LoadPropertyDto> DeleteProperty(long propertyId, long organizationId, CancellationToken cancellationToken);
        Task<LoadPropertyDto> InactivateProperty(long propertyId);
        Task<LoadPropertyDto> InactivateProperty(long propertyId, long organizationId, CancellationToken cancellationToken);
        Task<LoadPropertyDto> ReactivateProperty(long propertyId);
        Task<LoadPropertyDto> ReactivateProperty(long propertyId, long organizationId, CancellationToken cancellationToken);
        Task<bool> IsSingleUnitPortfolio(long organizationId);
        Task<(int TotalProperties, int TotalUnits, int OccupiedUnits)> GetDashboardCountsAsync(long organizationId);
        Task<int> GetTotalPropertyCountAsync(long organizationId);
        Task<int> GetTotalPropertyCountByLandlordAsync(long landlordId);
        Task<int> GetTotalUnitCountAsync(long organizationId);
        Task<int> GetTotalUnitCountByLandlordAsync(long landlordId);
        Task<List<long>> GetUnitIdsByPropertyId(long propertyId);
        Task<List<long>> GetTenantIdsByPropertyId(long propertyId);
        Task<List<long>> GetLeaseIdsByPropertyId(long propertyId);
        Task<int> DeleteDepositsByLeaseIds(List<long> leaseIds);
        Task<bool> PropertyNameExistsInOrganization(string? propertyName, long organizationId, long? excludePropertyId = null);
    }
}