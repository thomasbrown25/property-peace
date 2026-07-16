using brownstone_hub_api.Dtos.Message;
using brownstone_hub_api.Repositories.Messages;
using brownstone_hub_api.Repositories.Conversations;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.MessageAnalysisService;
using brownstone_hub_api.Services.ActionSuppressionService;
using Microsoft.Extensions.DependencyInjection;
using System.Text.Json;

namespace brownstone_hub_api.Services.MessageService
{
    public class MessageService(
        IMessageRepository messageRepository,
        IUserRepository userRepository,
        IConversationRepository conversationRepository,
        IMessageAnalysisService? messageAnalysisService,
        IActionSuppressionService? actionSuppressionService,
        IServiceScopeFactory serviceScopeFactory,
        ILogger<MessageService> logger) : IMessageService
    {
        private readonly IMessageRepository _messageRepository = messageRepository;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly IConversationRepository _conversationRepository = conversationRepository;
        private readonly IMessageAnalysisService? _messageAnalysisService = messageAnalysisService;
        private readonly IActionSuppressionService? _actionSuppressionService = actionSuppressionService;
        private readonly IServiceScopeFactory _serviceScopeFactory = serviceScopeFactory;
        private readonly ILogger<MessageService> _logger = logger;

        private async Task<long?> GetCurrentUserIdAsync()
        {
            var user = await _userRepository.GetCurrentUser();
            return user?.Id;
        }

        public async Task<ServiceResponse<LoadMessageDto>> AddMessage(AddMessageDto message)
        {
            try
            {
                var senderId = await GetCurrentUserIdAsync();
                if (!senderId.HasValue)
                {
                    return ServiceResponse<LoadMessageDto>.CreateError("User not found", "User not authenticated", "", 401);
                }

                var result = await _messageRepository.AddMessage(message, senderId.Value);
                
                // Trigger AI analysis in background (fire-and-forget)
                // Use a new scope to avoid DbContext disposal issues
                if (_messageAnalysisService != null)
                {
                    var conversationId = message.ConversationId; // Capture for closure
                    _ = Task.Run(async () =>
                    {
                        // Create a new scope for the background task
                        using var scope = _serviceScopeFactory.CreateScope();
                        var scopedAnalysisService = scope.ServiceProvider.GetRequiredService<IMessageAnalysisService>();
                        var scopedConversationRepository = scope.ServiceProvider.GetRequiredService<IConversationRepository>();
                        var scopedMessageRepository = scope.ServiceProvider.GetRequiredService<IMessageRepository>();
                        var scopedLogger = scope.ServiceProvider.GetRequiredService<ILogger<MessageService>>();
                        
                        try
                        {
                            await Task.Delay(2000); // Small delay to ensure message is fully saved
                            var analysisResult = await scopedAnalysisService.AnalyzeConversationAsync(conversationId);
                            
                            if (analysisResult.Success && analysisResult.Data != null)
                            {
                                // Get messages to set urgency flags
                                var messages = await scopedMessageRepository.GetMessagesByConversationId(conversationId, 0, 0, 100);
                                
                                // Set IsUrgent flag on individual messages
                                await scopedAnalysisService.SetMessageUrgencyFromAnalysisAsync(
                                    conversationId,
                                    analysisResult.Data,
                                    messages
                                );
                                
                                // Update conversation with analysis results (still keep UrgentItemsJson for backward compatibility during migration)
                                var urgentItemsJson = analysisResult.Data.UrgentItems != null && analysisResult.Data.UrgentItems.Any()
                                    ? JsonSerializer.Serialize(analysisResult.Data.UrgentItems)
                                    : null;
                                
                                // Check if conversation has any urgent messages (not suppressed)
                                var hasUrgentMessages = messages.Any(m => m.IsUrgent);
                                
                                await scopedConversationRepository.UpdateConversationAnalysisAsync(
                                    conversationId,
                                    analysisResult.Data.Summary,
                                    hasUrgentMessages,
                                    urgentItemsJson
                                );
                                
                                scopedLogger.LogInformation(
                                    "AI analysis completed for conversation {ConversationId}. Summary: {Summary}, Urgent items: {UrgentCount}, HasUrgentItems: {HasUrgent}, Urgent messages: {UrgentMessageCount}",
                                    conversationId,
                                    analysisResult.Data.Summary,
                                    analysisResult.Data.UrgentItems?.Count ?? 0,
                                    hasUrgentMessages,
                                    messages.Count(m => m.IsUrgent)
                                );
                            }
                            else
                            {
                                scopedLogger.LogWarning(
                                    "AI analysis failed for conversation {ConversationId}. Success: {Success}, Message: {Message}",
                                    conversationId,
                                    analysisResult?.Success ?? false,
                                    analysisResult?.Message ?? "Unknown error"
                                );
                            }
                        }
                        catch (Exception ex)
                        {
                            // Log but don't fail - analysis is non-critical
                            scopedLogger.LogError(ex, "Background AI analysis failed for conversation {ConversationId}. Error: {Error}", 
                                conversationId, ex.Message);
                        }
                    });
                }
                
                return ServiceResponse<LoadMessageDto>.CreateSuccess(result, "Message sent successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding message");
                return ServiceResponse<LoadMessageDto>.CreateError("Error sending message", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<LoadMessageDto>> GetMessageById(long messageId)
        {
            try
            {
                var result = await _messageRepository.GetMessageById(messageId);
                if (result == null)
                    return ServiceResponse<LoadMessageDto>.CreateError("Message not found", $"No message found with ID {messageId}", statusCode: 404);

                return ServiceResponse<LoadMessageDto>.CreateSuccess(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving message {MessageId}", messageId);
                return ServiceResponse<LoadMessageDto>.CreateError("Error retrieving message", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadMessageDto>>> GetMessagesByConversationId(long conversationId, int skip = 0, int take = 50)
        {
            try
            {
                var user = await _userRepository.GetCurrentUser();
                if (user == null)
                {
                    return ServiceResponse<List<LoadMessageDto>>.CreateError("User not found", "Unable to retrieve current user", statusCode: 401);
                }

                var result = await _messageRepository.GetMessagesByConversationId(conversationId, user.Id, skip, take);
                return ServiceResponse<List<LoadMessageDto>>.CreateSuccess(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving messages for conversation {ConversationId}", conversationId);
                return ServiceResponse<List<LoadMessageDto>>.CreateError("Error retrieving messages", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<LoadMessageDto>> UpdateMessage(long messageId, string content)
        {
            try
            {
                var result = await _messageRepository.UpdateMessage(messageId, content);
                return ServiceResponse<LoadMessageDto>.CreateSuccess(result, "Message updated successfully");
            }
            catch (KeyNotFoundException)
            {
                return ServiceResponse<LoadMessageDto>.CreateError("Message not found", $"No message found with ID {messageId}", statusCode: 404);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating message {MessageId}", messageId);
                return ServiceResponse<LoadMessageDto>.CreateError("Error updating message", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<bool>> DeleteMessage(long messageId)
        {
            try
            {
                // Get message to find conversationId before deleting
                var message = await _messageRepository.GetMessageById(messageId);
                var conversationId = message?.ConversationId;

                var result = await _messageRepository.DeleteMessage(messageId);
                
                // If message deletion succeeded and we have a conversationId, delete related suppressions
                if (result && conversationId.HasValue && _actionSuppressionService != null)
                {
                    try
                    {
                        await _actionSuppressionService.DeleteSuppressionsByEntityId(conversationId.Value, "urgentConversation");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to delete suppressions for conversation {ConversationId} when deleting message {MessageId}", conversationId, messageId);
                        // Don't fail message deletion if suppression deletion fails
                    }
                }

                return ServiceResponse<bool>.CreateSuccess(result, "Message deleted successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting message {MessageId}", messageId);
                return ServiceResponse<bool>.CreateError("Error deleting message", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<bool>> MarkMessageAsRead(long messageId)
        {
            try
            {
                var user = await _userRepository.GetCurrentUser();
                if (user == null)
                {
                    return ServiceResponse<bool>.CreateError("User not found", "Unable to retrieve current user", statusCode: 401);
                }

                await _messageRepository.MarkMessageAsRead(messageId, user.Id);
                return ServiceResponse<bool>.CreateSuccess(true, "Message marked as read");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error marking message {MessageId} as read", messageId);
                return ServiceResponse<bool>.CreateError("Error marking message as read", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<bool>> MarkConversationAsRead(long conversationId)
        {
            try
            {
                var user = await _userRepository.GetCurrentUser();
                if (user == null)
                {
                    return ServiceResponse<bool>.CreateError("User not found", "Unable to retrieve current user", statusCode: 401);
                }

                await _messageRepository.MarkConversationAsRead(conversationId, user.Id);
                return ServiceResponse<bool>.CreateSuccess(true, "Conversation marked as read");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error marking conversation {ConversationId} as read", conversationId);
                return ServiceResponse<bool>.CreateError("Error marking conversation as read", ex.Message, ex.InnerException?.Message);
            }
        }
    }
}

