using System.Text.Json;
using System.Text.Json.Nodes;
using Anthropic.SDK;
using Anthropic.SDK.Common;
using Anthropic.SDK.Messaging;
using brownstone_hub_api.Config;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.MaintenanceAgent;
using brownstone_hub_api.Dtos.MaintenanceRequest;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Repositories.MaintenanceRequests;
using brownstone_hub_api.Repositories.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using AnthropicMessage = Anthropic.SDK.Messaging.Message;

namespace brownstone_hub_api.Services.LandlordMaintenanceAgentService
{
    public class LandlordMaintenanceAgentService(
        DataContext dataContext,
        IMaintenanceRequestRepository maintenanceRequestRepository,
        IUserRepository userRepository,
        IOptions<AnthropicSettings> anthropicSettings,
        ILogger<LandlordMaintenanceAgentService> logger) : ILandlordMaintenanceAgentService
    {
        private readonly DataContext _dataContext = dataContext;
        private readonly IMaintenanceRequestRepository _maintenanceRequestRepository = maintenanceRequestRepository;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly AnthropicSettings _settings = anthropicSettings.Value;
        private readonly ILogger<LandlordMaintenanceAgentService> _logger = logger;

        private const int MaxIterations = 10;

        public async Task<MaintenanceAgentChatResponseDto> ChatAsync(
            List<MaintenanceAgentMessageDto> messages,
            long? preselectedPropertyId = null,
            string? preselectedPropertyName = null,
            long? preselectedUnitId = null,
            string? preselectedUnitName = null,
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

            string systemPrompt;

            if (preselectedPropertyId.HasValue)
            {
                var unitLine = preselectedUnitId.HasValue
                    ? $"\n- Pre-selected unit: \"{preselectedUnitName}\" (unit_id: {preselectedUnitId})"
                    : string.Empty;

                var unitConfirm = preselectedUnitId.HasValue
                    ? $", {preselectedUnitName}"
                    : string.Empty;

                var unitSubmit = preselectedUnitId.HasValue
                    ? $" and unit_id={preselectedUnitId}"
                    : string.Empty;

                systemPrompt = $"""
                    You are a Maintenance Agent for a property management platform. Your job is to help landlords
                    quickly create maintenance tickets through natural conversation.

                    CONTEXT: The landlord opened this from a specific property page. The property and unit are already known:
                    - Pre-selected property: "{preselectedPropertyName}" (property_id: {preselectedPropertyId}){unitLine}

                    WORKFLOW:
                    1. DO NOT call get_landlord_properties or get_property_units — they are already known.
                       Start by confirming: "I'll create a maintenance ticket for {preselectedPropertyName}{unitConfirm}. What's the issue?"
                    2. Ask clear, concise questions to understand the issue — 1 or 2 at a time:
                       - What is the problem?
                       - Where specifically (kitchen, bathroom, roof, etc.)?
                    3. Once you understand the issue, optionally ask for a photo:
                       "Do you have a photo? It helps document the issue."
                       Include [PHOTO_REQUEST] at the end of that message.
                       - If they upload a photo, use it to refine the description.
                       - If they skip, continue without.
                    4. Call get_maintenance_categories to pick the right category.
                    5. Determine priority:
                       - High: safety hazards, active leaks, no heat/water/power, flooding, fire risk, gas smells
                       - Medium: broken appliances, minor leaks, HVAC not working well
                       - Low: cosmetic issues, non-urgent repairs, painting
                    6. Briefly recap the issue and ask: "Ready to submit the ticket?"
                       Do NOT mention priority, category, or technical fields in the recap.
                    7. Once confirmed, call submit_maintenance_request using property_id={preselectedPropertyId}{unitSubmit}.
                    8. After submission, the application will show the created maintenance ID and ask whether they are done
                       or want to submit another ticket for this property.
                       - If yes: restart from step 2.
                       - If no / done: the application may close the drawer.

                    RULES:
                    - Be concise and professional — landlords are busy
                    - Do NOT suggest specific vendors or contractors by name
                    - Do NOT submit without getting confirmation first
                    - Emergency issues (gas leak, fire, flooding, no heat in winter) should be High priority
                    """;
            }
            else
            {
                systemPrompt = """
                    You are a Maintenance Agent for a property management platform. Your job is to help landlords
                    quickly create maintenance tickets for their properties through natural conversation.

                    WORKFLOW:
                    1. On the very first message, call get_landlord_properties.
                       - If they have 1 property, say which property you'll file the request for, then skip to step 3.
                       - If they have multiple properties, ask which property has the issue.
                       - When the landlord replies with a displayed list number (for example "1"), treat it as selection_number, not property_id.
                    2. Call get_property_units for the selected property using the real property_id from the tool result, or selection_number if the landlord answered with the displayed number.
                       - If the property has 1 unit, confirm which unit and proceed.
                       - If it has multiple units, ask which unit has the issue (or if it's a common area).
                       - If it has no units (single-family), skip unit selection.
                    3. Ask clear, concise questions to understand the issue — 1 or 2 at a time:
                       - What is the problem?
                       - Where specifically (kitchen, bathroom, roof, etc.)?
                    4. Once you understand the issue, optionally ask for a photo:
                       "Do you have a photo? It helps document the issue."
                       Include [PHOTO_REQUEST] at the end of that message.
                       - If they upload a photo, use it to refine the description.
                       - If they skip, continue without.
                    5. Call get_maintenance_categories to pick the right category.
                    6. Determine priority:
                       - High: safety hazards, active leaks, no heat/water/power, flooding, fire risk, gas smells
                       - Medium: broken appliances, minor leaks, HVAC not working well
                       - Low: cosmetic issues, non-urgent repairs, painting
                    7. Briefly recap the issue and ask: "Ready to submit the ticket?"
                       Do NOT mention priority, category, or technical fields in the recap.
                    8. Once confirmed, call submit_maintenance_request.
                    9. After submission, the application will show the created maintenance ID and ask whether they are done,
                       want to submit another ticket for the same property, or want to start one for a different property.
                       - If yes / same property: restart from step 3 (you already know the property/unit context).
                       - If different property: restart from step 1.
                       - If no / done: the application may close the drawer.

                    RULES:
                    - Be concise and professional — landlords are busy
                    - Do NOT suggest specific vendors or contractors by name
                    - Do NOT submit without getting confirmation first
                    - Emergency issues (gas leak, fire, flooding, no heat in winter) should be High priority
                    """;
            }

            var anthropicMessages = new List<AnthropicMessage>();

            if (messages.Count == 0)
            {
                anthropicMessages.Add(new AnthropicMessage(RoleType.User, "I need to create a maintenance ticket."));
            }
            else
            {
                foreach (var msg in messages)
                {
                    var role = msg.Role == "assistant" ? RoleType.Assistant : RoleType.User;

                    if (role == RoleType.User && !string.IsNullOrEmpty(msg.PhotoBase64))
                    {
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

            LoadMaintenanceRequestDto? submittedRequest = null;
            int iterations = 0;
            MessageResponse? response = null;

            while (true)
            {
                if (cancellationToken.IsCancellationRequested) break;

                if (++iterations > MaxIterations)
                {
                    _logger.LogWarning("Landlord Maintenance Agent exceeded {Max} iterations. Stopping.", MaxIterations);
                    break;
                }

                response = await client.Messages.GetClaudeMessageAsync(parameters, cancellationToken);

                var toolUses = response.Content.OfType<ToolUseContent>().ToList();
                if (toolUses.Count == 0) break;

                anthropicMessages.Add(response.Message);

                var toolResults = new List<ContentBase>();
                foreach (var toolUse in toolUses)
                {
                    _logger.LogDebug("Landlord Maintenance Agent calling tool {Tool}", toolUse.Name);
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
            if (submittedRequest != null)
            {
                var followUp = preselectedPropertyId.HasValue
                    ? "Are you done, or would you like to submit another ticket for this property?"
                    : "Are you done, would you like to submit another ticket for this same property, or would you like to start one for a different property?";

                finalText = $"We have successfully submitted the maintenance ticket. Maintenance ID: {submittedRequest.Id}.\n\n{followUp}";
            }

            return new MaintenanceAgentChatResponseDto
            {
                Message = finalText,
                Done = submittedRequest != null,
                PhotoRequested = photoRequested,
                MaintenanceRequest = submittedRequest
            };
        }

        private async Task<(string result, LoadMaintenanceRequestDto? request)> DispatchToolAsync(
            string toolName,
            JsonNode? input,
            long landlordUserId,
            CancellationToken cancellationToken)
        {
            try
            {
                switch (toolName)
                {
                    case "get_landlord_properties":
                    {
                        var result = await GetLandlordPropertiesAsync(landlordUserId);
                        return (result, null);
                    }
                    case "get_property_units":
                    {
                        var propertyId = input?["property_id"]?.GetValue<long>() ?? 0;
                        var selectionNumber = input?["selection_number"]?.GetValue<int?>();
                        var result = await GetPropertyUnitsAsync(propertyId, landlordUserId, selectionNumber);
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
                _logger.LogError(ex, "Landlord Maintenance Agent tool {Tool} failed", toolName);
                return (JsonSerializer.Serialize(new { error = ex.Message }), null);
            }
        }

        private async Task<string> GetLandlordPropertiesAsync(long landlordUserId)
        {
            var properties = await _dataContext.Properties
                .AsNoTracking()
                .Where(p => p.LandlordId == landlordUserId && !p.IsDeleted)
                .OrderBy(p => string.IsNullOrWhiteSpace(p.Name) ? p.StreetAddress : p.Name)
                .ThenBy(p => p.StreetAddress)
                .Select(p => new { p.Id, p.Name, p.StreetAddress })
                .ToListAsync();

            if (properties.Count == 0)
                return JsonSerializer.Serialize(new { properties = Array.Empty<object>(), message = "No properties found." });

            var result = properties.Select((p, index) => new
            {
                selection_number = index + 1,
                property_id = p.Id,
                name = p.Name,
                address = p.StreetAddress
            });

            return JsonSerializer.Serialize(new { properties = result });
        }

        private async Task<string> GetPropertyUnitsAsync(long propertyId, long landlordUserId, int? selectionNumber = null)
        {
            var properties = await _dataContext.Properties
                .AsNoTracking()
                .Where(p => p.LandlordId == landlordUserId && !p.IsDeleted)
                .OrderBy(p => string.IsNullOrWhiteSpace(p.Name) ? p.StreetAddress : p.Name)
                .ThenBy(p => p.StreetAddress)
                .Select(p => new { p.Id, p.Name, p.StreetAddress })
                .ToListAsync();

            if (selectionNumber.HasValue && selectionNumber.Value >= 1 && selectionNumber.Value <= properties.Count)
            {
                propertyId = properties[selectionNumber.Value - 1].Id;
            }
            else if (propertyId >= 1 && propertyId <= properties.Count && !properties.Any(p => p.Id == propertyId))
            {
                // Claude can mistake the landlord-facing numbered list choice ("1", "2", etc.)
                // for a real property_id. If that number is not an owned property id, treat it as
                // the list selection number so single-number replies map to the intended property.
                propertyId = properties[(int)propertyId - 1].Id;
            }

            var selectedProperty = properties.FirstOrDefault(p => p.Id == propertyId);
            if (selectedProperty == null)
                return JsonSerializer.Serialize(new { units = Array.Empty<object>(), error = "Property not found for this landlord." });

            var units = await _dataContext.Units
                .AsNoTracking()
                .Where(u => u.PropertyId == propertyId)
                .OrderBy(u => u.Name)
                .Select(u => new { u.Id, u.Name })
                .ToListAsync();

            if (units.Count == 0)
                return JsonSerializer.Serialize(new
                {
                    property_id = selectedProperty.Id,
                    property_name = selectedProperty.Name,
                    units = Array.Empty<object>(),
                    message = "No units found for this property. Only proceed without a unit if the landlord confirms this is a single-family/no-unit property."
                });

            var result = units.Select((u, index) => new { selection_number = index + 1, unit_id = u.Id, name = u.Name });
            return JsonSerializer.Serialize(new
            {
                property_id = selectedProperty.Id,
                property_name = selectedProperty.Name,
                units = result
            });
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
            var unitIdRaw = input["unit_id"]?.GetValue<long?>();
            var unitId = unitIdRaw == 0 ? null : unitIdRaw;
            var title = input["title"]?.GetValue<string>() ?? string.Empty;
            var description = input["description"]?.GetValue<string>() ?? string.Empty;
            var priorityStr = input["priority"]?.GetValue<string>()?.ToLower() ?? "medium";

            if (propertyId == 0 || string.IsNullOrWhiteSpace(description))
                return (JsonSerializer.Serialize(new { error = "property_id and description are required" }), null);

            var property = await _dataContext.Properties
                .AsNoTracking()
                .Where(p => p.Id == propertyId && !p.IsDeleted)
                .Select(p => new { p.Id, p.OrganizationId })
                .FirstOrDefaultAsync();

            if (property == null)
                return (JsonSerializer.Serialize(new { error = "Property not found" }), null);

            if (!property.OrganizationId.HasValue)
                return (JsonSerializer.Serialize(new { error = "Property has no organization" }), null);

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
                Priority = priority,
                Status = EMaintenanceStatus.Reported,
                OrganizationId = property.OrganizationId
            };

            try
            {
                var created = await _maintenanceRequestRepository.AddMaintenanceRequest(dto);
                if (created == null)
                    return (JsonSerializer.Serialize(new { error = "Failed to create maintenance request" }), null);

                return (JsonSerializer.Serialize(new
                {
                    success = true,
                    request_id = created.Id,
                    title = created.Title,
                    status = created.Status.ToString(),
                    priority = created.Priority.ToString()
                }), created);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create maintenance request from landlord agent for property {PropertyId}", propertyId);
                return (JsonSerializer.Serialize(new { error = "Failed to save maintenance request. Please try again." }), null);
            }
        }

        private static List<Anthropic.SDK.Common.Tool> BuildTools()
        {
            var getLandlordPropertiesSchema = JsonNode.Parse("""
                {
                    "type": "object",
                    "properties": {}
                }
                """)!;

            var getPropertyUnitsSchema = JsonNode.Parse("""
                {
                    "type": "object",
                    "properties": {
                        "property_id": {
                            "type": "integer",
                            "description": "The actual property_id from get_landlord_properties. Do not use the displayed list number here."
                        },
                        "selection_number": {
                            "type": "integer",
                            "description": "The landlord-facing list number they selected, such as 1, 2, or 3. Use this when the landlord replies with just a number."
                        }
                    },
                    "required": []
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
                            "description": "The property ID"
                        },
                        "unit_id": {
                            "type": "integer",
                            "description": "The unit ID (if applicable)"
                        },
                        "title": {
                            "type": "string",
                            "description": "Short title summarizing the issue (max 60 chars)"
                        },
                        "description": {
                            "type": "string",
                            "description": "Full description of the maintenance issue"
                        },
                        "category_id": {
                            "type": "integer",
                            "description": "The category ID from get_maintenance_categories"
                        },
                        "priority": {
                            "type": "string",
                            "enum": ["low", "medium", "high"],
                            "description": "Priority level"
                        }
                    },
                    "required": ["property_id", "description", "category_id", "priority"]
                }
                """)!;

            return
            [
                new Function("get_landlord_properties",
                    "Get all properties managed by the current landlord",
                    getLandlordPropertiesSchema),

                new Function("get_property_units",
                    "Get the units for a specific property",
                    getPropertyUnitsSchema),

                new Function("get_maintenance_categories",
                    "Get the list of maintenance categories (plumbing, electrical, HVAC, etc.)",
                    getMaintenanceCategoriesSchema),

                new Function("submit_maintenance_request",
                    "Submit the maintenance request after gathering all necessary information and getting confirmation",
                    submitMaintenanceRequestSchema)
            ];
        }
    }
}
