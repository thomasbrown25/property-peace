using brownstone_hub_api.Dtos.File;

namespace brownstone_hub_api.Repositories.Files
{
    public interface IFileRepository
    {
        Task<LoadFileDto> AddFile(AddFileDto file, long organizationId, long? createdBy);
        Task<LoadFileDto?> GetFileById(long id);
        Task<List<LoadFileDto>> GetFilesByOrganizationId(long organizationId, long? categoryId = null, long? propertyId = null, long? unitId = null, long? leaseId = null, DateTime? startDate = null, DateTime? endDate = null);
        Task<LoadFileDto> UpdateFile(long id, UpdateFileDto file, long? updatedBy);
        Task<bool> DeleteFile(long id);
    }
}

