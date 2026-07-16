using brownstone_hub_api.Dtos.TimeEntry;
using brownstone_hub_api.Dtos.TimeTrackingSettings;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.StaffMembers;
using brownstone_hub_api.Repositories.TimeEntries;
using brownstone_hub_api.Repositories.TimeBreaks;
using brownstone_hub_api.Repositories.TimeTrackingSettings;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Utils;
using Microsoft.AspNetCore.Http;

namespace brownstone_hub_api.Services.TimeEntryService
{
    public class TimeEntryService(
        ITimeEntryRepository timeEntryRepository,
        ITimeBreakRepository timeBreakRepository,
        IStaffMemberRepository staffMemberRepository,
        ITimeTrackingSettingsRepository timeTrackingSettingsRepository,
        IUserRepository userRepository,
        INotificationService notificationService,
        IEmailService emailService,
        IHttpContextAccessor httpContextAccessor,
        ILogger<TimeEntryService> logger) : ITimeEntryService
    {
        private readonly ITimeEntryRepository _timeEntryRepository = timeEntryRepository;
        private readonly ITimeBreakRepository _timeBreakRepository = timeBreakRepository;
        private readonly IStaffMemberRepository _staffMemberRepository = staffMemberRepository;
        private readonly ITimeTrackingSettingsRepository _timeTrackingSettingsRepository = timeTrackingSettingsRepository;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly INotificationService _notificationService = notificationService;
        private readonly IEmailService _emailService = emailService;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly ILogger<TimeEntryService> _logger = logger;

        private async Task<long?> GetCurrentUserIdAsync()
        {
            var user = await _userRepository.GetCurrentUser();
            return user?.Id;
        }

        private long? GetOrganizationIdFromContext()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }

        private async Task<(int RoundingIncrementMinutes, ETimeRoundingMethod RoundingMethod)> GetTimeTrackingSettingsAsync(long organizationId)
        {
            var settings = await _timeTrackingSettingsRepository.GetSettingsByOrganizationId(organizationId);
            if (settings == null)
            {
                // Create default settings if they don't exist
                var defaultSettings = new UpdateTimeTrackingSettingsDto
                {
                    RoundingIncrementMinutes = 15,
                    RoundingMethod = ETimeRoundingMethod.RoundNearest
                };
                var created = await _timeTrackingSettingsRepository.CreateOrUpdateSettings(organizationId, defaultSettings);
                return (created.RoundingIncrementMinutes, created.RoundingMethod);
            }
            return (settings.RoundingIncrementMinutes, settings.RoundingMethod);
        }

        private async Task<decimal> CalculateAndRoundHoursAsync(DateTime startTime, DateTime? endTime, long timeEntryId, long organizationId)
        {
            if (!endTime.HasValue)
                return 0;

            // Calculate raw hours
            var rawHours = (decimal)(endTime.Value - startTime).TotalHours;

            // Get break hours
            var breaks = await _timeBreakRepository.GetTimeBreaksByTimeEntryId(timeEntryId);
            var breakHours = breaks.Sum(b => b.DurationHours ?? 0);

            // Subtract breaks
            var hoursAfterBreaks = rawHours - breakHours;

            // Get rounding settings
            var (incrementMinutes, roundingMethod) = await GetTimeTrackingSettingsAsync(organizationId);

            // Apply rounding
            var roundedHours = TimeRoundingHelper.RoundTime(hoursAfterBreaks, incrementMinutes, roundingMethod);

            return roundedHours;
        }

        public async Task<ServiceResponse<LoadTimeEntryDto>> StartTimer(StartTimerDto dto)
        {
            try
            {
                var userId = await GetCurrentUserIdAsync();
                if (!userId.HasValue)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("User not authenticated", "", "", 401);
                }

                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("Organization context required", "", "", 400);
                }

