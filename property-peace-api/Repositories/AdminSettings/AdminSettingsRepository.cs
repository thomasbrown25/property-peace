using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Models = brownstone_hub_api.Models;

namespace brownstone_hub_api.Repositories.AdminSettings
{
    public class AdminSettingsRepository(DataContext context, ILogger<AdminSettingsRepository> logger) : IAdminSettingsRepository
    {
        private readonly DataContext _context = context;
        private readonly ILogger<AdminSettingsRepository> _logger = logger;

        public async Task<Models.AdminSettings?> GetAdminSettings()
        {
            try
            {
                // There should only be one admin settings record
                var settings = await _context.AdminSettings.FirstOrDefaultAsync();
                return settings;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving admin settings");
                throw;
            }
        }

        public async Task<Models.AdminSettings> UpdateAdminSettings(string notificationEmail, bool allPremiumFeaturesOnFreePlan)
        {
            try
            {
                var settings = await _context.AdminSettings.FirstOrDefaultAsync();

                if (settings == null)
                {
                    settings = new Models.AdminSettings
                    {
                        NotificationEmail = notificationEmail,
                        AllPremiumFeaturesOnFreePlan = allPremiumFeaturesOnFreePlan,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    await _context.AdminSettings.AddAsync(settings);
                }
                else
                {
                    settings.NotificationEmail = notificationEmail;
                    settings.AllPremiumFeaturesOnFreePlan = allPremiumFeaturesOnFreePlan;
                    settings.UpdatedAt = DateTime.UtcNow;
                    _context.AdminSettings.Update(settings);
                }

                await _context.SaveChangesAsync();
                return settings;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating admin settings");
                throw;
            }
        }
    }
}

