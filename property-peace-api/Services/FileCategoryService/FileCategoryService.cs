using brownstone_hub_api.Dtos.FileCategory;
using brownstone_hub_api.Repositories.FileCategories;
using Microsoft.AspNetCore.Http;

namespace brownstone_hub_api.Services.FileCategoryService
{
    public class FileCategoryService(
        IFileCategoryRepository fileCategoryRepository,
        IHttpContextAccessor httpContextAccessor,
        ILogger<FileCategoryService> logger) : IFileCategoryService
    {
        private readonly IFileCategoryRepository _fileCategoryRepository = fileCategoryRepository;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly ILogger<FileCategoryService> _logger = logger;

        private long? GetOrganizationIdFromContext()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }

        private long? GetUserIdFromContext()
        {
            var userIdClaim = _httpContextAccessor.HttpContext?.User?.FindFirst("UserId");
            if (userIdClaim != null && long.TryParse(userIdClaim.Value, out var userId))
            {
                return userId;
            }
            return null;
        }

        public async Task<ServiceResponse<LoadFileCategoryDto>> AddFileCategory(AddFileCategoryDto category)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadFileCategoryDto>.CreateError(
                        "Organization not found",
                        "Unable to determine organization context."
                    );
                }

                var userId = GetUserIdFromContext();

                // Check if category with same name already exists
                var existingCategories = await _fileCategoryRepository.GetFileCategoriesByOrganizationId(organizationId.Value);
                if (existingCategories.Any(c => c.Name.Equals(category.Name, StringComparison.OrdinalIgnoreCase) && c.FileCount >= 0))
                {
                    return ServiceResponse<LoadFileCategoryDto>.CreateError(
                        "Category already exists",
                        $"A category with the name '{category.Name}' already exists."
                    );
                }

                var newCategory = await _fileCategoryRepository.AddFileCategory(category, organizationId.Value, userId);
                return new ServiceResponse<LoadFileCategoryDto> { Data = newCategory, Message = "Category created successfully" };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding file category");
                return ServiceResponse<LoadFileCategoryDto>.CreateError(
                    "Error creating category",
                    ex.Message
                );
            }
        }

        public async Task<ServiceResponse<LoadFileCategoryDto>> GetFileCategoryById(long id)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadFileCategoryDto>.CreateError(
                        "Organization not found",
                        "Unable to determine organization context."
                    );
                }

                var category = await _fileCategoryRepository.GetFileCategoryById(id);
                if (category == null)
                {
                    return ServiceResponse<LoadFileCategoryDto>.CreateError(
                        "Category not found",
                        $"Category with ID {id} was not found.",
                        "",
                        404
                    );
                }

                if (category.OrganizationId != organizationId.Value)
                {
                    return ServiceResponse<LoadFileCategoryDto>.CreateError(
                        "Access denied",
                        "You do not have access to this category.",
                        "",
                        403
                    );
                }

                return new ServiceResponse<LoadFileCategoryDto> { Data = category };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting file category by ID {CategoryId}", id);
                return ServiceResponse<LoadFileCategoryDto>.CreateError(
                    "Error retrieving category",
                    ex.Message
                );
            }
        }

        public async Task<ServiceResponse<List<LoadFileCategoryDto>>> GetFileCategories()
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<List<LoadFileCategoryDto>>.CreateError(
                        "Organization not found",
                        "Unable to determine organization context."
                    );
                }

                var categories = await _fileCategoryRepository.GetFileCategoriesByOrganizationId(organizationId.Value);
                return new ServiceResponse<List<LoadFileCategoryDto>> { Data = categories };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting file categories");
                return ServiceResponse<List<LoadFileCategoryDto>>.CreateError(
                    "Error retrieving categories",
                    ex.Message
                );
            }
        }

        public async Task<ServiceResponse<LoadFileCategoryDto>> UpdateFileCategory(long id, UpdateFileCategoryDto category)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadFileCategoryDto>.CreateError(
                        "Organization not found",
                        "Unable to determine organization context."
                    );
                }

                var userId = GetUserIdFromContext();

                var existingCategory = await _fileCategoryRepository.GetFileCategoryById(id);
                if (existingCategory == null)
                {
                    return ServiceResponse<LoadFileCategoryDto>.CreateError(
                        "Category not found",
                        $"Category with ID {id} was not found.",
                        "",
                        404
                    );
                }

                if (existingCategory.OrganizationId != organizationId.Value)
                {
                    return ServiceResponse<LoadFileCategoryDto>.CreateError(
                        "Access denied",
                        "You do not have access to this category.",
                        "",
                        403
                    );
                }

                // Check if another category with same name exists
                var allCategories = await _fileCategoryRepository.GetFileCategoriesByOrganizationId(organizationId.Value);
                if (allCategories.Any(c => c.Id != id && c.Name.Equals(category.Name, StringComparison.OrdinalIgnoreCase)))
                {
                    return ServiceResponse<LoadFileCategoryDto>.CreateError(
                        "Category already exists",
                        $"A category with the name '{category.Name}' already exists."
                    );
                }

                var updatedCategory = await _fileCategoryRepository.UpdateFileCategory(id, category, userId);
                return new ServiceResponse<LoadFileCategoryDto> { Data = updatedCategory, Message = "Category updated successfully" };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating file category {CategoryId}", id);
                return ServiceResponse<LoadFileCategoryDto>.CreateError(
                    "Error updating category",
                    ex.Message
                );
            }
        }

        public async Task<ServiceResponse<bool>> DeleteFileCategory(long id)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<bool>.CreateError(
                        "Organization not found",
                        "Unable to determine organization context."
                    );
                }

                var existingCategory = await _fileCategoryRepository.GetFileCategoryById(id);
                if (existingCategory == null)
                {
                    return ServiceResponse<bool>.CreateError(
                        "Category not found",
                        $"Category with ID {id} was not found.",
                        "",
                        404
                    );
                }

                if (existingCategory.OrganizationId != organizationId.Value)
                {
                    return ServiceResponse<bool>.CreateError(
                        "Access denied",
                        "You do not have access to this category.",
                        "",
                        403
                    );
                }

                var deleted = await _fileCategoryRepository.DeleteFileCategory(id);
                return new ServiceResponse<bool> { Data = deleted, Message = "Category deleted successfully" };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting file category {CategoryId}", id);
                return ServiceResponse<bool>.CreateError(
                    "Error deleting category",
                    ex.Message
                );
            }
        }
    }
}

