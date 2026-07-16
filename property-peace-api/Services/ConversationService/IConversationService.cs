using brownstone_hub_api.Dtos.Conversation;

namespace brownstone_hub_api.Services.ConversationService
{
    public interface IConversationService
    {
        Task<ServiceResponse<LoadConversationDto>> AddConversation(AddConversationDto conversation, long landlordId);
        Task<ServiceResponse<LoadConversationDto>> GetConversationById(long conversationId, long userId);
        Task<ServiceResponse<List<LoadConversationDto>>> GetConversationsByLandlordId(long landlordId, bool includeArchived = false);
        Task<ServiceResponse<List<LoadConversationDto>>> GetConversationsByParticipantUserId(long userId, bool includeArchived = false);
        Task<ServiceResponse<LoadConversationDto>> UpdateConversation(long conversationId, AddConversationDto conversation);
        Task<ServiceResponse<bool>> DeleteConversation(long conversationId);
        Task<ServiceResponse<LoadConversationDto>> ArchiveConversation(long conversationId, bool archive);
        Task<ServiceResponse<LoadConversationDto>> PinConversation(long conversationId, bool pin);
        Task<ServiceResponse<LoadConversationDto>> GetOrCreateTenantLandlordConversation(long tenantUserId);
        Task<ServiceResponse<List<LoadConversationDto>>> GetTenantConversations(long tenantUserId, bool includeArchived = false);
        Task<ServiceResponse<LoadConversationDto>> StartTenantConversation(long tenantUserId, long landlordUserId);
        Task<ServiceResponse<List<TenantAvailableLandlordDto>>> GetAvailableLandlordsForTenant(long tenantUserId);
        Task<ServiceResponse<List<LoadConversationDto>>> GetUrgentConversations(long landlordId);
        Task<ServiceResponse<LoadConversationDto>> UpdateConversationAnalysisAsync(long conversationId, string? summary, bool hasUrgentItems, string? urgentItemsJson);
        Task<ServiceResponse<LoadConversationDto>> ClearSpecificUrgentItemAsync(long conversationId, string urgentItemId, long? messageId = null);
        Task<ServiceResponse<List<UrgentMessageDetailDto>>> GetAllUrgentMessageDetailsAsync(long organizationId);
        Task<ServiceResponse<Dtos.Message.MessageAnalysisResult>> AnalyzeAndUpdateConversationAsync(long conversationId, long userId);
    }
}

