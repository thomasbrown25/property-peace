using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Message;
using brownstone_hub_api.Repositories.Conversations;
using brownstone_hub_api.Repositories.Timelines;
using brownstone_hub_api.Services.MessageDeliveries;
using Microsoft.EntityFrameworkCore;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace brownstone_hub_api.Repositories.Messages
{
    public class MessageRepository(
        DataContext context,
        ILogger<MessageRepository> logger,
        IMapper mapper,
        IConversationTimelineSequenceAllocator? timelineSequenceAllocator = null,
        ICommunicationDestinationProtector? destinationProtector = null) : IMessageRepository
    {
        private readonly DataContext _context = context;
        private readonly ILogger<MessageRepository> _logger = logger;
        private readonly IMapper _mapper = mapper;
        private readonly IConversationTimelineSequenceAllocator _timelineSequenceAllocator =
            timelineSequenceAllocator ?? new ConversationTimelineSequenceAllocator();
        private readonly ICommunicationDestinationProtector? _destinationProtector = destinationProtector;

        public async Task<LoadMessageDto> AddMessage(AddMessageDto message, long senderId)
        {
            try
            {
                // Resolve the conversation through active membership so an inaccessible ID is
                // indistinguishable from a missing conversation.
                var conversation = await _context.Conversations
                    .WhereActiveParticipant(_context.OrganizationMembers, senderId)
                    .FirstOrDefaultAsync(c => c.Id == message.ConversationId);
                if (conversation == null)
                {
                    throw new KeyNotFoundException($"Conversation with ID {message.ConversationId} not found");
                }

                if (message.ReplyToMessageId.HasValue &&
                    !await _context.Messages.AnyAsync(m =>
                        m.Id == message.ReplyToMessageId.Value &&
                        m.ConversationId == message.ConversationId &&
                        !m.IsDeleted))
                {
                    throw new KeyNotFoundException("Reply message not found");
                }

                if (!conversation.OrganizationId.HasValue || conversation.OrganizationId.Value <= 0)
                {
                    throw new InvalidOperationException(
                        "Conversation organization is unresolved; timeline evidence cannot be recorded safely.");
                }
                var organizationId = conversation.OrganizationId.Value;

                if (message.ClientRequestId?.Length > 200)
                    throw new ArgumentException("ClientRequestId cannot exceed 200 characters.", nameof(message));

                var payloadHash = ComputeMessagePayloadHash(message, senderId);
                if (!string.IsNullOrWhiteSpace(message.ClientRequestId))
                {
                    var prior = await _context.ConversationTimelineEntries.SingleOrDefaultAsync(x =>
                        x.OrganizationId == organizationId &&
                        x.Producer == "message-api" &&
                        x.EventId == message.ClientRequestId);
                    if (prior != null)
                    {
                        if (!string.Equals(prior.PayloadHash, payloadHash, StringComparison.Ordinal))
                            throw new TimelineIdempotencyConflictException("Client request was already recorded with a different payload hash.");
                        if (!prior.MessageId.HasValue)
                            throw new InvalidOperationException("Idempotent message timeline entry is missing its message.");
                        var replayed = (await GetMessageById(prior.MessageId.Value, senderId))!;
                        replayed.WasReplayed = true;
                        return replayed;
                    }
                }

                var entity = new Message
                {
                    ConversationId = message.ConversationId,
                    Content = message.Content,
                    AttachmentUrl = message.AttachmentUrl,
                    AttachmentName = message.AttachmentName,
                    SenderId = senderId,
                    ReplyToMessageId = message.ReplyToMessageId,
                    OrganizationId = conversation.OrganizationId // Set OrganizationId from conversation
                };

                await _context.Messages.AddAsync(entity);

                var eventId = string.IsNullOrWhiteSpace(message.ClientRequestId)
                    ? $"message-{Guid.NewGuid():N}"
                    : message.ClientRequestId.Trim();
                var sequence = await _timelineSequenceAllocator.AllocateAsync(_context, conversation.Id);
                var channel = NormalizeChannel(message.Channel);
                var timelineEntry = new ConversationTimelineEntry
                {
                    OrganizationId = organizationId,
                    ConversationId = conversation.Id,
                    Sequence = sequence,
                    Kind = channel switch
                    {
                        "sms" => TimelineEntryKind.InboundSms,
                        "email" => TimelineEntryKind.Email,
                        _ => TimelineEntryKind.Message
                    },
                    OccurredAtUtc = entity.CreatedAt.ToUniversalTime(),
                    RecordedAtUtc = DateTime.UtcNow,
                    ActorUserId = senderId,
                    Message = entity,
                    SourceType = "message",
                    SourceId = eventId,
                    Summary = message.Content.Length > 500 ? message.Content[..500] : message.Content,
                    MetadataVersion = 1,
                    MetadataJson = JsonSerializer.Serialize(new Dictionary<string, string>
                    {
                        ["channel"] = channel,
                        ["direction"] = channel == "inApp" ? "outbound" : "inbound",
                        ["status"] = channel == "inApp" ? "delivered" : "received"
                    }),
                    Visibility = TimelineVisibility.Participants,
                    Producer = "message-api",
                    EventId = eventId,
                    PayloadHash = payloadHash
                };
                _context.ConversationTimelineEntries.Add(timelineEntry);

                // In-app delivery means the saved message is available to an active recipient. Record it
                // atomically with the message/timeline, independently of any later external attempt.
                var recipients = await _context.ConversationParticipants
                    .Where(p => p.ConversationId == conversation.Id && p.UserId != senderId && !p.IsDeleted)
                    .Select(p => p.UserId)
                    .Distinct()
                    .ToListAsync();
                var deliveryNow = DateTime.UtcNow;

                // Resolve external destinations from server-owned records and snapshot complete payloads
                // before the single SaveChanges below, eliminating the former post-commit crash gap.
                if (_destinationProtector != null && channel == "inApp" && senderId == conversation.LandlordId)
                {
                    var tenant = conversation.TenantId.HasValue
                        ? await _context.Tenants.Where(x => x.Id == conversation.TenantId.Value)
                            .Select(x => new { x.Email, x.PhoneNumber }).SingleOrDefaultAsync()
                        : null;
                    var organizationSmsNumber = await _context.OrganizationSmsNumbers
                        .Where(x => x.OrganizationId == organizationId && x.IsActive && x.IsPrimary)
                        .Select(x => x.PhoneNumber).FirstOrDefaultAsync();
                    var senderName = await _context.Users.Where(x => x.Id == senderId)
                        .Select(x => (x.FirstName + " " + x.LastName).Trim()).SingleAsync();

                    if (!string.IsNullOrWhiteSpace(organizationSmsNumber) && !string.IsNullOrWhiteSpace(tenant?.PhoneNumber))
                        AddExternalDelivery(MessageDeliveryChannel.Sms, tenant.PhoneNumber, entity.Content, null, null, organizationSmsNumber);

                    if (recipients.Count == 0 && !string.IsNullOrWhiteSpace(tenant?.Email))
                    {
                        var title = string.IsNullOrWhiteSpace(conversation.Title) ? "Property Peace message" : conversation.Title;
                        var displaySender = string.IsNullOrWhiteSpace(senderName) ? "Your landlord" : senderName;
                        var subject = $"New message about {title} [PP-C{conversation.Id}]";
                        var html = $"<p>{WebUtility.HtmlEncode(displaySender)} sent you a message in Property Peace.</p>" +
                                   $"<p><strong>{WebUtility.HtmlEncode(title)}</strong></p>" +
                                   $"<blockquote>{WebUtility.HtmlEncode(entity.Content).Replace("\n", "<br />")}</blockquote>";
                        AddExternalDelivery(MessageDeliveryChannel.Email, tenant.Email, entity.Content, subject, html, null);
                    }

                    void AddExternalDelivery(MessageDeliveryChannel externalChannel, string destination, string body,
                        string? subject, string? html, string? from)
                    {
                        _context.MessageDeliveries.Add(new MessageDelivery
                        {
                            OrganizationId = organizationId,
                            ConversationTimelineEntry = timelineEntry,
                            Message = entity,
                            Channel = externalChannel,
                            Status = MessageDeliveryStatus.Pending,
                            ProtectedDestination = _destinationProtector.Protect(destination.Trim()),
                            MaskedDestination = MaskDestination(destination),
                            ProtectedFromAddress = string.IsNullOrWhiteSpace(from) ? null : _destinationProtector.Protect(from.Trim()),
                            BodySnapshot = body,
                            SubjectSnapshot = subject,
                            HtmlBodySnapshot = html,
                            IdempotencyKey = $"message:{eventId}:external:{externalChannel.ToString().ToLowerInvariant()}",
                            CreatedAtUtc = deliveryNow,
                            UpdatedAtUtc = deliveryNow
                        });
                    }
                }

                foreach (var recipientId in recipients)
                {
                    _context.MessageDeliveries.Add(new MessageDelivery
                    {
                        OrganizationId = organizationId,
                        ConversationTimelineEntry = timelineEntry,
                        Message = entity,
                        Channel = MessageDeliveryChannel.InApp,
                        Status = MessageDeliveryStatus.Delivered,
                        RecipientUserId = recipientId,
                        DeliveredAtUtc = deliveryNow,
                        IdempotencyKey = $"message:{eventId}:inApp:{recipientId}",
                        CreatedAtUtc = deliveryNow,
                        UpdatedAtUtc = deliveryNow
                    });
                }

                // Update conversation's last message info
                conversation.LastMessageAt = entity.CreatedAt;
                conversation.LastMessagePreview = message.Content.Length > 100 
                    ? message.Content.Substring(0, 100) + "..." 
                    : message.Content;
                conversation.LastMessageBy = senderId;
                conversation.UpdatedAt = DateTime.UtcNow;

                _context.Conversations.Update(conversation);
                await _context.SaveChangesAsync();

                return (await GetMessageById(entity.Id, senderId))!;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding message");
                throw;
            }
        }

        private static string ComputeMessagePayloadHash(AddMessageDto message, long senderId)
        {
            var canonical = JsonSerializer.Serialize(new
            {
                message.ConversationId,
                SenderId = senderId,
                message.Content,
                message.AttachmentUrl,
                message.AttachmentName,
                message.ReplyToMessageId,
                Channel = NormalizeChannel(message.Channel),
                message.TrustedProviderPayloadHash
            });
            return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical))).ToLowerInvariant();
        }

        private static string NormalizeChannel(string? channel) => channel?.Trim().ToLowerInvariant() switch
        {
            "sms" => "sms",
            "email" => "email",
            _ => "inApp"
        };

        private static string MaskDestination(string value)
        {
            var trimmed = value.Trim();
            var at = trimmed.IndexOf('@');
            if (at > 0) return trimmed[0] + "***" + trimmed[at..];
            return trimmed.Length <= 4 ? "****" : new string('*', trimmed.Length - 4) + trimmed[^4..];
        }

        public async Task<LoadMessageDto?> GetMessageById(long messageId, long actorUserId)
        {
            try
            {
                var authorizedConversationIds = _context.Conversations
                    .WhereActiveParticipant(_context.OrganizationMembers, actorUserId)
                    .Select(c => c.Id);
                var message = await _context.Messages
                    .Include(m => m.Sender)
                    .Include(m => m.ReplyToMessage)
                        .ThenInclude(rm => rm.Sender)
                    .FirstOrDefaultAsync(m =>
                        m.Id == messageId &&
                        !m.IsDeleted &&
                        authorizedConversationIds.Contains(m.ConversationId));

                if (message == null)
                    return null;

                var dto = new LoadMessageDto
                {
                    Id = message.Id,
                    ConversationId = message.ConversationId,
                    Content = message.Content,
                    AttachmentUrl = message.AttachmentUrl,
                    AttachmentName = message.AttachmentName,
                    SenderId = message.SenderId,
                    SenderName = message.Sender != null 
                        ? $"{message.Sender.FirstName} {message.Sender.LastName}".Trim() 
                        : message.Sender?.Email ?? "Unknown",
                    SenderEmail = message.Sender?.Email,
                    SenderProfileImageUrl = message.Sender?.ProfileImageUrl,
                    ReplyToMessageId = message.ReplyToMessageId,
                    IsEdited = message.IsEdited,
                    EditedAt = message.EditedAt,
                    IsDeleted = message.IsDeleted,
                    IsUrgent = message.IsUrgent,
                    UrgentDetectedAt = message.UrgentDetectedAt,
                    CreatedAt = message.CreatedAt
                };

                // Include reply message if exists
                if (message.ReplyToMessage != null)
                {
                    dto.ReplyToMessage = new LoadMessageDto
                    {
                        Id = message.ReplyToMessage.Id,
                        Content = message.ReplyToMessage.Content,
                        SenderName = message.ReplyToMessage.Sender != null 
                            ? $"{message.ReplyToMessage.Sender.FirstName} {message.ReplyToMessage.Sender.LastName}".Trim() 
                            : message.ReplyToMessage.Sender?.Email ?? "Unknown",
                        SenderProfileImageUrl = message.ReplyToMessage.Sender?.ProfileImageUrl,
                        CreatedAt = message.ReplyToMessage.CreatedAt
                    };
                }

                return dto;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving message {MessageId}", messageId);
                throw;
            }
        }

        public async Task<List<LoadMessageDto>> GetMessagesByConversationId(long conversationId, long userId, int skip = 0, int take = 50)
        {
            try
            {
                if (!await _context.Conversations
                    .WhereActiveParticipant(_context.OrganizationMembers, userId)
                    .AnyAsync(c => c.Id == conversationId))
                {
                    throw new KeyNotFoundException("Conversation not found");
                }

                var messages = await _context.Messages
                    .Include(m => m.Sender)
                    .Include(m => m.ReplyToMessage)
                        .ThenInclude(rm => rm.Sender)
                    .Include(m => m.ReadReceipts)
                    .Where(m => m.ConversationId == conversationId && !m.IsDeleted)
                    .OrderByDescending(m => m.CreatedAt)
                    .Skip(skip)
                    .Take(take)
                    .ToListAsync();

                var dtos = messages.Select(message =>
                {
                    var dto = new LoadMessageDto
                    {
                        Id = message.Id,
                        ConversationId = message.ConversationId,
                        Content = message.Content,
                        AttachmentUrl = message.AttachmentUrl,
                        AttachmentName = message.AttachmentName,
                        SenderId = message.SenderId,
                        SenderName = message.Sender != null 
                        ? $"{message.Sender.FirstName} {message.Sender.LastName}".Trim() 
                        : message.Sender?.Email ?? "Unknown",
                        SenderEmail = message.Sender?.Email,
                        SenderProfileImageUrl = message.Sender?.ProfileImageUrl,
                        ReplyToMessageId = message.ReplyToMessageId,
                        IsEdited = message.IsEdited,
                        EditedAt = message.EditedAt,
                        IsDeleted = message.IsDeleted,
                        IsUrgent = message.IsUrgent,
                        UrgentDetectedAt = message.UrgentDetectedAt,
                        CreatedAt = message.CreatedAt
                    };

                    // Check if this message has been read by the current user
                    var readReceipt = message.ReadReceipts.FirstOrDefault(rr => rr.UserId == userId);
                    dto.IsRead = readReceipt != null;
                    dto.ReadAt = readReceipt?.ReadAt;

                    // Include reply message if exists
                    if (message.ReplyToMessage != null)
                    {
                        dto.ReplyToMessage = new LoadMessageDto
                        {
                            Id = message.ReplyToMessage.Id,
                            Content = message.ReplyToMessage.Content,
                            SenderName = message.ReplyToMessage.Sender != null 
                            ? $"{message.ReplyToMessage.Sender.FirstName} {message.ReplyToMessage.Sender.LastName}".Trim() 
                            : message.ReplyToMessage.Sender?.Email ?? "Unknown",
                            SenderProfileImageUrl = message.ReplyToMessage.Sender?.ProfileImageUrl,
                            CreatedAt = message.ReplyToMessage.CreatedAt
                        };
                    }

                    return dto;
                }).ToList();

                // Reverse to show oldest first (like chat apps)
                dtos.Reverse();

                return dtos;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving messages for conversation {ConversationId}", conversationId);
                throw;
            }
        }

        public async Task<LoadMessageDto> UpdateMessage(long messageId, string content, long actorUserId)
        {
            try
            {
                var authorizedConversationIds = _context.Conversations
                    .WhereActiveParticipant(_context.OrganizationMembers, actorUserId)
                    .Select(c => c.Id);
                var message = await _context.Messages.FirstOrDefaultAsync(m =>
                    m.Id == messageId &&
                    !m.IsDeleted &&
                    m.SenderId == actorUserId &&
                    authorizedConversationIds.Contains(m.ConversationId));
                if (message == null)
                    throw new KeyNotFoundException("Message not found");

                message.Content = content;
                message.IsEdited = true;
                message.EditedAt = DateTime.UtcNow;
                message.UpdatedAt = DateTime.UtcNow;

                _context.Messages.Update(message);
                await _context.SaveChangesAsync();

                return (await GetMessageById(messageId, actorUserId))!;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating message {MessageId}", messageId);
                throw;
            }
        }

        public async Task<bool> DeleteMessage(long messageId, long actorUserId)
        {
            try
            {
                var authorizedConversationIds = _context.Conversations
                    .WhereActiveParticipant(_context.OrganizationMembers, actorUserId)
                    .Select(c => c.Id);
                var message = await _context.Messages.FirstOrDefaultAsync(m =>
                    m.Id == messageId &&
                    !m.IsDeleted &&
                    m.SenderId == actorUserId &&
                    authorizedConversationIds.Contains(m.ConversationId));
                if (message == null)
                    return false;

                // Soft delete
                message.IsDeleted = true;
                message.DeletedAt = DateTime.UtcNow;
                message.UpdatedAt = DateTime.UtcNow;

                _context.Messages.Update(message);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting message {MessageId}", messageId);
                throw;
            }
        }

        public async Task MarkMessageAsRead(long messageId, long userId)
        {
            try
            {
                var authorizedConversationIds = _context.Conversations
                    .WhereActiveParticipant(_context.OrganizationMembers, userId)
                    .Select(c => c.Id);
                if (!await _context.Messages.AnyAsync(m =>
                    m.Id == messageId &&
                    !m.IsDeleted &&
                    authorizedConversationIds.Contains(m.ConversationId)))
                {
                    throw new KeyNotFoundException("Message not found");
                }

                // Check if already read
                var existing = await _context.MessageReads
                    .FirstOrDefaultAsync(mr => mr.MessageId == messageId && mr.UserId == userId);

                if (existing == null)
                {
                    var readReceipt = new MessageRead
                    {
                        MessageId = messageId,
                        UserId = userId,
                        ReadAt = DateTime.UtcNow
                    };

                    await _context.MessageReads.AddAsync(readReceipt);
                    await _context.SaveChangesAsync();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error marking message {MessageId} as read for user {UserId}", messageId, userId);
                throw;
            }
        }

        public async Task MarkConversationAsRead(long conversationId, long userId)
        {
            try
            {
                if (!await _context.Conversations
                    .WhereActiveParticipant(_context.OrganizationMembers, userId)
                    .AnyAsync(c => c.Id == conversationId))
                {
                    throw new KeyNotFoundException("Conversation not found");
                }

                // Get all unread messages in this conversation
                var unreadMessages = await _context.Messages
                    .Where(m => m.ConversationId == conversationId 
                        && !m.IsDeleted 
                        && m.SenderId != userId) // Don't mark own messages as read
                    .Where(m => !_context.MessageReads.Any(mr => mr.MessageId == m.Id && mr.UserId == userId))
                    .Select(m => m.Id)
                    .ToListAsync();

                if (unreadMessages.Any())
                {
                    var readReceipts = unreadMessages.Select(messageId => new MessageRead
                    {
                        MessageId = messageId,
                        UserId = userId,
                        ReadAt = DateTime.UtcNow
                    }).ToList();

                    await _context.MessageReads.AddRangeAsync(readReceipts);
                    await _context.SaveChangesAsync();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error marking conversation {ConversationId} as read for user {UserId}", conversationId, userId);
                throw;
            }
        }

        public async Task<bool> SetMessageUrgent(
            long messageId,
            bool isUrgent,
            long conversationId,
            long organizationId,
            long actorUserId)
        {
            try
            {
                var authorizedConversationIds = _context.Conversations
                    .WhereActiveParticipant(_context.OrganizationMembers, actorUserId)
                    .Where(c => c.Id == conversationId && c.OrganizationId == organizationId)
                    .Select(c => c.Id);
                var message = await _context.Messages.FirstOrDefaultAsync(m =>
                    m.Id == messageId &&
                    !m.IsDeleted &&
                    m.ConversationId == conversationId &&
                    m.OrganizationId == organizationId &&
                    authorizedConversationIds.Contains(m.ConversationId));
                if (message == null)
                    return false;

                message.IsUrgent = isUrgent;
                message.UrgentDetectedAt = isUrgent ? DateTime.UtcNow : null;
                message.UpdatedAt = DateTime.UtcNow;

                _context.Messages.Update(message);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error setting message {MessageId} urgent status to {IsUrgent}", messageId, isUrgent);
                throw;
            }
        }

        public async Task<bool> SetConversationUrgent(
            long conversationId,
            bool isUrgent,
            long organizationId,
            long actorUserId)
        {
            var authorized = await _context.Conversations
                .WhereActiveParticipant(_context.OrganizationMembers, actorUserId)
                .AnyAsync(c => c.Id == conversationId && c.OrganizationId == organizationId);
            if (!authorized) return false;

            var messages = await _context.Messages
                .Where(m => m.ConversationId == conversationId &&
                            m.OrganizationId == organizationId &&
                            !m.IsDeleted)
                .ToListAsync();
            var now = DateTime.UtcNow;
            foreach (var message in messages)
            {
                message.IsUrgent = isUrgent;
                message.UrgentDetectedAt = isUrgent ? now : null;
                message.UpdatedAt = now;
            }
            await _context.SaveChangesAsync();
            return true;
        }
    }
}

