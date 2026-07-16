using brownstone_hub_api.Dtos.Announcement;
using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Dtos.Message;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.OpenAIService;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Services.MessageService;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Repositories.Conversations;
using brownstone_hub_api.Data;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using Microsoft.AspNetCore.Http;

namespace brownstone_hub_api.Services.AnnouncementService
{
    public class AnnouncementService(
        IOpenAIService openAIService,
        INotificationService notificationService,
        IEmailService emailService,
        IMessageService messageService,
        IConversationRepository conversationRepository,
        IUserRepository userRepository,
        DataContext dataContext,
        IHttpContextAccessor httpContextAccessor,
        ILogger<AnnouncementService> logger) : IAnnouncementService
    {
        private readonly IOpenAIService _openAIService = openAIService;
        private readonly INotificationService _notificationService = notificationService;
        private readonly IEmailService _emailService = emailService;
        private readonly IMessageService _messageService = messageService;
        private readonly IConversationRepository _conversationRepository = conversationRepository;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly DataContext _dataContext = dataContext;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly ILogger<AnnouncementService> _logger = logger;

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

        public async Task<ServiceResponse<FormatMessageResponseDto>> FormatMessageAsync(FormatMessageDto dto)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(dto.Message))
                {
                    return ServiceResponse<FormatMessageResponseDto>.CreateError(
                        "Message is required",
                        "Please provide a message to format."
                    );
                }

                var prompt = $@"You are a professional communication assistant. Format the following announcement message to be professional, clear, and suitable for landlord-to-tenant communication.

Guidelines:
- Maintain the original intent and meaning
- Use professional but approachable tone
- Improve grammar and clarity
- Ensure the message is well-structured and easy to read
- Keep it concise while preserving all important information
- Make it suitable for both in-app notifications and email delivery
- Return ONLY the message body, do not include a subject line
- Do NOT add any signature, closing, or team name (such as ""[Your Property Management Team]"" or similar) - the signature will be added automatically

Original message:
{dto.Message}

Please provide the enhanced, professionally formatted message body (no subject line, no signature):";

                var response = await _openAIService.GenerateTextAsync(prompt, maxTokens: 2000);

                if (!response.Success || string.IsNullOrEmpty(response.Data))
                {
                    return ServiceResponse<FormatMessageResponseDto>.CreateError(
                        "Failed to format message",
                        response.Message ?? "AI service error",
                        "",
                        500
                    );
                }

                // Generate subject separately
                var subjectPrompt = $@"Based on the following announcement message, generate a concise, professional email subject line (maximum 60 characters):

{dto.Message}

Subject line only (no quotes, no 'Subject:' prefix):";

                var subjectResponse = await _openAIService.GenerateTextAsync(subjectPrompt, maxTokens: 100);

                var subject = subjectResponse.Success && !string.IsNullOrEmpty(subjectResponse.Data)
                    ? subjectResponse.Data.Trim().Replace("\"", "").Replace("Subject:", "").Trim()
                    : "Announcement";

                // Limit subject to 60 characters
                if (subject.Length > 60)
                {
                    subject = subject.Substring(0, 57) + "...";
                }

