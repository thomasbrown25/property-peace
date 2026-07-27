using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Dtos.NotificationSetting;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Notifications;
using brownstone_hub_api.Repositories.NotificationSettings;
using brownstone_hub_api.Repositories.Users;
using Microsoft.AspNetCore.SignalR;
using brownstone_hub_api.Hubs;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Services.SmsService;
using Microsoft.AspNetCore.Http;

namespace brownstone_hub_api.Services.NotificationService
{
    public class NotificationService(
        INotificationRepository notificationRepository,
        INotificationSettingRepository notificationSettingRepository,
        IHubContext<NotificationHub> hubContext,
        IEmailService emailService,
        ISmsService smsService,
        SmsTemplateService smsTemplateService,
        EmailTemplateService emailTemplateService,
        IUserRepository userRepository,
        IHttpContextAccessor httpContextAccessor,
        ILogger<NotificationService> logger) : INotificationService
    {
        private readonly INotificationRepository _notificationRepository = notificationRepository;
        private readonly INotificationSettingRepository _notificationSettingRepository = notificationSettingRepository;
        private readonly IHubContext<NotificationHub> _hubContext = hubContext;
        private readonly IEmailService _emailService = emailService;
        private readonly ISmsService _smsService = smsService;
        private readonly SmsTemplateService _smsTemplateService = smsTemplateService;
        private readonly EmailTemplateService _emailTemplateService = emailTemplateService;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly ILogger<NotificationService> _logger = logger;

        private async Task<long?> GetCurrentUserIdAsync()
        {
            var user = await _userRepository.GetCurrentUser();
            return user?.Id;
        }

        private long? GetCurrentOrganizationId()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }

        public async Task<ServiceResponse<NotificationListResponseDto>> GetNotifications(long userId)
        {
            var response = new ServiceResponse<NotificationListResponseDto>();

            try
            {
                // Validate that the passed userId matches the authenticated user
                var currentUserId = await GetCurrentUserIdAsync();
                if (!currentUserId.HasValue)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    response.StatusCode = 401;
                    return response;
                }

                if (currentUserId.Value != userId)
                {
                    response.Success = false;
                    response.Message = "Unauthorized access";
                    response.StatusCode = 403;
                    return response;
                }

                // Get current organization ID from context (set by OrganizationContextMiddleware)
                var organizationId = GetCurrentOrganizationId();

                // Filter notifications by organization if user is in an organization context
                var notifications = await _notificationRepository.GetNotificationsByUserId(userId, organizationId);
                var unreadCount = await _notificationRepository.GetUnreadCountByUserId(userId, organizationId);

                response.Data = new NotificationListResponseDto
                {
                    Notifications = notifications,
                    UnreadCount = unreadCount
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred in Notification Service while getting notifications for user {UserId}", userId);
                response.Success = false;
                response.Message = ex.Message;
                response.StatusCode = 500;
                return response;
            }

            return response;
        }

        public async Task<ServiceResponse<int>> GetUnreadCount(long userId)
        {
            var response = new ServiceResponse<int>();

            try
            {
                // Validate that the passed userId matches the authenticated user
                var currentUserId = await GetCurrentUserIdAsync();
                if (!currentUserId.HasValue)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    response.StatusCode = 401;
                    return response;
                }

                if (currentUserId.Value != userId)
                {
                    response.Success = false;
                    response.Message = "Unauthorized access";
                    response.StatusCode = 403;
                    return response;
                }

                // Get current organization ID from context (set by OrganizationContextMiddleware)
                var organizationId = GetCurrentOrganizationId();

                // Filter unread count by organization if user is in an organization context
                var unreadCount = await _notificationRepository.GetUnreadCountByUserId(userId, organizationId);
                response.Data = unreadCount;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred in Notification Service while getting unread count for user {UserId}", userId);
                response.Success = false;
                response.Message = ex.Message;
                response.StatusCode = 500;
                return response;
            }

