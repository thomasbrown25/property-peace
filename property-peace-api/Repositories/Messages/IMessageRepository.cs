using brownstone_hub_api.Dtos.Message;

namespace brownstone_hub_api.Repositories.Messages
{
    public interface IMessageRepository
    {
        Task<LoadMessageDto> AddMessage(AddMessageDto message, long senderId);
        Task<LoadMessageDto> GetMessageById(long messageId);
        Task<List<LoadMessageDto>> GetMessagesByConversationId(long conversationId, long userId, int skip = 0, int take = 50);
        Task<LoadMessageDto> UpdateMessage(long messageId, string content);
        Task<bool> DeleteMessage(long messageId);
        Task MarkMessageAsRead(long messageId, long userId);
        Task MarkConversationAsRead(long conversationId, long userId);
        Task<bool> SetMessageUrgent(long messageId, bool isUrgent);
    }
}

