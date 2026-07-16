using brownstone_hub_api.Dtos.Message;

namespace brownstone_hub_api.Services.MessageService
{
    public interface IMessageService
    {
        Task<ServiceResponse<LoadMessageDto>> AddMessage(AddMessageDto message);
        Task<ServiceResponse<LoadMessageDto>> GetMessageById(long messageId);
        Task<ServiceResponse<List<LoadMessageDto>>> GetMessagesByConversationId(long conversationId, int skip = 0, int take = 50);
        Task<ServiceResponse<LoadMessageDto>> UpdateMessage(long messageId, string content);
        Task<ServiceResponse<bool>> DeleteMessage(long messageId);
        Task<ServiceResponse<bool>> MarkMessageAsRead(long messageId);
        Task<ServiceResponse<bool>> MarkConversationAsRead(long conversationId);
    }
}

