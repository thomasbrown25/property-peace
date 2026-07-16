
namespace brownstone_hub_api.Dtos.NotificationSetting
{
    public class NotificationPreferenceDto
    {
        public bool Email { get; set; }
        public bool Phone { get; set; }
        public bool InApp { get; set; } = true;
    }

    public class NotificationSettingDto
    {
        public long Id { get; set; }
        public long UserId { get; set; }
        public bool EmailEnabled { get; set; }
        public bool PhoneEnabled { get; set; }
        public string? EmailAddress { get; set; }
        public string? PhoneNumber { get; set; }
        public NotificationPreferenceDto RentReminders { get; set; } = new();
        public NotificationPreferenceDto OverdueAlerts { get; set; } = new();
        public NotificationPreferenceDto PaymentConfirmations { get; set; } = new();
        public NotificationPreferenceDto MaintenanceUpdates { get; set; } = new();
        public NotificationPreferenceDto LeaseExpiration { get; set; } = new();
        public NotificationPreferenceDto NewTenantNotifications { get; set; } = new();
        public NotificationPreferenceDto ApplicationCompletion { get; set; } = new();
        public NotificationPreferenceDto TenantMessages { get; set; } = new();
        public bool DailySummaryEmail { get; set; } = true;
        public NotificationPreferenceDto AdminSubscriptionNotifications { get; set; } = new();
        public NotificationPreferenceDto AdminNewUserNotifications { get; set; } = new();
    }
}

