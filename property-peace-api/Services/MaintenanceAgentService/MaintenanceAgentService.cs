using System.Text.Json;
using System.Text.Json.Nodes;
using Anthropic.SDK;
using Anthropic.SDK.Common;
using Anthropic.SDK.Messaging;
using brownstone_hub_api.Config;
using brownstone_hub_api.Dtos.MaintenanceAgent;
using brownstone_hub_api.Dtos.MaintenanceRequest;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.MaintenanceRequests;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.MaintenanceRequestService;
using Microsoft.Extensions.Options;
using AnthropicMessage = Anthropic.SDK.Messaging.Message;

namespace brownstone_hub_api.Services.MaintenanceAgentService
{
    public class MaintenanceAgentService(
        ILeaseRepository leaseRepository,
        IMaintenanceRequestRepository maintenanceRequestRepository,
        IMaintenanceRequestService maintenanceRequestService,
        IUserRepository userRepository,
        IOptions<AnthropicSettings> anthropicSettings,
        ILogger<MaintenanceAgentService> logger) : IMaintenanceAgentService
    {
        private readonly ILeaseRepository _leaseRepository = leaseRepository;
        private readonly IMaintenanceRequestRepository _maintenanceRequestRepository = maintenanceRequestRepository;
        private readonly IMaintenanceRequestService _maintenanceRequestService = maintenanceRequestService;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly AnthropicSettings _settings = anthropicSettings.Value;
        private readonly ILogger<MaintenanceAgentService> _logger = logger;

        private const int MaxIterations = 10;

        public async Task<MaintenanceAgentChatResponseDto> ChatAsync(
            List<MaintenanceAgentMessageDto> messages,
            CancellationToken cancellationToken = default)
        {
            var currentUser = await _userRepository.GetCurrentUser();
            if (currentUser == null)
            {
                return new MaintenanceAgentChatResponseDto
                {
                    Message = "I'm sorry, I couldn't verify your identity. Please try again.",
                    Done = false
                };
            }

            var client = new AnthropicClient(_settings.ApiKey);
            var tools = BuildTools();

            var systemPrompt = """
                You are a friendly Maintenance Agent for a property management platform. Your job is to help tenants
                submit maintenance requests by gathering the right information through natural conversation.

                WORKFLOW:
                1. On the very first message, call get_tenant_leases to see which properties the tenant has.
                   - If they have 1 lease, skip asking and just say which property you'll file the request for,
                     then immediately ask what the issue is.
                   - If they have multiple leases, ask which property has the issue.
                2. Ask clear, concise questions to understand the issue:
                   - What is the problem (faucet, heater, lock, etc.)?
                   - Where specifically (kitchen, bathroom, bedroom, etc.)?
                   - How long has it been happening?
                   - Any safety concern (water damage, no heat/power, etc.)?
                   Keep questions short — ask 1 or 2 at a time.
                3. Once you have a clear understanding of the issue, ask the tenant for a photo:
                   "Do you have a photo of the issue? It helps the landlord respond faster."
                   Include [PHOTO_REQUEST] at the end of that message.
                   - If they upload a photo, use it to improve the description and confirm priority.
                   - If they decline or skip, continue without a photo.
                4. Once you have enough info, call get_maintenance_categories to pick the right category.
                5. Determine priority based on the issue:
                   - High: safety hazards, no heat/water/power, active leaks, gas smells, flooding, fire risk
                   - Medium: broken appliances, minor leaks, HVAC not cooling/heating well
                   - Low: cosmetic issues, minor wear, painting, non-urgent replacements
                6. Once you have enough information, confirm with the tenant in plain, friendly language.
                   Briefly recap the issue in one sentence and ask if they're ready to submit — for example:
                   "Got it — sounds like [brief natural description of the issue]. Ready for me to submit a ticket?"
                   Do NOT mention priority, category, title, or any technical fields.
                7. Once they confirm, call submit_maintenance_request.
                8. After successful submission, confirm with the ticket number and let them know their landlord has been notified.
                   Then ask: "Would you like to submit another maintenance request?"
                   - If yes: start the workflow over from step 2 (you already know their property).
                   - If no: let them know they can close this chat anytime.

                RULES:
                - Be concise and warm — this is a quick conversation, not an interview
                - Do NOT suggest specific vendors or contractors by name
                - Do NOT make legal statements, mention eviction, or promise specific timelines
                - Do NOT submit without getting tenant confirmation first
                - Emergency issues (gas leak, fire, no heat in winter, flooding) should be High priority
                """;

            // Build Anthropic message list
            var anthropicMessages = new List<AnthropicMessage>();

            if (messages.Count == 0)
            {
                // First turn — trigger with a begin message
                anthropicMessages.Add(new AnthropicMessage(RoleType.User, "Hello, I need to submit a maintenance request."));
            }
            else
            {
                foreach (var msg in messages)
                {
                    var role = msg.Role == "assistant" ? RoleType.Assistant : RoleType.User;

                    if (role == RoleType.User && !string.IsNullOrEmpty(msg.PhotoBase64))
                    {
                        // User message with an attached photo
                        anthropicMessages.Add(new AnthropicMessage
                        {
                            Role = RoleType.User,
                            Content = new List<ContentBase>
                            {
                                new ImageContent
                                {
                                    Source = new ImageSource
                                    {
                                        Type = SourceType.base64,
                                        MediaType = msg.PhotoMimeType ?? "image/jpeg",
                                        Data = msg.PhotoBase64
                                    }
                                },
                                new TextContent { Text = string.IsNullOrWhiteSpace(msg.Content)
                                    ? "Here's a photo of the issue." : msg.Content }
                            }
                        });
                    }
                    else
                    {
                        anthropicMessages.Add(new AnthropicMessage(role, msg.Content));
                    }
                }
            }

            var parameters = new MessageParameters
            {
                Model = _settings.AgentModel,
                MaxTokens = 1024,
                Messages = anthropicMessages,
                Tools = tools,
                System = [new SystemMessage(systemPrompt)],
                Temperature = 1.0m,
                Stream = false
            };

            // State for tracking submitted request
            LoadMaintenanceRequestDto? submittedRequest = null;

            int iterations = 0;
            MessageResponse? response = null;

            while (true)
            {
                if (cancellationToken.IsCancellationRequested) break;

                if (++iterations > MaxIterations)
                {
                    _logger.LogWarning("Maintenance Agent exceeded {Max} iterations. Stopping.", MaxIterations);
                    break;
                }

                response = await client.Messages.GetClaudeMessageAsync(parameters, cancellationToken);

                var toolUses = response.Content.OfType<ToolUseContent>().ToList();
                if (toolUses.Count == 0)
                {
                    // Claude responded with text — we're done this turn
                    break;
                }

                anthropicMessages.Add(response.Message);

                var toolResults = new List<ContentBase>();
                foreach (var toolUse in toolUses)
                {
                    _logger.LogDebug("Maintenance Agent calling tool {Tool}", toolUse.Name);
                    var (result, request) = await DispatchToolAsync(toolUse.Name, toolUse.Input, currentUser.Id, cancellationToken);
                    if (request != null) submittedRequest = request;

                    toolResults.Add(new ToolResultContent
                    {
                        ToolUseId = toolUse.Id,
                        Content = [new TextContent { Text = result }]
                    });
                }

                anthropicMessages.Add(new AnthropicMessage { Role = RoleType.User, Content = toolResults });
            }

            var rawText = response?.Content.OfType<TextContent>().FirstOrDefault()?.Text
                ?? "I'm sorry, something went wrong. Please try again.";

            const string photoTag = "[PHOTO_REQUEST]";
            var photoRequested = rawText.Contains(photoTag);
            var finalText = rawText.Replace(photoTag, "").Trim();

            return new MaintenanceAgentChatResponseDto
            {
                Message = finalText,
                Done = submittedRequest != null,
                PhotoRequested = photoRequested,
                MaintenanceRequest = submittedRequest
            };
        }

        // ── Tool Dispatch ──────────────────────────────────────────────────────────

        private async Task<(string result, LoadMaintenanceRequestDto? request)> DispatchToolAsync(
            string toolName,
            JsonNode? input,
            long tenantUserId,
            CancellationToken cancellationToken)
        {
            try
            {
                switch (toolName)
                {
                    case "get_tenant_leases":
                    {
                        var result = await GetTenantLeasesAsync(tenantUserId);
                        return (result, null);
                    }
                    case "get_maintenance_categories":
                    {
                        var result = await GetMaintenanceCategoriesAsync();
                        return (result, null);
                    }
                    case "submit_maintenance_request":
                    {
                        var (result, request) = await SubmitMaintenanceRequestAsync(input);
                        return (result, request);
                    }
                    default:
                        return (JsonSerializer.Serialize(new { error = $"Unknown tool: {toolName}" }), null);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Maintenance Agent tool {Tool} failed", toolName);
                return (JsonSerializer.Serialize(new { error = ex.Message }), null);
            }
        }

        // ── Tool Implementations ───────────────────────────────────────────────────

        private async Task<string> GetTenantLeasesAsync(long tenantUserId)
        {
            var leases = await _leaseRepository.GetLeasesByTenantUserId(tenantUserId);
            var active = leases.Where(l => l.IsActive == true).ToList();

            if (active.Count == 0)
                return JsonSerializer.Serialize(new { leases = Array.Empty<object>(), message = "No active leases found." });

            var result = active.Select(l => new
            {
                lease_id = l.Id,
                property_id = l.PropertyId,
                unit_id = l.UnitId,
                property_name = l.PropertyName,
                unit_name = l.UnitName,
                organization_id = l.OrganizationId
            });

            return JsonSerializer.Serialize(new { leases = result });
        }

        private async Task<string> GetMaintenanceCategoriesAsync()
        {
            var categories = await _maintenanceRequestRepository.GetMaintenanceCategories();
            var result = categories.Select(c => new { id = c.Id, name = c.Label });
            return JsonSerializer.Serialize(new { categories = result });
        }

        private async Task<(string result, LoadMaintenanceRequestDto? request)> SubmitMaintenanceRequestAsync(JsonNode? input)
        {
            if (input == null)
                return (JsonSerializer.Serialize(new { error = "Missing input parameters" }), null);

            var propertyId = input["property_id"]?.GetValue<long>() ?? 0;
            var unitId = input["unit_id"]?.GetValue<long?>();
            var title = input["title"]?.GetValue<string>() ?? string.Empty;
            var description = input["description"]?.GetValue<string>() ?? string.Empty;
            var categoryId = input["category_id"]?.GetValue<long>() ?? 0;
            var priorityStr = input["priority"]?.GetValue<string>()?.ToLower() ?? "medium";

            if (propertyId == 0 || string.IsNullOrWhiteSpace(description) || categoryId == 0)
                return (JsonSerializer.Serialize(new { error = "property_id, description, and category_id are required" }), null);

            var priority = priorityStr switch
            {
                "high" => EMaintenancePriority.High,
                "low" => EMaintenancePriority.Low,
                _ => EMaintenancePriority.Medium
            };

            var dto = new AddMaintenanceRequestDto
            {
                PropertyId = propertyId,
                UnitId = unitId,
                Title = string.IsNullOrWhiteSpace(title) ? description[..Math.Min(60, description.Length)] : title,
                Description = description,
                CategoryId = categoryId,
                Priority = priority,
                Status = EMaintenanceStatus.Reported
            };

            var response = await _maintenanceRequestService.AddMaintenanceRequestFromAgent(dto);

            if (!response.Success || response.Data == null)
                return (JsonSerializer.Serialize(new { error = response.Message ?? "Failed to create request" }), null);

            var created = response.Data;
            return (JsonSerializer.Serialize(new
            {
                success = true,
                request_id = created.Id,
                title = created.Title,
                status = created.Status.ToString(),
                priority = created.Priority.ToString(),
                category = created.Category?.Label
            }), created);
        }

        // ── Tool Definitions ───────────────────────────────────────────────────────

        private static List<Anthropic.SDK.Common.Tool> BuildTools()
        {
            var getTenantLeasesSchema = JsonNode.Parse("""
                {
                    "type": "object",
                    "properties": {}
                }
                """)!;

            var getMaintenanceCategoriesSchema = JsonNode.Parse("""
                {
                    "type": "object",
                    "properties": {}
                }
                """)!;

            var submitMaintenanceRequestSchema = JsonNode.Parse("""
                {
                    "type": "object",
                    "properties": {
                        "property_id": {
                            "type": "integer",
                            "description": "The property ID from get_tenant_leases"
                        },
                        "unit_id": {
                            "type": "integer",
                            "description": "The unit ID from get_tenant_leases (if applicable)"
                        },
                        "title": {
                            "type": "string",
                            "description": "Short title summarizing the issue (max 60 chars)"
                        },
                        "description": {
                            "type": "string",
                            "description": "Full description of the maintenance issue gathered from the conversation"
                        },
                        "category_id": {
                            "type": "integer",
                            "description": "The category ID from get_maintenance_categories"
                        },
                        "priority": {
                            "type": "string",
                            "enum": ["low", "medium", "high"],
                            "description": "Priority level: high for safety/emergencies, medium for standard issues, low for cosmetic"
                        }
                    },
                    "required": ["property_id", "description", "category_id", "priority"]
                }
                """)!;

            return
            [
                new Function("get_tenant_leases",
                    "Get the tenant's active leases with property and unit information",
                    getTenantLeasesSchema),

                new Function("get_maintenance_categories",
                    "Get the list of maintenance categories (plumbing, electrical, HVAC, etc.)",
                    getMaintenanceCategoriesSchema),

                new Function("submit_maintenance_request",
                    "Submit the maintenance request after gathering all necessary information and confirming with the tenant",
                    submitMaintenanceRequestSchema)
            ];
        }
    }
}
