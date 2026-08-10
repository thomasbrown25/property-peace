
using brownstone_hub_api.Dtos.Unit;

namespace brownstone_hub_api.Services.UnitService
{
    public interface IUnitService
    {
        Task<ServiceResponse<List<LoadUnitDto>>> GetUnits(long propertyId);
        Task<ServiceResponse<LoadUnitDto>> AddOrUpdateUnit(UpdateUnitDto updatedUnit, CancellationToken cancellationToken = default);
        Task<ServiceResponse<List<LoadUnitDto>>> BulkCreateUnits(BulkCreateUnitsDto bulkCreateDto, CancellationToken cancellationToken = default);
        Task<ServiceResponse<LoadUnitDto>> GetUnitById(long id);
        Task<ServiceResponse<LoadUnitDto>> DeleteUnit(long id);
    }
}