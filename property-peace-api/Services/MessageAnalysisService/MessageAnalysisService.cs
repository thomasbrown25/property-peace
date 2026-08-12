using brownstone_hub_api.Config;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Message;
using brownstone_hub_api.Repositories.Messages;
using brownstone_hub_api.Services.OpenAIService;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace brownstone_hub_api.Services.MessageAnalysisService
{
    public class MessageAnalysisService(
        IOpenAIService openAIService,
        IMessageRepository messageRepository,
        DataContext dataContext,
        IOptions<MessageAnalysisSettings> settings,
        ILogger<MessageAnalysisService> logger) : IMessageAnalysisService
    {
        private readonly IOpenAIService _openAIService = openAIService;
        private readonly IMessageRepository _messageRepository = messageRepository;
        private readonly DataContext _dataContext = dataContext;
        private readonly MessageAnalysisSettings _settings = settings.Value;
        private readonly ILogger<MessageAnalysisService> _logger = logger;

        public async Task<ServiceResponse<MessageAnalysisResult>> AnalyzeConversationAsync(long conversationId)
        {
            try
            {
                if (!_settings.Enabled)
                {
                    return ServiceResponse<MessageAnalysisResult>.CreateError("Analysis disabled", "Message analysis is disabled in configuration.");
                }

                // Get conversation to identify tenant
                var conversation = await _dataContext.Conversations
                    .Include(c => c.Tenant)
                    .FirstOrDefaultAsync(c => c.Id == conversationId);

                if (conversation == null)
                {
                    return ServiceResponse<MessageAnalysisResult>.CreateError("Conversation not found", $"Conversation {conversationId} not found");
                }

                // Get tenant UserId if conversation has a tenant
                long? tenantUserId = null;
                if (conversation.TenantId.HasValue && conversation.Tenant != null)
                {
                    tenantUserId = conversation.Tenant.UserId;
                }

                // Fetch the last 20 messages from the conversation (most recent first, then take last 20)
                var allMessages = await _messageRepository.GetMessagesByConversationId(
                    conversationId, 
                    0, // userId not needed for fetching messages
                    0, // skip
                    20 // Analyze only the last 20 messages
                );

                if (allMessages == null || allMessages.Count == 0)
                {
                    return ServiceResponse<MessageAnalysisResult>.CreateError(
                        "Insufficient messages", 
                        $"Conversation needs at least {_settings.MinMessagesForAnalysis} messages for analysis. Found 0."
                    );
                }

                // Filter to only include tenant messages (exclude landlord and AI messages)
                var tenantMessages = allMessages;
                if (tenantUserId.HasValue)
                {
                    // Only include messages from the tenant
                    tenantMessages = allMessages
                        .Where(m => m.SenderId == tenantUserId.Value)
                        .ToList();
                    
                    _logger.LogInformation(
                        "Filtered messages for urgency analysis: {TotalMessages} total, {TenantMessages} from tenant (UserId: {TenantUserId})",
                        allMessages.Count,
                        tenantMessages.Count,
                        tenantUserId.Value
                    );
                }
                else
                {
                    // If no tenant is associated, we can't determine which messages are from tenants
                    // In this case, we'll analyze all messages but log a warning
                    _logger.LogWarning(
                        "Conversation {ConversationId} has no associated tenant. Analyzing all messages, which may include landlord/AI messages.",
                        conversationId
                    );
                }

                if (tenantMessages.Count < _settings.MinMessagesForAnalysis)
                {
                    return ServiceResponse<MessageAnalysisResult>.CreateError(
                        "Insufficient tenant messages", 
                        $"Conversation needs at least {_settings.MinMessagesForAnalysis} tenant messages for analysis. Found {tenantMessages.Count} tenant messages out of {allMessages.Count} total."
                    );
                }

                return await AnalyzeMessagesAsync(tenantMessages);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error analyzing conversation {ConversationId}", conversationId);
                return ServiceResponse<MessageAnalysisResult>.CreateError("Analysis error", ex.Message);
            }
        }

        public async Task<ServiceResponse<MessageAnalysisResult>> AnalyzeMessagesAsync(List<LoadMessageDto> messages)
        {
            try
            {
                if (!_settings.Enabled)
                {
                    return ServiceResponse<MessageAnalysisResult>.CreateError("Analysis disabled", "Message analysis is disabled in configuration.");
                }

                if (messages == null || messages.Count < _settings.MinMessagesForAnalysis)
                {
                    return ServiceResponse<MessageAnalysisResult>.CreateError(
                        "Insufficient messages", 
                        $"Need at least {_settings.MinMessagesForAnalysis} messages for analysis. Found {messages?.Count ?? 0}."
                    );
                }

                // Build conversation text from messages (reverse order to get chronological)
                var conversationText = string.Join("\n\n", messages
                    .OrderBy(m => m.CreatedAt)
                    .Select(m => $"[{m.SenderName}]: {m.Content}"));

                // Build the prompt for OpenAI
                var prompt = BuildAnalysisPrompt(conversationText);

                // Call OpenAI with timeout
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(_settings.AnalysisTimeoutSeconds));
                
                var openAiResponse = await _openAIService.GenerateJsonAsync<MessageAnalysisResult>(prompt, 2000);
                
                if (!openAiResponse.Success || openAiResponse.Data == null)
                {
                    _logger.LogWarning("OpenAI analysis failed: {Error}", openAiResponse.Message);
                    return ServiceResponse<MessageAnalysisResult>.CreateError(
                        "Analysis failed", 
                        openAiResponse.Message ?? "Failed to analyze messages"
                    );
                }

                var result = openAiResponse.Data;
                
                // Validate and clean up the result
                if (string.IsNullOrWhiteSpace(result.Summary))
                {
                    result.Summary = "No summary available.";
                }

                if (result.UrgentItems == null)
                {
                    result.UrgentItems = [];
                }

                // Generate unique IDs for urgent items if they don't have one
                foreach (var item in result.UrgentItems)
                {
                    if (string.IsNullOrEmpty(item.Id))
                    {
                        // Generate a unique ID based on the item's content
                        item.Id = GenerateUrgentItemId(item);
                    }
                }

                _logger.LogInformation(
                    "Successfully analyzed {MessageCount} messages. Found {UrgentCount} urgent items. HasUrgentItems: {HasUrgent}, Summary: {Summary}", 
                    messages.Count, 
                    result.UrgentItems.Count,
                    result.HasUrgentItems,
                    result.Summary
                );

                if (result.UrgentItems != null && result.UrgentItems.Any())
                {
                    foreach (var item in result.UrgentItems)
                    {
                        _logger.LogInformation(
                            "Urgent item detected - Type: {Type}, Severity: {Severity}, Description: {Description}",
                            item.Type,
                            item.Severity,
                            item.Description
                        );
                    }
                }
                else
                {
                    _logger.LogWarning(
                        "Analysis completed but no urgent items found. Conversation text preview: {Preview}",
                        conversationText.Length > 200 ? conversationText.Substring(0, 200) + "..." : conversationText
                    );
                }

                return ServiceResponse<MessageAnalysisResult>.CreateSuccess(result);
            }
            catch (OperationCanceledException)
            {
                _logger.LogWarning("Message analysis timed out after {TimeoutSeconds} seconds", _settings.AnalysisTimeoutSeconds);
                return ServiceResponse<MessageAnalysisResult>.CreateError(
                    "Analysis timeout", 
                    $"Analysis timed out after {_settings.AnalysisTimeoutSeconds} seconds."
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error analyzing messages");
                return ServiceResponse<MessageAnalysisResult>.CreateError("Analysis error", ex.Message);
            }
        }

        public async Task SetMessageUrgencyFromAnalysisAsync(long conversationId, MessageAnalysisResult analysisResult, List<LoadMessageDto> messages)
        {
            try
            {
                var authorization = await _dataContext.Conversations
                    .Where(c => c.Id == conversationId && c.OrganizationId.HasValue)
                    .Select(c => new { OrganizationId = c.OrganizationId!.Value, ActorUserId = c.LandlordId })
                    .SingleOrDefaultAsync();
                if (authorization == null)
                {
                    _logger.LogWarning("Cannot scope message urgency for conversation {ConversationId}", conversationId);
                    return;
                }

                if (analysisResult?.UrgentItems == null || !analysisResult.UrgentItems.Any())
                {
                    // No urgent items, ensure all messages are marked as not urgent
                    foreach (var message in messages)
                    {
                        await _messageRepository.SetMessageUrgent(message.Id, false, conversationId, authorization.OrganizationId, authorization.ActorUserId);
                    }
                    return;
                }

                // Match urgent items to messages and set IsUrgent flag
                foreach (var urgentItem in analysisResult.UrgentItems)
                {
                    if (string.IsNullOrEmpty(urgentItem.MessageExcerpt))
                    {
                        // If no excerpt, we can't match to a specific message
                        // In this case, we'll mark all tenant messages as urgent if they contain urgent keywords
                        foreach (var message in messages)
                        {
                            var messageContent = message.Content.ToLowerInvariant().Trim();
                            var urgentKeywords = new[] { "broken", "broke", "leak", "leaking", "not working", "fell off", "needs fixing", "needs repair", "urgent", "emergency" };
                            
                            if (urgentKeywords.Any(keyword => messageContent.Contains(keyword)))
                            {
                                await _messageRepository.SetMessageUrgent(message.Id, true, conversationId, authorization.OrganizationId, authorization.ActorUserId);
                            }
                        }
                        continue;
                    }

                    // Find message that matches the excerpt
                    var excerpt = urgentItem.MessageExcerpt.ToLowerInvariant().Trim();
                    var matchingMessage = messages.FirstOrDefault(m =>
                    {
                        var messageContent = m.Content.ToLowerInvariant().Trim();
                        return messageContent.Contains(excerpt) || excerpt.Contains(messageContent);
                    });

                    if (matchingMessage != null)
                    {
                        await _messageRepository.SetMessageUrgent(matchingMessage.Id, true, conversationId, authorization.OrganizationId, authorization.ActorUserId);
                        _logger.LogInformation(
                            "Set message {MessageId} as urgent based on urgent item: {Type} - {Description}",
                            matchingMessage.Id,
                            urgentItem.Type,
                            urgentItem.Description
                        );
                    }
                    else
                    {
                        _logger.LogWarning(
                            "Could not find matching message for urgent item excerpt: {Excerpt}",
                            urgentItem.MessageExcerpt
                        );
                    }
                }

                // Mark all other messages as not urgent (if they weren't matched)
                var urgentMessageIds = new HashSet<long>();
                foreach (var urgentItem in analysisResult.UrgentItems)
                {
                    if (!string.IsNullOrEmpty(urgentItem.MessageExcerpt))
                    {
                        var excerpt = urgentItem.MessageExcerpt.ToLowerInvariant().Trim();
                        var matchingMessage = messages.FirstOrDefault(m =>
                        {
                            var messageContent = m.Content.ToLowerInvariant().Trim();
                            return messageContent.Contains(excerpt) || excerpt.Contains(messageContent);
                        });
                        if (matchingMessage != null)
                        {
                            urgentMessageIds.Add(matchingMessage.Id);
                        }
                    }
                }

                // Set non-matching messages to not urgent
                foreach (var message in messages)
                {
                    if (!urgentMessageIds.Contains(message.Id))
                    {
                        await _messageRepository.SetMessageUrgent(message.Id, false, conversationId, authorization.OrganizationId, authorization.ActorUserId);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error setting message urgency for conversation {ConversationId}", conversationId);
                // Don't throw - this is a background operation
            }
        }

        private string BuildAnalysisPrompt(string conversationText)
        {
            return $@"You are analyzing incoming tenant messages in a property management system. 
IMPORTANT: Only analyze messages from tenants. Messages from landlords or AI assistants have already been filtered out.
Analyze the following conversation and:
1. Provide a 2-3 sentence summary of the main topics discussed
2. Identify any urgent items that require immediate landlord attention:

CRITICAL RULE: ANY message from a tenant that mentions:
- Something broken, damaged, or not working
- Something that ""fell off"", ""broke"", ""stopped working"", ""needs fixing"", ""needs repair""
- Maintenance requests, repair needs, or issues with the property
- Safety concerns, security issues, or things that prevent normal use
- Water leaks, burst pipes, flooding, plumbing issues
- Heating/cooling failures, electrical issues, appliance problems
- Structural damage, broken doors/windows, security issues

MUST be flagged as urgent with at least ""medium"" severity.

PRIORITY RULE: When a message contains BOTH maintenance/safety issues AND payment issues:
- ALWAYS prioritize the maintenance/safety issue as the PRIMARY urgent item
- Maintenance and safety issues take precedence over payment issues
- Examples: ""pipe burst"" or ""water leak"" should be flagged as maintenance (high priority) even if rent is also mentioned

URGENT ITEMS INCLUDE (but not limited to):
- ANY maintenance request or repair need (broken items, things that fell off, not working, needs fixing, etc.)
- Maintenance emergencies (water leaks, heating/cooling failures, broken appliances, electrical issues, plumbing problems)
- Safety hazards (broken locks, doors, windows, structural issues, trip hazards, security concerns)
- Payment issues (overdue rent, payment disputes, bounced checks, late fees)
- Lease violations (unauthorized occupants, property damage, noise complaints, unauthorized pets)
- Health hazards (mold, pests, air quality issues, fire hazards)
- Time-sensitive requests (urgent repairs, move-in/move-out issues, access requests)

EXAMPLES OF URGENT MESSAGES:
- ""My door knob just completely fell off. I need some help with getting this fixed"" -> URGENT (high severity - security/safety issue)
- ""The sink is leaking"" -> URGENT (medium severity - maintenance issue)
- ""The heater stopped working"" -> URGENT (high severity - essential service)
- ""Something broke"" -> URGENT (medium severity - needs investigation)

IMPORTANT: 
- ANY message from a tenant requesting maintenance, repairs, or reporting something broken MUST be flagged as urgent
- If a tenant says something ""fell off"", ""broke"", ""stopped working"", or ""needs fixing"", it is ALWAYS urgent
- Use ""high"" severity for safety issues, security problems (like broken locks/doors), or things that prevent normal use of the property
- Use ""medium"" severity for non-critical repairs that still need attention
- Use ""low"" severity for minor issues or general inquiries (but still flag them as urgent)

For each urgent item, provide: type, description, severity (high/medium/low), and relevant message excerpt.

Return JSON in this format:
{{
  ""summary"": ""Brief 2-3 sentence summary of the conversation"",
  ""urgentItems"": [
    {{
      ""type"": ""maintenance"",
      ""description"": ""Clear description of the urgent issue"",
      ""severity"": ""high"",
      ""messageExcerpt"": ""Relevant excerpt from the message""
    }}
  ]
}}

If there are no urgent items, return an empty array for urgentItems.

Conversation:
{conversationText}";
        }

        private string GenerateUrgentItemId(UrgentItem item)
        {
            // Create a unique identifier based on the item's content
            var content = $"{item.Type}|{item.Description}|{item.Severity}|{item.MessageExcerpt ?? ""}";
            using var sha256 = SHA256.Create();
            var hashBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(content));
            var hashString = Convert.ToBase64String(hashBytes).Replace("+", "-").Replace("/", "_").TrimEnd('=');
            return hashString.Substring(0, Math.Min(16, hashString.Length)); // Use first 16 characters
        }
    }
}

