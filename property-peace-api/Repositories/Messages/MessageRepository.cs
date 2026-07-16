using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Message;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.Messages
{
    public class MessageRepository(
        DataContext context,
        ILogger<MessageRepository> logger,
        IMapper mapper) : IMessageRepository
    {
        private readonly DataContext _context = context;
        private readonly ILogger<MessageRepository> _logger = logger;
        private readonly IMapper _mapper = mapper;

        public async Task<LoadMessageDto> AddMessage(AddMessageDto message, long senderId)
        {
            try
            {
                // Get conversation first to retrieve OrganizationId
                var conversation = await _context.Conversations.FindAsync(message.ConversationId);
                if (conversation == null)
                {
                    throw new KeyNotFoundException($"Conversation with ID {message.ConversationId} not found");
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

                // Update conversation's last message info
                conversation.LastMessageAt = entity.CreatedAt;
                conversation.LastMessagePreview = message.Content.Length > 100 
                    ? message.Content.Substring(0, 100) + "..." 
                    : message.Content;
                conversation.LastMessageBy = senderId;
                conversation.UpdatedAt = DateTime.UtcNow;

                _context.Conversations.Update(conversation);
                await _context.SaveChangesAsync();

                return await GetMessageById(entity.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding message");
                throw;
            }
        }

        public async Task<LoadMessageDto> GetMessageById(long messageId)
        {
            try
            {
                var message = await _context.Messages
                    .Include(m => m.Sender)
                    .Include(m => m.ReplyToMessage)
                        .ThenInclude(rm => rm.Sender)
                    .FirstOrDefaultAsync(m => m.Id == messageId);

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

        public async Task<LoadMessageDto> UpdateMessage(long messageId, string content)
        {
            try
            {
                var message = await _context.Messages.FindAsync(messageId);
                if (message == null)
                    throw new KeyNotFoundException("Message not found");

                message.Content = content;
                message.IsEdited = true;
                message.EditedAt = DateTime.UtcNow;
                message.UpdatedAt = DateTime.UtcNow;

                _context.Messages.Update(message);
                await _context.SaveChangesAsync();

                return await GetMessageById(messageId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating message {MessageId}", messageId);
                throw;
            }
        }

        public async Task<bool> DeleteMessage(long messageId)
        {
            try
            {
                var message = await _context.Messages.FindAsync(messageId);
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

        public async Task<bool> SetMessageUrgent(long messageId, bool isUrgent)
        {
            try
            {
                var message = await _context.Messages.FindAsync(messageId);
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
    }
}