                // Get staff member for current user
                var staffMember = await _staffMemberRepository.GetStaffMemberByUserId(userId.Value, organizationId.Value);
                if (staffMember == null)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("User is not a staff member", "", "", 403);
                }

                // Check if there's already an active timer (draft entry without end time)
                var existingEntries = await _timeEntryRepository.GetTimeEntriesByStaffMemberId(staffMember.Id);
                var activeTimer = existingEntries.FirstOrDefault(e => e.Status == ETimeEntryStatus.Draft && !e.EndTime.HasValue);
                if (activeTimer != null)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("There is already an active timer. Please stop it first.", "", "", 400);
                }

                var addDto = new AddTimeEntryDto
                {
                    StaffMemberId = staffMember.Id,
                    PropertyId = dto.PropertyId,
                    MaintenanceRequestId = dto.MaintenanceRequestId,
                    UnitId = dto.UnitId,
                    OrganizationId = organizationId.Value,
                    StartTime = DateTime.UtcNow,
                    EndTime = null,
                    Description = dto.Description
                };

                var result = await _timeEntryRepository.AddTimeEntry(addDto);
                return ServiceResponse<LoadTimeEntryDto>.CreateSuccess(result, "Timer started successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error starting timer");
                return ServiceResponse<LoadTimeEntryDto>.CreateError("Error starting timer", ex.Message, ex.StackTrace ?? "", 500);
            }
        }

        public async Task<ServiceResponse<LoadTimeEntryDto>> StopTimer(long timeEntryId, StopTimerDto dto)
        {
            try
            {
                var userId = await GetCurrentUserIdAsync();
                if (!userId.HasValue)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("User not authenticated", "", "", 401);
                }

                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("Organization context required", "", "", 400);
                }

                var timeEntry = await _timeEntryRepository.GetTimeEntryById(timeEntryId);
                if (timeEntry == null)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("Time entry not found", "", "", 404);
                }

                // Verify ownership
                var staffMember = await _staffMemberRepository.GetStaffMemberByUserId(userId.Value, organizationId.Value);
                if (staffMember == null || timeEntry.StaffMemberId != staffMember.Id)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("Unauthorized to stop this timer", "", "", 403);
                }

                if (timeEntry.EndTime.HasValue)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("Timer is already stopped", "", "", 400);
                }

                var endTime = DateTime.UtcNow;
                var hoursWorked = await CalculateAndRoundHoursAsync(timeEntry.StartTime, endTime, timeEntryId, organizationId.Value);

                var updateDto = new UpdateTimeEntryDto
                {
                    Id = timeEntryId,
                    PropertyId = timeEntry.PropertyId,
                    MaintenanceRequestId = timeEntry.MaintenanceRequestId,
                    UnitId = timeEntry.UnitId,
                    StartTime = timeEntry.StartTime,
                    EndTime = endTime,
                    HoursWorked = hoursWorked,
                    Description = timeEntry.Description,
                    Notes = dto.Notes ?? timeEntry.Notes,
                    Status = ETimeEntryStatus.Draft,
                    IsBillable = timeEntry.IsBillable
                };

                var result = await _timeEntryRepository.UpdateTimeEntry(updateDto);
                if (result == null)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("Failed to update time entry", "", "", 500);
                }

                return ServiceResponse<LoadTimeEntryDto>.CreateSuccess(result, "Timer stopped successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error stopping timer");
                return ServiceResponse<LoadTimeEntryDto>.CreateError("Error stopping timer", ex.Message, ex.StackTrace ?? "", 500);
            }
        }

        public async Task<ServiceResponse<LoadTimeEntryDto>> CreateTimeEntry(AddTimeEntryDto dto)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("Organization context required", "", "", 400);
                }

                dto.OrganizationId = organizationId.Value;

                // Calculate hours if end time is provided
                if (dto.EndTime.HasValue)
                {
                    var tempEntry = await _timeEntryRepository.AddTimeEntry(dto);
                    var hoursWorked = await CalculateAndRoundHoursAsync(dto.StartTime, dto.EndTime, tempEntry.Id, organizationId.Value);
                    
                    var updateDto = new UpdateTimeEntryDto
                    {
                        Id = tempEntry.Id,
                        PropertyId = dto.PropertyId,
                        MaintenanceRequestId = dto.MaintenanceRequestId,
                        UnitId = dto.UnitId,
                        StartTime = dto.StartTime,
                        EndTime = dto.EndTime,
                        HoursWorked = hoursWorked,
                        Description = dto.Description,
                        Notes = dto.Notes,
                        Status = ETimeEntryStatus.Draft,
                        IsBillable = dto.IsBillable
                    };

                    var result = await _timeEntryRepository.UpdateTimeEntry(updateDto);
                    return ServiceResponse<LoadTimeEntryDto>.CreateSuccess(result ?? tempEntry, "Time entry created successfully");
                }

                var result2 = await _timeEntryRepository.AddTimeEntry(dto);
                return ServiceResponse<LoadTimeEntryDto>.CreateSuccess(result2, "Time entry created successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating time entry");
                return ServiceResponse<LoadTimeEntryDto>.CreateError("Error creating time entry", ex.Message, ex.StackTrace ?? "", 500);
            }
        }

        public async Task<ServiceResponse<LoadTimeEntryDto>> UpdateTimeEntry(long id, UpdateTimeEntryDto dto)
        {
            try
            {
                var existing = await _timeEntryRepository.GetTimeEntryById(id);
                if (existing == null)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("Time entry not found", "", "", 404);
                }

                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue || existing.OrganizationId != organizationId.Value)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("Unauthorized", "", "", 403);
                }

                // Recalculate hours if end time is provided
                if (dto.EndTime.HasValue)
                {
                    dto.HoursWorked = await CalculateAndRoundHoursAsync(dto.StartTime, dto.EndTime, id, organizationId.Value);
                }

                var result = await _timeEntryRepository.UpdateTimeEntry(dto);
                if (result == null)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("Failed to update time entry", "", "", 500);
                }

                return ServiceResponse<LoadTimeEntryDto>.CreateSuccess(result, "Time entry updated successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating time entry");
                return ServiceResponse<LoadTimeEntryDto>.CreateError("Error updating time entry", ex.Message, ex.StackTrace ?? "", 500);
            }
        }

        public async Task<ServiceResponse<bool>> DeleteTimeEntry(long id)
        {
            try
            {
                var existing = await _timeEntryRepository.GetTimeEntryById(id);
                if (existing == null)
                {
                    return ServiceResponse<bool>.CreateError("Time entry not found", "", "", 404);
                }

                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue || existing.OrganizationId != organizationId.Value)
                {
                    return ServiceResponse<bool>.CreateError("Unauthorized", "", "", 403);
                }

                // Only allow deletion of draft entries
                if (existing.Status != ETimeEntryStatus.Draft)
                {
                    return ServiceResponse<bool>.CreateError("Only draft time entries can be deleted", "", "", 400);
                }

                var result = await _timeEntryRepository.DeleteTimeEntry(id);
                return ServiceResponse<bool>.CreateSuccess(result, "Time entry deleted successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting time entry");
                return ServiceResponse<bool>.CreateError("Error deleting time entry", ex.Message, ex.StackTrace ?? "", 500);
            }
        }

        public async Task<ServiceResponse<LoadTimeEntryDto>> GetTimeEntryById(long id)
        {
            try
            {
                var timeEntry = await _timeEntryRepository.GetTimeEntryById(id);
                if (timeEntry == null)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("Time entry not found", "", "", 404);
                }

                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue || timeEntry.OrganizationId != organizationId.Value)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("Unauthorized", "", "", 403);
                }

                return ServiceResponse<LoadTimeEntryDto>.CreateSuccess(timeEntry);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving time entry");
                return ServiceResponse<LoadTimeEntryDto>.CreateError("Error retrieving time entry", ex.Message, ex.StackTrace ?? "", 500);
            }
        }

        public async Task<ServiceResponse<List<LoadTimeEntryDto>>> GetTimeEntries(long? propertyId = null, long? staffMemberId = null, DateTime? startDate = null, DateTime? endDate = null, ETimeEntryStatus? status = null)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<List<LoadTimeEntryDto>>.CreateError("Organization context required", "", "", 400);
                }

                List<LoadTimeEntryDto> results;

                if (propertyId.HasValue)
                {
                    results = await _timeEntryRepository.GetTimeEntriesByPropertyId(propertyId.Value, startDate, endDate);
                }
                else if (staffMemberId.HasValue)
                {
                    results = await _timeEntryRepository.GetTimeEntriesByStaffMemberId(staffMemberId.Value, startDate, endDate);
                }
                else if (status.HasValue)
                {
                    results = await _timeEntryRepository.GetTimeEntriesByStatus(organizationId.Value, status.Value, startDate, endDate);
                }
                else
                {
                    results = await _timeEntryRepository.GetTimeEntriesByOrganizationId(organizationId.Value, startDate, endDate);
                }

                // Filter by status if provided
                if (status.HasValue)
                {
                    results = results.Where(e => e.Status == status.Value).ToList();
                }

                return ServiceResponse<List<LoadTimeEntryDto>>.CreateSuccess(results);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving time entries");
                return ServiceResponse<List<LoadTimeEntryDto>>.CreateError("Error retrieving time entries", ex.Message, ex.StackTrace ?? "", 500);
            }
        }

        public async Task<ServiceResponse<List<LoadTimeEntryDto>>> GetTimeEntriesByProperty(long propertyId, DateTime? startDate = null, DateTime? endDate = null)
        {
            try
            {
                var results = await _timeEntryRepository.GetTimeEntriesByPropertyId(propertyId, startDate, endDate);
                return ServiceResponse<List<LoadTimeEntryDto>>.CreateSuccess(results);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving time entries by property");
                return ServiceResponse<List<LoadTimeEntryDto>>.CreateError("Error retrieving time entries", ex.Message, ex.StackTrace ?? "", 500);
            }
        }

        public async Task<ServiceResponse<List<LoadTimeEntryDto>>> GetTimeEntriesByStaffMember(long staffMemberId, DateTime? startDate = null, DateTime? endDate = null)
        {
            try
            {
                var results = await _timeEntryRepository.GetTimeEntriesByStaffMemberId(staffMemberId, startDate, endDate);
                return ServiceResponse<List<LoadTimeEntryDto>>.CreateSuccess(results);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving time entries by staff member");
                return ServiceResponse<List<LoadTimeEntryDto>>.CreateError("Error retrieving time entries", ex.Message, ex.StackTrace ?? "", 500);
            }
        }

        public async Task<ServiceResponse<List<LoadTimeEntryDto>>> GetTimeEntriesByMaintenanceRequest(long maintenanceRequestId)
        {
            try
            {
                var results = await _timeEntryRepository.GetTimeEntriesByMaintenanceRequestId(maintenanceRequestId);
                return ServiceResponse<List<LoadTimeEntryDto>>.CreateSuccess(results);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving time entries by maintenance request");
                return ServiceResponse<List<LoadTimeEntryDto>>.CreateError("Error retrieving time entries", ex.Message, ex.StackTrace ?? "", 500);
            }
        }

        public async Task<ServiceResponse<List<LoadTimeEntryDto>>> GetPendingApprovals()
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<List<LoadTimeEntryDto>>.CreateError("Organization context required", "", "", 400);
                }

                var results = await _timeEntryRepository.GetPendingApprovals(organizationId.Value);
                return ServiceResponse<List<LoadTimeEntryDto>>.CreateSuccess(results);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving pending approvals");
                return ServiceResponse<List<LoadTimeEntryDto>>.CreateError("Error retrieving pending approvals", ex.Message, ex.StackTrace ?? "", 500);
            }
        }

        public async Task<ServiceResponse<LoadTimeEntryDto>> SubmitForApproval(long id, SubmitTimeEntryDto dto)
        {
            try
            {
                var userId = await GetCurrentUserIdAsync();
                if (!userId.HasValue)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("User not authenticated", "", "", 401);
                }

                var timeEntry = await _timeEntryRepository.GetTimeEntryById(id);
                if (timeEntry == null)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("Time entry not found", "", "", 404);
                }

                // Verify ownership
                var staffMember = await _staffMemberRepository.GetStaffMemberByUserId(userId.Value, timeEntry.OrganizationId);
                if (staffMember == null || timeEntry.StaffMemberId != staffMember.Id)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("Unauthorized to submit this time entry", "", "", 403);
                }

                if (timeEntry.Status != ETimeEntryStatus.Draft)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("Only draft time entries can be submitted", "", "", 400);
                }

                if (!timeEntry.EndTime.HasValue)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("Time entry must have an end time before submission", "", "", 400);
                }

                var updateDto = new UpdateTimeEntryDto
                {
                    Id = id,
                    PropertyId = timeEntry.PropertyId,
                    MaintenanceRequestId = timeEntry.MaintenanceRequestId,
                    UnitId = timeEntry.UnitId,
                    StartTime = timeEntry.StartTime,
                    EndTime = timeEntry.EndTime,
                    HoursWorked = timeEntry.HoursWorked,
                    Description = timeEntry.Description,
                    Notes = dto.Notes ?? timeEntry.Notes,
                    Status = ETimeEntryStatus.Submitted,
                    IsBillable = timeEntry.IsBillable
                };

                var result = await _timeEntryRepository.UpdateTimeEntry(updateDto);
                if (result == null)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("Failed to submit time entry", "", "", 500);
                }

                // Send notification to organization managers
                // TODO: Implement notification logic

                return ServiceResponse<LoadTimeEntryDto>.CreateSuccess(result, "Time entry submitted for approval");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error submitting time entry for approval");
                return ServiceResponse<LoadTimeEntryDto>.CreateError("Error submitting time entry", ex.Message, ex.StackTrace ?? "", 500);
            }
        }

        public async Task<ServiceResponse<LoadTimeEntryDto>> ApproveTimeEntry(long id, ApproveTimeEntryDto dto)
        {
            try
            {
                var userId = await GetCurrentUserIdAsync();
                if (!userId.HasValue)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("User not authenticated", "", "", 401);
                }

                var timeEntry = await _timeEntryRepository.GetTimeEntryById(id);
                if (timeEntry == null)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("Time entry not found", "", "", 404);
                }

                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue || timeEntry.OrganizationId != organizationId.Value)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("Unauthorized", "", "", 403);
                }

                if (timeEntry.Status != ETimeEntryStatus.Submitted)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("Only submitted time entries can be approved", "", "", 400);
                }

                var updateDto = new UpdateTimeEntryDto
                {
                    Id = id,
                    PropertyId = timeEntry.PropertyId,
                    MaintenanceRequestId = timeEntry.MaintenanceRequestId,
                    UnitId = timeEntry.UnitId,
                    StartTime = timeEntry.StartTime,
                    EndTime = timeEntry.EndTime,
                    HoursWorked = timeEntry.HoursWorked,
                    Description = timeEntry.Description,
                    Notes = timeEntry.Notes,
                    Status = ETimeEntryStatus.Approved,
                    IsBillable = timeEntry.IsBillable
                };

                // Update approved by and approved at in repository
                var result = await _timeEntryRepository.UpdateTimeEntry(updateDto);
                if (result == null)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("Failed to approve time entry", "", "", 500);
                }

                // TODO: Send notification to staff member
                // TODO: Update approved by and approved at fields

                return ServiceResponse<LoadTimeEntryDto>.CreateSuccess(result, "Time entry approved successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error approving time entry");
                return ServiceResponse<LoadTimeEntryDto>.CreateError("Error approving time entry", ex.Message, ex.StackTrace ?? "", 500);
            }
        }

        public async Task<ServiceResponse<LoadTimeEntryDto>> RejectTimeEntry(long id, ApproveTimeEntryDto dto)
        {
            try
            {
                var userId = await GetCurrentUserIdAsync();
                if (!userId.HasValue)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("User not authenticated", "", "", 401);
                }

                var timeEntry = await _timeEntryRepository.GetTimeEntryById(id);
                if (timeEntry == null)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("Time entry not found", "", "", 404);
                }

                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue || timeEntry.OrganizationId != organizationId.Value)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("Unauthorized", "", "", 403);
                }

                if (timeEntry.Status != ETimeEntryStatus.Submitted)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("Only submitted time entries can be rejected", "", "", 400);
                }

                var updateDto = new UpdateTimeEntryDto
                {
                    Id = id,
                    PropertyId = timeEntry.PropertyId,
                    MaintenanceRequestId = timeEntry.MaintenanceRequestId,
                    UnitId = timeEntry.UnitId,
                    StartTime = timeEntry.StartTime,
                    EndTime = timeEntry.EndTime,
                    HoursWorked = timeEntry.HoursWorked,
                    Description = timeEntry.Description,
                    Notes = timeEntry.Notes,
                    Status = ETimeEntryStatus.Rejected,
                    IsBillable = timeEntry.IsBillable
                };

                var result = await _timeEntryRepository.UpdateTimeEntry(updateDto);
                if (result == null)
                {
                    return ServiceResponse<LoadTimeEntryDto>.CreateError("Failed to reject time entry", "", "", 500);
                }

                // TODO: Send notification to staff member with rejection reason
                // TODO: Update rejection reason field

                return ServiceResponse<LoadTimeEntryDto>.CreateSuccess(result, "Time entry rejected");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error rejecting time entry");
                return ServiceResponse<LoadTimeEntryDto>.CreateError("Error rejecting time entry", ex.Message, ex.StackTrace ?? "", 500);
            }
        }
    }
}
