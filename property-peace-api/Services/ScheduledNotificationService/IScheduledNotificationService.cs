namespace brownstone_hub_api.Services.ScheduledNotificationService
{
    public interface IScheduledNotificationService
    {
        Task ProcessScheduledNotifications();
        Task ProcessScheduledAnnouncements();
        /// <summary>Runs rent reminder logic for a single lease (e.g. from admin job). Throws if lease not found.</summary>
        Task ProcessRentRemindersForLeaseAsync(long leaseId);
    }
}

