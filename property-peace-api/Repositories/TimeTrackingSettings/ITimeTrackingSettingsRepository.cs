using brownstone_hub_api.Dtos.TimeTrackingSettings;

namespace brownstone_hub_api.Repositories.TimeTrackingSettings
{
    public interface ITimeTrackingSettingsRepository
    {
        Task<LoadTimeTrackingSettingsDto?> GetSettingsByOrganizationId(long organizationId);
        Task<LoadTimeTrackingSettingsDto> CreateOrUpdateSettings(long organizationId, UpdateTimeTrackingSettingsDto dto);
    }
}
