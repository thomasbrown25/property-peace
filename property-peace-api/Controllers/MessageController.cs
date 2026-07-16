using brownstone_hub_api.Dtos.Message;
using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Services.MessageService;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Repositories.Conversations;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Services.SmsService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using brownstone_hub_api.Hubs;
using Microsoft.Extensions.Logging;
using System.Net;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Tenant,Landlord,Admin")]
    public class MessageController(
        IMessageService messageService,
        IHubContext<ConversationHub> hubContext,
        INotificationService notificationService,
        IConversationRepository conversationRepository,
        IEmailService emailService,
        ISmsService smsService,
        ILogger<MessageController> logger) : ControllerBase
    {
        private readonly IMessageService _messageService = messageService;
        private readonly IHubContext<ConversationHub> _hubContext = hubContext;
        private readonly INotificationService _notificationService = notificationService;
        private readonly IConversationRepository _conversationRepository = conversationRepository;
        private readonly IEmailService _emailService = emailService;
        private readonly ISmsService _smsService = smsService;
        private readonly ILogger<MessageController> _logger = logger;


        [HttpPost]
        public async Task<IActionResult> AddMessage([FromBody] AddMessageDto message)
        {
            var response = await _messageService.AddMessage(message);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            var dedicatedSmsSent = false;

            // Get conversation to find participants and send email notifications
            try
            {
                // Get the sender ID from the response
                var senderId = response.Data?.SenderId ?? 0;
                
                if (senderId > 0)
                {
                    // Get conversation with participants
                    var conversation = await _conversationRepository.GetConversationById(message.ConversationId, senderId);
                    
                    if (conversation != null && senderId == conversation.LandlordId && !string.IsNullOrWhiteSpace(conversation.LandlordSmsNumber) && !string.IsNullOrWhiteSpace(conversation.TenantPhoneNumber))
                    {
                        dedicatedSmsSent = await _smsService.SendSmsAsync(
                            conversation.TenantPhoneNumber,
                            message.Content ?? string.Empty,
                            from: conversation.LandlordSmsNumber);

                        if (dedicatedSmsSent)
                        {
                            _logger.LogInformation("Dedicated SMS sent for conversation {ConversationId} to tenant phone from {FromNumber}", message.ConversationId, conversation.LandlordSmsNumber);
                        }
                        else
                        {
                            _logger.LogWarning("Dedicated SMS failed for conversation {ConversationId} to tenant phone from {FromNumber}", message.ConversationId, conversation.LandlordSmsNumber);
                        }
                    }
                    
                    if (conversation != null && conversation.Participants != null && conversation.Participants.Any())
                    {
                        // Get sender name for email
                        var senderName = !string.IsNullOrEmpty(response.Data?.SenderName) 
                            ? response.Data.SenderName 
                            : "Someone";
                        var messagePreview = !string.IsNullOrEmpty(message.Content)
                            ? (message.Content.Length > 100 
                                ? message.Content.Substring(0, 100) + "..." 
                                : message.Content)
                            : "New message";
                        
                        // Send email notifications to all participants except the sender
                        foreach (var participant in conversation.Participants)
                        {
                            if (participant.UserId != senderId && participant.IsActive)
                            {
                                try
                                {
                                    var conversationTitle = !string.IsNullOrEmpty(conversation.Title)
                                        ? conversation.Title
                                        : !string.IsNullOrEmpty(conversation.TenantName)
                                            ? conversation.TenantName
                                            : !string.IsNullOrEmpty(conversation.LandlordName)
                                                ? conversation.LandlordName
                                                : "Conversation";
                                    
                                    await _notificationService.CreateNotification(new CreateNotificationDto
                                    {
                                        UserId = participant.UserId,
                                        Type = ENotificationType.Message,
                                        Title = $"New message in {conversationTitle}",
                                        Message = $"{senderName}: {messagePreview}",
                                        RelatedId = message.ConversationId,
                                        SendEmail = true, // Will check user preferences
                                        SendSMS = !dedicatedSmsSent // Dedicated landlord replies are sent from the org SMS number above
                                    });
                                    
                                    _logger.LogInformation("Email notification sent to user {UserId} for message in conversation {ConversationId}", 
                                        participant.UserId, message.ConversationId);
                                }
                                catch (Exception ex)
                                {
                                    // Log but don't fail the request if notification fails
                                    // The message was already saved successfully
                                    _logger.LogError(ex, "Error sending email notification to user {UserId} for conversation {ConversationId}: {Error}", 
                                        participant.UserId, message.ConversationId, ex.Message);
                                }
                            }
                        }
                    }
                    else
                    {
                        _logger.LogWarning("Conversation {ConversationId} not found or has no participants when sending message notification", 
                            message.ConversationId);
                    }
                }
            }
            catch (Exception ex)
            {
                // Log but don't fail the request if notification logic fails
                // The message was already saved successfully
                _logger.LogError(ex, "Error processing email notifications for message in conversation {ConversationId}: {Error}", 
                    message.ConversationId, ex.Message);
            }

            // Email-only tenant fallback: if the conversation is linked to a tenant with an email
            // but no tenant user participant, send the landlord's typed chat message by email.
            try
            {
                var senderId = response.Data?.SenderId ?? 0;
                if (senderId > 0)
                {
                    var conversation = await _conversationRepository.GetConversationById(message.ConversationId, senderId);
                    var tenantEmail = conversation?.TenantEmail?.Trim();
                    var hasTenantUserParticipant = conversation?.Participants?.Any(p => p.UserId != senderId && p.IsActive) == true;

                    if (!string.IsNullOrWhiteSpace(tenantEmail) && !hasTenantUserParticipant)
                    {
                        var senderName = !string.IsNullOrWhiteSpace(response.Data?.SenderName)
                            ? response.Data.SenderName
                            : "Your landlord";
                        var conversationTitle = !string.IsNullOrWhiteSpace(conversation?.Title)
                            ? conversation.Title
                            : "Property Peace message";
                        var subject = $"New message about {conversationTitle} [PP-C{message.ConversationId}]";
                        var encodedBody = WebUtility.HtmlEncode(message.Content ?? string.Empty).Replace("\n", "<br />");
                        var encodedSender = WebUtility.HtmlEncode(senderName);
                        var encodedTitle = WebUtility.HtmlEncode(conversationTitle);
                        var html = $@"
                            <p>{encodedSender} sent you a message in Property Peace.</p>
                            <p><strong>{encodedTitle}</strong></p>
                            <blockquote style=""border-left:4px solid #d9e2ef;margin:16px 0;padding:8px 12px;color:#1f2937;"">{encodedBody}</blockquote>
                            <p style=""color:#64748b;font-size:13px;"">You can reply to your landlord directly by contacting them, or create your Property Peace account when invited.</p>";

                        var sent = await _emailService.SendEmailAsync(tenantEmail, subject, html, message.Content);
                        if (sent)
                        {
                            _logger.LogInformation("Email-only tenant fallback sent for conversation {ConversationId} to {TenantEmail}", message.ConversationId, tenantEmail);
                        }
                        else
                        {
                            _logger.LogWarning("Email-only tenant fallback failed for conversation {ConversationId} to {TenantEmail}", message.ConversationId, tenantEmail);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                // Do not fail saved chat messages if email fallback fails.
                _logger.LogError(ex, "Error sending email-only tenant fallback for conversation {ConversationId}: {Error}", message.ConversationId, ex.Message);
            }

            // Send SignalR notification to conversation participants
            try
            {
                // Send to conversation group
                var conversationGroup = $"conversation_{message.ConversationId}";
                await _hubContext.Clients.Group(conversationGroup)
                    .SendAsync("MessageReceived", response.Data);

                // Also notify all participants via their user groups to update conversation list
                await _hubContext.Clients.Group(conversationGroup)
                    .SendAsync("ConversationListUpdated");
            }
            catch (Exception)
            {
                // Log but don't fail the request if SignalR fails
                // The message was already saved successfully
            }

            return Ok(response);
        }

        [HttpGet("{messageId}")]
        public async Task<IActionResult> GetMessage(long messageId)
        {
            var response = await _messageService.GetMessageById(messageId);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpGet("conversation/{conversationId}")]
        public async Task<IActionResult> GetMessages(long conversationId, [FromQuery] int skip = 0, [FromQuery] int take = 50)
        {
            var response = await _messageService.GetMessagesByConversationId(conversationId, skip, take);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpPut("{messageId}")]
        public async Task<IActionResult> UpdateMessage(long messageId, [FromBody] string content)
        {
            var response = await _messageService.UpdateMessage(messageId, content);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpDelete("{messageId}")]
        public async Task<IActionResult> DeleteMessage(long messageId)
        {
            var response = await _messageService.DeleteMessage(messageId);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpPost("{messageId}/read")]
        public async Task<IActionResult> MarkMessageAsRead(long messageId)
        {
            var response = await _messageService.MarkMessageAsRead(messageId);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpPost("conversation/{conversationId}/read")]
        public async Task<IActionResult> MarkConversationAsRead(long conversationId)
        {
            var response = await _messageService.MarkConversationAsRead(conversationId);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }
    }
}

