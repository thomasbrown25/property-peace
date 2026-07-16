

using brownstone_hub_api.Dtos.MaintenanceImage;

namespace brownstone_hub_api.Repositories.MaintenanceImages
{
    public interface IMaintenanceImageRepository
    {
        Task<LoadMaintenanceImageDto> AddMaintenanceImage(AddMaintenanceImageDto maintenanceImage);
        Task<List<LoadMaintenanceImageDto>> GetMaintenanceImagesByRequestId(long maintenanceRequestId);
        Task<LoadMaintenanceImageDto> DeleteMaintenanceImage(long id);
    }
}