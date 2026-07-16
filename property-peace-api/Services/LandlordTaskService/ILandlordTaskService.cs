using brownstone_hub_api.Dtos.LandlordTask;

namespace brownstone_hub_api.Services.LandlordTaskService
{
    public interface ILandlordTaskService
    {
        Task<ServiceResponse<LoadLandlordTaskDto>> AddTask(AddLandlordTaskDto dto);
        Task<ServiceResponse<LoadLandlordTaskDto>> GetTaskById(long id);
        Task<ServiceResponse<List<LoadLandlordTaskDto>>> GetTasks(DateTime? from = null, DateTime? to = null, long? propertyId = null);
        Task<ServiceResponse<LoadLandlordTaskDto>> UpdateTask(UpdateLandlordTaskDto dto);
        Task<ServiceResponse<bool>> DeleteTask(long id);
    }
}
