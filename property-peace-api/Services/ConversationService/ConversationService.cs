using brownstone_hub_api.Dtos.Conversation;
using brownstone_hub_api.Repositories.Conversations;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Services.ActionSuppressionService;
using brownstone_hub_api.Services.MessageAnalysisService;
using brownstone_hub_api.Dtos.Message;
using Microsoft.AspNetCore.Http;
using System.Text.Json;

namespace brownstone_hub_api.Services.ConversationService
{
    public class ConversationService(
        IConversationRepository conversationRepository,
        IUserRepository userRepository,
        IActionSuppressionService? actionSuppressionService,
        IHttpContextAccessor httpContextAccessor,
        IMessageAnalysisService? messageAnalysisService,
        ILogger<ConversationService> logger,
        IOrganizationMemberRepository organizationMemberRepository) : IConversationService
    {
        private readonly IConversationRepository _conversationRepository = conversationRepository;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly IActionSuppressionService? _actionSuppressionService = actionSuppressionService;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly IMessageAnalysisService? _messageAnalysisService = messageAnalysisService;
        private readonly ILogger<ConversationService> _logger = logger;
        private readonly IOrganizationMemberRepository _organizationMemberRepository = organizationMemberRepository;

        private long? GetOrganizationIdFromContext()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }

