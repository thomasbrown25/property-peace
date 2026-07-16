using brownstone_hub_api.Dtos.Conversation;
using brownstone_hub_api.Dtos.ActionSuppression;
using brownstone_hub_api.Services.ConversationService;
using brownstone_hub_api.Services.MessageAnalysisService;
using brownstone_hub_api.Services.UserService;
using brownstone_hub_api.Services.ActionSuppressionService;
using brownstone_hub_api.Repositories.Messages;
using brownstone_hub_api.Helpers;
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
        ILogger<ConversationController> logger) : ControllerBase
    {
        private readonly IConversationService _conversationService = conversationService;
        private readonly IUserService _userService = userService;
        private readonly IMessageAnalysisService? _messageAnalysisService = messageAnalysisService;
        private readonly IActionSuppressionService _actionSuppressionService = actionSuppressionService;
        private readonly IMessageRepository _messageRepository = messageRepository;
        private readonly ILogger<ConversationController> _logger = logger;

        private async Task<long> GetLandlordIdAsync()
        {
            // Try to get user ID directly from claims first
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!string.IsNullOrEmpty(userIdClaim) && long.TryParse(userIdClaim, out var userId))
            {
                return userId;
            }

            // If user ID not in claims, get email from "sub" claim (JWT standard)
            var email = User.FindFirst("sub")?.Value;
            if (string.IsNullOrEmpty(email))
            {
                // Fallback to NameIdentifier (might be email in some cases)
                email = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
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
        [HttpPut("{conversationId}")]
        public async Task<IActionResult> UpdateConversation(long conversationId, [FromBody] AddConversationDto conversation)
        {
            var response = await _conversationService.UpdateConversation(conversationId, conversation);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpDelete("{conversationId}")]
        public async Task<IActionResult> DeleteConversation(long conversationId)
        {
            var response = await _conversationService.DeleteConversation(conversationId);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpPost("{conversationId}/archive")]
        public async Task<IActionResult> ArchiveConversation(long conversationId, [FromBody] bool archive)
        {
            var response = await _conversationService.ArchiveConversation(conversationId, archive);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpPost("{conversationId}/pin")]
        public async Task<IActionResult> PinConversation(long conversationId, [FromBody] bool pin)
        {
            var response = await _conversationService.PinConversation(conversationId, pin);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
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
                    
                    // Set IsUrgent = false on the message
                    try
                    {
                        await _messageRepository.SetMessageUrgent(messageId.Value, false);
                        _logger.LogInformation("Set message {MessageId} IsUrgent to false", messageId.Value);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to set message {MessageId} IsUrgent to false", messageId.Value);
                    }
                    
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
                // Clear all urgent items (original behavior)
                // Set IsUrgent = false on all messages in the conversation
                try
                {
                    var messages = await _messageRepository.GetMessagesByConversationId(conversationId, userId, 0, 1000);
                    foreach (var message in messages.Where(m => m.IsUrgent))
                    {
                        await _messageRepository.SetMessageUrgent(message.Id, false);
                    }
                    _logger.LogInformation("Set all urgent messages in conversation {ConversationId} to not urgent", conversationId);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to set messages to not urgent for conversation {ConversationId}", conversationId);
                }
                
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
    }

    public class ClearUrgentItemRequest
    {
        public string? UrgentItemId { get; set; }
        public long? MessageId { get; set; }
    }
}

