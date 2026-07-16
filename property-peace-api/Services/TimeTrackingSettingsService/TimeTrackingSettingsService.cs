using brownstone_hub_api.Dtos.TimeTrackingSettings;
using brownstone_hub_api.Repositories.TimeTrackingSettings;
using Microsoft.AspNetCore.Http;

namespace brownstone_hub_api.Services.TimeTrackingSettingsService
{
    public class TimeTrackingSettingsService(
        ITimeTrackingSettingsRepository timeTrackingSettingsRepository,
        IHttpContextAccessor httpContextAccessor,
        ILogger<TimeTrackingSettingsService> logger) : ITimeTrackingSettingsService
    {
        private readonly ITimeTrackingSettingsRepository _timeTrackingSettingsRepository = timeTrackingSettingsRepository;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly ILogger<TimeTrackingSettingsService> _logger = logger;

        private long? GetOrganizationIdFromContext()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }

        public async Task<ServiceResponse<LoadTimeTrackingSettingsDto>> GetSettings()
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadTimeTrackingSettingsDto>.CreateError("Organization context required", "", "", 400);
                }

                var settings = await _timeTrackingSettingsRepository.GetSettingsByOrganizationId(organizationId.Value);
                if (settings == null)
                {
                    // Create default settings
                    var defaultSettings = new UpdateTimeTrackingSettingsDto
                    {
                        RoundingIncrementMinutes = 15,
                        RoundingMethod = Enums.ETimeRoundingMethod.RoundNearest
                    };
                    var created = await _timeTrackingSettingsRepository.CreateOrUpdateSettings(organizationId.Value, defaultSettings);
                    return ServiceResponse<LoadTimeTrackingSettingsDto>.CreateSuccess(created);
                }

                return ServiceResponse<LoadTimeTrackingSettingsDto>.CreateSuccess(settings);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving time tracking settings");
                return ServiceResponse<LoadTimeTrackingSettingsDto>.CreateError("Error retrieving settings", ex.Message, ex.StackTrace ?? "", 500);
            }
        }

        public async Task<ServiceResponse<LoadTimeTrackingSettingsDto>> UpdateSettings(UpdateTimeTrackingSettingsDto dto)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadTimeTrackingSettingsDto>.CreateError("Organization context required", "", "", 400);
                }

                var result = await _timeTrackingSettingsRepository.CreateOrUpdateSettings(organizationId.Value, dto);
                return ServiceResponse<LoadTimeTrackingSettingsDto>.CreateSuccess(result, "Settings updated successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating time tracking settings");
                return ServiceResponse<LoadTimeTrackingSettingsDto>.CreateError("Error updating settings", ex.Message, ex.StackTrace ?? "", 500);
            }
        }
    }
}
