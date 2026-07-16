using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.TimeTrackingSettings;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.TimeTrackingSettings
{
    public class TimeTrackingSettingsRepository(DataContext context, ILogger<TimeTrackingSettingsRepository> logger, IMapper mapper) : ITimeTrackingSettingsRepository
    {
        private readonly DataContext _context = context;
        private readonly ILogger<TimeTrackingSettingsRepository> _logger = logger;
        private readonly IMapper _mapper = mapper;

        public async Task<LoadTimeTrackingSettingsDto?> GetSettingsByOrganizationId(long organizationId)
        {
            try
            {
                var settings = await _context.TimeTrackingSettings
                    .Include(s => s.Organization)
                    .FirstOrDefaultAsync(s => s.OrganizationId == organizationId);

                if (settings == null)
                    return null;

                return _mapper.Map<LoadTimeTrackingSettingsDto>(settings);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving time tracking settings for organization {OrganizationId}", organizationId);
                throw;
            }
        }

        public async Task<LoadTimeTrackingSettingsDto> CreateOrUpdateSettings(long organizationId, UpdateTimeTrackingSettingsDto dto)
        {
            try
            {
                var existing = await _context.TimeTrackingSettings
                    .FirstOrDefaultAsync(s => s.OrganizationId == organizationId);

                if (existing == null)
                {
                    // Create new settings
                    var newSettings = new Models.TimeTrackingSettings
                    {
                        OrganizationId = organizationId,
                        RoundingIncrementMinutes = dto.RoundingIncrementMinutes,
                        RoundingMethod = dto.RoundingMethod
                    };
                    await _context.TimeTrackingSettings.AddAsync(newSettings);
                    await _context.SaveChangesAsync();

                    return await GetSettingsByOrganizationId(organizationId) ?? throw new Exception("Failed to retrieve created settings");
                }
                else
                {
                    // Update existing settings
                    existing.RoundingIncrementMinutes = dto.RoundingIncrementMinutes;
                    existing.RoundingMethod = dto.RoundingMethod;
                    existing.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();

                    return await GetSettingsByOrganizationId(organizationId) ?? throw new Exception("Failed to retrieve updated settings");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating/updating time tracking settings for organization {OrganizationId}", organizationId);
                throw;
            }
        }
    }
}
