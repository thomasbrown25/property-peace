using brownstone_hub_api.Dtos.Storage;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Services.StorageService
{
    public interface IStorageService
    {
        Task<StorageObject> TrackAsync(TrackStorageObjectRequest request);
        Task<StorageSummaryDto> GetSummaryAsync();
        Task<List<StorageOrganizationUsageDto>> GetOrganizationsAsync();
        Task<List<StorageUserUsageDto>> GetUsersAsync();
        Task<StorageUserUsageDto?> GetUserAsync(long userId);
        Task<StorageOrganizationUsageDto?> GetOrganizationAsync(long organizationId);
    }
}
