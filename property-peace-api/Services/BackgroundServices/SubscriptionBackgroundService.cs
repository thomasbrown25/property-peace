using brownstone_hub_api.Repositories.Subscriptions;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Repositories.Organizations;

namespace brownstone_hub_api.Services.BackgroundServices
{
    public class SubscriptionBackgroundService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<SubscriptionBackgroundService> _logger;
        private readonly TimeSpan _checkInterval = TimeSpan.FromHours(24); // Run daily

        public SubscriptionBackgroundService(
            IServiceProvider serviceProvider,
            ILogger<SubscriptionBackgroundService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("SubscriptionBackgroundService started");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await ProcessSubscriptionsAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in SubscriptionBackgroundService");
                }

                try
                {
                    await Task.Delay(_checkInterval, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
            }
        }

        private async Task ProcessSubscriptionsAsync()
        {
            using var scope = _serviceProvider.CreateScope();
            var subscriptionRepository = scope.ServiceProvider.GetRequiredService<ISubscriptionRepository>();
            var historyRepository = scope.ServiceProvider.GetRequiredService<ISubscriptionHistoryRepository>();
            var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();
            var organizationRepository = scope.ServiceProvider.GetRequiredService<brownstone_hub_api.Repositories.Organizations.IOrganizationRepository>();
            var memberRepository = scope.ServiceProvider.GetRequiredService<brownstone_hub_api.Repositories.Organizations.IOrganizationMemberRepository>();

            try
            {
                // Check for expiring trials (3 days before, 1 day before, and on expiration day)
                var today = DateTime.Now.Date;
                var threeDaysFromNow = today.AddDays(3);
                var oneDayFromNow = today.AddDays(1);

                // Get trials expiring in 3 days
                var expiringIn3Days = await subscriptionRepository.GetExpiringTrialsAsync(threeDaysFromNow);
                foreach (var subscription in expiringIn3Days)
                {
                    await SendTrialExpirationWarningAsync(notificationService, organizationRepository, memberRepository, subscription, 3);
                }

                // Get trials expiring in 1 day
                var expiringIn1Day = await subscriptionRepository.GetExpiringTrialsAsync(oneDayFromNow);
                foreach (var subscription in expiringIn1Day)
                {
                    await SendTrialExpirationWarningAsync(notificationService, organizationRepository, memberRepository, subscription, 1);
                }

                // Get trials expiring today
                var expiringToday = await subscriptionRepository.GetExpiringTrialsAsync(today);
                foreach (var subscription in expiringToday)
                {
                    await SendTrialExpirationWarningAsync(notificationService, organizationRepository, memberRepository, subscription, 0);

                    // Update subscription status if trial has ended
                    if (subscription.TrialEnd.HasValue && subscription.TrialEnd.Value.Date <= today)
                    {
                        subscription.Status = "TrialExpired";
                        await subscriptionRepository.UpdateSubscriptionAsync(subscription);

                        await historyRepository.AddHistoryAsync(new Models.SubscriptionHistory
                        {
                            SubscriptionId = subscription.Id,
                            EventType = "TrialExpired"
                        });
                    }
                }

                // Check for subscriptions that need to be paused (period ended)
                var subscriptionsToPause = await subscriptionRepository.GetSubscriptionsToPauseAsync();
                foreach (var subscription in subscriptionsToPause)
                {
                    if (subscription.PausedAtPeriodEnd &&
                        subscription.CurrentPeriodEnd.HasValue &&
                        subscription.CurrentPeriodEnd.Value.Date <= today &&
                        subscription.Status != "Paused")
                    {
                        subscription.Status = "Paused";
                        subscription.PausedAt = DateTime.UtcNow;
                        await subscriptionRepository.UpdateSubscriptionAsync(subscription);

                        await historyRepository.AddHistoryAsync(new Models.SubscriptionHistory
                        {
                            SubscriptionId = subscription.Id,
                            EventType = "Paused"
                        });

                        _logger.LogInformation("Subscription {SubscriptionId} has been paused (period ended)", subscription.Id);
                    }
                }

                // Check for subscriptions that need renewal reminders
                var activeSubscriptions = await subscriptionRepository.GetActiveSubscriptionsAsync();
                foreach (var subscription in activeSubscriptions)
                {
                    if (subscription.CurrentPeriodEnd.HasValue &&
                        subscription.Status == "Active" &&
                        !subscription.CancelAtPeriodEnd &&
                        !subscription.PausedAtPeriodEnd)
                    {
                        var daysUntilRenewal = (subscription.CurrentPeriodEnd.Value.Date - today).Days;

                        // Send reminder 7 days before renewal
                        if (daysUntilRenewal == 7)
                        {
                            await SendRenewalReminderAsync(notificationService, organizationRepository, memberRepository, subscription);
                        }
                    }
                }

                _logger.LogInformation("Subscription background processing completed");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing subscriptions");
            }
        }

