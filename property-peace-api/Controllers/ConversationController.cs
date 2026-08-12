using brownstone_hub_api.Dtos.Conversation;
using brownstone_hub_api.Dtos.Timeline;
using brownstone_hub_api.Dtos.ActionSuppression;
using brownstone_hub_api.Services.ConversationService;
using brownstone_hub_api.Services.MessageAnalysisService;
using brownstone_hub_api.Services.UserService;
using brownstone_hub_api.Services.ActionSuppressionService;
using brownstone_hub_api.Repositories.Messages;
using brownstone_hub_api.Repositories.Timelines;
using brownstone_hub_api.Services.Timelines;
using brownstone_hub_api.Helpers;
using brownstone_hub_api.Attributes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text.Json;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Tenant,Landlord,Admin")]
    public class ConversationController(
        IConversationService conversationService,
        IUserService userService,
        IMessageAnalysisService? messageAnalysisService,
        IActionSuppressionService actionSuppressionService,
        IMessageRepository messageRepository,
        IMilestone7ConversationService milestone7Service,
        ILogger<ConversationController> logger) : ControllerBase
    {
        private readonly IConversationService _conversationService = conversationService;
        private readonly IUserService _userService = userService;
        private readonly IMessageAnalysisService? _messageAnalysisService = messageAnalysisService;
        private readonly IActionSuppressionService _actionSuppressionService = actionSuppressionService;
        private readonly IMessageRepository _messageRepository = messageRepository;
        private readonly IMilestone7ConversationService _milestone7Service = milestone7Service;
        private readonly ILogger<ConversationController> _logger = logger;

        private async Task<long> GetLandlordIdAsync()
        {
            // Try to get user ID directly from claims first
            var nameIdentifier = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var userIdClaim = User.FindFirst("userId")?.Value;
            if (long.TryParse(nameIdentifier, out var userId) && userId > 0) return userId;
            if (long.TryParse(userIdClaim, out userId) && userId > 0) return userId;

            // Numeric actor resolution is consistent with SignalR: NameIdentifier, userId, then sub.
            var subject = User.FindFirst("sub")?.Value;
            if (long.TryParse(subject, out userId) && userId > 0) return userId;
            var email = subject;
            if (string.IsNullOrEmpty(email))
            {
                // Fallback to NameIdentifier (might be email in some cases)
                email = nameIdentifier;
            }
            if (string.IsNullOrEmpty(email))
            {
                email = User.FindFirst(ClaimTypes.Name)?.Value;
            }

            if (!string.IsNullOrEmpty(email))
            {
                try
                {
                    var userResponse = await _userService.GetUserByEmailAsync(email);
                    return userResponse.Success && userResponse.Data != null ? userResponse.Data.Id : 0;
                }
                catch (Exception)
                {
                    return 0;
                }
            }

            return 0;
        }

        [Authorize(Roles = "Landlord,Admin")]
        [RequireOrganizationRole("Owner", "Manager")]
        [HttpPost]
        public async Task<IActionResult> AddConversation([FromBody] AddConversationDto conversation)
        {
            var landlordId = await GetLandlordIdAsync();
            if (landlordId == 0)
                return Unauthorized();

            var response = await _conversationService.AddConversation(conversation, landlordId);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        // Tenant-specific: must be declared before [HttpGet("{conversationId}")] so "tenant/my-conversation" matches literally
        [Authorize(Roles = "Tenant,Admin")]
        [HttpGet("tenant/my-conversation")]
        public async Task<IActionResult> GetTenantConversation()
        {
            var userId = await GetLandlordIdAsync();
            if (userId == 0)
                return Unauthorized();

            var response = await _conversationService.GetOrCreateTenantLandlordConversation(userId);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [Authorize(Roles = "Tenant,Admin")]
        [HttpGet("tenant/my-conversations")]
        public async Task<IActionResult> GetTenantConversations([FromQuery] bool includeArchived = false)
        {
            var userId = await GetLandlordIdAsync();
            if (userId == 0)
                return Unauthorized();

            var response = await _conversationService.GetTenantConversations(userId, includeArchived);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [Authorize(Roles = "Tenant,Admin")]
        [HttpGet("tenant/available-landlords")]
        public async Task<IActionResult> GetAvailableLandlordsForTenant()
        {
            var userId = await GetLandlordIdAsync();
            if (userId == 0)
                return Unauthorized();

            var response = await _conversationService.GetAvailableLandlordsForTenant(userId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [Authorize(Roles = "Tenant,Admin")]
        [HttpPost("tenant/start")]
        public async Task<IActionResult> StartTenantConversation([FromBody] StartTenantConversationDto dto)
        {
            var userId = await GetLandlordIdAsync();
            if (userId == 0)
                return Unauthorized();

            var response = await _conversationService.StartTenantConversation(userId, dto.LandlordUserId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [RequireOrganizationRole("Owner", "Manager", "Viewer")]
        [HttpGet("{conversationId}")]
        public async Task<IActionResult> GetConversation(long conversationId)
        {
            var userId = await GetLandlordIdAsync();
            if (userId == 0)
                return Unauthorized();

            var response = await _conversationService.GetConversationById(conversationId, userId);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [RequireOrganizationRole("Owner", "Manager", "Viewer")]
        [HttpGet]
        public async Task<IActionResult> GetConversations([FromQuery] bool includeArchived = false)
        {
            var landlordId = await GetLandlordIdAsync();
            if (landlordId == 0)
                return Unauthorized();

            var response = await _conversationService.GetConversationsByLandlordId(landlordId, includeArchived);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [Authorize(Roles = "Admin")]
        [RequireOrganizationRole("Owner", "Manager", "Viewer")]
        [HttpGet("admin/conversations")]
        public async Task<IActionResult> GetAdminConversations([FromQuery] bool includeArchived = false)
        {
            var userId = await GetLandlordIdAsync(); // GetLandlordIdAsync works for admin too
            if (userId == 0)
                return Unauthorized();

            var response = await _conversationService.GetConversationsByParticipantUserId(userId, includeArchived);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [RequireOrganizationRole("Owner", "Manager")]
        [HttpPut("{conversationId}")]
        public async Task<IActionResult> UpdateConversation(long conversationId, [FromBody] AddConversationDto conversation)
        {
            var actorUserId = await GetLandlordIdAsync();
            if (actorUserId == 0) return Unauthorized();
            var response = await _conversationService.UpdateConversation(conversationId, conversation, actorUserId);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [RequireOrganizationRole("Owner", "Manager")]
        [HttpDelete("{conversationId}")]
        public async Task<IActionResult> DeleteConversation(long conversationId)
        {
            var actorUserId = await GetLandlordIdAsync();
            if (actorUserId == 0) return Unauthorized();
            var response = await _conversationService.DeleteConversation(conversationId, actorUserId);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [RequireOrganizationRole("Owner", "Manager")]
        [HttpPost("{conversationId}/archive")]
        public async Task<IActionResult> ArchiveConversation(long conversationId, [FromBody] bool archive)
        {
            var actorUserId = await GetLandlordIdAsync();
            if (actorUserId == 0) return Unauthorized();
            var response = await _conversationService.ArchiveConversation(conversationId, archive, actorUserId);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [RequireOrganizationRole("Owner", "Manager")]
        [HttpPost("{conversationId}/pin")]
        public async Task<IActionResult> PinConversation(long conversationId, [FromBody] bool pin)
        {
            var actorUserId = await GetLandlordIdAsync();
            if (actorUserId == 0) return Unauthorized();
            var response = await _conversationService.PinConversation(conversationId, pin, actorUserId);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [RequireOrganizationRole("Owner", "Manager", "Viewer")]
        [HttpGet("{conversationId}/summary")]
        public async Task<IActionResult> GetConversationSummary(long conversationId)
        {
            var userId = await GetLandlordIdAsync();
            if (userId == 0)
                return Unauthorized();

            var response = await _conversationService.GetConversationById(conversationId, userId);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            var summary = new
            {
                summary = response.Data?.AiSummary,
                summaryUpdatedAt = response.Data?.AiSummaryUpdatedAt,
                hasUrgentItems = response.Data?.HasUrgentItems ?? false,
                urgentItems = response.Data?.UrgentItemsJson != null
                    ? JsonSerializer.Deserialize<List<object>>(response.Data.UrgentItemsJson)
                    : null,
                urgentItemsDetectedAt = response.Data?.UrgentItemsDetectedAt
            };

            return Ok(new { success = true, data = summary });
        }

        [Authorize(Roles = "Landlord,Admin")]
        [RequireOrganizationRole("Owner", "Manager", "Viewer")]
        [HttpGet("urgent")]
        public async Task<IActionResult> GetUrgentConversations()
        {
            var landlordId = await GetLandlordIdAsync();
            if (landlordId == 0)
                return Unauthorized();

            var response = await _conversationService.GetUrgentConversations(landlordId);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [RequireOrganizationRole("Owner", "Manager")]
        [HttpPost("{conversationId}/analyze")]
        public async Task<IActionResult> AnalyzeConversation(long conversationId)
        {
            var userId = await GetLandlordIdAsync();
            if (userId == 0)
                return Unauthorized();

            var response = await _conversationService.AnalyzeAndUpdateConversationAsync(conversationId, userId);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [RequireOrganizationRole("Owner", "Manager")]
        [HttpPost("{conversationId}/clear-urgent")]
        public async Task<IActionResult> ClearUrgentItems(long conversationId, [FromBody] ClearUrgentItemRequest? request = null)
        {
            _logger.LogInformation("ClearUrgentItems endpoint called - ConversationId: {ConversationId}, Request: {Request}", 
                conversationId, request != null ? $"UrgentItemId: {request.UrgentItemId}, MessageId: {request.MessageId}" : "null");
            
            var userId = await GetLandlordIdAsync();
            if (userId == 0)
                return Unauthorized();

            // Verify user has access to this conversation
            var conversationResponse = await _conversationService.GetConversationById(conversationId, userId);
            if (!conversationResponse.Success)
            {
                return StatusCode(conversationResponse.StatusCode, new { conversationResponse.Message, conversationResponse.Errors });
            }

            // Get organization ID from context
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
            {
                return StatusCode(403, new { message = "Organization context is required" });
            }

            // If urgentItemId is provided, clear only that specific item
            // Otherwise, clear all urgent items (backward compatibility)
            var urgentItemId = request?.UrgentItemId;
            var messageId = request?.MessageId;
            
            _logger.LogInformation("ClearUrgentItems called - ConversationId: {ConversationId}, UrgentItemId: {UrgentItemId}, MessageId: {MessageId}, OrganizationId: {OrganizationId}, UserId: {UserId}", 
                conversationId, urgentItemId ?? "(null)", messageId?.ToString() ?? "(null)", organizationId?.ToString() ?? "(null)", userId);

            // If we have a messageId, we can clear by matching message content even if urgentItemId is empty
            if (!string.IsNullOrEmpty(urgentItemId) || messageId.HasValue)
            {
                // Reject a message ID unless it belongs to this authorized conversation and organization
                // before mutating conversation analysis or creating suppression evidence.
                if (messageId.HasValue && !await _messageRepository.SetMessageUrgent(
                        messageId.Value, false, conversationId, organizationId.Value, userId))
                {
                    return NotFound(new { message = "Message not found" });
                }

                // Clear only the specific urgent item
                _logger.LogInformation("Clearing urgent item {UrgentItemId} for conversation {ConversationId}, message {MessageId}",
                    urgentItemId, conversationId, request?.MessageId);
                
                var updateResponse = await _conversationService.ClearSpecificUrgentItemAsync(conversationId, urgentItemId, request?.MessageId);
                if (!updateResponse.Success)
                {
                    _logger.LogWarning("Failed to clear urgent item: {Message}", updateResponse.Message);
                    return StatusCode(updateResponse.StatusCode, new { updateResponse.Message, updateResponse.Errors });
                }

                // Create a permanent suppression for this specific urgent message
                // Use messageId if provided, otherwise use conversationId as EntityId (suppress all urgent items in conversation)
                if (messageId.HasValue)
                {
                    _logger.LogInformation("Creating suppression for message {MessageId} in conversation {ConversationId}, organization {OrganizationId}, user {UserId}", 
                        messageId.Value, conversationId, organizationId.Value, userId);
                    
                    _logger.LogInformation("Message {MessageId} urgency was cleared within authorized scope", messageId.Value);

                    var suppressionDto = new AddActionSuppressionDto
                    {
                        ActionType = "urgentMessage",
                        EntityId = messageId.Value,
                        SuppressedUntil = null, // Null means permanently suppressed
                        Reason = "Urgency manually cleared by user for specific message"
                    };

                    try
                    {
                        var suppressionResult = await _actionSuppressionService.CreateSuppression(suppressionDto, organizationId.Value, userId);
                        if (suppressionResult != null && suppressionResult.Id > 0)
                        {
                            _logger.LogInformation("Successfully created suppression {SuppressionId} for message {MessageId} in conversation {ConversationId}", 
                                suppressionResult.Id, messageId.Value, conversationId);
                        }
                        else
                        {
                            _logger.LogError("Suppression creation returned null or invalid ID (Id={Id}). Result: {Result}", 
                                suppressionResult?.Id ?? 0, suppressionResult);
                        }
                    }
                    catch (Exception ex)
                    {
                        // Log the full exception with inner exception details
                        _logger.LogError(ex, "Failed to create suppression for urgent message {MessageId} in conversation {ConversationId}. " +
                            "ActionType: {ActionType}, EntityId: {EntityId}, OrganizationId: {OrganizationId}, CreatedBy: {CreatedBy}. " +
                            "Exception: {ExceptionType}, Message: {ExceptionMessage}, StackTrace: {StackTrace}",
                            messageId.Value, conversationId, 
                            suppressionDto.ActionType, suppressionDto.EntityId, organizationId.Value, userId,
                            ex.GetType().Name, ex.Message, ex.StackTrace);
                        
                        if (ex.InnerException != null)
                        {
                            _logger.LogError("Inner exception: {InnerExceptionType}, Message: {InnerExceptionMessage}", 
                                ex.InnerException.GetType().Name, ex.InnerException.Message);
                        }
                        
                        // Don't re-throw - allow urgent item clearing to succeed even if suppression fails
                        // This way the user can still clear urgency, and we can investigate the suppression issue separately
                    }
                }
                else
                {
                    _logger.LogWarning("MessageId is not provided, skipping suppression creation. UrgentItemId: {UrgentItemId}, ConversationId: {ConversationId}", 
                        urgentItemId, conversationId);
                }

                return Ok(updateResponse);
            }
            else
            {
                // Clear only within the actor's authorized conversation and request organization.
                if (!await _messageRepository.SetConversationUrgent(
                        conversationId, false, organizationId.Value, userId))
                {
                    return NotFound(new { message = "Conversation not found" });
                }
                _logger.LogInformation("Set all urgent messages in conversation {ConversationId} to not urgent", conversationId);

                // Create a permanent suppression (null SuppressedUntil) for this conversation's urgent messages
                var suppressionDto = new AddActionSuppressionDto
                {
                    ActionType = "urgentConversation",
                    EntityId = conversationId,
                    SuppressedUntil = null, // Null means permanently suppressed
                    Reason = "Urgency manually cleared by user"
                };

                try
                {
                    await _actionSuppressionService.CreateSuppression(suppressionDto, organizationId.Value, userId);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to create suppression for conversation {ConversationId}", conversationId);
                    // Continue even if suppression creation fails
                }

                // Clear urgent items by setting hasUrgentItems to false and urgentItemsJson to null
                // Keep the existing summary
                var updateResponse = await _conversationService.UpdateConversationAnalysisAsync(
                    conversationId,
                    conversationResponse.Data?.AiSummary, // Keep existing summary
                    false, // Clear urgent items flag
                    null // Clear urgent items JSON
                );

                if (!updateResponse.Success)
                    return StatusCode(updateResponse.StatusCode, new { updateResponse.Message, updateResponse.Errors });

                return Ok(updateResponse);
            }
        }

        [Authorize(Roles = "Landlord,Admin")]
        [RequireOrganizationRole("Owner", "Manager", "Viewer")]
        [HttpGet("suppressed-messages")]
        public async Task<IActionResult> GetSuppressedMessageIds()
        {
            var userId = await GetLandlordIdAsync();
            if (userId == 0)
                return Unauthorized();

            // Get organization ID from context
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
            {
                return StatusCode(403, new { message = "Organization context is required" });
            }

            try
            {
                // Get active suppressions for urgent messages
                var activeSuppressions = await _actionSuppressionService.GetActiveSuppressionsByOrganization(organizationId.Value);
                
                // Filter to only urgent message suppressions and extract message IDs
                var suppressedMessageIds = activeSuppressions
                    .Where(s => s.ActionType == "urgentMessage")
                    .Select(s => s.EntityId)
                    .ToList();

                return Ok(new { suppressedMessageIds });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting suppressed message IDs for organization {OrganizationId}", organizationId.Value);
                return StatusCode(500, new { message = "Error getting suppressed message IDs", error = ex.Message });
            }
        }

        [Authorize(Roles = "Landlord,Admin")]
        [RequireOrganizationRole("Owner", "Manager", "Viewer")]
        [HttpGet("urgent-messages/all")]
        public async Task<IActionResult> GetAllUrgentMessageDetails()
        {
            var userId = await GetLandlordIdAsync();
            if (userId == 0)
                return Unauthorized();

            // Get organization ID from context
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
            {
                return StatusCode(403, new { message = "Organization context is required" });
            }

            try
            {
                var response = await _conversationService.GetAllUrgentMessageDetailsAsync(organizationId.Value);
                
                if (!response.Success)
                    return StatusCode(response.StatusCode, new { response.Message, response.Errors });

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all urgent message details for organization {OrganizationId}", organizationId.Value);
                return StatusCode(500, new { message = "Error getting urgent message details", error = ex.Message });
            }
        }
        [HttpGet("{conversationId:long}/timeline")]
        public async Task<IActionResult> GetTimeline(long conversationId, [FromQuery] long? afterSequence = null, [FromQuery] int take = 50) =>
            await M7Scoped(async (userId, organizationId) => await _milestone7Service.ReadTimelineAsync(conversationId, userId, organizationId, afterSequence, take));

        [HttpGet("timeline/search")]
        public async Task<IActionResult> SearchTimeline([FromQuery] TimelineSearchRequest request) =>
            await M7Scoped(async (userId, organizationId) => await _milestone7Service.SearchAsync(userId, organizationId, request));

        [HttpGet("{conversationId:long}/unread")]
        public async Task<IActionResult> GetUnread(long conversationId) =>
            await M7Scoped(async (userId, organizationId) => await _milestone7Service.GetUnreadAsync(conversationId, userId, organizationId));

        [HttpPost("{conversationId:long}/read")]
        public async Task<IActionResult> MarkRead(long conversationId, [FromBody] MarkTimelineReadRequest request) =>
            await M7Scoped(async (userId, organizationId) => await _milestone7Service.MarkReadAsync(conversationId, userId, organizationId, request.ThroughSequence));

        [HttpGet("quick-replies")]
        public async Task<IActionResult> ListQuickReplies([FromQuery] long organizationId, [FromQuery] string? contextKind = null) =>
            await M7Scoped(async (userId, activeOrganizationId) => await _milestone7Service.ListQuickRepliesAsync(userId, activeOrganizationId, contextKind));

        [HttpPost("quick-replies")]
        public async Task<IActionResult> CreateQuickReply([FromBody] SaveQuickReplyRequest request) =>
            await M7Scoped(async (userId, organizationId) => await _milestone7Service.CreateQuickReplyAsync(userId, organizationId, request));

        [HttpPut("quick-replies/{id:long}")]
        public async Task<IActionResult> UpdateQuickReply(long id, [FromBody] SaveQuickReplyRequest request) =>
            await M7Scoped(async (userId, organizationId) => await _milestone7Service.UpdateQuickReplyAsync(userId, organizationId, id, request));

        [HttpDelete("quick-replies/{id:long}")]
        public async Task<IActionResult> DeleteQuickReply(long id) => await M7Scoped(async (userId, organizationId) =>
        {
            await _milestone7Service.DeleteQuickReplyAsync(userId, organizationId, id);
            return new { deleted = true };
        });

        [Authorize(Roles = "Landlord,Admin")]
        [RequireOrganizationRole("Owner", "Manager", "Viewer")]
        [HttpGet("groups/participants")]
        public async Task<IActionResult> DiscoverGroupParticipants([FromQuery] long organizationId) =>
            await M7Scoped(async (userId, activeOrganizationId) => await _milestone7Service.DiscoverParticipantsAsync(userId, activeOrganizationId));

        [Authorize(Roles = "Landlord,Admin")]
        [RequireOrganizationRole("Owner", "Manager")]
        [HttpPost("groups")]
        public async Task<IActionResult> CreateGroup([FromBody] CreateGroupRequest request) =>
            await M7Scoped(async (userId, organizationId) => await _milestone7Service.CreateGroupAsync(userId, organizationId, request));

        [Authorize(Roles = "Landlord,Admin")]
        [RequireOrganizationRole("Owner", "Manager")]
        [HttpPost("groups/{conversationId:long}/participants/{participantUserId:long}")]
        public async Task<IActionResult> AddGroupParticipant(long conversationId, long participantUserId) => await M7Scoped(async (userId, organizationId) =>
        {
            await _milestone7Service.AddGroupParticipantAsync(userId, organizationId, conversationId, participantUserId);
            return new { added = true };
        });

        [Authorize(Roles = "Landlord,Admin")]
        [RequireOrganizationRole("Owner", "Manager")]
        [HttpDelete("groups/{conversationId:long}/participants/{participantUserId:long}")]
        public async Task<IActionResult> RemoveGroupParticipant(long conversationId, long participantUserId) => await M7Scoped(async (userId, organizationId) =>
        {
            await _milestone7Service.RemoveGroupParticipantAsync(userId, organizationId, conversationId, participantUserId);
            return new { removed = true };
        });

        [HttpPost("groups/{conversationId:long}/leave")]
        public async Task<IActionResult> LeaveGroup(long conversationId) => await M7Scoped(async (userId, organizationId) =>
        {
            await _milestone7Service.LeaveGroupAsync(userId, organizationId, conversationId);
            return new { left = true };
        });

        [Authorize(Roles = "Landlord,Admin")]
        [RequireOrganizationRole("Owner", "Manager", "Viewer")]
        [HttpGet("follow-ups")]
        public async Task<IActionResult> ListFollowUps([FromQuery] long organizationId, [FromQuery] long? conversationId = null) =>
            await M7Scoped(async (userId, activeOrganizationId) => await _milestone7Service.ListFollowUpsAsync(userId, activeOrganizationId, conversationId));

        [Authorize(Roles = "Landlord,Admin")]
        [RequireOrganizationRole("Owner", "Manager", "Viewer")]
        [HttpGet("follow-ups/{id:long}")]
        public async Task<IActionResult> GetFollowUp(long id) =>
            await M7Scoped(async (userId, organizationId) => await _milestone7Service.GetFollowUpAsync(userId, organizationId, id));

        [Authorize(Roles = "Landlord,Admin")]
        [RequireOrganizationRole("Owner", "Manager")]
        [HttpPost("follow-ups")]
        public async Task<IActionResult> CreateFollowUp([FromBody] SaveFollowUpTaskRequest request) =>
            await M7Scoped(async (userId, organizationId) => await _milestone7Service.CreateFollowUpAsync(userId, organizationId, request));

        [Authorize(Roles = "Landlord,Admin")]
        [RequireOrganizationRole("Owner", "Manager")]
        [HttpPut("follow-ups/{id:long}")]
        public async Task<IActionResult> UpdateFollowUp(long id, [FromBody] FollowUpMutationRequest request) =>
            await M7Scoped(async (userId, organizationId) => await _milestone7Service.UpdateFollowUpAsync(userId, organizationId, id, request.Task, request.RowVersion));

        [Authorize(Roles = "Landlord,Admin")]
        [RequireOrganizationRole("Owner", "Manager")]
        [HttpPost("follow-ups/{id:long}/complete")]
        public async Task<IActionResult> CompleteFollowUp(long id, [FromBody] RowVersionRequest request) =>
            await M7Scoped(async (userId, organizationId) => await _milestone7Service.CompleteFollowUpAsync(userId, organizationId, id, request.RowVersion));

        [Authorize(Roles = "Landlord,Admin")]
        [RequireOrganizationRole("Owner", "Manager")]
        [HttpDelete("follow-ups/{id:long}")]
        public async Task<IActionResult> DeleteFollowUp(long id, [FromBody] RowVersionRequest request) => await M7Scoped(async (userId, organizationId) =>
        {
            await _milestone7Service.DeleteFollowUpAsync(userId, organizationId, id, request.RowVersion);
            return new { deleted = true };
        });

        private async Task<IActionResult> M7Scoped<T>(Func<long, long, Task<T>> action)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Organization context is required" });
            return await M7(userId => action(userId, organizationId.Value));
        }

        private async Task<IActionResult> M7<T>(Func<long, Task<T>> action)
        {
            var userId = await GetLandlordIdAsync();
            if (userId == 0) return Unauthorized();
            try { return Ok(new { success = true, data = await action(userId) }); }
            catch (KeyNotFoundException) { return NotFound(new { message = "Resource not found" }); }
            catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
            catch (Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException) { return Conflict(new { message = "Resource was changed by another request" }); }
            catch (TimelineIdempotencyConflictException ex) { return Conflict(new { message = ex.Message }); }
            catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
        }
    }

    public sealed record MarkTimelineReadRequest(long? ThroughSequence);
    public sealed record RowVersionRequest(byte[] RowVersion);
    public sealed record FollowUpMutationRequest(SaveFollowUpTaskRequest Task, byte[] RowVersion);

    public class ClearUrgentItemRequest
    {
        public string? UrgentItemId { get; set; }
        public long? MessageId { get; set; }
    }
}