            return response;
        }

        public async Task<ServiceResponse<bool>> MarkNotificationAsRead(long notificationId)
        {
            var response = new ServiceResponse<bool>();

            try
            {
                // Get current user to verify ownership
                var currentUserId = await GetCurrentUserIdAsync();
                if (!currentUserId.HasValue)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    response.StatusCode = 401;
                    return response;
                }

                var result = await _notificationRepository.MarkNotificationAsRead(notificationId, currentUserId.Value);

                if (!result)
                {
                    response.Success = false;
                    response.Message = "Notification not found or you don't have permission to mark it as read.";
                    response.StatusCode = 404;
                    return response;
                }

                response.Data = true;
                response.Message = "Notification marked as read.";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred in Notification Service while marking notification {NotificationId} as read", notificationId);
                response.Success = false;
                response.Message = ex.Message;
                response.StatusCode = 500;
                return response;
            }

            return response;
        }

        public async Task<ServiceResponse<int>> MarkAllNotificationsAsRead(long userId)
        {
            var response = new ServiceResponse<int>();

            try
            {
                // Validate that the passed userId matches the authenticated user
                var currentUserId = await GetCurrentUserIdAsync();
                if (!currentUserId.HasValue)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    response.StatusCode = 401;
                    return response;
                }

                if (currentUserId.Value != userId)
                {
                    response.Success = false;
                    response.Message = "Unauthorized access";
                    response.StatusCode = 403;
                    return response;
                }

                // Get current organization ID from context (set by OrganizationContextMiddleware)
                var organizationId = GetCurrentOrganizationId();

                // Mark all notifications as read, filtered by organization if in organization context
                var count = await _notificationRepository.MarkAllNotificationsAsRead(userId, organizationId);
                response.Data = count;
                response.Message = $"{count} notification(s) marked as read.";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred in Notification Service while marking all notifications as read for user {UserId}", userId);
                response.Success = false;
                response.Message = ex.Message;
                response.StatusCode = 500;
                return response;
            }

            return response;
        }

        public async Task<ServiceResponse<NotificationDto>> CreateNotification(CreateNotificationDto createNotificationDto)
        {
            var response = new ServiceResponse<NotificationDto>();

            try
            {
                // If OrganizationId is not provided, try to get it from HttpContext (set by OrganizationContextMiddleware)
                if (!createNotificationDto.OrganizationId.HasValue)
                {
                    var organizationId = GetCurrentOrganizationId();
                    if (organizationId.HasValue)
                    {
                        createNotificationDto.OrganizationId = organizationId;
                    }
                }

                // Create the in-app notification record unless the user has disabled in-app alerts
                NotificationDto? notification = null;
                if (createNotificationDto.SendInApp)
                {
                    notification = await _notificationRepository.CreateNotification(createNotificationDto);
                }
                else
                {
                    _logger.LogDebug("SendInApp is false for notification type {Type} for user {UserId}, skipping in-app record", createNotificationDto.Type, createNotificationDto.UserId);
                }

                // Check if email/SMS should be sent
                var settings = await _notificationSettingRepository.GetNotificationSettings(createNotificationDto.UserId);
                
                // Create default settings if they don't exist
                if (settings == null)
                {
                    _logger.LogInformation("Notification settings not found for user {UserId}, creating default settings", createNotificationDto.UserId);
                    
                    // Get user to populate email address
                    var user = await _userRepository.GetUser(createNotificationDto.UserId);
                    if (user != null)
                    {
                        // Create default settings with user's email
                        settings = await _notificationSettingRepository.AddNotificationSettings(createNotificationDto.UserId);
                        
                        // Update email address if user has one
                        if (!string.IsNullOrEmpty(user.Email) && string.IsNullOrEmpty(settings.EmailAddress))
                        {
                            settings.EmailAddress = user.Email;
                            // Update the settings in the database
                            await _notificationSettingRepository.UpdateNotificationSettings(settings);
                            _logger.LogInformation("Populated EmailAddress for user {UserId} from user email: {Email}", createNotificationDto.UserId, user.Email);
                        }
                    }
                    else
                    {
                        _logger.LogWarning("User {UserId} not found when creating default notification settings", createNotificationDto.UserId);
                    }
                }
                
                if (settings != null)
                {
                    // If EmailAddress is still empty, try to get it from user
                    if (string.IsNullOrEmpty(settings.EmailAddress))
                    {
                        var user = await _userRepository.GetUser(createNotificationDto.UserId);
                        if (user != null && !string.IsNullOrEmpty(user.Email))
                        {
                            settings.EmailAddress = user.Email;
                            await _notificationSettingRepository.UpdateNotificationSettings(settings);
                            _logger.LogInformation("Populated EmailAddress for user {UserId} from user email: {Email}", createNotificationDto.UserId, user.Email);
                        }
                    }
                    
                    // Determine if email/SMS should be sent based on notification type and user preferences
                    bool shouldSendEmail = false;
                    bool shouldSendSMS = false;

                    if (createNotificationDto.SendEmail && settings.EmailEnabled)
                    {
                        shouldSendEmail = ShouldSendEmailForType(createNotificationDto.Type, settings);
                    }

                    if (createNotificationDto.SendSMS && settings.PhoneEnabled)
                    {
                        shouldSendSMS = ShouldSendSMSForType(createNotificationDto.Type, settings);
                    }

                    // Send email if enabled
                    if (shouldSendEmail && !string.IsNullOrEmpty(settings.EmailAddress))
                    {
                        try
                        {
                            // Format email using template service
                            var (subject, htmlContent, plainTextContent) = _emailTemplateService.FormatEmail(
                                type: createNotificationDto.Type,
                                title: createNotificationDto.Title,
                                message: createNotificationDto.Message
                            );

                            var emailSent = await _emailService.SendEmailAsync(
                                to: settings.EmailAddress,
                                subject: subject,
                                htmlContent: htmlContent,
                                plainTextContent: plainTextContent
                            );

                            if (emailSent)
                            {
                                _logger.LogInformation("Email notification sent successfully to {Email} for notification {NotificationId}",
                                    settings.EmailAddress, notification?.Id);
                            }
                            else
                            {
                                _logger.LogWarning("Failed to send email notification to {Email} for notification {NotificationId}",
                                    settings.EmailAddress, notification?.Id);
                            }
                        }
                        catch (Exception ex)
                        {
                            // Log error but don't fail notification creation
                            _logger.LogError(ex, "Error sending email notification to {Email} for notification {NotificationId}: {Error}", 
                                settings.EmailAddress, notification.Id, ex.Message);
                        }
                    }

                    // Send SMS if enabled
                    if (shouldSendSMS && !string.IsNullOrEmpty(settings.PhoneNumber))
                    {
                        try
                        {
                            // Format message using template service
                            var formattedSmsMessage = _smsTemplateService.FormatMessage(
                                type: createNotificationDto.Type,
                                title: createNotificationDto.Title,
                                message: createNotificationDto.Message
                            );

                            var smsSent = await _smsService.SendSmsAsync(
                                to: settings.PhoneNumber,
                                message: formattedSmsMessage
                            );

                            if (smsSent)
                            {
                                _logger.LogInformation("SMS notification sent successfully to {Phone} for notification {NotificationId}",
                                    settings.PhoneNumber, notification?.Id);
                            }
                            else
                            {
                                _logger.LogWarning("Failed to send SMS notification to {Phone} for notification {NotificationId}",
                                    settings.PhoneNumber, notification?.Id);
                            }
                        }
                        catch (Exception ex)
                        {
                            // Log error but don't fail notification creation
                            _logger.LogError(ex, "Error sending SMS notification to {Phone} for notification {NotificationId}: {Error}", 
                                settings.PhoneNumber, notification.Id, ex.Message);
                        }
                    }
                }

                // Send notification via SignalR for real-time updates (only when in-app record exists)
                if (notification != null)
                {
                    try
                    {
                        var groupName = $"user_{createNotificationDto.UserId}";
                        _logger.LogInformation("Attempting to send SignalR notification to group {GroupName} for user {UserId}. Notification: {NotificationId}, Type: {Type}, Title: {Title}",
                            groupName, createNotificationDto.UserId, notification.Id, notification.Type, notification.Title);

                        await _hubContext.Clients.Group(groupName)
                            .SendAsync("ReceiveNotification", notification);

                        _logger.LogInformation("Successfully sent real-time notification to user {UserId} via SignalR group {GroupName}",
                            createNotificationDto.UserId, groupName);
                    }
                    catch (Exception ex)
                    {
                        // Log but don't fail notification creation if SignalR fails
                        _logger.LogError(ex, "Failed to send notification via SignalR to user {UserId}. Error: {Error}",
                            createNotificationDto.UserId, ex.Message);
                    }
                }

                response.Data = notification;
                response.Message = "Notification created successfully.";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred in Notification Service while creating notification for user {UserId}", createNotificationDto.UserId);
                response.Success = false;
                response.Message = ex.Message;
                response.StatusCode = 500;
                return response;
            }

            return response;
        }

        private bool ShouldSendEmailForType(Enums.ENotificationType type, NotificationSettingDto settings)
        {
            return type switch
            {
                Enums.ENotificationType.Rent => settings.RentReminders.Email || settings.OverdueAlerts.Email,
                Enums.ENotificationType.Payment => settings.PaymentConfirmations.Email,
                Enums.ENotificationType.Maintenance => settings.MaintenanceUpdates.Email,
                Enums.ENotificationType.Lease => settings.LeaseExpiration.Email,
                Enums.ENotificationType.Message => settings.TenantMessages.Email,
                Enums.ENotificationType.Support => settings.TenantMessages.Email,
                Enums.ENotificationType.Application => settings.ApplicationCompletion.Email,
                Enums.ENotificationType.System => settings.AdminSubscriptionNotifications.Email || settings.AdminNewUserNotifications.Email,
                Enums.ENotificationType.RentPaymentSetupReminder => settings.EmailEnabled,
                Enums.ENotificationType.TenantInvite => false,
                _ => false
            };
        }

        private bool ShouldSendSMSForType(Enums.ENotificationType type, NotificationSettingDto settings)
        {
            return type switch
            {
                Enums.ENotificationType.Rent => settings.RentReminders.Phone || settings.OverdueAlerts.Phone,
                Enums.ENotificationType.Payment => settings.PaymentConfirmations.Phone,
                Enums.ENotificationType.Maintenance => settings.MaintenanceUpdates.Phone,
                Enums.ENotificationType.Lease => settings.LeaseExpiration.Phone,
                Enums.ENotificationType.Message => settings.TenantMessages.Phone,
                Enums.ENotificationType.Support => false,
                Enums.ENotificationType.Application => settings.ApplicationCompletion.Phone,
                Enums.ENotificationType.System => settings.AdminSubscriptionNotifications.Phone || settings.AdminNewUserNotifications.Phone,
                Enums.ENotificationType.RentPaymentSetupReminder => false,
                Enums.ENotificationType.TenantInvite => false,
                _ => false
            };
        }

    }
}

