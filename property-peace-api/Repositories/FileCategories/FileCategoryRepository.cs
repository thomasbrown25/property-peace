using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.FileCategory;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.FileCategories
{
    public class FileCategoryRepository(DataContext context, IMapper mapper, ILogger<FileCategoryRepository> logger) : IFileCategoryRepository
    {
        private readonly DataContext _context = context;
        private readonly IMapper _mapper = mapper;
        private readonly ILogger<FileCategoryRepository> _logger = logger;

        public async Task<LoadFileCategoryDto> AddFileCategory(AddFileCategoryDto category, long organizationId, long? createdBy)
        {
            var entity = _mapper.Map<Models.FileCategory>(category);
            entity.OrganizationId = organizationId;
            entity.CreatedBy = createdBy;
            entity.CreatedAt = DateTime.UtcNow;

            await _context.FileCategories.AddAsync(entity);
            await _context.SaveChangesAsync();

            return await MapToDtoAsync(entity);
        }

        public async Task<LoadFileCategoryDto?> GetFileCategoryById(long id)
        {
            var category = await _context.FileCategories
                .Include(c => c.Files)
                .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted);

            return category == null ? null : await MapToDtoAsync(category);
        }

        public async Task<List<LoadFileCategoryDto>> GetFileCategoriesByOrganizationId(long organizationId)
        {
            var categories = await _context.FileCategories
                .Include(c => c.Files)
                .Where(c => c.OrganizationId == organizationId && !c.IsDeleted)
                .OrderBy(c => c.Name)
                .ToListAsync();

            var dtos = new List<LoadFileCategoryDto>();
            foreach (var category in categories)
            {
                dtos.Add(await MapToDtoAsync(category));
            }

            return dtos;
        }

        public async Task<LoadFileCategoryDto> UpdateFileCategory(long id, UpdateFileCategoryDto category, long? updatedBy)
        {
            var entity = await _context.FileCategories.FindAsync(id);
            if (entity == null || entity.IsDeleted)
                throw new KeyNotFoundException($"File category with ID {id} not found");

            entity.Name = category.Name;
            entity.UpdatedBy = updatedBy;
            entity.UpdatedAt = DateTime.UtcNow;

            _context.FileCategories.Update(entity);
            await _context.SaveChangesAsync();

            return await MapToDtoAsync(entity);
        }

        public async Task<bool> DeleteFileCategory(long id)
        {
            var category = await _context.FileCategories
                .Include(c => c.Files)
                .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted);

            if (category == null)
                return false;

            // Check if category has files
            var fileCount = category.Files.Count(f => !f.IsDeleted);
            if (fileCount > 0)
            {
                throw new InvalidOperationException($"Cannot delete category with {fileCount} file(s). Please reassign or delete files first.");
            }

            category.IsDeleted = true;
            category.DeletedAt = DateTime.UtcNow;
            _context.FileCategories.Update(category);
            await _context.SaveChangesAsync();

            return true;
        }

        private async Task<LoadFileCategoryDto> MapToDtoAsync(Models.FileCategory category)
        {
            await _context.Entry(category).Collection(c => c.Files).LoadAsync();
            
            var dto = _mapper.Map<LoadFileCategoryDto>(category);
            dto.FileCount = category.Files.Count(f => !f.IsDeleted);
            
            return dto;
        }
    }
}

