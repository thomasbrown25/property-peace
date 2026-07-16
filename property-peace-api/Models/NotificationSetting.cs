
namespace brownstone_hub_api.Models
{
    public class NotificationSetting
    {
        public long Id { get; set; }
        public long UserId { get; set; }
        public bool EmailEnabled { get; set; } = true;
        public bool PhoneEnabled { get; set; } = true;
        public string? EmailAddress { get; set; }
        public string? PhoneNumber { get; set; }

        // Nested preference classes stored as JSON or separate columns
        public bool RentRemindersEmail { get; set; } = true;
        public bool RentRemindersPhone { get; set; } = true;
        public bool OverdueAlertsEmail { get; set; } = true;
        public bool OverdueAlertsPhone { get; set; } = true;
        public bool OverdueAlertsInApp { get; set; } = true;
        public bool PaymentConfirmationsEmail { get; set; } = true;
        public bool PaymentConfirmationsPhone { get; set; } = true;
        public bool PaymentConfirmationsInApp { get; set; } = true;
        public bool MaintenanceUpdatesEmail { get; set; } = true;
        public bool MaintenanceUpdatesPhone { get; set; } = true;
        public bool MaintenanceUpdatesInApp { get; set; } = true;
        public bool LeaseExpirationEmail { get; set; } = true;
        public bool LeaseExpirationPhone { get; set; } = true;
        public bool LeaseExpirationInApp { get; set; } = true;
        public bool NewTenantNotificationsEmail { get; set; } = true;
        public bool NewTenantNotificationsPhone { get; set; } = true;
        public bool NewTenantNotificationsInApp { get; set; } = true;
        public bool ApplicationCompletionEmail { get; set; } = true;
        public bool ApplicationCompletionPhone { get; set; } = true;
        public bool ApplicationCompletionInApp { get; set; } = true;
        public bool TenantMessagesEmail { get; set; } = true;
        public bool TenantMessagesPhone { get; set; } = true;
        public bool TenantMessagesInApp { get; set; } = true;
        public bool RentRemindersInApp { get; set; } = true;

        // Daily summary digest preferences
        public bool DailySummaryEmail { get; set; } = true;
        public string? DailySummaryUnsubscribeToken { get; set; }

        // Admin notification preferences
        public bool AdminSubscriptionNotificationsEmail { get; set; } = true;
        public bool AdminSubscriptionNotificationsPhone { get; set; } = true;
        public bool AdminSubscriptionNotificationsInApp { get; set; } = true;
        public bool AdminNewUserNotificationsEmail { get; set; } = true;
        public bool AdminNewUserNotificationsPhone { get; set; } = true;
        public bool AdminNewUserNotificationsInApp { get; set; } = true;

        public DateTime CreatedDate { get; set; } = DateTime.Now;
        public DateTime UpdatedDate { get; set; } = DateTime.Now;
    }
}

