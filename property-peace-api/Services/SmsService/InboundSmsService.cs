using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Message;
using brownstone_hub_api.Hubs;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Conversations;
using brownstone_hub_api.Repositories.Messages;
using brownstone_hub_api.Repositories.NotificationSettings;
using brownstone_hub_api.Repositories.OrganizationSmsNumbers;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Enums;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.SmsService
{
    public class InboundSmsService(
        INotificationSettingRepository notificationSettingRepository,
        IConversationRepository conversationRepository,
        IMessageRepository messageRepository,
        IUserRepository userRepository,
        IOrganizationSmsNumberRepository organizationSmsNumberRepository,
        DataContext context,
        INotificationService notificationService,
        IHubContext<ConversationHub> conversationHub,
        ILogger<InboundSmsService> logger) : IInboundSmsService
    {
        private readonly INotificationSettingRepository _notificationSettingRepository = notificationSettingRepository;
        private readonly IConversationRepository _conversationRepository = conversationRepository;
        private readonly IMessageRepository _messageRepository = messageRepository;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly IOrganizationSmsNumberRepository _organizationSmsNumberRepository = organizationSmsNumberRepository;
        private readonly DataContext _context = context;
        private readonly INotificationService _notificationService = notificationService;
        private readonly IHubContext<ConversationHub> _conversationHub = conversationHub;
        private readonly ILogger<InboundSmsService> _logger = logger;

        public async Task<string> HandleInboundAsync(string fromPhone, string toPhone, string body)
        {
            var organizationSmsNumber = await _organizationSmsNumberRepository.GetByPhoneNumberAsync(toPhone);
            if (organizationSmsNumber == null)
            {
                _logger.LogWarning("Inbound SMS to unknown Property Peace number {To} from {From}", toPhone, fromPhone);
                return EmptyTwiml();
            }

            // 1. Look up tenant by phone number. Prefer notification settings, then fall back to tenant profile phone numbers
            // so invited tenants who have not configured notification preferences can still text their landlord.
            var userId = await _notificationSettingRepository.GetUserIdByPhoneNumber(fromPhone)
                ?? await GetTenantUserIdByPhoneNumberAsync(fromPhone);
            if (userId == null)
            {
                _logger.LogWarning("Inbound SMS from unknown number {From} — no matching user or tenant found", fromPhone);
                return EmptyTwiml();
            }

            // 2. Get tenant's most recent active conversation for the organization that owns the Twilio To number
            var conversations = await _conversationRepository.GetConversationsByTenantUserId(userId.Value);
            var conversation = conversations.FirstOrDefault(c => c.LandlordSmsNumber == organizationSmsNumber.PhoneNumber);
            if (conversation == null)
            {
                _logger.LogWarning("Inbound SMS from user {UserId} — no active conversation found", userId);
                return EmptyTwiml();
            }

            // 3. Save the message as the tenant
            var messageDto = new AddMessageDto
            {
                ConversationId = conversation.Id,
                Content = body.Trim()
            };

            var savedMessage = await _messageRepository.AddMessage(messageDto, userId.Value);

            _logger.LogInformation(
                "Inbound SMS from user {UserId} routed to conversation {ConversationId}",
                userId, conversation.Id);

            // 4. Broadcast via SignalR so the landlord's dashboard updates in real time
            try
            {
                var conversationGroup = $"conversation_{conversation.Id}";
                await _conversationHub.Clients.Group(conversationGroup)
                    .SendAsync("MessageReceived", savedMessage);
                await _conversationHub.Clients.Group(conversationGroup)
                    .SendAsync("ConversationListUpdated");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SignalR broadcast failed for inbound SMS message");
            }

            // 5. Notify the landlord (in-app + email per their preferences)
            try
            {
                if (conversation.LandlordId > 0)
                {
                    var user = await _userRepository.GetUser(userId.Value);
                    var senderName = user != null
                        ? $"{user.FirstName} {user.LastName}".Trim()
                        : "Tenant";

                    var preview = body.Length > 100 ? body[..100] + "..." : body;
                    var title = !string.IsNullOrEmpty(conversation.Title)
                        ? conversation.Title
                        : senderName;

                    await _notificationService.CreateNotification(new CreateNotificationDto
                    {
                        UserId = conversation.LandlordId,
                        Type = ENotificationType.Message,
                        Title = $"New message in {title}",
                        Message = $"{senderName}: {preview}",
                        RelatedId = conversation.Id,
                        SendEmail = true,
                        SendSMS = false // Don't SMS the landlord back — would cause loop
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to notify landlord of inbound SMS");
            }

            return EmptyTwiml();
        }

        private async Task<long?> GetTenantUserIdByPhoneNumberAsync(string phoneNumber)
        {
            var digitsOnly = new string(phoneNumber.Where(char.IsDigit).ToArray());
            if (string.IsNullOrWhiteSpace(digitsOnly)) return null;

            var normalizedInbound = digitsOnly.Length >= 10 ? digitsOnly[^10..] : digitsOnly;

            var tenants = await _context.Tenants
                .AsNoTracking()
                .Where(t => t.UserId.HasValue && !t.IsDeleted && t.PhoneNumber != null)
                .Select(t => new { t.UserId, t.PhoneNumber })
                .ToListAsync();

            return tenants.FirstOrDefault(t =>
            {
                var tenantDigits = new string(t.PhoneNumber!.Where(char.IsDigit).ToArray());
                var normalizedTenant = tenantDigits.Length >= 10 ? tenantDigits[^10..] : tenantDigits;
                return normalizedTenant == normalizedInbound;
            })?.UserId;
        }

        // Return empty TwiML so Twilio doesn't send an auto-reply
        private static string EmptyTwiml() =>
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>";
    }
}
