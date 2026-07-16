using brownstone_hub_api.Dtos.FileCategory;

namespace brownstone_hub_api.Repositories.FileCategories
{
    public interface IFileCategoryRepository
    {
        Task<LoadFileCategoryDto> AddFileCategory(AddFileCategoryDto category, long organizationId, long? createdBy);
        Task<LoadFileCategoryDto?> GetFileCategoryById(long id);
        Task<List<LoadFileCategoryDto>> GetFileCategoriesByOrganizationId(long organizationId);
        Task<LoadFileCategoryDto> UpdateFileCategory(long id, UpdateFileCategoryDto category, long? updatedBy);
        Task<bool> DeleteFileCategory(long id);
    }
}

