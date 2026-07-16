using brownstone_hub_api.Dtos.Message;

namespace brownstone_hub_api.Services.MessageAnalysisService
{
    public interface IMessageAnalysisService
    {
        Task<ServiceResponse<MessageAnalysisResult>> AnalyzeConversationAsync(long conversationId);
        Task<ServiceResponse<MessageAnalysisResult>> AnalyzeMessagesAsync(List<LoadMessageDto> messages);
        Task SetMessageUrgencyFromAnalysisAsync(long conversationId, MessageAnalysisResult analysisResult, List<LoadMessageDto> messages);
    }
}

