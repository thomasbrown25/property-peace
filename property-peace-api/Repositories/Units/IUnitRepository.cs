using brownstone_hub_api.Dtos.Unit;

namespace brownstone_hub_api.Repositories.Units
{
    public interface IUnitRepository
    {
        Task<List<LoadUnitDto>> GetUnits(long propertyId, long? organizationId = null);
        Task<List<LoadUnitDto>> GetUnitsByPropertyIds(List<long> propertyIds, long? organizationId = null);
        Task<LoadUnitDto> AddUnit(UpdateUnitDto newUnit, long propertyId, long? organizationId = null);
        Task<List<LoadUnitDto>> BulkCreateUnits(BulkCreateUnitsDto bulkCreateDto, long? organizationId = null);
        Task<LoadUnitDto> GetUnitById(long id, long? organizationId = null);
        Task<LoadUnitDto> UpdateUnit(UpdateUnitDto updateUnitDto);
        Task<LoadUnitDto> DeleteUnit(long id);
        Task<int> DeleteUnitsByPropertyId(long propertyId);
    }
}