        private async Task SendTrialExpirationWarningAsync(
            INotificationService notificationService,
            IOrganizationRepository organizationRepository,
            IOrganizationMemberRepository memberRepository,
            Models.Subscription subscription,
            int daysRemaining)
        {
            try
            {
                // Only organization (landlord) subscriptions get trial expiration emails
                if (!subscription.OrganizationId.HasValue)
                    return;

                // Get organization and notify all owners/managers
                var organization = await organizationRepository.GetOrganizationByIdAsync(subscription.OrganizationId.Value);
                if (organization == null)
                {
                    _logger.LogWarning("Cannot send trial expiration warning: organization {OrganizationId} not found for subscription {SubscriptionId}", subscription.OrganizationId, subscription.Id);
                    return;
                }

                var message = daysRemaining switch
                {
                    0 => "Your organization's free trial has ended today. Please subscribe to continue using the service.",
                    1 => "Your organization's free trial ends tomorrow. Please subscribe to continue using the service.",
                    _ => $"Your organization's free trial ends in {daysRemaining} days. Please subscribe to continue using the service."
                };

                // Get all owners and managers of the organization
                var members = await memberRepository.GetMembersByOrganizationIdAsync(subscription.OrganizationId.Value);
                var ownersAndManagers = members.Where(m => m.IsActive && (m.Role == "Owner" || m.Role == "Manager") && m.UserId.HasValue);

                foreach (var member in ownersAndManagers)
                {
                    var notificationDto = new CreateNotificationDto
                    {
                        UserId = member.UserId!.Value,
                        Type = ENotificationType.System,
                        Title = "Trial Expiring Soon",
                        Message = message,
                        RelatedId = subscription.Id,
                        SendEmail = true,
                        SendSMS = false // SMS for trial expiration might be too frequent
                    };

                    await notificationService.CreateNotification(notificationDto);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending trial expiration warning for subscription {SubscriptionId}", subscription.Id);
            }
        }

        private async Task SendRenewalReminderAsync(
            INotificationService notificationService,
            IOrganizationRepository organizationRepository,
            IOrganizationMemberRepository memberRepository,
            Models.Subscription subscription)
        {
            try
            {
                // Only organization (landlord) subscriptions get renewal reminders
                if (!subscription.OrganizationId.HasValue)
                    return;

                // Get organization and notify all owners/managers
                var organization = await organizationRepository.GetOrganizationByIdAsync(subscription.OrganizationId.Value);
                if (organization == null)
                {
                    _logger.LogWarning("Cannot send renewal reminder: organization {OrganizationId} not found for subscription {SubscriptionId}", subscription.OrganizationId, subscription.Id);
                    return;
                }

                // Get all owners and managers of the organization
                var members = await memberRepository.GetMembersByOrganizationIdAsync(subscription.OrganizationId.Value);
                var ownersAndManagers = members.Where(m => m.IsActive && (m.Role == "Owner" || m.Role == "Manager") && m.UserId.HasValue);

                foreach (var member in ownersAndManagers)
                {
                    var notificationDto = new CreateNotificationDto
                    {
                        UserId = member.UserId!.Value,
                        Type = ENotificationType.System,
                        Title = "Subscription Renewal Reminder",
                        Message = "Your organization's subscription will renew in 7 days. Make sure your payment method is up to date.",
                        RelatedId = subscription.Id,
                        SendEmail = true,
                        SendSMS = false
                    };
                    await notificationService.CreateNotification(notificationDto);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending renewal reminder for subscription {SubscriptionId}", subscription.Id);
            }
        }
    }
}

