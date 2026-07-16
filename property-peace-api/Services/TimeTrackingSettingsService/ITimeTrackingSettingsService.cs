using brownstone_hub_api.Dtos.TimeTrackingSettings;

namespace brownstone_hub_api.Services.TimeTrackingSettingsService
{
    public interface ITimeTrackingSettingsService
    {
        Task<ServiceResponse<LoadTimeTrackingSettingsDto>> GetSettings();
        Task<ServiceResponse<LoadTimeTrackingSettingsDto>> UpdateSettings(UpdateTimeTrackingSettingsDto dto);
    }
}
