using System.Collections.Generic;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Conversation;
using brownstone_hub_api.Dtos.Message;
using brownstone_hub_api.Dtos.SupportRequest;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.AdminSettings;
using brownstone_hub_api.Repositories.Conversations;
using brownstone_hub_api.Repositories.Messages;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.EmailService;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.SupportRequestService
{
    public class SupportRequestService(
        IConversationRepository conversationRepository,
        IMessageRepository messageRepository,
        IUserRepository userRepository,
        IAdminSettingsRepository adminSettingsRepository,
        IEmailService emailService,
        DataContext context,
        IHttpContextAccessor httpContextAccessor,
        ILogger<SupportRequestService> logger) : ISupportRequestService
    {
        private readonly IConversationRepository _conversationRepository = conversationRepository;
        private readonly IMessageRepository _messageRepository = messageRepository;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly IAdminSettingsRepository _adminSettingsRepository = adminSettingsRepository;
        private readonly IEmailService _emailService = emailService;
        private readonly DataContext _context = context;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly ILogger<SupportRequestService> _logger = logger;

        public async Task<ServiceResponse<bool>> SubmitSupportRequest(SubmitSupportRequestDto request)
        {
            var response = new ServiceResponse<bool>();

            try
            {
                // Get current user (landlord submitting the request)
                var currentUser = await _userRepository.GetCurrentUser();
                if (currentUser == null)
                {
                    response.Success = false;
                    response.Message = "User not authenticated";
                    response.StatusCode = 401;
                    return response;
                }

                // Find an admin user
                var adminUser = await _context.Users
                    .Include(u => u.UserRoles)
                        .ThenInclude(ur => ur.Role)
                    .Where(u => !u.IsDeleted && 
                                u.UserRoles.Any(ur => ur.Role.RoleName.ToLower() == "admin"))
                    .FirstOrDefaultAsync();

                if (adminUser == null)
                {
                    _logger.LogWarning("No admin user found in the system");
                    response.Success = false;
                    response.Message = "Admin user not found. Please contact support directly.";
                    response.StatusCode = 500;
                    return response;
                }

                // Create a new conversation for each support/feedback request
                // Each request gets its own conversation thread
                var conversationTitle = request.Type == "tech-support" 
                    ? $"Tech Support: {request.Subject}"
                    : $"Feedback: {request.Subject}";

                // Create new conversation
                var addConversationDto = new AddConversationDto
                {
                    Title = conversationTitle,
                    Description = request.Type == "tech-support" 
                        ? "Technical support request"
                        : "Feature request or feedback",
                    IsGroupChat = false,
                    ParticipantUserIds = new List<long> { adminUser.Id }
                };

                // Get organization ID from context if available
                long? organizationId = null;
                if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
                {
                    organizationId = orgId;
                }
                
                LoadConversationDto conversationResult;
                try
                {
                    conversationResult = await _conversationRepository.AddConversation(
                        addConversationDto, 
                        currentUser.Id,
                        organizationId);
                    
                    if (conversationResult == null)
                    {
                        _logger.LogError("Failed to create conversation for support request - GetConversationById returned null");
                        response.Success = false;
                        response.Message = "Failed to create conversation. Please try again.";
                        response.StatusCode = 500;
                        return response;
                    }
                }
                catch (Exception convEx)
                {
                    _logger.LogError(convEx, "Exception creating conversation: {Message}", convEx.Message);
                    response.Success = false;
                    response.Message = $"Failed to create conversation: {convEx.Message}";
                    response.StatusCode = 500;
                    return response;
                }
                
                var conversationId = conversationResult.Id;

                // Map request type to enum
                var supportAndFeedbackType = request.Type == "tech-support" 
                    ? ESupportAndFeedbackType.Support 
                    : ESupportAndFeedbackType.Feedback;

                // Save to SupportAndFeedback table
                var supportAndFeedback = new SupportAndFeedback
                {
                    UserId = currentUser.Id,
                    Type = supportAndFeedbackType,
                    SubType = request.Type == "tech-support" ? "tech-support" : "feedback",
                    Subject = request.Subject,
                    Message = request.Message,
                    CreatedAt = DateTime.UtcNow,
                    IsResolved = false
                };

                _context.SupportAndFeedbacks.Add(supportAndFeedback);
                await _context.SaveChangesAsync();

                // Create message with request details
                var requestTypeLabel = request.Type == "tech-support" ? "Tech Support" : "Feedback/Feature Request";
                var messageContent = $"**Type:** {requestTypeLabel}\n\n" +
                                    $"**Subject:** {request.Subject}\n\n" +
                                    $"**Message:**\n{request.Message}";

                var addMessageDto = new AddMessageDto
                {
                    ConversationId = conversationId,
                    Content = messageContent
                };

                await _messageRepository.AddMessage(addMessageDto, currentUser.Id);

                // Get admin settings for notification email
                var adminSettings = await _adminSettingsRepository.GetAdminSettings();
                
                // Always send to admin@brownstonehub.com, and also to configured admin email if different
                var adminEmail = "admin@brownstonehub.com";
                var additionalEmails = new List<string>();
                
                if (adminSettings != null && !string.IsNullOrWhiteSpace(adminSettings.NotificationEmail))
                {
                    var configuredEmail = adminSettings.NotificationEmail.Trim();
                    if (!string.Equals(configuredEmail, adminEmail, StringComparison.OrdinalIgnoreCase))
                    {
                        additionalEmails.Add(configuredEmail);
                    }
                }
                
                // Send email notification to admin
                var emailSubject = request.Type == "tech-support"
                    ? $"Tech Support Request: {request.Subject}"
                    : $"Feedback/Feature Request: {request.Subject}";

                var requestTypeTitle = request.Type == "tech-support" ? "Tech Support Request" : "Feedback/Feature Request";
                var emailBody = $@"
<html>
<body>
    <h2>New {requestTypeTitle}</h2>
    <p><strong>From:</strong> {currentUser.Firstname} {currentUser.Lastname} ({currentUser.Email})</p>
    <p><strong>Subject:</strong> {request.Subject}</p>
    <p><strong>Message:</strong></p>
    <p>{request.Message.Replace("\n", "<br>")}</p>
    <hr>
    <p><small>This request has been added to your admin inbox. You can view and respond to it there.</small></p>
</body>
</html>";

                var plainTextContent = $@"New {requestTypeTitle}

From: {currentUser.Firstname} {currentUser.Lastname} ({currentUser.Email})
Subject: {request.Subject}

Message:
{request.Message}

This request has been added to your admin inbox. You can view and respond to it there.";

                // Send to admin@brownstonehub.com
                try
                {
                    var emailSent = await _emailService.SendEmailAsync(
                        to: adminEmail,
                        subject: emailSubject,
                        htmlContent: emailBody,
                        plainTextContent: plainTextContent
                    );

                    if (emailSent)
                    {
                        _logger.LogInformation("Support request email sent to {Email}", adminEmail);
                    }
                    else
                    {
                        _logger.LogWarning("Failed to send support request email to {Email}", adminEmail);
                    }
                }
                catch (Exception emailEx)
                {
                    // Log but don't fail the request submission
                    _logger.LogError(emailEx, "Error sending support request email to {Email}", adminEmail);
                }
                
                // Also send to additional configured email if different
                foreach (var additionalEmail in additionalEmails)
                {
                    try
                    {
                        var emailSent = await _emailService.SendEmailAsync(
                            to: additionalEmail,
                            subject: emailSubject,
                            htmlContent: emailBody,
                            plainTextContent: plainTextContent
                        );

                        if (emailSent)
                        {
                            _logger.LogInformation("Support request email sent to {Email}", additionalEmail);
                        }
                        else
                        {
                            _logger.LogWarning("Failed to send support request email to {Email}", additionalEmail);
                        }
                    }
                    catch (Exception emailEx)
                    {
                        // Log but don't fail the request submission
                        _logger.LogError(emailEx, "Error sending support request email to {Email}", additionalEmail);
                    }
                }

                response.Success = true;
                response.Data = true;
                response.Message = "Support request submitted successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error submitting support request: {Message}", ex.Message);
                _logger.LogError(ex, "Stack trace: {StackTrace}", ex.StackTrace);
                if (ex.InnerException != null)
                {
                    _logger.LogError(ex.InnerException, "Inner exception: {Message}", ex.InnerException.Message);
                }
                response.Success = false;
                response.Message = $"An error occurred: {ex.Message}";
                response.StatusCode = 500;
            }

            return response;
        }
    }
}

