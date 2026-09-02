using System.Linq;
using brownstone_hub_api.Services.ScheduledNotificationService;

namespace brownstone_hub_api.Services.ScheduledNotificationService
{
    public class NotificationBackgroundService(
        IServiceProvider serviceProvider,
        ILogger<NotificationBackgroundService> logger) : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider = serviceProvider;
        private readonly ILogger<NotificationBackgroundService> _logger = logger;
        
        // Scheduled times: 6am, 9am, 3pm (15:00), 7pm (19:00)
        private readonly int[] _scheduledHours = { 6, 9, 15, 19 };
        private DateTime _lastRunDate = DateTime.MinValue;
        private HashSet<int> _runHoursToday = new HashSet<int>();

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Notification Background Service started at {Time}", DateTime.Now);
            _logger.LogInformation("Notifications will be processed at 6am, 9am, 3pm, and 7pm daily");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var now = DateTime.Now;
                    var today = now.Date;
                    
                    // Reset the run hours set if it's a new day
                    if (_lastRunDate != today)
                    {
                        _runHoursToday.Clear();
                        _lastRunDate = today;
                        _logger.LogInformation("New day detected, resetting notification schedule for {Date}", today);
                    }
                    
                    // Process scheduled announcements every minute (they can be scheduled for any time)
                    using (var scope = _serviceProvider.CreateScope())
                    {
                        var notificationService = scope.ServiceProvider.GetRequiredService<IScheduledNotificationService>();
                        await notificationService.ProcessScheduledAnnouncements();
                    }

                    // Check if current hour matches any scheduled hour and we haven't run it yet today
                    if (_scheduledHours.Contains(now.Hour) && !_runHoursToday.Contains(now.Hour))
                    {
                        // Only run if we're within the first 5 minutes of the hour to avoid multiple runs
                        if (now.Minute < 5)
                        {
                            _logger.LogInformation("Starting scheduled notification processing at {Time}", now);
                            
                            using (var scope = _serviceProvider.CreateScope())
                            {
                                var notificationService = scope.ServiceProvider.GetRequiredService<IScheduledNotificationService>();
                                await notificationService.ProcessScheduledNotifications();
                            }

                            // Mark this hour as run for today
                            _runHoursToday.Add(now.Hour);
                            _logger.LogInformation("Completed scheduled notification processing. Next scheduled times today: {Times}", 
                                string.Join(", ", _scheduledHours.Where(h => !_runHoursToday.Contains(h)).Select(h => $"{h}:00")));
                        }
                    }

                    // Check every minute to catch scheduled announcements accurately
                    await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in notification background service");
                    // Wait 5 minutes before retrying
                    try
                    {
                        await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
                    }
                    catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                    {
                        break;
                    }
                }
            }

            _logger.LogInformation("Notification Background Service stopped");
        }
    }
}

