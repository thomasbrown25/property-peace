using brownstone_hub_api.Dtos.LandlordTask;
using brownstone_hub_api.Repositories.LandlordTask;

namespace brownstone_hub_api.Services.LandlordTaskService
{
    public class LandlordTaskService(
        ILandlordTaskRepository taskRepository,
        IHttpContextAccessor httpContextAccessor,
        ILogger<LandlordTaskService> logger) : ILandlordTaskService
    {
        private readonly ILandlordTaskRepository _taskRepository = taskRepository;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly ILogger<LandlordTaskService> _logger = logger;

        private long? GetOrganizationId()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var obj) == true && obj is long id)
                return id;
            return null;
        }

        public async Task<ServiceResponse<LoadLandlordTaskDto>> AddTask(AddLandlordTaskDto dto)
        {
            try
            {
                var orgId = GetOrganizationId();
                if (orgId is null)
                    return ServiceResponse<LoadLandlordTaskDto>.CreateError("Organization not found", statusCode: 401);

                var result = await _taskRepository.AddTask(dto, orgId.Value);
                return ServiceResponse<LoadLandlordTaskDto>.CreateSuccess(result, "Task created successfully", 201);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[LandlordTaskService] Error adding task");
                return ServiceResponse<LoadLandlordTaskDto>.CreateError("Failed to create task", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadLandlordTaskDto>> GetTaskById(long id)
        {
            try
            {
                var orgId = GetOrganizationId();
                if (orgId is null)
                    return ServiceResponse<LoadLandlordTaskDto>.CreateError("Organization not found", statusCode: 401);

                var result = await _taskRepository.GetTaskById(id, orgId.Value);
                if (result is null)
                    return ServiceResponse<LoadLandlordTaskDto>.CreateError("Task not found", statusCode: 404);

                return ServiceResponse<LoadLandlordTaskDto>.CreateSuccess(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[LandlordTaskService] Error getting task {Id}", id);
                return ServiceResponse<LoadLandlordTaskDto>.CreateError("Failed to get task", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadLandlordTaskDto>>> GetTasks(
            DateTime? from = null, DateTime? to = null, long? propertyId = null)
        {
            try
            {
                var orgId = GetOrganizationId();
                if (orgId is null)
                    return ServiceResponse<List<LoadLandlordTaskDto>>.CreateError("Organization not found", statusCode: 401);

                var result = await _taskRepository.GetTasksByOrganization(orgId.Value, from, to, propertyId);
                return ServiceResponse<List<LoadLandlordTaskDto>>.CreateSuccess(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[LandlordTaskService] Error getting tasks");
                return ServiceResponse<List<LoadLandlordTaskDto>>.CreateError("Failed to get tasks", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadLandlordTaskDto>> UpdateTask(UpdateLandlordTaskDto dto)
        {
            try
            {
                var orgId = GetOrganizationId();
                if (orgId is null)
                    return ServiceResponse<LoadLandlordTaskDto>.CreateError("Organization not found", statusCode: 401);

                var result = await _taskRepository.UpdateTask(dto, orgId.Value);
                return ServiceResponse<LoadLandlordTaskDto>.CreateSuccess(result);
            }
            catch (KeyNotFoundException)
            {
                return ServiceResponse<LoadLandlordTaskDto>.CreateError("Task not found", statusCode: 404);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[LandlordTaskService] Error updating task {Id}", dto.Id);
                return ServiceResponse<LoadLandlordTaskDto>.CreateError("Failed to update task", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> DeleteTask(long id)
        {
            try
            {
                var orgId = GetOrganizationId();
                if (orgId is null)
                    return ServiceResponse<bool>.CreateError("Organization not found", statusCode: 401);

                var deleted = await _taskRepository.DeleteTask(id, orgId.Value);
                if (!deleted)
                    return ServiceResponse<bool>.CreateError("Task not found", statusCode: 404);

                return ServiceResponse<bool>.CreateSuccess(true, "Task deleted successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[LandlordTaskService] Error deleting task {Id}", id);
                return ServiceResponse<bool>.CreateError("Failed to delete task", ex.Message);
            }
        }
    }
}
