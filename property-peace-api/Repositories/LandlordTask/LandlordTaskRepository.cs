using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.LandlordTask;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.LandlordTask
{
    public class LandlordTaskRepository(DataContext context) : ILandlordTaskRepository
    {
        private readonly DataContext _context = context;

        public async Task<LoadLandlordTaskDto> AddTask(AddLandlordTaskDto dto, long organizationId)
        {
            var entity = new Models.LandlordTask
            {
                OrganizationId = organizationId,
                Title = dto.Title,
                DueDate = dto.DueDate,
                Category = dto.Category,
                PropertyId = dto.PropertyId,
                IsRecurring = dto.IsRecurring,
                RecurrenceType = dto.RecurrenceType,
                RecurrenceInterval = dto.RecurrenceInterval,
                RecurrenceEndDate = dto.RecurrenceEndDate,
                CreatedAt = DateTime.UtcNow
            };

            await _context.LandlordTasks.AddAsync(entity);
            await _context.SaveChangesAsync();

            return await ProjectToDto(entity.Id);
        }

        public async Task<LoadLandlordTaskDto?> GetTaskById(long id, long organizationId)
        {
            var entity = await _context.LandlordTasks
                .Include(t => t.Property)
                .FirstOrDefaultAsync(t => t.Id == id && t.OrganizationId == organizationId);

            return entity is null ? null : MapToDto(entity);
        }

        public async Task<List<LoadLandlordTaskDto>> GetTasksByOrganization(
            long organizationId, DateTime? from = null, DateTime? to = null, long? propertyId = null)
        {
            var query = _context.LandlordTasks
                .Include(t => t.Property)
                .Where(t => t.OrganizationId == organizationId);

            if (from.HasValue)
                query = query.Where(t => t.DueDate >= from.Value || t.IsRecurring);

            if (to.HasValue)
                query = query.Where(t => t.DueDate <= to.Value || t.IsRecurring);

            if (propertyId.HasValue)
                query = query.Where(t => t.PropertyId == propertyId.Value);

            var tasks = await query.OrderBy(t => t.DueDate).ToListAsync();
            return tasks.Select(MapToDto).ToList();
        }

        public async Task<LoadLandlordTaskDto> UpdateTask(UpdateLandlordTaskDto dto, long organizationId)
        {
            var entity = await _context.LandlordTasks
                .FirstOrDefaultAsync(t => t.Id == dto.Id && t.OrganizationId == organizationId)
                ?? throw new KeyNotFoundException($"Task {dto.Id} not found.");

            entity.Title = dto.Title;
            entity.DueDate = dto.DueDate;
            entity.Category = dto.Category;
            entity.Status = dto.Status;
            entity.PropertyId = dto.PropertyId;
            entity.IsRecurring = dto.IsRecurring;
            entity.RecurrenceType = dto.RecurrenceType;
            entity.RecurrenceInterval = dto.RecurrenceInterval;
            entity.RecurrenceEndDate = dto.RecurrenceEndDate;
            entity.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return await ProjectToDto(entity.Id);
        }

        public async Task<bool> DeleteTask(long id, long organizationId)
        {
            var entity = await _context.LandlordTasks
                .FirstOrDefaultAsync(t => t.Id == id && t.OrganizationId == organizationId);

            if (entity is null) return false;

            _context.LandlordTasks.Remove(entity);
            await _context.SaveChangesAsync();
            return true;
        }

        private async Task<LoadLandlordTaskDto> ProjectToDto(long id)
        {
            var entity = await _context.LandlordTasks
                .Include(t => t.Property)
                .FirstAsync(t => t.Id == id);
            return MapToDto(entity);
        }

        private static LoadLandlordTaskDto MapToDto(Models.LandlordTask t) => new()
        {
            Id = t.Id,
            Title = t.Title,
            DueDate = t.DueDate,
            Category = t.Category,
            Status = t.Status,
            PropertyId = t.PropertyId,
            PropertyName = t.Property?.Name,
            IsRecurring = t.IsRecurring,
            RecurrenceType = t.RecurrenceType,
            RecurrenceInterval = t.RecurrenceInterval,
            RecurrenceEndDate = t.RecurrenceEndDate,
            CreatedAt = t.CreatedAt,
            UpdatedAt = t.UpdatedAt
        };
    }
}
