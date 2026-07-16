using AutoMapper;
using AutoMapper.QueryableExtensions;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.TimeEntry;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.TimeEntries
{
    public class TimeEntryRepository(DataContext context, ILogger<TimeEntryRepository> logger, IMapper mapper) : ITimeEntryRepository
    {
        private readonly DataContext _context = context;
        private readonly ILogger<TimeEntryRepository> _logger = logger;
        private readonly IMapper _mapper = mapper;

        public async Task<LoadTimeEntryDto> AddTimeEntry(AddTimeEntryDto dto)
        {
            try
            {
                var timeEntry = _mapper.Map<TimeEntry>(dto);
                await _context.TimeEntries.AddAsync(timeEntry);
                await _context.SaveChangesAsync();

                return await GetTimeEntryById(timeEntry.Id) ?? throw new Exception("Failed to retrieve created time entry");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding time entry");
                throw;
            }
        }

        public async Task<LoadTimeEntryDto?> GetTimeEntryById(long id)
        {
            try
            {
                var timeEntry = await _context.TimeEntries
                    .Include(t => t.StaffMember)
                        .ThenInclude(s => s.User)
                    .Include(t => t.Property)
                    .Include(t => t.MaintenanceRequest)
                    .Include(t => t.Unit)
                    .Include(t => t.Organization)
                    .Include(t => t.ApprovedBy)
                    .Include(t => t.Breaks)
                    .FirstOrDefaultAsync(t => t.Id == id);

                if (timeEntry == null)
                    return null;

                return _mapper.Map<LoadTimeEntryDto>(timeEntry);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving time entry with ID {TimeEntryId}", id);
                throw;
            }
        }

        public async Task<LoadTimeEntryDto?> UpdateTimeEntry(UpdateTimeEntryDto dto)
        {
            try
            {
                var existing = await _context.TimeEntries
                    .FirstOrDefaultAsync(t => t.Id == dto.Id);

                if (existing == null)
                    return null;

                _mapper.Map(dto, existing);
                existing.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return await GetTimeEntryById(dto.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating time entry with ID {TimeEntryId}", dto.Id);
                throw;
            }
        }

        public async Task<bool> DeleteTimeEntry(long id)
        {
            try
            {
                var timeEntry = await _context.TimeEntries.FindAsync(id);
                if (timeEntry == null)
                    return false;

                _context.TimeEntries.Remove(timeEntry);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting time entry with ID {TimeEntryId}", id);
                throw;
            }
        }

        public async Task<List<LoadTimeEntryDto>> GetTimeEntriesByOrganizationId(long organizationId, DateTime? startDate = null, DateTime? endDate = null)
        {
            try
            {
                var query = _context.TimeEntries
                    .Include(t => t.StaffMember)
                        .ThenInclude(s => s.User)
                    .Include(t => t.Property)
                    .Include(t => t.MaintenanceRequest)
                    .Include(t => t.Unit)
                    .Include(t => t.ApprovedBy)
                    .Include(t => t.Breaks)
                    .Where(t => t.OrganizationId == organizationId);

                if (startDate.HasValue)
                    query = query.Where(t => t.StartTime >= startDate.Value);

                if (endDate.HasValue)
                    query = query.Where(t => t.StartTime <= endDate.Value);

                var timeEntries = await query
                    .OrderByDescending(t => t.StartTime)
                    .ToListAsync();

                return _mapper.Map<List<LoadTimeEntryDto>>(timeEntries);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving time entries for organization {OrganizationId}", organizationId);
                throw;
            }
        }

        public async Task<List<LoadTimeEntryDto>> GetTimeEntriesByPropertyId(long propertyId, DateTime? startDate = null, DateTime? endDate = null)
        {
            try
            {
                var query = _context.TimeEntries
                    .Include(t => t.StaffMember)
                        .ThenInclude(s => s.User)
                    .Include(t => t.Property)
                    .Include(t => t.MaintenanceRequest)
                    .Include(t => t.Unit)
                    .Include(t => t.ApprovedBy)
                    .Include(t => t.Breaks)
                    .Where(t => t.PropertyId == propertyId);

                if (startDate.HasValue)
                    query = query.Where(t => t.StartTime >= startDate.Value);

                if (endDate.HasValue)
                    query = query.Where(t => t.StartTime <= endDate.Value);

                var timeEntries = await query
                    .OrderByDescending(t => t.StartTime)
                    .ToListAsync();

                return _mapper.Map<List<LoadTimeEntryDto>>(timeEntries);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving time entries for property {PropertyId}", propertyId);
                throw;
            }
        }

        public async Task<List<LoadTimeEntryDto>> GetTimeEntriesByStaffMemberId(long staffMemberId, DateTime? startDate = null, DateTime? endDate = null)
        {
            try
            {
                var query = _context.TimeEntries
                    .Include(t => t.StaffMember)
                        .ThenInclude(s => s.User)
                    .Include(t => t.Property)
                    .Include(t => t.MaintenanceRequest)
                    .Include(t => t.Unit)
                    .Include(t => t.ApprovedBy)
                    .Include(t => t.Breaks)
                    .Where(t => t.StaffMemberId == staffMemberId);

                if (startDate.HasValue)
                    query = query.Where(t => t.StartTime >= startDate.Value);

                if (endDate.HasValue)
                    query = query.Where(t => t.StartTime <= endDate.Value);

                var timeEntries = await query
                    .OrderByDescending(t => t.StartTime)
                    .ToListAsync();

                return _mapper.Map<List<LoadTimeEntryDto>>(timeEntries);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving time entries for staff member {StaffMemberId}", staffMemberId);
                throw;
            }
        }

        public async Task<List<LoadTimeEntryDto>> GetTimeEntriesByMaintenanceRequestId(long maintenanceRequestId)
        {
            try
            {
                var timeEntries = await _context.TimeEntries
                    .Include(t => t.StaffMember)
                        .ThenInclude(s => s.User)
                    .Include(t => t.Property)
                    .Include(t => t.MaintenanceRequest)
                    .Include(t => t.Unit)
                    .Include(t => t.ApprovedBy)
                    .Include(t => t.Breaks)
                    .Where(t => t.MaintenanceRequestId == maintenanceRequestId)
                    .OrderByDescending(t => t.StartTime)
                    .ToListAsync();

                return _mapper.Map<List<LoadTimeEntryDto>>(timeEntries);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving time entries for maintenance request {MaintenanceRequestId}", maintenanceRequestId);
                throw;
            }
        }

        public async Task<List<LoadTimeEntryDto>> GetPendingApprovals(long organizationId)
        {
            try
            {
                var timeEntries = await _context.TimeEntries
                    .Include(t => t.StaffMember)
                        .ThenInclude(s => s.User)
                    .Include(t => t.Property)
                    .Include(t => t.MaintenanceRequest)
                    .Include(t => t.Unit)
                    .Include(t => t.ApprovedBy)
                    .Include(t => t.Breaks)
                    .Where(t => t.OrganizationId == organizationId && t.Status == ETimeEntryStatus.Submitted)
                    .OrderByDescending(t => t.CreatedAt)
                    .ToListAsync();

                return _mapper.Map<List<LoadTimeEntryDto>>(timeEntries);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving pending approvals for organization {OrganizationId}", organizationId);
                throw;
            }
        }

        public async Task<List<LoadTimeEntryDto>> GetTimeEntriesByStatus(long organizationId, ETimeEntryStatus status, DateTime? startDate = null, DateTime? endDate = null)
        {
            try
            {
                var query = _context.TimeEntries
                    .Include(t => t.StaffMember)
                        .ThenInclude(s => s.User)
                    .Include(t => t.Property)
                    .Include(t => t.MaintenanceRequest)
                    .Include(t => t.Unit)
                    .Include(t => t.ApprovedBy)
                    .Include(t => t.Breaks)
                    .Where(t => t.OrganizationId == organizationId && t.Status == status);

                if (startDate.HasValue)
                    query = query.Where(t => t.StartTime >= startDate.Value);

                if (endDate.HasValue)
                    query = query.Where(t => t.StartTime <= endDate.Value);

                var timeEntries = await query
                    .OrderByDescending(t => t.StartTime)
                    .ToListAsync();

                return _mapper.Map<List<LoadTimeEntryDto>>(timeEntries);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving time entries by status for organization {OrganizationId}", organizationId);
                throw;
            }
        }
    }
}