        private async Task<long?> GetOrganizationIdAsync(long userId)
        {
            // First try to get from context
            var orgId = GetOrganizationIdFromContext();
            if (orgId.HasValue)
            {
                return orgId;
            }

            // Fallback: get from user's CurrentOrganizationId
            try
            {
                var user = await _userRepository.GetUser(userId);
                if (user != null && user.CurrentOrganizationId.HasValue)
                {
                    return user.CurrentOrganizationId;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to get organization ID from user {UserId}", userId);
            }

            return null;
        }

        public async Task<ServiceResponse<LoadConversationDto>> AddConversation(AddConversationDto conversation, long landlordId)
        {
            try
            {
                // Always get organization ID - required for conversations
                var organizationId = await GetOrganizationIdAsync(landlordId);
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadConversationDto>.CreateError(
                        "Organization ID is required", 
                        "Unable to determine organization context. Please ensure you are associated with an organization.",
                        "", 
                        400
                    );
                }
                
                var result = await _conversationRepository.AddConversation(conversation, landlordId, organizationId);
                return ServiceResponse<LoadConversationDto>.CreateSuccess(result, "Conversation created successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding conversation");
                return ServiceResponse<LoadConversationDto>.CreateError("Error creating conversation", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<LoadConversationDto>> GetConversationById(long conversationId, long userId)
        {
            try
            {
                var result = await _conversationRepository.GetConversationById(conversationId, userId);
                if (result == null)
                    return ServiceResponse<LoadConversationDto>.CreateError("Conversation not found", $"No conversation found with ID {conversationId}", statusCode: 404);

                // Verify user has access: either they're the landlord or the tenant
                if (result.LandlordId != userId && result.TenantId.HasValue)
                {
                    // Check if user is the tenant (need to check via tenant's UserId)
                    // This will be handled by checking if the conversation was returned (tenant access is checked in repository)
                    // For now, we'll allow access if the conversation was found
                }

                return ServiceResponse<LoadConversationDto>.CreateSuccess(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving conversation {ConversationId}", conversationId);
                return ServiceResponse<LoadConversationDto>.CreateError("Error retrieving conversation", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadConversationDto>>> GetConversationsByLandlordId(long landlordId, bool includeArchived = false)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<List<LoadConversationDto>>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                var membership = await _organizationMemberRepository.GetMemberAsync(organizationId.Value, landlordId);
                if (membership is null || !membership.IsActive)
                    return ServiceResponse<List<LoadConversationDto>>.CreateError(
                        "Conversations not found", "No active organization access was found", "", 404);

                var result = await _conversationRepository.GetConversationsByOrganizationId(organizationId.Value, includeArchived, landlordId);
                return ServiceResponse<List<LoadConversationDto>>.CreateSuccess(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving conversations for landlord {LandlordId}", landlordId);
                return ServiceResponse<List<LoadConversationDto>>.CreateError("Error retrieving conversations", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadConversationDto>>> GetConversationsByParticipantUserId(long userId, bool includeArchived = false)
        {
            try
            {
                var result = await _conversationRepository.GetConversationsByParticipantUserId(userId, includeArchived);
                return ServiceResponse<List<LoadConversationDto>>.CreateSuccess(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving conversations for participant user {UserId}", userId);
                return ServiceResponse<List<LoadConversationDto>>.CreateError("Error retrieving conversations", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<LoadConversationDto>> UpdateConversation(long conversationId, AddConversationDto conversation, long actorUserId)
        {
            try
            {
                var result = await _conversationRepository.UpdateConversation(conversationId, conversation, actorUserId);
                return ServiceResponse<LoadConversationDto>.CreateSuccess(result, "Conversation updated successfully");
            }
            catch (KeyNotFoundException)
            {
                return ServiceResponse<LoadConversationDto>.CreateError("Conversation not found", $"No conversation found with ID {conversationId}", statusCode: 404);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating conversation {ConversationId}", conversationId);
                return ServiceResponse<LoadConversationDto>.CreateError("Error updating conversation", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<bool>> DeleteConversation(long conversationId, long actorUserId)
        {
            try
            {
                var result = await _conversationRepository.DeleteConversation(conversationId, actorUserId);
                return ServiceResponse<bool>.CreateSuccess(result, "Conversation deleted successfully");
            }
            catch (KeyNotFoundException)
            {
                return ServiceResponse<bool>.CreateError("Conversation not found", $"No conversation found with ID {conversationId}", statusCode: 404);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting conversation {ConversationId}", conversationId);
                return ServiceResponse<bool>.CreateError("Error deleting conversation", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<LoadConversationDto>> ArchiveConversation(long conversationId, bool archive, long actorUserId)
        {
            try
            {
                var result = await _conversationRepository.ArchiveConversation(conversationId, archive, actorUserId);
                return ServiceResponse<LoadConversationDto>.CreateSuccess(result, archive ? "Conversation archived" : "Conversation unarchived");
            }
            catch (KeyNotFoundException)
            {
                return ServiceResponse<LoadConversationDto>.CreateError("Conversation not found", $"No conversation found with ID {conversationId}", statusCode: 404);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error archiving conversation {ConversationId}", conversationId);
                return ServiceResponse<LoadConversationDto>.CreateError("Error archiving conversation", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<LoadConversationDto>> PinConversation(long conversationId, bool pin, long actorUserId)
        {
            try
            {
                var result = await _conversationRepository.PinConversation(conversationId, pin, actorUserId);
                return ServiceResponse<LoadConversationDto>.CreateSuccess(result, pin ? "Conversation pinned" : "Conversation unpinned");
            }
            catch (KeyNotFoundException)
            {
                return ServiceResponse<LoadConversationDto>.CreateError("Conversation not found", $"No conversation found with ID {conversationId}", statusCode: 404);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error pinning conversation {ConversationId}", conversationId);
                return ServiceResponse<LoadConversationDto>.CreateError("Error pinning conversation", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<LoadConversationDto>> GetOrCreateTenantLandlordConversation(long tenantUserId)
        {
            try
            {
                var result = await _conversationRepository.GetOrCreateTenantLandlordConversation(tenantUserId);
                return ServiceResponse<LoadConversationDto>.CreateSuccess(result);
            }
            catch (Exception ex)
            {
                // If tenant not found, this is expected for tenants who registered without an invite token
                // They don't have a Tenant record until they're associated with a lease/property
                if (ex.Message.Contains("Tenant not found"))
                {
                    _logger.LogInformation("Tenant user {TenantUserId} has no Tenant record yet - they may have registered without an invite token. Conversation will be created when they're associated with a lease.", tenantUserId);
                    return ServiceResponse<LoadConversationDto>.CreateError(
                        "Tenant record not found", 
                        "You need to be associated with a lease before you can message your landlord. Please contact your landlord to add you to a property.", 
                        "", 
                        404
                    );
                }
                
                _logger.LogError(ex, "Error getting or creating tenant-landlord conversation for tenant user {TenantUserId}", tenantUserId);
                return ServiceResponse<LoadConversationDto>.CreateError("Error getting or creating conversation", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadConversationDto>>> GetTenantConversations(long tenantUserId, bool includeArchived = false)
        {
            try
            {
                var result = await _conversationRepository.GetConversationsByTenantUserId(tenantUserId, includeArchived);
                return ServiceResponse<List<LoadConversationDto>>.CreateSuccess(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving conversations for tenant user {TenantUserId}", tenantUserId);
                return ServiceResponse<List<LoadConversationDto>>.CreateError("Error retrieving conversations", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadConversationDto>> StartTenantConversation(long tenantUserId, long landlordUserId)
        {
            try
            {
                var result = await _conversationRepository.GetOrCreateConversationForTenantLandlord(tenantUserId, landlordUserId);
                return ServiceResponse<LoadConversationDto>.CreateSuccess(result);
            }
            catch (Exception ex)
            {
                if (ex.Message.Contains("Tenant not found"))
                    return ServiceResponse<LoadConversationDto>.CreateError("Tenant record not found",
                        "You need to be associated with a lease before you can message a landlord.", "", 404);

                _logger.LogError(ex, "Error starting conversation for tenant {TenantUserId} with landlord {LandlordUserId}", tenantUserId, landlordUserId);
                return ServiceResponse<LoadConversationDto>.CreateError("Error starting conversation", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<TenantAvailableLandlordDto>>> GetAvailableLandlordsForTenant(long tenantUserId)
        {
            try
            {
                var result = await _conversationRepository.GetAvailableLandlordsForTenant(tenantUserId);
                return ServiceResponse<List<TenantAvailableLandlordDto>>.CreateSuccess(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving available landlords for tenant {TenantUserId}", tenantUserId);
                return ServiceResponse<List<TenantAvailableLandlordDto>>.CreateError("Error retrieving landlords", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadConversationDto>>> GetUrgentConversations(long landlordId)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    // Try to get from user as fallback
                    organizationId = await GetOrganizationIdAsync(landlordId);
                }
                
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<List<LoadConversationDto>>.CreateError(
                        "Organization ID is required", 
                        "No organization context found",
                        "", 
                        400
                    );
                }

                var allConversations = await _conversationRepository.GetConversationsByOrganizationId(organizationId.Value, includeArchived: false);
                
                // Get active suppressions to filter out permanently suppressed conversations
                var activeSuppressions = _actionSuppressionService != null 
                    ? await _actionSuppressionService.GetActiveSuppressionsByOrganization(organizationId.Value)
                    : new List<Dtos.ActionSuppression.LoadActionSuppressionDto>();
                
                var suppressedConversationIds = activeSuppressions
                    .Where(s => s.ActionType == "urgentConversation")
                    .Select(s => s.EntityId)
                    .ToHashSet();
                
                var urgentConversations = allConversations
                    .Where(c => c.HasUrgentItems && !suppressedConversationIds.Contains(c.Id))
                    .OrderByDescending(c => c.UrgentItemsDetectedAt ?? c.LastMessageAt ?? c.CreatedAt)
                    .ToList();
                
                return ServiceResponse<List<LoadConversationDto>>.CreateSuccess(urgentConversations);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting urgent conversations for landlord {LandlordId}", landlordId);
                return ServiceResponse<List<LoadConversationDto>>.CreateError("Error getting urgent conversations", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<LoadConversationDto>> UpdateConversationAnalysisAsync(long conversationId, string? summary, bool hasUrgentItems, string? urgentItemsJson)
        {
            try
            {
                var result = await _conversationRepository.UpdateConversationAnalysisAsync(conversationId, summary, hasUrgentItems, urgentItemsJson);
                if (result == null)
                {
                    return ServiceResponse<LoadConversationDto>.CreateError("Conversation not found", $"No conversation found with ID {conversationId}", statusCode: 404);
                }
                return ServiceResponse<LoadConversationDto>.CreateSuccess(result, "Analysis updated successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating conversation analysis for conversation {ConversationId}", conversationId);
                return ServiceResponse<LoadConversationDto>.CreateError("Error updating analysis", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<LoadConversationDto>> ClearSpecificUrgentItemAsync(long conversationId, string urgentItemId, long? messageId = null)
        {
            try
            {
                var result = await _conversationRepository.ClearSpecificUrgentItemAsync(conversationId, urgentItemId, messageId);
                if (result == null)
                {
                    return ServiceResponse<LoadConversationDto>.CreateError("Conversation not found", $"No conversation found with ID {conversationId}", statusCode: 404);
                }
                return ServiceResponse<LoadConversationDto>.CreateSuccess(result, "Urgent item cleared successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error clearing specific urgent item {UrgentItemId} for conversation {ConversationId}", urgentItemId, conversationId);
                return ServiceResponse<LoadConversationDto>.CreateError("Error clearing urgent item", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<List<UrgentMessageDetailDto>>> GetAllUrgentMessageDetailsAsync(long organizationId)
        {
            try
            {
                var details = await _conversationRepository.GetAllUrgentMessageDetailsAsync(organizationId);
                return ServiceResponse<List<UrgentMessageDetailDto>>.CreateSuccess(details);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all urgent message details for organization {OrganizationId}", organizationId);
                return ServiceResponse<List<UrgentMessageDetailDto>>.CreateError("Error getting urgent message details", ex.Message);
            }
        }

        public async Task<ServiceResponse<MessageAnalysisResult>> AnalyzeAndUpdateConversationAsync(long conversationId, long userId)
        {
            try
            {
                // Verify message analysis service is available
                if (_messageAnalysisService == null)
                {
                    return ServiceResponse<MessageAnalysisResult>.CreateError(
                        "Message analysis service is not available",
                        "Message analysis service is not configured.",
                        "",
                        400
                    );
                }

                // Verify user has access to this conversation
                var conversationResponse = await GetConversationById(conversationId, userId);
                if (!conversationResponse.Success)
                {
                    return ServiceResponse<MessageAnalysisResult>.CreateError(
                        conversationResponse.Message,
                        conversationResponse.Errors?.Message ?? "Unable to access conversation",
                        "",
                        conversationResponse.StatusCode
                    );
                }

                // Analyze the conversation
                var analysisResponse = await _messageAnalysisService.AnalyzeConversationAsync(conversationId);
                
                if (!analysisResponse.Success)
                {
                    return analysisResponse;
                }

                // Update conversation with analysis results if we have data
                if (analysisResponse.Data != null)
                {
                    // Serialize urgent items to JSON
                    var urgentItemsJson = analysisResponse.Data.UrgentItems != null && analysisResponse.Data.UrgentItems.Any()
                        ? JsonSerializer.Serialize(analysisResponse.Data.UrgentItems)
                        : null;

                    var updateResponse = await UpdateConversationAnalysisAsync(
                        conversationId,
                        analysisResponse.Data.Summary,
                        analysisResponse.Data.HasUrgentItems,
                        urgentItemsJson
                    );

                    if (!updateResponse.Success)
                    {
                        _logger.LogWarning("Failed to update conversation analysis: {Error}", updateResponse.Message);
                        // Still return the analysis result even if update fails
                    }
                }

                return analysisResponse;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error analyzing and updating conversation {ConversationId}", conversationId);
                return ServiceResponse<MessageAnalysisResult>.CreateError("Error analyzing conversation", ex.Message, ex.InnerException?.Message);
            }
        }
    }
}

