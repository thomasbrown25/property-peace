using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.NotificationSetting;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.NotificationSettings
{
    public class NotificationSettingRepository(
        DataContext context,
        ILogger<NotificationSettingRepository> logger,
        IMapper mapper) : INotificationSettingRepository
    {
        private readonly DataContext _context = context;
        private readonly ILogger<NotificationSettingRepository> _logger = logger;
        private readonly IMapper _mapper = mapper;

        public async Task<NotificationSettingDto?> GetNotificationSettings(long userId)
        {
            try
            {
                var settings = await _context.NotificationSettings
                    .FirstOrDefaultAsync(s => s.UserId == userId);

                if (settings == null)
                    return null;

                return _mapper.Map<NotificationSettingDto>(settings);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving notification settings for user {UserId}", userId);
                throw;
            }
        }

        public async Task<NotificationSettingDto> AddNotificationSettings(long userId)
        {
            try
            {
                var dbSettings = new NotificationSetting
                {
                    UserId = userId
                };

                _context.NotificationSettings.Add(dbSettings);
                await _context.SaveChangesAsync();

                dbSettings = await _context.NotificationSettings
                    .FirstOrDefaultAsync(x => x.UserId == userId);

                return _mapper.Map<NotificationSettingDto>(dbSettings);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding notification settings for user {UserId}", userId);
                throw;
            }
        }

        public async Task<NotificationSettingDto> UpdateNotificationSettings(NotificationSettingDto notificationSettingDto)
        {
            try
            {
                var dbSettings = await _context.NotificationSettings
                    .FirstOrDefaultAsync(x => x.UserId == notificationSettingDto.UserId);

                if (dbSettings == null)
                {
                    throw new KeyNotFoundException($"Notification settings not found for user {notificationSettingDto.UserId}");
                }

                // Map DTO to entity manually since we need to handle nested preferences
                dbSettings.EmailEnabled = notificationSettingDto.EmailEnabled;
                dbSettings.PhoneEnabled = notificationSettingDto.PhoneEnabled;
                dbSettings.EmailAddress = notificationSettingDto.EmailAddress;
                dbSettings.PhoneNumber = notificationSettingDto.PhoneNumber;
                dbSettings.RentRemindersEmail = notificationSettingDto.RentReminders.Email;
                dbSettings.RentRemindersPhone = notificationSettingDto.RentReminders.Phone;
                dbSettings.RentRemindersInApp = notificationSettingDto.RentReminders.InApp;
                dbSettings.OverdueAlertsEmail = notificationSettingDto.OverdueAlerts.Email;
                dbSettings.OverdueAlertsPhone = notificationSettingDto.OverdueAlerts.Phone;
                dbSettings.OverdueAlertsInApp = notificationSettingDto.OverdueAlerts.InApp;
                dbSettings.PaymentConfirmationsEmail = notificationSettingDto.PaymentConfirmations.Email;
                dbSettings.PaymentConfirmationsPhone = notificationSettingDto.PaymentConfirmations.Phone;
                dbSettings.PaymentConfirmationsInApp = notificationSettingDto.PaymentConfirmations.InApp;
                dbSettings.MaintenanceUpdatesEmail = notificationSettingDto.MaintenanceUpdates.Email;
                dbSettings.MaintenanceUpdatesPhone = notificationSettingDto.MaintenanceUpdates.Phone;
                dbSettings.MaintenanceUpdatesInApp = notificationSettingDto.MaintenanceUpdates.InApp;
                dbSettings.LeaseExpirationEmail = notificationSettingDto.LeaseExpiration.Email;
                dbSettings.LeaseExpirationPhone = notificationSettingDto.LeaseExpiration.Phone;
                dbSettings.LeaseExpirationInApp = notificationSettingDto.LeaseExpiration.InApp;
                dbSettings.NewTenantNotificationsEmail = notificationSettingDto.NewTenantNotifications.Email;
                dbSettings.NewTenantNotificationsPhone = notificationSettingDto.NewTenantNotifications.Phone;
                dbSettings.NewTenantNotificationsInApp = notificationSettingDto.NewTenantNotifications.InApp;
                dbSettings.ApplicationCompletionEmail = notificationSettingDto.ApplicationCompletion.Email;
                dbSettings.ApplicationCompletionPhone = notificationSettingDto.ApplicationCompletion.Phone;
                dbSettings.ApplicationCompletionInApp = notificationSettingDto.ApplicationCompletion.InApp;
                dbSettings.TenantMessagesEmail = notificationSettingDto.TenantMessages?.Email ?? true;
                dbSettings.TenantMessagesPhone = notificationSettingDto.TenantMessages?.Phone ?? false;
                dbSettings.TenantMessagesInApp = notificationSettingDto.TenantMessages?.InApp ?? true;
                dbSettings.DailySummaryEmail = notificationSettingDto.DailySummaryEmail;
                if (string.IsNullOrWhiteSpace(dbSettings.DailySummaryUnsubscribeToken))
                {
                    dbSettings.DailySummaryUnsubscribeToken = Guid.NewGuid().ToString("N");
                }
                dbSettings.AdminSubscriptionNotificationsEmail = notificationSettingDto.AdminSubscriptionNotifications.Email;
                dbSettings.AdminSubscriptionNotificationsPhone = notificationSettingDto.AdminSubscriptionNotifications.Phone;
                dbSettings.AdminSubscriptionNotificationsInApp = notificationSettingDto.AdminSubscriptionNotifications.InApp;
                dbSettings.AdminNewUserNotificationsEmail = notificationSettingDto.AdminNewUserNotifications.Email;
                dbSettings.AdminNewUserNotificationsPhone = notificationSettingDto.AdminNewUserNotifications.Phone;
                dbSettings.AdminNewUserNotificationsInApp = notificationSettingDto.AdminNewUserNotifications.InApp;
                dbSettings.UpdatedDate = DateTime.Now;

                await _context.SaveChangesAsync();

                return notificationSettingDto;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating notification settings for user {UserId}", notificationSettingDto.UserId);
                throw;
            }
        }

        public async Task<long?> GetUserIdByPhoneNumber(string phoneNumber)
        {
            try
            {
                // Normalize to digits only for comparison
                var digitsOnly = new string(phoneNumber.Where(char.IsDigit).ToArray());

                var settings = await _context.NotificationSettings
                    .Where(s => s.PhoneNumber != null && s.PhoneEnabled)
                    .ToListAsync();

                var match = settings.FirstOrDefault(s =>
                {
                    var settingsDigits = new string(s.PhoneNumber!.Where(char.IsDigit).ToArray());
                    // Match last 10 digits to handle +1 country code variations
                    var a = digitsOnly.Length >= 10 ? digitsOnly[^10..] : digitsOnly;
                    var b = settingsDigits.Length >= 10 ? settingsDigits[^10..] : settingsDigits;
                    return a == b;
                });

                return match?.UserId;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error looking up user by phone number");
                throw;
            }
        }
    }
}

