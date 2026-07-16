using brownstone_hub_api.Dtos.File;
using Microsoft.AspNetCore.Http;

namespace brownstone_hub_api.Services.FileService
{
    public interface IFileService
    {
        Task<ServiceResponse<List<LoadFileDto>>> AddFiles(List<IFormFile> files, string? title, long? categoryId, long? propertyId, long? unitId, long? leaseId);
        Task<ServiceResponse<LoadFileDto>> GetFileById(long id);
        Task<ServiceResponse<List<LoadFileDto>>> GetFiles(long? categoryId = null, long? propertyId = null, long? unitId = null, long? leaseId = null, DateTime? startDate = null, DateTime? endDate = null);
        Task<ServiceResponse<LoadFileDto>> UpdateFile(long id, UpdateFileDto file);
        Task<ServiceResponse<bool>> DeleteFile(long id);
    }
}

