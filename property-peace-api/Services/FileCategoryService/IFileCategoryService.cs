using brownstone_hub_api.Dtos.FileCategory;

namespace brownstone_hub_api.Services.FileCategoryService
{
    public interface IFileCategoryService
    {
        Task<ServiceResponse<LoadFileCategoryDto>> AddFileCategory(AddFileCategoryDto category);
        Task<ServiceResponse<LoadFileCategoryDto>> GetFileCategoryById(long id);
        Task<ServiceResponse<List<LoadFileCategoryDto>>> GetFileCategories();
        Task<ServiceResponse<LoadFileCategoryDto>> UpdateFileCategory(long id, UpdateFileCategoryDto category);
        Task<ServiceResponse<bool>> DeleteFileCategory(long id);
    }
}