                return new ServiceResponse<FormatMessageResponseDto>
                {
                    Data = new FormatMessageResponseDto
                    {
                        FormattedMessage = response.Data.Trim(),
                        Subject = subject
                    },
                    Message = "Message formatted successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error formatting message with AI");
                return ServiceResponse<FormatMessageResponseDto>.CreateError(
                    "Error formatting message",
                    ex.Message,
                    ex.InnerException?.Message,
                    500
                );
            }
        }

        public async Task<ServiceResponse<SendAnnouncementResponseDto>> SendAnnouncementAsync(SendAnnouncementDto dto)
        {
            try
            {
                var currentUserId = await GetCurrentUserIdAsync();
                if (!currentUserId.HasValue)
                {
                    return ServiceResponse<SendAnnouncementResponseDto>.CreateError(
                        "Unauthorized",
                        "User not authenticated",
                        "",
                        401
                    );
                }

                // Use the first selected organization as the primary organization for the announcement
                // If no organizations selected but properties/units are, use current organization context
                // If sending to all properties, use current organization context
                long? primaryOrganizationId = null;
                if (dto.OrganizationIds != null && dto.OrganizationIds.Any())
                {
                    primaryOrganizationId = dto.OrganizationIds.First();
                }
                else
                {
                    primaryOrganizationId = GetCurrentOrganizationId();
                }

                if (!primaryOrganizationId.HasValue)
                {
                    return ServiceResponse<SendAnnouncementResponseDto>.CreateError(
                        "Organization context required",
                        "Organization context is required to send announcements",
                        "",
                        403
                    );
                }

                // If sending to all properties (null propertyIds and unitIds), use organizationIds or current org
                bool sendToAllProperties = (dto.PropertyIds == null || !dto.PropertyIds.Any()) && 
                                          (dto.UnitIds == null || !dto.UnitIds.Any());

                if (string.IsNullOrWhiteSpace(dto.Message))
                {
                    return ServiceResponse<SendAnnouncementResponseDto>.CreateError(
                        "Message is required",
                        "Please provide an announcement message"
                    );
                }

                if (!dto.SendEmail && !dto.SendNotification)
                {
                    return ServiceResponse<SendAnnouncementResponseDto>.CreateError(
                        "Delivery method required",
                        "Please select at least one delivery method (email or notification)"
                    );
                }

                // Collect all unique tenant user IDs from selected units
                var tenantUserIds = new HashSet<long>();
                var processedUnitIds = new HashSet<long>();
                var processedPropertyIds = new HashSet<long>();

                // If sending to all properties, get all tenants from all properties in selected organizations
                if (sendToAllProperties)
                {
                    var orgIdsToUse = dto.OrganizationIds != null && dto.OrganizationIds.Any() 
                        ? dto.OrganizationIds 
                        : new List<long> { primaryOrganizationId.Value };

                    var allProperties = await _dataContext.Properties
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Lease!)
                                .ThenInclude(l => l.TenantLeases!)
                                    .ThenInclude(tl => tl.Tenant)
                        .Where(p => orgIdsToUse.Contains(p.OrganizationId ?? 0) && !p.IsDeleted)
                        .ToListAsync();

                    foreach (var property in allProperties)
                    {
                        foreach (var unit in property.Units ?? [])
                        {
                            if (unit.Lease != null && unit.Lease.TenantLeases != null)
                            {
                                foreach (var tenantLease in unit.Lease.TenantLeases)
                                {
                                    var tenant = tenantLease.Tenant;
                                    if (tenant.UserId.HasValue)
                                    {
                                        tenantUserIds.Add(tenant.UserId.Value);
                                    }
                                }
                            }
                        }
                    }
                }
                else
                {
                    // Get tenants from selected units
                    if (dto.UnitIds != null && dto.UnitIds.Any())
                    {
                        var units = await _dataContext.Units
                            .Include(u => u.Lease!)
                                .ThenInclude(l => l.TenantLeases!)
                                    .ThenInclude(tl => tl.Tenant)
                            .Where(u => dto.UnitIds.Contains(u.Id))
                            .ToListAsync();

                        foreach (var unit in units)
                        {
                            processedUnitIds.Add(unit.Id);
                            if (unit.Lease != null && unit.Lease.TenantLeases != null)
                            {
                                foreach (var tenantLease in unit.Lease.TenantLeases)
                                {
                                    var tenant = tenantLease.Tenant;
                                    if (tenant.UserId.HasValue)
                                    {
                                        tenantUserIds.Add(tenant.UserId.Value);
                                    }
                                }
                            }
                        }
                    }

                    // Get tenants from selected properties (all units in those properties, excluding already processed units)
                    if (dto.PropertyIds != null && dto.PropertyIds.Any())
                    {
                        var propertyIdsToProcess = dto.PropertyIds.Where(pid => !processedPropertyIds.Contains(pid)).ToList();
                        if (propertyIdsToProcess.Any())
                        {
                            var properties = await _dataContext.Properties
                                .Include(p => p.Units)
                                    .ThenInclude(u => u.Lease!)
                                        .ThenInclude(l => l.TenantLeases!)
                                            .ThenInclude(tl => tl.Tenant)
                                .Where(p => propertyIdsToProcess.Contains(p.Id))
                                .ToListAsync();

                            foreach (var property in properties)
                            {
                                processedPropertyIds.Add(property.Id);
                                foreach (var unit in property.Units ?? [])
                                {
                                    // Skip if this unit was already processed
                                    if (processedUnitIds.Contains(unit.Id))
                                    {
                                        continue;
                                    }

                                    if (unit.Lease != null && unit.Lease.TenantLeases != null)
                                    {
                                        foreach (var tenantLease in unit.Lease.TenantLeases)
                                        {
                                            var tenant = tenantLease.Tenant;
                                            if (tenant.UserId.HasValue)
                                            {
                                                tenantUserIds.Add(tenant.UserId.Value);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Get tenants from selected organizations (all units in all properties in those orgs, excluding already processed)
                    if (dto.OrganizationIds != null && dto.OrganizationIds.Any())
                    {
                        var properties = await _dataContext.Properties
                            .Include(p => p.Units)
                                .ThenInclude(u => u.Lease!)
                                    .ThenInclude(l => l.TenantLeases!)
                                        .ThenInclude(tl => tl.Tenant)
                            .Where(p => dto.OrganizationIds.Contains(p.OrganizationId ?? 0) && !processedPropertyIds.Contains(p.Id) && !p.IsDeleted)
                            .ToListAsync();

                        foreach (var property in properties)
                        {
                            foreach (var unit in property.Units ?? [])
                            {
                                // Skip if this unit was already processed
                                if (processedUnitIds.Contains(unit.Id))
                                {
                                    continue;
                                }

                                if (unit.Lease != null && unit.Lease.TenantLeases != null)
                                {
                                    foreach (var tenantLease in unit.Lease.TenantLeases)
                                    {
                                        var tenant = tenantLease.Tenant;
                                        if (tenant.UserId.HasValue)
                                        {
                                            tenantUserIds.Add(tenant.UserId.Value);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Get current user's name for signature
                var currentUser = await _userRepository.GetCurrentUser();
                var landlordName = "";
                if (currentUser != null)
                {
                    var nameParts = new List<string>();
                    if (!string.IsNullOrWhiteSpace(currentUser.Firstname))
                        nameParts.Add(currentUser.Firstname);
                    if (!string.IsNullOrWhiteSpace(currentUser.Lastname))
                        nameParts.Add(currentUser.Lastname);
                    
                    if (nameParts.Any())
                    {
                        landlordName = string.Join(" ", nameParts);
                    }
                }

                // Generate title from message using AI
                string announcementTitle = "Announcement";
                try
                {
                    var titlePrompt = $@"Based on the following announcement message, generate a concise, descriptive title (maximum 80 characters):

{dto.Message}

Title only (no quotes, no 'Title:' prefix):";

                    var titleResponse = await _openAIService.GenerateTextAsync(titlePrompt, maxTokens: 100);
                    if (titleResponse.Success && !string.IsNullOrEmpty(titleResponse.Data))
                    {
                        announcementTitle = titleResponse.Data.Trim().Replace("\"", "").Replace("Title:", "").Trim();
                        if (announcementTitle.Length > 80)
                        {
                            announcementTitle = announcementTitle.Substring(0, 77) + "...";
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to generate announcement title, using default");
                }

                // Append landlord signature to message
                var messageWithSignature = dto.Message.Trim();
                
                // Remove any "[Your Property Management Team]" text that might be in the message
                messageWithSignature = messageWithSignature
                    .Replace("[Your Property Management Team]", "", StringComparison.OrdinalIgnoreCase)
                    .Replace("[Your property management team]", "", StringComparison.OrdinalIgnoreCase)
                    .Replace("[your property management team]", "", StringComparison.OrdinalIgnoreCase)
                    .Trim();
                
                if (!string.IsNullOrEmpty(landlordName))
                {
                    // Add signature with appropriate closing - only landlord name, no team name
                    messageWithSignature += $"\n\nBest regards,\n{landlordName}";
                }

                // Generate subject from message using AI (can reuse title or generate separately)
                string emailSubject = announcementTitle;
                if (dto.SendEmail)
                {
                    try
                    {
                        var subjectPrompt = $@"Based on the following announcement message, generate a concise, professional email subject line (maximum 60 characters):

{dto.Message}

Subject line only (no quotes, no 'Subject:' prefix):";

                        var subjectResponse = await _openAIService.GenerateTextAsync(subjectPrompt, maxTokens: 100);
                        if (subjectResponse.Success && !string.IsNullOrEmpty(subjectResponse.Data))
                        {
                            emailSubject = subjectResponse.Data.Trim().Replace("\"", "").Replace("Subject:", "").Trim();
                            if (emailSubject.Length > 60)
                            {
                                emailSubject = emailSubject.Substring(0, 57) + "...";
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to generate email subject, using default");
                    }
                }

                // Check if this is a scheduled announcement
                bool isScheduled = dto.ScheduledAt.HasValue && dto.ScheduledAt.Value > DateTime.UtcNow;
                
                // Check if editing existing announcement
                Announcement? announcement = null;
                if (dto.Id.HasValue)
                {
                    announcement = await _dataContext.Announcements
                        .FirstOrDefaultAsync(a => a.Id == dto.Id.Value);
                    
                    if (announcement == null)
                    {
                        return ServiceResponse<SendAnnouncementResponseDto>.CreateError(
                            "Announcement not found",
                            "The announcement you are trying to edit does not exist"
                        );
                    }
                    
                    // Update existing announcement
                    announcement.Title = announcementTitle;
                    announcement.Message = messageWithSignature;
                    announcement.SendAsNotification = dto.SendNotification;
                    announcement.SendAsEmail = dto.SendEmail;
                    announcement.OrganizationIds = dto.OrganizationIds != null ? JsonSerializer.Serialize(dto.OrganizationIds) : null;
                    announcement.PropertyIds = dto.PropertyIds != null ? JsonSerializer.Serialize(dto.PropertyIds) : null;
                    announcement.UnitIds = dto.UnitIds != null ? JsonSerializer.Serialize(dto.UnitIds) : null;
                    announcement.ScheduledAt = dto.ScheduledAt;
                    announcement.UpdatedAt = DateTime.UtcNow;
                    
                    // If rescheduling, reset completion status but preserve expected recipient count
                    if (isScheduled)
                    {
                        announcement.IsCompleted = false;
                        announcement.CompletedAt = null;
                        // Update expected recipient count based on current tenant list
                        announcement.SentCount = tenantUserIds.Count;
                        announcement.FailedCount = 0;
                    }
                }
                else
                {
                    // Create new announcement record
                    announcement = new Announcement
                    {
                        OrganizationId = primaryOrganizationId.Value,
                        CreatedByUserId = currentUserId.Value,
                        Title = announcementTitle,
                        Message = messageWithSignature,
                        SendAsNotification = dto.SendNotification,
                        SendAsEmail = dto.SendEmail,
                        OrganizationIds = dto.OrganizationIds != null ? JsonSerializer.Serialize(dto.OrganizationIds) : null,
                        PropertyIds = dto.PropertyIds != null ? JsonSerializer.Serialize(dto.PropertyIds) : null,
                        UnitIds = dto.UnitIds != null ? JsonSerializer.Serialize(dto.UnitIds) : null,
                        ScheduledAt = dto.ScheduledAt,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow,
                        IsCompleted = !isScheduled // If scheduled, it's not completed yet; if immediate, it will be set after sending
                    };

                    _dataContext.Announcements.Add(announcement);
                }
                
                // Store expected recipient count for scheduled announcements
                if (isScheduled)
                {
                    // Calculate expected recipient count (we already have tenantUserIds from the collection above)
                    announcement.SentCount = tenantUserIds.Count; // Store expected count in SentCount for scheduled announcements
                }
                
                await _dataContext.SaveChangesAsync();

                // If scheduled for future, don't send now - just save the announcement
                if (isScheduled)
                {
                    return new ServiceResponse<SendAnnouncementResponseDto>
                    {
                        Data = new SendAnnouncementResponseDto
                        {
                            AnnouncementId = announcement.Id,
                            SentCount = tenantUserIds.Count, // Expected recipient count
                            FailedCount = 0
                        },
                        Message = $"Announcement scheduled for {dto.ScheduledAt.Value:g}"
                    };
                }

                // If no tenants found, still create the announcement but mark it as completed with 0 sent count
                if (tenantUserIds.Count == 0)
                {
                    // Update announcement to mark as completed (even though no one received it)
                    announcement.SentCount = 0;
                    announcement.FailedCount = 0;
                    announcement.IsCompleted = true;
                    announcement.CompletedAt = DateTime.UtcNow;
                    await _dataContext.SaveChangesAsync();

                    return new ServiceResponse<SendAnnouncementResponseDto>
                    {
                        Data = new SendAnnouncementResponseDto
                        {
                            AnnouncementId = announcement.Id,
                            SentCount = 0,
                            FailedCount = 0
                        },
                        Message = "Announcement created successfully. No tenants with created accounts were found for the selected properties/units/organizations.",
                        Success = true
                    };
                }

                int sentCount = 0;
                int failedCount = 0;

                // Get all users with their email addresses upfront for bulk email sending
                var tenantUserList = tenantUserIds.ToList();
                var userEmailMap = new Dictionary<long, string>();
                
                if (dto.SendEmail && tenantUserList.Any())
                {
                    var users = await _dataContext.Users
                        .Where(u => tenantUserList.Contains(u.Id) && !u.IsDeleted)
                        .Select(u => new { u.Id, u.Email })
                        .ToListAsync();
                    
                    foreach (var user in users)
                    {
                        if (!string.IsNullOrEmpty(user.Email))
                        {
                            userEmailMap[user.Id] = user.Email;
                        }
                    }
                }

                // Send bulk email if enabled
                bool bulkEmailSuccess = false;
                var emailRecipients = userEmailMap.Values.ToList();
                if (dto.SendEmail && emailRecipients.Any())
                {
                    try
                    {
                        bulkEmailSuccess = await _emailService.SendBulkEmailAsync(
                            to: emailRecipients,
                            subject: emailSubject,
                            htmlContent: $"<p>{messageWithSignature.Replace("\n", "<br/>")}</p>",
                            plainTextContent: messageWithSignature
                        );

                        if (bulkEmailSuccess)
                        {
                            _logger.LogInformation("Bulk email sent successfully to {Count} recipients for announcement {AnnouncementId}", 
                                emailRecipients.Count, announcement.Id);
                        }
                        else
                        {
                            _logger.LogWarning("Bulk email send failed for announcement {AnnouncementId}", announcement.Id);
                        }
                    }
                    catch (Exception bulkEmailEx)
                    {
                        _logger.LogError(bulkEmailEx, "Error sending bulk email for announcement {AnnouncementId}", announcement.Id);
                        bulkEmailSuccess = false;
                    }
                }

                // Send notifications individually and create recipient records
                var recipients = new List<AnnouncementRecipient>();
                
                foreach (var tenantUserId in tenantUserList)
                {
                    bool notificationSuccess = false;
                    bool emailSuccess = false;
                    DateTime? notificationSentAt = null;
                    DateTime? emailSentAt = null;
                    string? errorMessage = null;

                    try
                    {
                        // Send in-app notification and add message to conversation
                        if (dto.SendNotification)
                        {
                            var notificationDto = new CreateNotificationDto
                            {
                                UserId = tenantUserId,
                                OrganizationId = primaryOrganizationId,
                                Type = ENotificationType.Message,
                                Title = "Announcement",
                                Message = messageWithSignature,
                                SendEmail = false, // Email handled separately via bulk send
                                SendSMS = false,
                                PerformedByUserId = currentUserId
                            };

                            var notificationResult = await _notificationService.CreateNotification(notificationDto);
                            if (notificationResult.Success)
                            {
                                notificationSuccess = true;
                                notificationSentAt = DateTime.UtcNow;

                                // Add announcement as a message in the tenant-landlord conversation
                                try
                                {
                                    var conversation = await _conversationRepository.GetOrCreateTenantLandlordConversation(tenantUserId);
                                    if (conversation != null && conversation.Id > 0)
                                    {
                                        _logger.LogInformation("Adding announcement message to conversation {ConversationId} for tenant {TenantUserId}. Landlord ID: {LandlordId}, Current User ID: {CurrentUserId}", 
                                            conversation.Id, tenantUserId, conversation.LandlordId, currentUserId);
                                        
                                        var messageDto = new AddMessageDto
                                        {
                                            ConversationId = conversation.Id,
                                            Content = $"📢 **Announcement**\n\n{messageWithSignature}"
                                        };

                                        var messageResult = await _messageService.AddMessage(messageDto);
                                        if (messageResult.Success)
                                        {
                                            _logger.LogInformation("Successfully added announcement message {MessageId} to conversation {ConversationId} for tenant {TenantUserId}", 
                                                messageResult.Data?.Id, conversation.Id, tenantUserId);
                                        }
                                        else
                                        {
                                            _logger.LogWarning("Failed to add announcement message to conversation {ConversationId} for tenant {TenantUserId}: {Error}", 
                                                conversation.Id, tenantUserId, messageResult.Message);
                                        }
                                    }
                                    else
                                    {
                                        _logger.LogWarning("Could not get or create conversation for tenant {TenantUserId} - conversation was null or invalid. Announcement notification created but not added to conversation", 
                                            tenantUserId);
                                    }
                                }
                                catch (Exception msgEx)
                                {
                                    // Log but don't fail announcement - notification was already created successfully
                                    _logger.LogError(msgEx, "Error adding announcement message to conversation for tenant {TenantUserId}: {ErrorMessage}. Stack trace: {StackTrace}", 
                                        tenantUserId, msgEx.Message, msgEx.StackTrace);
                                }
                            }
                            else
                            {
                                errorMessage = $"Notification failed: {notificationResult.Message}";
                                _logger.LogWarning("Failed to create notification for user {UserId}: {Error}", tenantUserId, notificationResult.Message);
                            }
                        }

                        // Check if email was sent successfully for this user
                        if (dto.SendEmail)
                        {
                            emailSuccess = bulkEmailSuccess && userEmailMap.ContainsKey(tenantUserId);
                            if (emailSuccess)
                            {
                                emailSentAt = DateTime.UtcNow;
                            }
                            else if (!userEmailMap.ContainsKey(tenantUserId))
                            {
                                errorMessage = (!string.IsNullOrEmpty(errorMessage) ? errorMessage + "; " : "") + "User has no email address";
                                _logger.LogWarning("User {UserId} has no email address", tenantUserId);
                            }
                            else if (!bulkEmailSuccess)
                            {
                                errorMessage = (!string.IsNullOrEmpty(errorMessage) ? errorMessage + "; " : "") + "Email failed";
                            }
                        }

                        // Count success/failure
                        if (notificationSuccess || emailSuccess)
                        {
                            sentCount++;
                        }
                        else
                        {
                            failedCount++;
                        }

                        // Create recipient record
                        var recipient = new AnnouncementRecipient
                        {
                            AnnouncementId = announcement.Id,
                            TenantId = tenantUserId,
                            NotificationSent = notificationSuccess,
                            EmailSent = emailSuccess,
                            NotificationSentAt = notificationSentAt,
                            EmailSentAt = emailSentAt,
                            ErrorMessage = errorMessage,
                            CreatedAt = DateTime.UtcNow
                        };

                        recipients.Add(recipient);
                    }
                    catch (Exception ex)
                    {
                        failedCount++;
                        _logger.LogError(ex, "Error processing announcement recipient {UserId}", tenantUserId);

                        // Create recipient record with error
                        var recipient = new AnnouncementRecipient
                        {
                            AnnouncementId = announcement.Id,
                            TenantId = tenantUserId,
                            NotificationSent = false,
                            EmailSent = false,
                            ErrorMessage = ex.Message,
                            CreatedAt = DateTime.UtcNow
                        };

                        recipients.Add(recipient);
                    }
                }

                // Batch add all recipients
                if (recipients.Any())
                {
                    _dataContext.AnnouncementRecipients.AddRange(recipients);
                }

                // Update announcement with final counts
                announcement.SentCount = sentCount;
                announcement.FailedCount = failedCount;
                announcement.IsCompleted = true;
                announcement.CompletedAt = DateTime.UtcNow;
                announcement.UpdatedAt = DateTime.UtcNow;

                await _dataContext.SaveChangesAsync();

                return new ServiceResponse<SendAnnouncementResponseDto>
                {
                    Data = new SendAnnouncementResponseDto
                    {
                        AnnouncementId = announcement.Id,
                        SentCount = sentCount,
                        FailedCount = failedCount
                    },
                    Message = $"Announcement sent successfully to {sentCount} recipient(s)"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending announcement");
                return ServiceResponse<SendAnnouncementResponseDto>.CreateError(
                    "Error sending announcement",
                    ex.Message,
                    ex.InnerException?.Message,
                    500
                );
            }
        }

        public async Task<ServiceResponse<List<LoadAnnouncementDto>>> GetAnnouncementsAsync(DateTime? fromDate, DateTime? toDate, long? organizationId = null, long? propertyId = null)
        {
            try
            {
                var currentUserId = await GetCurrentUserIdAsync();
                if (!currentUserId.HasValue)
                {
                    return ServiceResponse<List<LoadAnnouncementDto>>.CreateError(
                        "Unauthorized",
                        "User not authenticated",
                        "",
                        401
                    );
                }

                var currentOrgId = GetCurrentOrganizationId();
                if (!currentOrgId.HasValue)
                {
                    return ServiceResponse<List<LoadAnnouncementDto>>.CreateError(
                        "Organization context required",
                        "Organization context is required to view announcements",
                        "",
                        403
                    );
                }

                var query = _dataContext.Announcements
                    .Include(a => a.Organization)
                    .Include(a => a.CreatedBy)
                    .AsQueryable();

                // Filter by organization
                if (organizationId.HasValue)
                {
                    // Build the search pattern before the query to avoid translation issues
                    var orgPattern = "\"" + organizationId.Value + "\"";
                    
                    // Check if announcement's OrganizationIds JSON contains the specified org
                    // or if the announcement's primary OrganizationId matches
                    query = query.Where(a => 
                        a.OrganizationId == organizationId.Value ||
                        (a.OrganizationIds != null && a.OrganizationIds.Contains(orgPattern))
                    );
                }
                else
                {
                    // If no organization filter (All Organizations), show announcements for all orgs user has access to
                    // Get all organizations the user is a member of
                    var userOrganizationIds = await _dataContext.OrganizationMembers
                        .Where(m => m.UserId == currentUserId.Value && m.IsActive)
                        .Select(m => m.OrganizationId)
                        .ToListAsync();

                    if (userOrganizationIds.Any())
                    {
                        // Filter by primary OrganizationId first (SQL-translatable)
                        query = query.Where(a => userOrganizationIds.Contains(a.OrganizationId));
                        
                        // Fetch results that match primary org
                        var announcementsByPrimaryOrg = await query.ToListAsync();
                        
                        // Now find announcements where OrganizationIds JSON array contains any user org ID
                        // Build search patterns for JSON array lookup (format: "123")
                        var searchPatterns = userOrganizationIds.Select(orgId => "\"" + orgId + "\"").ToList();
                        
                        // Query for announcements that might match via JSON (excluding already matched ones)
                        var announcementsByJsonOrg = await _dataContext.Announcements
                            .Where(a => a.OrganizationIds != null && 
                                !userOrganizationIds.Contains(a.OrganizationId)) // Exclude already matched
                            .ToListAsync();
                        
                        // Filter in memory for JSON array matches (can't do this in SQL with in-memory list)
                        var matchingJsonAnnouncements = announcementsByJsonOrg
                            .Where(a => searchPatterns.Any(pattern => a.OrganizationIds!.Contains(pattern)))
                            .Select(a => a.Id)
                            .ToList();
                        
                        // Get IDs of all matching announcements
                        var primaryOrgIds = announcementsByPrimaryOrg.Select(a => a.Id).ToList();
                        var allMatchingIds = primaryOrgIds.Concat(matchingJsonAnnouncements).ToList();
                        
                        // Reset query to filter by the combined IDs (this allows further filtering to continue)
                        query = _dataContext.Announcements
                            .Include(a => a.Organization)
                            .Include(a => a.CreatedBy)
                            .Where(a => allMatchingIds.Contains(a.Id));
                    }
                    else
                    {
                        // If user has no organizations, only show announcements created by them (fallback)
                        query = query.Where(a => a.CreatedByUserId == currentUserId.Value);
                    }
                }

                // Filter by property (check PropertyIds JSON field)
                if (propertyId.HasValue)
                {
                    // Build the search pattern before the query to avoid translation issues
                    var propertyPattern = "\"" + propertyId.Value + "\"";
                    query = query.Where(a => 
                        a.PropertyIds != null && 
                        a.PropertyIds.Contains(propertyPattern)
                    );
                }

                // Filter by date range
                if (fromDate.HasValue)
                {
                    query = query.Where(a => a.CreatedAt >= fromDate.Value);
                }

                if (toDate.HasValue)
                {
                    var endDate = toDate.Value.Date.AddDays(1).AddTicks(-1); // End of day
                    query = query.Where(a => a.CreatedAt <= endDate);
                }

                var announcements = await query
                    .OrderByDescending(a => a.CreatedAt)
                    .ToListAsync();

                var announcementDtos = announcements.Select(a => new LoadAnnouncementDto
                {
                    Id = a.Id,
                    OrganizationId = a.OrganizationId,
                    OrganizationName = a.Organization?.Name ?? string.Empty,
                    CreatedByUserId = a.CreatedByUserId,
                    CreatedByName = a.CreatedBy != null 
                        ? $"{a.CreatedBy.FirstName} {a.CreatedBy.LastName}".Trim()
                        : string.Empty,
                    Title = a.Title,
                    Message = a.Message,
                    FormattedMessage = a.FormattedMessage,
                    SendAsNotification = a.SendAsNotification,
                    SendAsEmail = a.SendAsEmail,
                    SentCount = a.SentCount,
                    FailedCount = a.FailedCount,
                    IsCompleted = a.IsCompleted,
                    CompletedAt = a.CompletedAt,
                    ScheduledAt = a.ScheduledAt,
                    CreatedAt = a.CreatedAt,
                    UpdatedAt = a.UpdatedAt
                }).ToList();

                return new ServiceResponse<List<LoadAnnouncementDto>>
                {
                    Data = announcementDtos,
                    Message = "Announcements retrieved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving announcements");
                return ServiceResponse<List<LoadAnnouncementDto>>.CreateError(
                    "Error retrieving announcements",
                    ex.Message,
                    ex.InnerException?.Message,
                    500
                );
            }
        }

        public async Task<ServiceResponse<LoadAnnouncementDto>> GetAnnouncementByIdAsync(long id)
        {
            try
            {
                var currentUserId = await GetCurrentUserIdAsync();
                if (!currentUserId.HasValue)
                {
                    return ServiceResponse<LoadAnnouncementDto>.CreateError(
                        "Unauthorized",
                        "User not authenticated",
                        "",
                        401
                    );
                }

                var announcement = await _dataContext.Announcements
                    .Include(a => a.Organization)
                    .Include(a => a.CreatedBy)
                    .FirstOrDefaultAsync(a => a.Id == id);

                if (announcement == null)
                {
                    return ServiceResponse<LoadAnnouncementDto>.CreateError(
                        "Announcement not found",
                        "The requested announcement does not exist",
                        "",
                        404
                    );
                }

                // Check if user has access to this announcement's organization
                var currentOrgId = GetCurrentOrganizationId();
                var userOrganizationIds = await _dataContext.OrganizationMembers
                    .Where(m => m.UserId == currentUserId.Value && m.IsActive)
                    .Select(m => m.OrganizationId)
                    .ToListAsync();

                if (!userOrganizationIds.Contains(announcement.OrganizationId))
                {
                    // Check if announcement's OrganizationIds JSON contains any user org
                    var hasAccess = false;
                    if (announcement.OrganizationIds != null)
                    {
                        var searchPatterns = userOrganizationIds.Select(orgId => "\"" + orgId + "\"").ToList();
                        hasAccess = searchPatterns.Any(pattern => announcement.OrganizationIds.Contains(pattern));
                    }

                    if (!hasAccess)
                    {
                        return ServiceResponse<LoadAnnouncementDto>.CreateError(
                            "Forbidden",
                            "You do not have access to this announcement",
                            "",
                            403
                        );
                    }
                }

                var dto = new LoadAnnouncementDto
                {
                    Id = announcement.Id,
                    OrganizationId = announcement.OrganizationId,
                    OrganizationName = announcement.Organization?.Name ?? string.Empty,
                    CreatedByUserId = announcement.CreatedByUserId,
                    CreatedByName = announcement.CreatedBy != null 
                        ? $"{announcement.CreatedBy.FirstName} {announcement.CreatedBy.LastName}".Trim()
                        : string.Empty,
                    Title = announcement.Title,
                    Message = announcement.Message,
                    FormattedMessage = announcement.FormattedMessage,
                    SendAsNotification = announcement.SendAsNotification,
                    SendAsEmail = announcement.SendAsEmail,
                    SentCount = announcement.SentCount,
                    FailedCount = announcement.FailedCount,
                    IsCompleted = announcement.IsCompleted,
                    CompletedAt = announcement.CompletedAt,
                    ScheduledAt = announcement.ScheduledAt,
                    CreatedAt = announcement.CreatedAt,
                    UpdatedAt = announcement.UpdatedAt,
                    OrganizationIds = announcement.OrganizationIds,
                    PropertyIds = announcement.PropertyIds,
                    UnitIds = announcement.UnitIds
                };

                return new ServiceResponse<LoadAnnouncementDto>
                {
                    Data = dto,
                    Message = "Announcement retrieved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving announcement {Id}", id);
                return ServiceResponse<LoadAnnouncementDto>.CreateError(
                    "Error retrieving announcement",
                    ex.Message,
                    ex.InnerException?.Message
                );
            }
        }

        public async Task<bool> SendScheduledAnnouncementAsync(long announcementId)
        {
            try
            {
                var announcement = await _dataContext.Announcements
                    .FirstOrDefaultAsync(a => a.Id == announcementId);

                if (announcement == null)
                {
                    _logger.LogWarning("Scheduled announcement {AnnouncementId} not found", announcementId);
                    return false;
                }

                if (announcement.IsCompleted)
                {
                    _logger.LogInformation("Announcement {AnnouncementId} is already completed, skipping", announcementId);
                    return true;
                }

                if (!announcement.ScheduledAt.HasValue)
                {
                    _logger.LogWarning("Announcement {AnnouncementId} does not have a ScheduledAt value", announcementId);
                    return false;
                }

                // Check if it's time to send
                if (announcement.ScheduledAt.Value > DateTime.UtcNow)
                {
                    _logger.LogInformation("Announcement {AnnouncementId} scheduled for {ScheduledAt} is not yet due", 
                        announcementId, announcement.ScheduledAt.Value);
                    return false;
                }

                _logger.LogInformation("Processing scheduled announcement {AnnouncementId} scheduled for {ScheduledAt}", 
                    announcementId, announcement.ScheduledAt.Value);

                // Parse recipient IDs
                var organizationIds = !string.IsNullOrEmpty(announcement.OrganizationIds)
                    ? JsonSerializer.Deserialize<List<long>>(announcement.OrganizationIds)
                    : null;
                var propertyIds = !string.IsNullOrEmpty(announcement.PropertyIds)
                    ? JsonSerializer.Deserialize<List<long>>(announcement.PropertyIds)
                    : null;
                var unitIds = !string.IsNullOrEmpty(announcement.UnitIds)
                    ? JsonSerializer.Deserialize<List<long>>(announcement.UnitIds)
                    : null;

                // Collect tenant user IDs
                var tenantUserIds = new HashSet<long>();
                bool sendToAllProperties = (propertyIds == null || !propertyIds.Any()) && 
                                          (unitIds == null || !unitIds.Any());

                if (sendToAllProperties)
                {
                    var orgIdsToUse = organizationIds != null && organizationIds.Any() 
                        ? organizationIds 
                        : new List<long> { announcement.OrganizationId };

                    var allProperties = await _dataContext.Properties
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Lease!)
                                .ThenInclude(l => l.TenantLeases!)
                                    .ThenInclude(tl => tl.Tenant)
                        .Where(p => orgIdsToUse.Contains(p.OrganizationId ?? 0) && !p.IsDeleted)
                        .ToListAsync();

                    foreach (var property in allProperties)
                    {
                        foreach (var unit in property.Units ?? [])
                        {
                            if (unit.Lease != null && unit.Lease.TenantLeases != null)
                            {
                                foreach (var tenantLease in unit.Lease.TenantLeases)
                                {
                                    var tenant = tenantLease.Tenant;
                                    if (tenant.UserId.HasValue)
                                    {
                                        tenantUserIds.Add(tenant.UserId.Value);
                                    }
                                }
                            }
                        }
                    }
                }
                else
                {
                    // Get tenants from selected units
                    if (unitIds != null && unitIds.Any())
                    {
                        var units = await _dataContext.Units
                            .Include(u => u.Lease!)
                                .ThenInclude(l => l.TenantLeases!)
                                    .ThenInclude(tl => tl.Tenant)
                            .Where(u => unitIds.Contains(u.Id))
                            .ToListAsync();

                        foreach (var unit in units)
                        {
                            if (unit.Lease != null && unit.Lease.TenantLeases != null)
                            {
                                foreach (var tenantLease in unit.Lease.TenantLeases)
                                {
                                    var tenant = tenantLease.Tenant;
                                    if (tenant.UserId.HasValue)
                                    {
                                        tenantUserIds.Add(tenant.UserId.Value);
                                    }
                                }
                            }
                        }
                    }

                    // Get tenants from selected properties
                    if (propertyIds != null && propertyIds.Any())
                    {
                        var properties = await _dataContext.Properties
                            .Include(p => p.Units)
                                .ThenInclude(u => u.Lease!)
                                    .ThenInclude(l => l.TenantLeases!)
                                        .ThenInclude(tl => tl.Tenant)
                            .Where(p => propertyIds.Contains(p.Id))
                            .ToListAsync();

                        foreach (var property in properties)
                        {
                            foreach (var unit in property.Units ?? [])
                            {
                                if (unit.Lease != null && unit.Lease.TenantLeases != null)
                                {
                                    foreach (var tenantLease in unit.Lease.TenantLeases)
                                    {
                                        var tenant = tenantLease.Tenant;
                                        if (tenant.UserId.HasValue)
                                        {
                                            tenantUserIds.Add(tenant.UserId.Value);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // If no tenants found, mark as completed (sent) with 0 sent count
                // This ensures the announcement shows as "Sent" status even with no recipients
                if (tenantUserIds.Count == 0)
                {
                    announcement.SentCount = 0;
                    announcement.FailedCount = 0;
                    announcement.IsCompleted = true; // Mark as sent/completed
                    announcement.CompletedAt = DateTime.UtcNow;
                    await _dataContext.SaveChangesAsync();
                    _logger.LogInformation("Scheduled announcement {AnnouncementId} marked as sent with 0 recipients at scheduled time {ScheduledAt}", 
                        announcementId, announcement.ScheduledAt);
                    return true;
                }

                // Send the announcement
                int sentCount = 0;
                int failedCount = 0;

                // Get all users with their email addresses upfront for bulk email sending
                var tenantUserList = tenantUserIds.ToList();
                var userEmailMap = new Dictionary<long, string>();
                
                if (announcement.SendAsEmail && tenantUserList.Any())
                {
                    var users = await _dataContext.Users
                        .Where(u => tenantUserList.Contains(u.Id) && !u.IsDeleted)
                        .Select(u => new { u.Id, u.Email })
                        .ToListAsync();
                    
                    foreach (var user in users)
                    {
                        if (!string.IsNullOrEmpty(user.Email))
                        {
                            userEmailMap[user.Id] = user.Email;
                        }
                    }
                }

                // Generate email subject
                string emailSubject = announcement.Title;
                if (announcement.SendAsEmail && !string.IsNullOrEmpty(announcement.Message))
                {
                    try
                    {
                        var subjectPrompt = $@"Based on the following announcement message, generate a concise, professional email subject line (maximum 60 characters):

{announcement.Message}

Subject line only (no quotes, no 'Subject:' prefix):";

                        var subjectResponse = await _openAIService.GenerateTextAsync(subjectPrompt, maxTokens: 100);
                        if (subjectResponse.Success && !string.IsNullOrEmpty(subjectResponse.Data))
                        {
                            emailSubject = subjectResponse.Data.Trim().Replace("\"", "").Replace("Subject:", "").Trim();
                            if (emailSubject.Length > 60)
                            {
                                emailSubject = emailSubject.Substring(0, 57) + "...";
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to generate email subject for scheduled announcement {AnnouncementId}, using title", announcementId);
                    }
                }

                // Send bulk email if enabled
                bool bulkEmailSuccess = false;
                var emailRecipients = userEmailMap.Values.ToList();
                if (announcement.SendAsEmail && emailRecipients.Any())
                {
                    try
                    {
                        bulkEmailSuccess = await _emailService.SendBulkEmailAsync(
                            to: emailRecipients,
                            subject: emailSubject,
                            htmlContent: $"<p>{announcement.Message.Replace("\n", "<br/>")}</p>",
                            plainTextContent: announcement.Message
                        );

                        if (bulkEmailSuccess)
                        {
                            _logger.LogInformation("Bulk email sent successfully to {Count} recipients for scheduled announcement {AnnouncementId}", 
                                emailRecipients.Count, announcementId);
                        }
                        else
                        {
                            _logger.LogWarning("Bulk email send failed for scheduled announcement {AnnouncementId}", announcementId);
                        }
                    }
                    catch (Exception bulkEmailEx)
                    {
                        _logger.LogError(bulkEmailEx, "Error sending bulk email for scheduled announcement {AnnouncementId}", announcementId);
                        bulkEmailSuccess = false;
                    }
                }

                // Send notifications individually and create recipient records
                var recipients = new List<AnnouncementRecipient>();
                
                foreach (var tenantUserId in tenantUserList)
                {
                    bool notificationSuccess = false;
                    bool emailSuccess = false;
                    DateTime? notificationSentAt = null;
                    DateTime? emailSentAt = null;
                    string? errorMessage = null;

                    try
                    {
                        // Send in-app notification and add message to conversation
                        if (announcement.SendAsNotification)
                        {
                            var notificationDto = new CreateNotificationDto
                            {
                                UserId = tenantUserId,
                                OrganizationId = announcement.OrganizationId,
                                Type = ENotificationType.Message,
                                Title = "Announcement",
                                Message = announcement.Message,
                                SendEmail = false, // Email handled separately via bulk send
                                SendSMS = false,
                                PerformedByUserId = announcement.CreatedByUserId
                            };

                            var notificationResult = await _notificationService.CreateNotification(notificationDto);
                            if (notificationResult.Success)
                            {
                                notificationSuccess = true;
                                notificationSentAt = DateTime.UtcNow;

                                // Add announcement as a message in the tenant-landlord conversation
                                try
                                {
                                    var conversation = await _conversationRepository.GetOrCreateTenantLandlordConversation(tenantUserId);
                                    if (conversation != null && conversation.Id > 0)
                                    {
                                        var messageDto = new AddMessageDto
                                        {
                                            ConversationId = conversation.Id,
                                            Content = $"📢 **Announcement**\n\n{announcement.Message}"
                                        };

                                        await _messageService.AddMessage(messageDto);
                                    }
                                }
                                catch (Exception msgEx)
                                {
                                    _logger.LogError(msgEx, "Error adding announcement message to conversation for tenant {TenantUserId}", tenantUserId);
                                }
                            }
                            else
                            {
                                errorMessage = $"Notification failed: {notificationResult.Message}";
                                _logger.LogWarning("Failed to create notification for user {UserId}: {Error}", tenantUserId, notificationResult.Message);
                            }
                        }

                        // Check if email was sent successfully for this user
                        if (announcement.SendAsEmail)
                        {
                            emailSuccess = bulkEmailSuccess && userEmailMap.ContainsKey(tenantUserId);
                            if (emailSuccess)
                            {
                                emailSentAt = DateTime.UtcNow;
                            }
                            else if (!userEmailMap.ContainsKey(tenantUserId))
                            {
                                errorMessage = (!string.IsNullOrEmpty(errorMessage) ? errorMessage + "; " : "") + "User has no email address";
                            }
                            else if (!bulkEmailSuccess)
                            {
                                errorMessage = (!string.IsNullOrEmpty(errorMessage) ? errorMessage + "; " : "") + "Email failed";
                            }
                        }

                        // Count success/failure
                        if (notificationSuccess || emailSuccess)
                        {
                            sentCount++;
                        }
                        else
                        {
                            failedCount++;
                        }

                        // Create recipient record
                        var recipient = new AnnouncementRecipient
                        {
                            AnnouncementId = announcement.Id,
                            TenantId = tenantUserId,
                            NotificationSent = notificationSuccess,
                            EmailSent = emailSuccess,
                            NotificationSentAt = notificationSentAt,
                            EmailSentAt = emailSentAt,
                            ErrorMessage = errorMessage,
                            CreatedAt = DateTime.UtcNow
                        };

                        recipients.Add(recipient);
                    }
                    catch (Exception ex)
                    {
                        failedCount++;
                        _logger.LogError(ex, "Error processing announcement recipient {UserId} for scheduled announcement {AnnouncementId}", tenantUserId, announcementId);

                        var recipient = new AnnouncementRecipient
                        {
                            AnnouncementId = announcement.Id,
                            TenantId = tenantUserId,
                            NotificationSent = false,
                            EmailSent = false,
                            ErrorMessage = ex.Message,
                            CreatedAt = DateTime.UtcNow
                        };

                        recipients.Add(recipient);
                    }
                }

                // Batch add all recipients
                if (recipients.Any())
                {
                    _dataContext.AnnouncementRecipients.AddRange(recipients);
                }

                // Update announcement with final counts
                announcement.SentCount = sentCount;
                announcement.FailedCount = failedCount;
                announcement.IsCompleted = true;
                announcement.CompletedAt = DateTime.UtcNow;
                announcement.UpdatedAt = DateTime.UtcNow;

                await _dataContext.SaveChangesAsync();

                _logger.LogInformation("Scheduled announcement {AnnouncementId} sent successfully to {SentCount} recipients, {FailedCount} failed", 
                    announcementId, sentCount, failedCount);

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending scheduled announcement {AnnouncementId}", announcementId);
                return false;
            }
        }

        public async Task<ServiceResponse<bool>> DeleteAnnouncementAsync(long id)
        {
            try
            {
                var currentUserId = await GetCurrentUserIdAsync();
                if (!currentUserId.HasValue)
                {
                    return ServiceResponse<bool>.CreateError(
                        "Unauthorized",
                        "User not authenticated",
                        "",
                        401
                    );
                }

                var currentOrgId = GetCurrentOrganizationId();
                if (!currentOrgId.HasValue)
                {
                    return ServiceResponse<bool>.CreateError(
                        "Organization context required",
                        "Organization context is required to delete announcements",
                        "",
                        403
                    );
                }

                var announcement = await _dataContext.Announcements
                    .Include(a => a.Recipients)
                    .FirstOrDefaultAsync(a => a.Id == id);

                if (announcement == null)
                {
                    return ServiceResponse<bool>.CreateError(
                        "Announcement not found",
                        "The requested announcement does not exist",
                        "",
                        404
                    );
                }

                // Check if user has permission (must be in same organization or be the creator)
                if (announcement.OrganizationId != currentOrgId.Value && announcement.CreatedByUserId != currentUserId.Value)
                {
                    return ServiceResponse<bool>.CreateError(
                        "Forbidden",
                        "You do not have permission to delete this announcement",
                        "",
                        403
                    );
                }

                // Check if announcement is scheduled and not yet sent
                bool isScheduled = announcement.ScheduledAt.HasValue && !announcement.IsCompleted;
                
                if (isScheduled)
                {
                    _logger.LogInformation("Cancelling scheduled announcement {AnnouncementId} that was scheduled for {ScheduledAt}", 
                        announcement.Id, announcement.ScheduledAt);
                }

                // Delete all recipients first (cascade delete should handle this, but being explicit)
                if (announcement.Recipients != null && announcement.Recipients.Any())
                {
                    _dataContext.AnnouncementRecipients.RemoveRange(announcement.Recipients);
                }

                // Delete the announcement
                _dataContext.Announcements.Remove(announcement);
                await _dataContext.SaveChangesAsync();

                _logger.LogInformation("Announcement {AnnouncementId} deleted successfully. Was scheduled: {WasScheduled}", 
                    id, isScheduled);

                return new ServiceResponse<bool>
                {
                    Data = true,
                    Message = isScheduled 
                        ? "Scheduled announcement cancelled and deleted successfully" 
                        : "Announcement deleted successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting announcement {Id}", id);
                return ServiceResponse<bool>.CreateError(
                    "Error deleting announcement",
                    ex.Message,
                    ex.InnerException?.Message,
                    500
                );
            }
        }
    }
}
