using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.File;
using Microsoft.EntityFrameworkCore;
using FileEntity = brownstone_hub_api.Models.File;

namespace brownstone_hub_api.Repositories.Files
{
    public class FileRepository(DataContext context, IMapper mapper, ILogger<FileRepository> logger) : IFileRepository
    {
        private readonly DataContext _context = context;
        private readonly IMapper _mapper = mapper;
        private readonly ILogger<FileRepository> _logger = logger;

        public async Task<LoadFileDto> AddFile(AddFileDto file, long organizationId, long? createdBy)
        {
            var entity = _mapper.Map<FileEntity>(file);
            entity.OrganizationId = organizationId;
            entity.CreatedBy = createdBy;
            entity.CreatedAt = DateTime.UtcNow;

            await _context.Files.AddAsync(entity);
            await _context.SaveChangesAsync();

            return await MapToDtoAsync(entity);
        }

        public async Task<LoadFileDto?> GetFileById(long id)
        {
            var file = await _context.Files
                .Include(f => f.Category)
                .Include(f => f.Property)
                .Include(f => f.Unit)
                .Include(f => f.Lease)
                .Include(f => f.CreatedByUser)
                .Include(f => f.UpdatedByUser)
                .FirstOrDefaultAsync(f => f.Id == id && !f.IsDeleted);

            return file == null ? null : await MapToDtoAsync(file);
        }

        public async Task<List<LoadFileDto>> GetFilesByOrganizationId(
            long organizationId,
            long? categoryId = null,
            long? propertyId = null,
            long? unitId = null,
            long? leaseId = null,
            DateTime? startDate = null,
            DateTime? endDate = null)
        {
            var query = _context.Files
                .Include(f => f.Category)
                .Include(f => f.Property)
                .Include(f => f.Unit)
                .Include(f => f.Lease)
                .Include(f => f.CreatedByUser)
                .Include(f => f.UpdatedByUser)
                .Where(f => f.OrganizationId == organizationId && !f.IsDeleted);

            if (categoryId.HasValue)
                query = query.Where(f => f.CategoryId == categoryId.Value);

            if (propertyId.HasValue)
                query = query.Where(f => f.PropertyId == propertyId.Value);

            if (unitId.HasValue)
                query = query.Where(f => f.UnitId == unitId.Value);

            if (leaseId.HasValue)
                query = query.Where(f => f.LeaseId == leaseId.Value);

            if (startDate.HasValue)
                query = query.Where(f => f.CreatedAt >= startDate.Value);

            if (endDate.HasValue)
                query = query.Where(f => f.CreatedAt <= endDate.Value);

            var files = await query
                .OrderByDescending(f => f.UpdatedAt ?? f.CreatedAt)
                .ToListAsync();

            var dtos = new List<LoadFileDto>();
            foreach (var file in files)
            {
                dtos.Add(await MapToDtoAsync(file));
            }

            return dtos;
        }

        public async Task<LoadFileDto> UpdateFile(long id, UpdateFileDto file, long? updatedBy)
        {
            var entity = await _context.Files.FindAsync(id);
            if (entity == null || entity.IsDeleted)
                throw new KeyNotFoundException($"File with ID {id} not found");

            if (!string.IsNullOrEmpty(file.Title))
                entity.Title = file.Title;

            if (file.CategoryId.HasValue)
                entity.CategoryId = file.CategoryId.Value;

            if (file.PropertyId.HasValue)
                entity.PropertyId = file.PropertyId.Value;

            if (file.UnitId.HasValue)
                entity.UnitId = file.UnitId.Value;

            if (file.LeaseId.HasValue)
                entity.LeaseId = file.LeaseId.Value;

            if (file.SharingInfo != null)
                entity.SharingInfo = file.SharingInfo;

            entity.UpdatedBy = updatedBy;
            entity.UpdatedAt = DateTime.UtcNow;

            _context.Files.Update(entity);
            await _context.SaveChangesAsync();

            return await MapToDtoAsync(entity);
        }

        public async Task<bool> DeleteFile(long id)
        {
            var file = await _context.Files.FindAsync(id);
            if (file == null || file.IsDeleted)
                return false;

            file.IsDeleted = true;
            file.DeletedAt = DateTime.UtcNow;
            _context.Files.Update(file);
            await _context.SaveChangesAsync();

            return true;
        }

        private async Task<LoadFileDto> MapToDtoAsync(FileEntity file)
        {
            await _context.Entry(file).Reference(f => f.Category).LoadAsync();
            await _context.Entry(file).Reference(f => f.Property).LoadAsync();
            await _context.Entry(file).Reference(f => f.Unit).LoadAsync();
            await _context.Entry(file).Reference(f => f.Lease).LoadAsync();
            await _context.Entry(file).Reference(f => f.CreatedByUser).LoadAsync();
            await _context.Entry(file).Reference(f => f.UpdatedByUser).LoadAsync();

            var dto = _mapper.Map<LoadFileDto>(file);

            // Build location string
            var locationParts = new List<string>();
            if (file.Property != null)
            {
                var propertyName = !string.IsNullOrEmpty(file.Property.Name) 
                    ? file.Property.Name 
                    : file.Property.StreetAddress;
                locationParts.Add(propertyName);
                
                if (file.Property.PropertyType != null)
                {
                    var propertyType = file.Property.PropertyType.ToString();
                    locationParts.Add($"({propertyType})");
                }
            }

            if (file.Unit != null && !string.IsNullOrEmpty(file.Unit.Name))
            {
                locationParts.Add($"- {file.Unit.Name}");
            }

            if (file.Lease != null)
            {
                locationParts.Add("Lease");
            }

            dto.Location = locationParts.Count > 0 ? string.Join(" ", locationParts) : null;
            dto.CategoryName = file.Category?.Name;
            dto.PropertyName = file.Property?.Name;
            dto.UnitName = file.Unit?.Name;
            dto.CreatedByName = file.CreatedByUser != null 
                ? $"{file.CreatedByUser.FirstName} {file.CreatedByUser.LastName}".Trim()
                : null;
            dto.UpdatedByName = file.UpdatedByUser != null 
                ? $"{file.UpdatedByUser.FirstName} {file.UpdatedByUser.LastName}".Trim()
                : null;

            return dto;
        }
    }
}

