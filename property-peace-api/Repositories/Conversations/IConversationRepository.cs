using brownstone_hub_api.Dtos.Conversation;

namespace brownstone_hub_api.Repositories.Conversations
{
    public interface IConversationRepository
    {
        Task<LoadConversationDto> AddConversation(AddConversationDto conversation, long landlordId, long? organizationId = null);
        Task<LoadConversationDto> GetConversationById(long conversationId, long userId);
        Task<LoadConversationDto> GetConversationById(long conversationId, long userId, long organizationId);
        Task<List<LoadConversationDto>> GetConversationsByLandlordId(long landlordId, bool includeArchived = false);
        Task<List<LoadConversationDto>> GetConversationsByOrganizationId(long organizationId, bool includeArchived = false, long? landlordId = null);
        Task<List<LoadConversationDto>> GetConversationsByParticipantUserId(long userId, bool includeArchived = false);
        Task<LoadConversationDto> UpdateConversation(long conversationId, AddConversationDto conversation, long actorUserId);
        Task<bool> DeleteConversation(long conversationId, long actorUserId);
        Task<LoadConversationDto> ArchiveConversation(long conversationId, bool archive, long actorUserId);
        Task<LoadConversationDto> PinConversation(long conversationId, bool pin, long actorUserId);
        Task<int> GetUnreadCount(long conversationId, long userId);
        Task<LoadConversationDto> GetOrCreateTenantLandlordConversation(long tenantUserId, long organizationId);
        Task<List<LoadConversationDto>> GetConversationsByTenantUserId(long tenantUserId, bool includeArchived = false);
        Task<List<LoadConversationDto>> GetConversationsByTenantUserId(long tenantUserId, long organizationId, bool includeArchived = false);
        Task<LoadConversationDto> GetOrCreateConversationForTenantLandlord(long tenantUserId, long landlordUserId, long organizationId);
        Task<List<TenantAvailableLandlordDto>> GetAvailableLandlordsForTenant(long tenantUserId, long organizationId);
        Task<int> DeleteConversationsByPropertyId(long propertyId);
        Task<LoadConversationDto?> UpdateConversationAnalysisAsync(long conversationId, string? summary, bool hasUrgentItems, string? urgentItemsJson);
        Task<LoadConversationDto?> ClearSpecificUrgentItemAsync(long conversationId, string urgentItemId, long? messageId = null);
        Task<List<UrgentMessageDetailDto>> GetAllUrgentMessageDetailsAsync(long organizationId);
    }
}

