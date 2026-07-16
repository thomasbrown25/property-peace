using System.Net;
using System.Text.RegularExpressions;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Message;
using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Hubs;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Messages;
using brownstone_hub_api.Services.NotificationService;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.EmailSyncService
{
    public partial class InboundEmailService(
        DataContext context,
        IMessageRepository messageRepository,
        INotificationService notificationService,
        IHubContext<ConversationHub> conversationHub,
        ILogger<InboundEmailService> logger) : IInboundEmailService
    {
        private readonly DataContext _context = context;
        private readonly IMessageRepository _messageRepository = messageRepository;
        private readonly INotificationService _notificationService = notificationService;
        private readonly IHubContext<ConversationHub> _conversationHub = conversationHub;
        private readonly ILogger<InboundEmailService> _logger = logger;

        public async Task<bool> HandleInboundAsync(string fromEmail, string toEmail, string? subject, string? textBody, string? htmlBody, CancellationToken cancellationToken = default)
        {
            var normalizedFrom = NormalizeEmail(fromEmail);
            if (string.IsNullOrWhiteSpace(normalizedFrom))
            {
                _logger.LogWarning("Inbound email missing From address");
                return false;
            }

            var body = NormalizeBody(textBody, htmlBody);
            if (string.IsNullOrWhiteSpace(body))
            {
                _logger.LogWarning("Inbound email from {From} had no usable body", normalizedFrom);
                return false;
            }

            var senderUserId = await ResolveSenderUserIdAsync(normalizedFrom, cancellationToken);
            if (!senderUserId.HasValue)
            {
                _logger.LogWarning("Inbound email from {From} did not match a Property Peace user or tenant", normalizedFrom);
                return false;
            }

            var conversation = await ResolveConversationAsync(senderUserId.Value, normalizedFrom, toEmail, subject, cancellationToken);
            if (conversation == null)
            {
                _logger.LogWarning("Inbound email from user {UserId} could not be mapped to a conversation", senderUserId.Value);
                return false;
            }

            var savedMessage = await _messageRepository.AddMessage(new AddMessageDto
            {
                ConversationId = conversation.Id,
                Content = body
            }, senderUserId.Value);

            _logger.LogInformation("Inbound email from {From} routed to conversation {ConversationId}", normalizedFrom, conversation.Id);

            try
            {
                var conversationGroup = $"conversation_{conversation.Id}";
                await _conversationHub.Clients.Group(conversationGroup).SendAsync("MessageReceived", savedMessage, cancellationToken);
                await _conversationHub.Clients.Group(conversationGroup).SendAsync("ConversationListUpdated", cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SignalR broadcast failed for inbound email message in conversation {ConversationId}", conversation.Id);
            }

            try
            {
                var sender = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == senderUserId.Value, cancellationToken);
                var senderName = sender != null ? $"{sender.FirstName} {sender.LastName}".Trim() : normalizedFrom;
                if (string.IsNullOrWhiteSpace(senderName)) senderName = normalizedFrom;
                var preview = body.Length > 100 ? body[..100] + "..." : body;
                var title = !string.IsNullOrWhiteSpace(conversation.Title) ? conversation.Title : senderName;

                await _notificationService.CreateNotification(new CreateNotificationDto
                {
                    UserId = conversation.LandlordId,
                    OrganizationId = conversation.OrganizationId,
                    Type = ENotificationType.Message,
                    Title = $"New email reply in {title}",
                    Message = $"{senderName}: {preview}",
                    RelatedId = conversation.Id,
                    SendEmail = true,
                    SendSMS = false,
                    PerformedByUserId = senderUserId.Value,
                    PerformedByName = senderName
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to notify landlord of inbound email for conversation {ConversationId}", conversation.Id);
            }

            return true;
        }

        private async Task<long?> ResolveSenderUserIdAsync(string normalizedFrom, CancellationToken cancellationToken)
        {
            var directUser = await _context.Users.AsNoTracking()
                .Where(u => u.Email != null && u.Email.ToLower() == normalizedFrom && !u.IsDeleted)
                .Select(u => (long?)u.Id)
                .FirstOrDefaultAsync(cancellationToken);
            if (directUser.HasValue) return directUser;

            return await _context.Tenants.AsNoTracking()
                .Where(t => t.Email != null && t.Email.ToLower() == normalizedFrom && t.UserId.HasValue && !t.IsDeleted)
                .OrderByDescending(t => t.Id)
                .Select(t => t.UserId)
                .FirstOrDefaultAsync(cancellationToken);
        }

        private async Task<Conversation?> ResolveConversationAsync(long senderUserId, string normalizedFrom, string? toEmail, string? subject, CancellationToken cancellationToken)
        {
            var tokenConversationId = ExtractConversationId(toEmail) ?? ExtractConversationId(subject);
            if (tokenConversationId.HasValue)
            {
                var tokenMatch = await _context.Conversations
                    .Include(c => c.Tenant)
                    .Include(c => c.Participants)
                    .FirstOrDefaultAsync(c => c.Id == tokenConversationId.Value && !c.IsArchived, cancellationToken);

                if (tokenMatch != null && IsSenderInConversation(tokenMatch, senderUserId, normalizedFrom))
                    return tokenMatch;
            }

            var conversations = await _context.Conversations
                .Include(c => c.Tenant)
                .Include(c => c.Participants)
                .Where(c => !c.IsArchived && (
                    c.Participants.Any(p => p.UserId == senderUserId && !p.IsDeleted) ||
                    (c.Tenant != null && c.Tenant.UserId == senderUserId) ||
                    (c.Tenant != null && c.Tenant.Email != null && c.Tenant.Email.ToLower() == normalizedFrom)))
                .OrderByDescending(c => c.LastMessageAt ?? c.CreatedAt)
                .Take(2)
                .ToListAsync(cancellationToken);

            return conversations.Count == 1 ? conversations[0] : null;
        }

        private static bool IsSenderInConversation(Conversation conversation, long senderUserId, string normalizedFrom)
        {
            return conversation.Participants.Any(p => p.UserId == senderUserId && !p.IsDeleted)
                || conversation.Tenant?.UserId == senderUserId
                || string.Equals(conversation.Tenant?.Email, normalizedFrom, StringComparison.OrdinalIgnoreCase);
        }

        private static long? ExtractConversationId(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;

            var match = ConversationTokenRegex().Match(value);
            if (match.Success && long.TryParse(match.Groups[1].Value, out var id))
                return id;

            return null;
        }

        private static string NormalizeBody(string? textBody, string? htmlBody)
        {
            var body = !string.IsNullOrWhiteSpace(textBody) ? textBody : StripHtml(htmlBody);
            if (string.IsNullOrWhiteSpace(body)) return string.Empty;

            var lines = body.Replace("\r\n", "\n").Split('\n');
            var kept = new List<string>();
            foreach (var line in lines)
            {
                var trimmed = line.TrimEnd();
                if (trimmed.StartsWith("On ", StringComparison.OrdinalIgnoreCase) && trimmed.Contains(" wrote:", StringComparison.OrdinalIgnoreCase)) break;
                if (trimmed.StartsWith(">")) break;
                if (trimmed.Equals("--", StringComparison.Ordinal)) break;
                kept.Add(trimmed);
            }

            return string.Join("\n", kept).Trim();
        }

        private static string StripHtml(string? html)
        {
            if (string.IsNullOrWhiteSpace(html)) return string.Empty;
            var withoutBreaks = Regex.Replace(html, "<br\\s*/?>|</p>", "\n", RegexOptions.IgnoreCase);
            var withoutTags = Regex.Replace(withoutBreaks, "<.*?>", string.Empty);
            return WebUtility.HtmlDecode(withoutTags);
        }

        private static string NormalizeEmail(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return string.Empty;
            var match = EmailRegex().Match(raw);
            return match.Success ? match.Value.Trim().ToLowerInvariant() : raw.Trim().ToLowerInvariant();
        }

        [GeneratedRegex(@"(?:PP-C|conversation-|c)(\d+)", RegexOptions.IgnoreCase)]
        private static partial Regex ConversationTokenRegex();

        [GeneratedRegex(@"[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}", RegexOptions.IgnoreCase)]
        private static partial Regex EmailRegex();
    }
}
