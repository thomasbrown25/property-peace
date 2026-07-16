using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.TimeBreak;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.TimeBreaks
{
    public class TimeBreakRepository(DataContext context, ILogger<TimeBreakRepository> logger, IMapper mapper) : ITimeBreakRepository
    {
        private readonly DataContext _context = context;
        private readonly ILogger<TimeBreakRepository> _logger = logger;
        private readonly IMapper _mapper = mapper;

        public async Task<LoadTimeBreakDto> AddTimeBreak(AddTimeBreakDto dto)
        {
            try
            {
                var timeBreak = _mapper.Map<TimeBreak>(dto);
                
                // Calculate duration if end time is provided
                if (dto.EndTime.HasValue)
                {
                    var duration = dto.EndTime.Value - dto.StartTime;
                    timeBreak.DurationHours = (decimal)duration.TotalHours;
                }

                await _context.TimeBreaks.AddAsync(timeBreak);
                await _context.SaveChangesAsync();

                return await GetTimeBreakById(timeBreak.Id) ?? throw new Exception("Failed to retrieve created time break");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding time break");
                throw;
            }
        }

        public async Task<LoadTimeBreakDto?> GetTimeBreakById(long id)
        {
            try
            {
                var timeBreak = await _context.TimeBreaks
                    .Include(tb => tb.TimeEntry)
                    .FirstOrDefaultAsync(tb => tb.Id == id);

                if (timeBreak == null)
                    return null;

                return _mapper.Map<LoadTimeBreakDto>(timeBreak);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving time break with ID {TimeBreakId}", id);
                throw;
            }
        }

        public async Task<LoadTimeBreakDto?> UpdateTimeBreak(UpdateTimeBreakDto dto)
        {
            try
            {
                var existing = await _context.TimeBreaks
                    .FirstOrDefaultAsync(tb => tb.Id == dto.Id);

                if (existing == null)
                    return null;

                _mapper.Map(dto, existing);
                
                // Recalculate duration if end time is provided
                if (dto.EndTime.HasValue)
                {
                    var duration = dto.EndTime.Value - dto.StartTime;
                    existing.DurationHours = (decimal)duration.TotalHours;
                }

                existing.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return await GetTimeBreakById(dto.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating time break with ID {TimeBreakId}", dto.Id);
                throw;
            }
        }

        public async Task<bool> DeleteTimeBreak(long id)
        {
            try
            {
                var timeBreak = await _context.TimeBreaks.FindAsync(id);
                if (timeBreak == null)
                    return false;

                _context.TimeBreaks.Remove(timeBreak);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting time break with ID {TimeBreakId}", id);
                throw;
            }
        }

        public async Task<List<LoadTimeBreakDto>> GetTimeBreaksByTimeEntryId(long timeEntryId)
        {
            try
            {
                var timeBreaks = await _context.TimeBreaks
                    .Include(tb => tb.TimeEntry)
                    .Where(tb => tb.TimeEntryId == timeEntryId)
                    .OrderBy(tb => tb.StartTime)
                    .ToListAsync();

                return _mapper.Map<List<LoadTimeBreakDto>>(timeBreaks);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving time breaks for time entry {TimeEntryId}", timeEntryId);
                throw;
            }
        }
    }
}
