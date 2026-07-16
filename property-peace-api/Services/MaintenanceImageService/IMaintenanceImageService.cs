
using brownstone_hub_api.Dtos.MaintenanceImage;

namespace brownstone_hub_api.Services.MaintenanceImageService
{
    public interface IMaintenanceImageService
    {
        Task<ServiceResponse<List<LoadMaintenanceImageDto>>> AddMaintenanceImages(long maintenanceRequestId, List<IFormFile> files);
        Task<ServiceResponse<List<LoadMaintenanceImageDto>>> GetMaintenanceImages(long maintenanceRequestId);
        Task<ServiceResponse<LoadMaintenanceImageDto>> DeleteMaintenanceImage(long id);
    }
}