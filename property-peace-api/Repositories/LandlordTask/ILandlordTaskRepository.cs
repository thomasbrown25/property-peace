using brownstone_hub_api.Dtos.LandlordTask;

namespace brownstone_hub_api.Repositories.LandlordTask
{
    public interface ILandlordTaskRepository
    {
        Task<LoadLandlordTaskDto> AddTask(AddLandlordTaskDto dto, long organizationId);
        Task<LoadLandlordTaskDto?> GetTaskById(long id, long organizationId);
        Task<List<LoadLandlordTaskDto>> GetTasksByOrganization(long organizationId, DateTime? from = null, DateTime? to = null, long? propertyId = null);
        Task<LoadLandlordTaskDto> UpdateTask(UpdateLandlordTaskDto dto, long organizationId);
        Task<bool> DeleteTask(long id, long organizationId);
    }
}
