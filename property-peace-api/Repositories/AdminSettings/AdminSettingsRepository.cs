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

        public async Task<Models.AdminSettings> UpdateAdminSettings(
            string notificationEmail,
            bool allPremiumFeaturesOnFreePlan,
            bool maintenanceModeEnabled,
            string maintenanceTitle,
            string maintenanceMessage,
            string maintenanceSupportEmail)
        {
            try
            {
                var settings = await GetOrCreateSettings();

                settings.NotificationEmail = notificationEmail;
                settings.AllPremiumFeaturesOnFreePlan = allPremiumFeaturesOnFreePlan;
                ApplyMaintenanceSettings(settings, maintenanceModeEnabled, maintenanceTitle, maintenanceMessage, maintenanceSupportEmail);

                await _context.SaveChangesAsync();
                return settings;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating admin settings");
                throw;
            }
        }

        public async Task<Models.AdminSettings> UpdateMaintenanceSettings(
            bool maintenanceModeEnabled,
            string maintenanceTitle,
            string maintenanceMessage,
            string maintenanceSupportEmail)
        {
            try
            {
                var settings = await GetOrCreateSettings();
                ApplyMaintenanceSettings(settings, maintenanceModeEnabled, maintenanceTitle, maintenanceMessage, maintenanceSupportEmail);

                await _context.SaveChangesAsync();
                return settings;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating maintenance settings");
                throw;
            }
        }

        private async Task<Models.AdminSettings> GetOrCreateSettings()
        {
            var settings = await _context.AdminSettings.FirstOrDefaultAsync();
            if (settings != null) return settings;

            settings = new Models.AdminSettings
            {
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            await _context.AdminSettings.AddAsync(settings);
            return settings;
        }

        private static void ApplyMaintenanceSettings(
            Models.AdminSettings settings,
            bool maintenanceModeEnabled,
            string maintenanceTitle,
            string maintenanceMessage,
            string maintenanceSupportEmail)
        {
            settings.MaintenanceModeEnabled = maintenanceModeEnabled;
            settings.MaintenanceTitle = string.IsNullOrWhiteSpace(maintenanceTitle)
                ? "Property Peace is getting a quick tune-up"
                : maintenanceTitle.Trim();
            settings.MaintenanceMessage = string.IsNullOrWhiteSpace(maintenanceMessage)
                ? "We’re making updates to improve reliability and performance. Please check back shortly."
                : maintenanceMessage.Trim();
            settings.MaintenanceSupportEmail = string.IsNullOrWhiteSpace(maintenanceSupportEmail)
                ? "support@propertypeace.io"
                : maintenanceSupportEmail.Trim();
            settings.UpdatedAt = DateTime.UtcNow;
        }
    }
}
