using brownstone_hub_api.Dtos.TimeBreak;
using brownstone_hub_api.Dtos.TimeEntry;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.TimeBreaks;
using brownstone_hub_api.Repositories.TimeEntries;
using Microsoft.AspNetCore.Http;

namespace brownstone_hub_api.Services.TimeBreakService
{
    public class TimeBreakService(
        ITimeBreakRepository timeBreakRepository,
        ITimeEntryRepository timeEntryRepository,
        IHttpContextAccessor httpContextAccessor,
        ILogger<TimeBreakService> logger) : ITimeBreakService
    {
        private readonly ITimeBreakRepository _timeBreakRepository = timeBreakRepository;
        private readonly ITimeEntryRepository _timeEntryRepository = timeEntryRepository;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly ILogger<TimeBreakService> _logger = logger;

        private long? GetOrganizationIdFromContext()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }

        public async Task<ServiceResponse<LoadTimeBreakDto>> AddTimeBreak(AddTimeBreakDto dto)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadTimeBreakDto>.CreateError("Organization context required", "", "", 400);
                }

                // Verify time entry exists and belongs to organization
                var timeEntry = await _timeEntryRepository.GetTimeEntryById(dto.TimeEntryId);
                if (timeEntry == null)
                {
                    return ServiceResponse<LoadTimeBreakDto>.CreateError("Time entry not found", "", "", 404);
                }

                if (timeEntry.OrganizationId != organizationId.Value)
                {
                    return ServiceResponse<LoadTimeBreakDto>.CreateError("Unauthorized", "", "", 403);
                }

                var result = await _timeBreakRepository.AddTimeBreak(dto);
                
                // Recalculate hours for the time entry
                if (timeEntry.EndTime.HasValue)
                {
                    // TODO: Trigger recalculation of hours in time entry
                }

                return ServiceResponse<LoadTimeBreakDto>.CreateSuccess(result, "Break added successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding time break");
                return ServiceResponse<LoadTimeBreakDto>.CreateError("Error adding time break", ex.Message, ex.StackTrace ?? "", 500);
            }
        }

        public async Task<ServiceResponse<LoadTimeBreakDto>> UpdateTimeBreak(long id, UpdateTimeBreakDto dto)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadTimeBreakDto>.CreateError("Organization context required", "", "", 400);
                }

                var existing = await _timeBreakRepository.GetTimeBreakById(id);
                if (existing == null)
                {
                    return ServiceResponse<LoadTimeBreakDto>.CreateError("Time break not found", "", "", 404);
                }

                // Verify time entry belongs to organization
                var timeEntry = await _timeEntryRepository.GetTimeEntryById(existing.TimeEntryId);
                if (timeEntry == null || timeEntry.OrganizationId != organizationId.Value)
                {
                    return ServiceResponse<LoadTimeBreakDto>.CreateError("Unauthorized", "", "", 403);
                }

                var result = await _timeBreakRepository.UpdateTimeBreak(dto);
                if (result == null)
                {
                    return ServiceResponse<LoadTimeBreakDto>.CreateError("Failed to update time break", "", "", 500);
                }

                // Recalculate hours for the time entry
                if (timeEntry.EndTime.HasValue)
                {
                    // TODO: Trigger recalculation of hours in time entry
                }

                return ServiceResponse<LoadTimeBreakDto>.CreateSuccess(result, "Break updated successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating time break");
                return ServiceResponse<LoadTimeBreakDto>.CreateError("Error updating time break", ex.Message, ex.StackTrace ?? "", 500);
            }
        }

        public async Task<ServiceResponse<bool>> DeleteTimeBreak(long id)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<bool>.CreateError("Organization context required", "", "", 400);
                }

                var existing = await _timeBreakRepository.GetTimeBreakById(id);
                if (existing == null)
                {
                    return ServiceResponse<bool>.CreateError("Time break not found", "", "", 404);
                }

                // Verify time entry belongs to organization
                var timeEntry = await _timeEntryRepository.GetTimeEntryById(existing.TimeEntryId);
                if (timeEntry == null || timeEntry.OrganizationId != organizationId.Value)
                {
                    return ServiceResponse<bool>.CreateError("Unauthorized", "", "", 403);
                }

                var result = await _timeBreakRepository.DeleteTimeBreak(id);
                
                // Recalculate hours for the time entry
                if (timeEntry.EndTime.HasValue)
                {
                    // TODO: Trigger recalculation of hours in time entry
                }

                return ServiceResponse<bool>.CreateSuccess(result, "Break deleted successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting time break");
                return ServiceResponse<bool>.CreateError("Error deleting time break", ex.Message, ex.StackTrace ?? "", 500);
            }
        }

        public async Task<ServiceResponse<LoadTimeBreakDto>> GetTimeBreakById(long id)
        {
            try
            {
                var timeBreak = await _timeBreakRepository.GetTimeBreakById(id);
                if (timeBreak == null)
                {
                    return ServiceResponse<LoadTimeBreakDto>.CreateError("Time break not found", "", "", 404);
                }

                return ServiceResponse<LoadTimeBreakDto>.CreateSuccess(timeBreak);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving time break");
                return ServiceResponse<LoadTimeBreakDto>.CreateError("Error retrieving time break", ex.Message, ex.StackTrace ?? "", 500);
            }
        }

        public async Task<ServiceResponse<List<LoadTimeBreakDto>>> GetTimeBreaksByTimeEntryId(long timeEntryId)
        {
            try
            {
                var results = await _timeBreakRepository.GetTimeBreaksByTimeEntryId(timeEntryId);
                return ServiceResponse<List<LoadTimeBreakDto>>.CreateSuccess(results);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving time breaks");
                return ServiceResponse<List<LoadTimeBreakDto>>.CreateError("Error retrieving time breaks", ex.Message, ex.StackTrace ?? "", 500);
            }
        }
    }
}
