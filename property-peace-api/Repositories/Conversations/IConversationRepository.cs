using brownstone_hub_api.Dtos.Conversation;

namespace brownstone_hub_api.Repositories.Conversations
{
    public interface IConversationRepository
    {
        Task<LoadConversationDto> AddConversation(AddConversationDto conversation, long landlordId, long? organizationId = null);
        Task<LoadConversationDto> GetConversationById(long conversationId, long userId);
        Task<List<LoadConversationDto>> GetConversationsByLandlordId(long landlordId, bool includeArchived = false);
        Task<List<LoadConversationDto>> GetConversationsByOrganizationId(long organizationId, bool includeArchived = false, long? landlordId = null);
        Task<List<LoadConversationDto>> GetConversationsByParticipantUserId(long userId, bool includeArchived = false);
        Task<LoadConversationDto> UpdateConversation(long conversationId, AddConversationDto conversation);
        Task<bool> DeleteConversation(long conversationId);
        Task<LoadConversationDto> ArchiveConversation(long conversationId, bool archive);
        Task<LoadConversationDto> PinConversation(long conversationId, bool pin);
        Task<int> GetUnreadCount(long conversationId, long userId);
        Task<LoadConversationDto> GetOrCreateTenantLandlordConversation(long tenantUserId);
        Task<List<LoadConversationDto>> GetConversationsByTenantUserId(long tenantUserId, bool includeArchived = false);
        Task<LoadConversationDto> GetOrCreateConversationForTenantLandlord(long tenantUserId, long landlordUserId);
        Task<List<TenantAvailableLandlordDto>> GetAvailableLandlordsForTenant(long tenantUserId);
        Task<int> DeleteConversationsByPropertyId(long propertyId);
        Task<LoadConversationDto?> UpdateConversationAnalysisAsync(long conversationId, string? summary, bool hasUrgentItems, string? urgentItemsJson);
        Task<LoadConversationDto?> ClearSpecificUrgentItemAsync(long conversationId, string urgentItemId, long? messageId = null);
        Task<List<UrgentMessageDetailDto>> GetAllUrgentMessageDetailsAsync(long organizationId);
    }
}

