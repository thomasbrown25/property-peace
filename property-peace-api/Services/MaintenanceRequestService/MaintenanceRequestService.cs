using Azure.Storage.Blobs;
using brownstone_hub_api.Dtos.Image;
using brownstone_hub_api.Dtos.MaintenanceCategory;
using brownstone_hub_api.Dtos.MaintenanceEvent;
using brownstone_hub_api.Dtos.MaintenanceImage;
using brownstone_hub_api.Dtos.MaintenanceRequest;
using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Repositories.Images;
using brownstone_hub_api.Repositories.MaintenanceRequests;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Units;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Repositories.Vendors;
using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Services.ImageService;
using brownstone_hub_api.Services.MaintenanceImageService;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Services.OpenAIService;
using Microsoft.AspNetCore.Http;
using System.Text.Json;

namespace brownstone_hub_api.Services.MaintenanceRequestService
{
    public class MaintenanceRequestService(IMaintenanceRequestRepository maintenanceRequestRepository, IImageService<MaintenanceImage, LoadImageDto, AddImageDto> imageService, IPropertyRepository propertyRepository, BlobServiceClient blobServiceClient, IUserRepository userRepository, INotificationService notificationService, IUnitRepository unitRepository, IVendorRepository vendorRepository, IEmailService emailService, EmailTemplateService emailTemplateService, IOrganizationMemberRepository organizationMemberRepository, IHttpContextAccessor httpContextAccessor, ILogger<MaintenanceRequestService> logger, IOpenAIService openAIService) : IMaintenanceRequestService
    {
        private readonly IMaintenanceRequestRepository _maintenanceRequestRepository = maintenanceRequestRepository;
        private readonly IImageService<MaintenanceImage, LoadImageDto, AddImageDto> _imageService = imageService;
        private readonly IPropertyRepository _propertyRepository = propertyRepository;
        private readonly BlobServiceClient _blobServiceClient = blobServiceClient;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly INotificationService _notificationService = notificationService;
        private readonly IOrganizationMemberRepository _organizationMemberRepository = organizationMemberRepository;
        private readonly IUnitRepository _unitRepository = unitRepository;
        private readonly IVendorRepository _vendorRepository = vendorRepository;
        private readonly IEmailService _emailService = emailService;
        private readonly EmailTemplateService _emailTemplateService = emailTemplateService;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly ILogger<MaintenanceRequestService> _logger = logger;
        private readonly IOpenAIService _openAIService = openAIService;

        private async Task<long?> GetCurrentUserIdAsync()
        {
            var user = await _userRepository.GetCurrentUser();
            return user?.Id;
        }

        private long? GetOrganizationIdFromContext()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }

        private string GenerateTitleFromDescription(string description)
        {
            if (string.IsNullOrWhiteSpace(description))
                return "Maintenance Request";

            // Generate a simple title from description (first sentence or first 60 chars)
            var title = description.Length <= 60
                ? description
                : description.Substring(0, Math.Min(57, description.Length)) + "...";
            
            // Capitalize first letter
            if (!string.IsNullOrEmpty(title))
            {
                title = char.ToUpper(title[0]) + (title.Length > 1 ? title.Substring(1) : "");
            }

            return title;
        }

        private async Task<string> GenerateTitleWithAIAsync(string description)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(description))
                    return "Maintenance Request";

                // Create prompt for AI
                var prompt = $@"You are a maintenance request title generator. Based on the maintenance request description below, generate a concise, descriptive title.

Maintenance Request Description: {description}

Generate a title that:
- Is clear and descriptive (max 60 characters)
- Summarizes the main issue
- Is professional and specific
- Does not include unnecessary words like ""Request"" or ""Issue""

Return ONLY a JSON object with the following format:
{{
    ""title"": ""<the generated title>"",
    ""reasoning"": ""<brief explanation of why this title was chosen>"" 
}}

Generate a concise, professional title that accurately represents the maintenance request.";

                // Call AI service
                var aiResponse = await _openAIService.GenerateJsonAsync<TitleGenerationResponse>(prompt, maxTokens: 300);
                
                if (!aiResponse.Success || aiResponse.Data == null || string.IsNullOrWhiteSpace(aiResponse.Data.Title))
                {
                    _logger.LogWarning("AI failed to generate title: {Error}, falling back to simple generation", aiResponse.Message);
                    return GenerateTitleFromDescription(description);
                }

                var generatedTitle = aiResponse.Data.Title.Trim();
                
                // Ensure title is not too long (max 60 chars)
                if (generatedTitle.Length > 60)
                {
                    generatedTitle = generatedTitle.Substring(0, 57).Trim() + "...";
                }

                _logger.LogInformation("AI generated title: {Title}. Reasoning: {Reasoning}", 
                    generatedTitle, aiResponse.Data.Reasoning);

                return generatedTitle;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error using AI to generate maintenance title");
                return GenerateTitleFromDescription(description);
            }
        }

        private class TitleGenerationResponse
        {
            public string Title { get; set; } = string.Empty;
            public string Reasoning { get; set; } = string.Empty;
        }

        private async Task<long?> ChooseCategoryWithAIAsync(string title, string description)
        {
            try
            {
                // Get available categories
                var categories = await _maintenanceRequestRepository.GetMaintenanceCategories();
                if (categories == null || !categories.Any())
                {
                    _logger.LogWarning("No maintenance categories available for AI selection");
                    return null;
                }

                // Build category list for AI prompt
                var categoryList = string.Join(", ", categories.Select(c => $"{c.Value} (ID: {c.Id})"));
                
                // Create prompt for AI
                var prompt = $@"You are a maintenance request categorization assistant. Based on the maintenance request details below, choose the most appropriate category.

Available categories: {categoryList}

Maintenance Request Title: {title}
Maintenance Request Description: {description}

Analyze the request and determine which category best fits. Return ONLY a JSON object with the following format:
{{
    ""categoryId"": <the numeric ID of the chosen category>,
    ""reasoning"": ""<brief explanation of why this category was chosen>""
}}

Choose the category ID that best matches the maintenance request. Be specific and accurate.";

                // Call AI service
                var aiResponse = await _openAIService.GenerateJsonAsync<CategorySelectionResponse>(prompt, maxTokens: 500);
                
                if (!aiResponse.Success || aiResponse.Data == null)
                {
                    _logger.LogWarning("AI failed to select category: {Error}", aiResponse.Message);
                    return null;
                }

                var selectedCategoryId = aiResponse.Data.CategoryId;
                
                // Validate that the selected category ID exists
                var categoryExists = categories.Any(c => c.Id == selectedCategoryId);
                if (!categoryExists)
                {
                    _logger.LogWarning("AI selected invalid category ID {CategoryId}, available IDs: {AvailableIds}", 
                        selectedCategoryId, string.Join(", ", categories.Select(c => c.Id)));
                    return null;
                }

                _logger.LogInformation("AI selected category ID {CategoryId} for maintenance request. Reasoning: {Reasoning}", 
                    selectedCategoryId, aiResponse.Data.Reasoning);

                return selectedCategoryId;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error using AI to choose maintenance category");
                return null;
            }
        }

        private class CategorySelectionResponse
        {
            public long CategoryId { get; set; }
            public string Reasoning { get; set; } = string.Empty;
        }

        private async Task<EMaintenancePriority?> ChoosePriorityWithAIAsync(string title, string description)
        {
            try
            {
                // Create prompt for AI
                var prompt = $@"You are a maintenance request priority assessment assistant. Based on the maintenance request details below, determine the appropriate priority level.

Priority Levels:
- Low: Non-urgent issues that can be addressed when convenient (cosmetic issues, minor repairs, routine maintenance)
- Medium: Standard maintenance requests that need attention but are not emergencies
- High: Urgent issues requiring prompt attention (safety hazards, water leaks, no heat/water/power, electrical issues, structural damage, security issues)

Maintenance Request Title: {title}
Maintenance Request Description: {description}

Analyze the request and determine the priority level. Consider:
- Safety concerns (fire, gas leaks, structural damage, security issues)
- Urgency keywords (leak, flood, fire, emergency, urgent, broken, no heat, no water, no power, electrical, gas, danger, safety)
- Impact on habitability (heating/cooling failures, plumbing emergencies, electrical issues)
- Cosmetic vs functional issues

Return ONLY a JSON object with the following format:
{{
    ""priority"": ""low"" or ""medium"" or ""high"",
    ""reasoning"": ""<brief explanation of why this priority was chosen>"" 
}}

Choose the priority that best matches the urgency and impact of the maintenance request. Be specific and accurate.";

                // Call AI service
                var aiResponse = await _openAIService.GenerateJsonAsync<PrioritySelectionResponse>(prompt, maxTokens: 500);
                
                if (!aiResponse.Success || aiResponse.Data == null)
                {
                    _logger.LogWarning("AI failed to select priority: {Error}", aiResponse.Message);
                    return null;
                }

                var priorityString = aiResponse.Data.Priority?.ToLower();
                
                // Map string to enum
                EMaintenancePriority? selectedPriority = priorityString switch
                {
                    "low" => EMaintenancePriority.Low,
                    "medium" => EMaintenancePriority.Medium,
                    "high" => EMaintenancePriority.High,
                    _ => null
                };

                if (!selectedPriority.HasValue)
                {
                    _logger.LogWarning("AI selected invalid priority value: {Priority}, defaulting to Medium", priorityString);
                    return EMaintenancePriority.Medium;
                }

                _logger.LogInformation("AI selected priority {Priority} for maintenance request. Reasoning: {Reasoning}", 
                    selectedPriority.Value, aiResponse.Data.Reasoning);

                return selectedPriority.Value;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error using AI to choose maintenance priority");
                return null;
            }
        }

        private class PrioritySelectionResponse
        {
            public string Priority { get; set; } = string.Empty;
            public string Reasoning { get; set; } = string.Empty;
        }

        public async Task<ServiceResponse<LoadMaintenanceRequestDto>> AddMaintenanceRequest(AddMaintenanceRequestDto newRequest, List<IFormFile> files)
        {
            try
            {
                var createdByUserId = await GetCurrentUserIdAsync();
                if (!createdByUserId.HasValue)
                {
                    return ServiceResponse<LoadMaintenanceRequestDto>.CreateError("User not found", "User not authenticated", "", 401);
                }

                // Get organization ID from context
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadMaintenanceRequestDto>.CreateError(
                        "Organization context is required",
                        "Organization context is required to create maintenance requests.",
                        "",
                        403
                    );
                }

                // Validate User ID exists
                var property = await _propertyRepository.GetPropertyById(newRequest.PropertyId);
                if (property == null)
                    return ServiceResponse<LoadMaintenanceRequestDto>.CreateError("Invalid Property ID", "Issue getting property ID.");

                // Set OrganizationId on the request DTO
                newRequest.OrganizationId = organizationId.Value;

                // Generate title if not provided
                if (string.IsNullOrWhiteSpace(newRequest.Title))
                {
                    if (!string.IsNullOrWhiteSpace(newRequest.Description))
                    {
                        newRequest.Title = GenerateTitleFromDescription(newRequest.Description);
                    }
                    else
                    {
                        newRequest.Title = "Maintenance Request";
                    }
                }

                // Run category and priority AI calls in parallel — both are independent OpenAI round-trips
                var needsAIPriority = newRequest.Priority == EMaintenancePriority.Medium || newRequest.Priority == default(EMaintenancePriority);

                var categoryTask = ChooseCategoryWithAIAsync(newRequest.Title, newRequest.Description);
                var priorityTask = needsAIPriority
                    ? ChoosePriorityWithAIAsync(newRequest.Title, newRequest.Description)
                    : Task.FromResult<EMaintenancePriority?>(null);

                await Task.WhenAll(categoryTask, priorityTask);

                var aiSelectedCategoryId = await categoryTask;
                if (aiSelectedCategoryId.HasValue)
                {
                    newRequest.CategoryId = aiSelectedCategoryId.Value;
                    _logger.LogInformation("AI selected category ID {CategoryId} for maintenance request", aiSelectedCategoryId.Value);
                }
                else
                {
                    _logger.LogError("AI failed to select category for maintenance request. This should not happen.");
                    return ServiceResponse<LoadMaintenanceRequestDto>.CreateError(
                        "Category selection failed",
                        "Unable to automatically categorize the maintenance request. Please try again.",
                        "",
                        500
                    );
                }

                if (needsAIPriority)
                {
                    var aiSelectedPriority = await priorityTask;
                    if (aiSelectedPriority.HasValue)
                    {
                        newRequest.Priority = aiSelectedPriority.Value;
                        _logger.LogInformation("AI selected priority {Priority} for maintenance request", aiSelectedPriority.Value);
                    }
                    else
                    {
                        newRequest.Priority = EMaintenancePriority.Medium;
                        _logger.LogWarning("AI failed to select priority, using default Medium");
                    }
                }

                var addedRequest = await _maintenanceRequestRepository.AddMaintenanceRequest(newRequest);

                if (files != null && files.Count > 0)
                {
                    var imageResponse = await _imageService.AddImages(addedRequest.Id, files);
                    if (!imageResponse.Success)
                    {
                        return ServiceResponse<LoadMaintenanceRequestDto>.CreateError("Error uploading images", imageResponse.Message);
                    }
                    addedRequest.Images = imageResponse?.Data;
                }

                // Create notifications for new maintenance request — run concurrently
                try
                {
                    _logger.LogInformation("Creating notifications for maintenance request {RequestId}. CreatedByUserId: {CreatedByUserId}, LandlordId: {LandlordId}",
                        addedRequest.Id, createdByUserId, property.LandlordId);

                    User? user = null;
                    if (createdByUserId.HasValue)
                    {
                        user = await _userRepository.GetUser(createdByUserId.Value);
                    }

                    var performedByName = user != null ? $"{user.FirstName} {user.LastName}".Trim() : "System";
                    var notificationTasks = new List<Task>();

                    // Confirmation to the tenant who created the request (skip if landlord created it)
                    if (createdByUserId.HasValue && createdByUserId.Value != property.LandlordId)
                    {
                        _logger.LogInformation("Queuing notification for maintenance request creator: UserId {UserId}", createdByUserId.Value);

                        notificationTasks.Add(_notificationService.CreateNotification(new CreateNotificationDto
                        {
                            UserId = createdByUserId.Value,
                            OrganizationId = property.OrganizationId,
                            Type = ENotificationType.Maintenance,
                            Title = "Maintenance Request Created",
                            Message = $"Your maintenance request '{addedRequest.Title}' has been created for {addedRequest.PropertyName}",
                            RelatedId = addedRequest.Id,
                            SendEmail = true,
                            SendSMS = true,
                            PerformedByUserId = createdByUserId.Value,
                            PerformedByName = performedByName
                        }));
                    }

                    // Alert to the landlord (skip if landlord created it themselves)
                    if (!createdByUserId.HasValue || createdByUserId.Value != property.LandlordId)
                    {
                        _logger.LogInformation("Queuing notification for landlord: UserId {UserId}", property.LandlordId);

                        notificationTasks.Add(_notificationService.CreateNotification(new CreateNotificationDto
                        {
                            UserId = property.LandlordId,
                            OrganizationId = property.OrganizationId,
                            Type = ENotificationType.Maintenance,
                            Title = "New Maintenance Request",
                            Message = $"New maintenance request '{addedRequest.Title}' created for {addedRequest.PropertyName}",
                            RelatedId = addedRequest.Id,
                            SendEmail = true,
                            SendSMS = true,
                            PerformedByUserId = createdByUserId,
                            PerformedByName = performedByName
                        }));
                    }

                    await Task.WhenAll(notificationTasks);
                    _logger.LogInformation("All notifications sent for maintenance request {RequestId}", addedRequest.Id);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to create notification for maintenance request {RequestId}", addedRequest.Id);
                }

                // Return a successful response with the added request
                return new ServiceResponse<LoadMaintenanceRequestDto>
                {
                    Data = addedRequest,
                    Message = "Maintenance request added successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding maintenance request");
                return ServiceResponse<LoadMaintenanceRequestDto>.CreateError("Error adding maintenance request", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<LoadMaintenanceRequestDto>> AddMaintenanceRequestFromAgent(AddMaintenanceRequestDto dto)
        {
            try
            {
                var createdByUserId = await GetCurrentUserIdAsync();
                if (!createdByUserId.HasValue)
                    return ServiceResponse<LoadMaintenanceRequestDto>.CreateError("User not found", "User not authenticated", "", 401);

                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                    return ServiceResponse<LoadMaintenanceRequestDto>.CreateError("Organization context is required", "Organization context is required to create maintenance requests.", "", 403);

                var property = await _propertyRepository.GetPropertyById(dto.PropertyId);
                if (property == null)
                    return ServiceResponse<LoadMaintenanceRequestDto>.CreateError("Invalid Property ID", "Issue getting property ID.");

                dto.OrganizationId = organizationId.Value;

                if (string.IsNullOrWhiteSpace(dto.Title))
                    dto.Title = dto.Description.Length <= 60
                        ? dto.Description
                        : dto.Description[..57].Trim() + "...";

                var addedRequest = await _maintenanceRequestRepository.AddMaintenanceRequest(dto);

                // Notifications
                try
                {
                    var notificationTasks = new List<Task>();

                    if (createdByUserId.HasValue && createdByUserId.Value != property.LandlordId)
                    {
                        notificationTasks.Add(_notificationService.CreateNotification(new CreateNotificationDto
                        {
                            UserId = createdByUserId.Value,
                            OrganizationId = property.OrganizationId,
                            Type = ENotificationType.Maintenance,
                            Title = "Percy maintenance request created",
                            Message = $"Percy created your maintenance request '{addedRequest.Title}' for {addedRequest.PropertyName}",
                            RelatedId = addedRequest.Id,
                            SendEmail = true,
                            SendSMS = true,
                            PerformedByUserId = createdByUserId.Value,
                            PerformedByName = "Percy"
                        }));
                    }

                    if (!createdByUserId.HasValue || createdByUserId.Value != property.LandlordId)
                    {
                        notificationTasks.Add(_notificationService.CreateNotification(new CreateNotificationDto
                        {
                            UserId = property.LandlordId,
                            OrganizationId = property.OrganizationId,
                            Type = ENotificationType.Maintenance,
                            Title = "Percy maintenance request created",
                            Message = $"Percy created '{addedRequest.Title}' for {addedRequest.PropertyName}",
                            RelatedId = addedRequest.Id,
                            SendEmail = true,
                            SendSMS = true,
                            PerformedByUserId = createdByUserId,
                            PerformedByName = "Percy"
                        }));
                    }

                    await Task.WhenAll(notificationTasks);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to create notifications for agent-submitted maintenance request {RequestId}", addedRequest.Id);
                }

                return new ServiceResponse<LoadMaintenanceRequestDto>
                {
                    Data = addedRequest,
                    Message = "Maintenance request created successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding maintenance request from agent");
                return ServiceResponse<LoadMaintenanceRequestDto>.CreateError("Error adding maintenance request", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<LoadMaintenanceRequestDto>> UpdateMaintenanceRequest(long maintenanceRequestId, UpdateMaintenanceRequestDto updateMaintenanceRequestDto)
        {
            try
            {
                var request = await _maintenanceRequestRepository.GetMaintenanceRequestById(maintenanceRequestId);
                if (request == null)
                {
                    return ServiceResponse<LoadMaintenanceRequestDto>.CreateError("Request Not Found", $"No maintenance request was found with ID {maintenanceRequestId}.", "", 404);
                }

                var oldStatus = request.Status;
                var oldVendorId = request.VendorId;
                var updatedRequest = await _maintenanceRequestRepository.UpdateMaintenanceRequest(updateMaintenanceRequestDto);
                if (updatedRequest == null)
                {
                    return ServiceResponse<LoadMaintenanceRequestDto>.CreateError("Error Updating Request", "An error occurred while updating the maintenance request.");
                }

                // Send email to vendor if assigned or changed
                if (updatedRequest.VendorId.HasValue && updatedRequest.VendorId != oldVendorId)
                {
                    try
                    {
                        var vendor = await _vendorRepository.GetVendorById(updatedRequest.VendorId.Value);
                        if (vendor != null && !string.IsNullOrWhiteSpace(vendor.Email))
                        {
                            var property = await _propertyRepository.GetPropertyById(updatedRequest.PropertyId);
                            var propertyName = property?.Name ?? "Property";
                            var unitName = updatedRequest.UnitName ?? "Unit";

                            var subject = $"Maintenance Request Assigned - {updatedRequest.Title}";
                            var message = $"You have been assigned to a maintenance request:\n\n" +
                                        $"Title: {updatedRequest.Title}\n" +
                                        $"Property: {propertyName}\n" +
                                        $"Unit: {unitName}\n" +
                                        $"Priority: {updatedRequest.Priority}\n" +
                                        $"Status: {updatedRequest.Status}\n" +
                                        (!string.IsNullOrWhiteSpace(updatedRequest.Description) ? $"\nDescription:\n{updatedRequest.Description}\n" : "") +
                                        $"\nPlease contact the property manager if you have any questions.";

                            var (emailSubject, htmlBody, plainTextBody) = _emailTemplateService.FormatEmail(
                                ENotificationType.Maintenance,
                                subject,
                                message,
                                new Dictionary<string, string>
                                {
                                    { "PropertyName", propertyName },
                                    { "UnitName", unitName },
                                    { "Title", updatedRequest.Title },
                                    { "Priority", updatedRequest.Priority.ToString() ?? "N/A" },
                                    { "Status", updatedRequest.Status.ToString() ?? "N/A" },
                                    { "Description", updatedRequest.Description ?? "" }
                                }
                            );

                            var emailSent = await _emailService.SendEmailAsync(
                                vendor.Email,
                                emailSubject,
                                htmlBody,
                                plainTextBody
                            );

                            if (emailSent)
                            {
                                _logger.LogInformation("Vendor assignment email sent successfully to {VendorEmail} for maintenance request {RequestId}", vendor.Email, updatedRequest.Id);
                            }
                            else
                            {
                                _logger.LogWarning("Failed to send vendor assignment email to {VendorEmail} for maintenance request {RequestId}", vendor.Email, updatedRequest.Id);
                            }
                        }
                        else if (vendor != null && string.IsNullOrWhiteSpace(vendor.Email))
                        {
                            _logger.LogWarning("Vendor {VendorId} assigned to maintenance request {RequestId} but has no email address configured", vendor.Id, updatedRequest.Id);
                        }
                    }
                    catch (Exception vendorEx)
                    {
                        _logger.LogWarning(vendorEx, "Failed to send email to vendor for maintenance request {RequestId}", updatedRequest.Id);
                    }
                }

                // Create notification if status changed — notify tenants only, skip the updater
                if (oldStatus != updatedRequest.Status && updatedRequest.UnitId.HasValue)
                {
                    try
                    {
                        var updatedByUserId = await GetCurrentUserIdAsync();
                        var property = await _propertyRepository.GetPropertyById(updatedRequest.PropertyId);
                        if (property != null)
                        {
                            var statusMessage = updatedRequest.Status switch
                            {
                                EMaintenanceStatus.InProgress => "is now in progress",
                                EMaintenanceStatus.Resolved => "has been completed",
                                EMaintenanceStatus.Scheduled => "has been scheduled",
                                EMaintenanceStatus.Acknowledged => "has been acknowledged",
                                _ => "has been updated"
                            };

                            var unit = await _unitRepository.GetUnitById(updatedRequest.UnitId.Value);
                            var tenants = unit?.Lease?.Tenants ?? unit?.Tenants;
                            if (tenants != null)
                            {
                                foreach (var tenant in tenants.Where(t => t.UserId.HasValue && t.IsActive))
                                {
                                    if (tenant.UserId.Value == updatedByUserId)
                                        continue;

                                    var tenantNotificationDto = new CreateNotificationDto
                                    {
                                        UserId = tenant.UserId!.Value,
                                        OrganizationId = property.OrganizationId,
                                        Type = ENotificationType.Maintenance,
                                        Title = "Maintenance Request Updated",
                                        Message = $"Your maintenance request '{updatedRequest.Title}' {statusMessage}",
                                        RelatedId = updatedRequest.Id,
                                        SendEmail = true,
                                        SendSMS = true
                                    };

                                    await _notificationService.CreateNotification(tenantNotificationDto);
                                    _logger.LogInformation("Notification sent to tenant UserId {UserId} for maintenance request {RequestId}", tenant.UserId.Value, updatedRequest.Id);
                                }
                            }

                            // Create an activity record for the updater (landlord) — no email/SMS, just shows in their activity feed
                            if (updatedByUserId.HasValue)
                            {
                                var updater = await _userRepository.GetUser(updatedByUserId.Value);
                                var updaterName = updater != null
                                    ? $"{updater.FirstName} {updater.LastName}".Trim()
                                    : null;
                                if (string.IsNullOrEmpty(updaterName))
                                    updaterName = updater?.Email ?? "Unknown";

                                var landlordActivityDto = new CreateNotificationDto
                                {
                                    UserId = updatedByUserId.Value,
                                    OrganizationId = property.OrganizationId,
                                    Type = ENotificationType.Maintenance,
                                    Title = "Maintenance Request Updated",
                                    Message = $"Maintenance request '{updatedRequest.Title}' for {updatedRequest.PropertyName} {statusMessage}",
                                    RelatedId = updatedRequest.Id,
                                    PerformedByUserId = updatedByUserId.Value,
                                    PerformedByName = updaterName,
                                    SendEmail = false,
                                    SendSMS = false
                                };

                                await _notificationService.CreateNotification(landlordActivityDto);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to create notification for maintenance request update {RequestId}", maintenanceRequestId);
                    }
                }

                return new ServiceResponse<LoadMaintenanceRequestDto>
                {
                    Data = updatedRequest,
                    Message = "Maintenance request updated successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating maintenance request with ID {RequestId}", maintenanceRequestId);
                return ServiceResponse<LoadMaintenanceRequestDto>.CreateError("Error updating maintenance request", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadMaintenanceRequestDto>>> GetMaintenanceRequestsByUnitId(long unitId)
        {
            try
            {
                var requests = await _maintenanceRequestRepository.GetMaintenanceRequestsByUnitId(unitId);

                return new ServiceResponse<List<LoadMaintenanceRequestDto>>
                {
                    Data = requests,
                    Message = "Maintenance requests retrieved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving maintenance requests for unit ID {UnitId}", unitId);
                return ServiceResponse<List<LoadMaintenanceRequestDto>>.CreateError("Error retrieving maintenance requests", ex.Message);
            }
        }


        public async Task<ServiceResponse<LoadMaintenanceRequestDto>> GetMaintenanceRequestById(long requestId)
        {
            try
            {
                var request = await _maintenanceRequestRepository.GetMaintenanceRequestById(requestId);

                if (request == null)
                {
                    return ServiceResponse<LoadMaintenanceRequestDto>.CreateError(
                        "Request Not Found",
                        $"No maintenance request was found with ID {requestId}.",
                        "",
                        404
                    );
                }

                return new ServiceResponse<LoadMaintenanceRequestDto>
                {
                    Data = request,
                    Message = "Maintenance request retrieved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving maintenance request by ID: {RequestId}", requestId);
                return ServiceResponse<LoadMaintenanceRequestDto>.CreateError("Error retrieving maintenance request", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadMaintenanceRequestDto>>> GetMaintenanceRequestsByPropertyId(long propertyId)
        {
            try
            {
                var requests = await _maintenanceRequestRepository.GetMaintenanceRequestsByPropertyId(propertyId);

                return new ServiceResponse<List<LoadMaintenanceRequestDto>>
                {
                    Data = requests,
                    Message = "Maintenance requests retrieved successfully"
                };

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving maintenance requests for property ID {PropertyId}", propertyId);
                return ServiceResponse<List<LoadMaintenanceRequestDto>>.CreateError("Error retrieving maintenance requests", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadMaintenanceRequestDto>>> GetCurrentMaintenanceByPropertyId(long propertyId)
        {
            try
            {
                var requests = await _maintenanceRequestRepository.GetCurrentMaintenanceByPropertyId(propertyId);
                return new ServiceResponse<List<LoadMaintenanceRequestDto>>
                {
                    Data = requests,
                    Message = "Current maintenance requests retrieved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving current maintenance requests for unit ID {propertyId}", propertyId);
                return ServiceResponse<List<LoadMaintenanceRequestDto>>.CreateError("Error retrieving current maintenance requests", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadMaintenanceRequestDto>>> GetMaintenanceHistoryByPropertyId(long propertyId)
        {
            try
            {
                var requests = await _maintenanceRequestRepository.GetMaintenanceHistoryByPropertyId(propertyId);
                return new ServiceResponse<List<LoadMaintenanceRequestDto>>
                {
                    Data = requests,
                    Message = "Maintenance history retrieved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving maintenance history for unit ID {propertyId}", propertyId);
                return ServiceResponse<List<LoadMaintenanceRequestDto>>.CreateError("Error retrieving maintenance history", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadMaintenanceRequestDto>>> GetCurrentMaintenanceByLandlordId(long landlordId)
        {
            try
            {
                // Validate that the passed landlordId matches the authenticated user
                var currentUserId = await GetCurrentUserIdAsync();
                if (!currentUserId.HasValue)
                {
                    return ServiceResponse<List<LoadMaintenanceRequestDto>>.CreateError("User not found", "User not authenticated", "", 401);
                }

                if (currentUserId.Value != landlordId)
                {
                    return ServiceResponse<List<LoadMaintenanceRequestDto>>.CreateError("Unauthorized access", "You can only access your own maintenance requests", "", 403);
                }

                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<List<LoadMaintenanceRequestDto>>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                var requests = await _maintenanceRequestRepository.GetCurrentMaintenanceByOrganizationId(organizationId.Value);
                return new ServiceResponse<List<LoadMaintenanceRequestDto>>
                {
                    Data = requests,
                    Message = "Current maintenance requests for landlord retrieved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving current maintenance requests for landlord ID {landlordId}", landlordId);
                return ServiceResponse<List<LoadMaintenanceRequestDto>>.CreateError(
                    "Error retrieving current maintenance requests", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadMaintenanceRequestDto>>> GetMaintenanceHistoryByLandlordId(long landlordId)
        {
            try
            {
                // Validate that the passed landlordId matches the authenticated user
                var currentUserId = await GetCurrentUserIdAsync();
                if (!currentUserId.HasValue)
                {
                    return ServiceResponse<List<LoadMaintenanceRequestDto>>.CreateError("User not found", "User not authenticated", "", 401);
                }

                if (currentUserId.Value != landlordId)
                {
                    return ServiceResponse<List<LoadMaintenanceRequestDto>>.CreateError("Unauthorized access", "You can only access your own maintenance history", "", 403);
                }

                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<List<LoadMaintenanceRequestDto>>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                var requests = await _maintenanceRequestRepository.GetMaintenanceHistoryByOrganizationId(organizationId.Value);
                return new ServiceResponse<List<LoadMaintenanceRequestDto>>
                {
                    Data = requests,
                    Message = "Maintenance history for landlord retrieved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving maintenance history for landlord ID {landlordId}", landlordId);
                return ServiceResponse<List<LoadMaintenanceRequestDto>>.CreateError(
                    "Error retrieving maintenance history", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadMaintenanceRequestDto>>> GetCurrentMaintenanceByOrganizationId(long organizationId)
        {
            try
            {
                var requests = await _maintenanceRequestRepository.GetCurrentMaintenanceByOrganizationId(organizationId);
                return new ServiceResponse<List<LoadMaintenanceRequestDto>>
                {
                    Data = requests,
                    Message = "Current maintenance requests for organization retrieved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving current maintenance requests for organization ID {OrganizationId}", organizationId);
                return ServiceResponse<List<LoadMaintenanceRequestDto>>.CreateError(
                    "Error retrieving current maintenance requests", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadMaintenanceRequestDto>>> GetMaintenanceHistoryByOrganizationId(long organizationId)
        {
            try
            {
                var requests = await _maintenanceRequestRepository.GetMaintenanceHistoryByOrganizationId(organizationId);
                return new ServiceResponse<List<LoadMaintenanceRequestDto>>
                {
                    Data = requests,
                    Message = "Maintenance history for organization retrieved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving maintenance history for organization ID {OrganizationId}", organizationId);
                return ServiceResponse<List<LoadMaintenanceRequestDto>>.CreateError(
                    "Error retrieving maintenance history", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadMaintenanceRequestDto>>> GetCurrentMaintenanceByTenantUserId()
        {
            long? tenantUserId = null;
            try
            {
                tenantUserId = await GetCurrentUserIdAsync();
                if (!tenantUserId.HasValue)
                {
                    return ServiceResponse<List<LoadMaintenanceRequestDto>>.CreateError("User not found", "User not authenticated", "", 401);
                }

                var requests = await _maintenanceRequestRepository.GetCurrentMaintenanceByTenantUserId(tenantUserId.Value);
                return new ServiceResponse<List<LoadMaintenanceRequestDto>>
                {
                    Data = requests,
                    Message = "Current maintenance requests for tenant retrieved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving current maintenance requests for tenant user ID {TenantUserId}", tenantUserId ?? 0);
                return ServiceResponse<List<LoadMaintenanceRequestDto>>.CreateError(
                    "Error retrieving current maintenance requests", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadMaintenanceRequestDto>>> GetMaintenanceHistoryByTenantUserId()
        {
            long? tenantUserId = null;
            try
            {
                tenantUserId = await GetCurrentUserIdAsync();
                if (!tenantUserId.HasValue)
                {
                    return ServiceResponse<List<LoadMaintenanceRequestDto>>.CreateError("User not found", "User not authenticated", "", 401);
                }

                var requests = await _maintenanceRequestRepository.GetMaintenanceHistoryByTenantUserId(tenantUserId.Value);
                return new ServiceResponse<List<LoadMaintenanceRequestDto>>
                {
                    Data = requests,
                    Message = "Maintenance history for tenant retrieved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving maintenance history for tenant user ID {TenantUserId}", tenantUserId ?? 0);
                return ServiceResponse<List<LoadMaintenanceRequestDto>>.CreateError(
                    "Error retrieving maintenance history", ex.Message);
            }
        }


        public async Task<ServiceResponse<List<MaintenanceEventDto>>> GetMaintenanceEventsByRequestId(long maintenanceRequestId)
        {
            try
            {
                var events = await _maintenanceRequestRepository.GetMaintenanceEventsByRequestId(maintenanceRequestId);
                return new ServiceResponse<List<MaintenanceEventDto>>
                {
                    Data = events,
                    Message = "Maintenance events retrieved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving maintenance events for request ID {RequestId}", maintenanceRequestId);
                return ServiceResponse<List<MaintenanceEventDto>>.CreateError("Error retrieving maintenance events", ex.Message);
            }
        }


        public async Task<ServiceResponse<int>> GetPropertyOpenMaintenanceRequestsCount(long propertyId)
        {
            try
            {
                var count = await _maintenanceRequestRepository.GetPropertyOpenMaintenanceRequestsCount(propertyId);
                return new ServiceResponse<int>
                {
                    Data = count,
                    Message = "Maintenance request count retrieved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving maintenance request count for property ID {PropertyId}", propertyId);
                return ServiceResponse<int>.CreateError("Error retrieving maintenance request count", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> DeleteMaintenanceRequest(long maintenanceRequestId)
        {
            try
            {
                var request = await _maintenanceRequestRepository.GetMaintenanceRequestById(maintenanceRequestId);
                if (request == null)
                {
                    return ServiceResponse<bool>.CreateError("Request Not Found", $"No maintenance request was found with ID {maintenanceRequestId}.", "", 404);
                }

                // Delete the image from Azure Blob Storage
                foreach (var image in request.Images)
                {
                    var blobClient = _blobServiceClient.GetBlobContainerClient("maintenance-images").GetBlobClient(image.BlobName);
                    await blobClient.DeleteIfExistsAsync();
                }

                var deleted = await _maintenanceRequestRepository.DeleteMaintenanceRequest(maintenanceRequestId);
                if (!deleted)
                {
                    return ServiceResponse<bool>.CreateError("Error Deleting Request", "An error occurred while deleting the maintenance request.");
                }

                return new ServiceResponse<bool>
                {
                    Data = true,
                    Message = "Maintenance request deleted successfully"
                };

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting maintenance request with ID {RequestId}", maintenanceRequestId);
                return ServiceResponse<bool>.CreateError("Error deleting maintenance request", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadMaintenanceCategoryDto>>> GetMaintenanceCategories()
        {
            try
            {
                var categories = await _maintenanceRequestRepository.GetMaintenanceCategories();
                return new ServiceResponse<List<LoadMaintenanceCategoryDto>>
                {
                    Data = categories,
                    Message = "Maintenance categories retrieved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving maintenance categories");
                return ServiceResponse<List<LoadMaintenanceCategoryDto>>.CreateError("Error retrieving maintenance categories", ex.Message);
            }
        }

        private async Task<(long? CategoryId, string Reasoning)> ChooseCategoryWithAIAndReasoningAsync(string title, string description)
        {
            try
            {
                // Get available categories
                var categories = await _maintenanceRequestRepository.GetMaintenanceCategories();
                if (categories == null || !categories.Any())
                {
                    _logger.LogWarning("No maintenance categories available for AI selection");
                    return (null, string.Empty);
                }

                // Build category list for AI prompt
                var categoryList = string.Join(", ", categories.Select(c => $"{c.Value} (ID: {c.Id})"));
                
                // Create prompt for AI
                var prompt = $@"You are a maintenance request categorization assistant. Based on the maintenance request details below, choose the most appropriate category.

Available categories: {categoryList}

Maintenance Request Title: {title}
Maintenance Request Description: {description}

Analyze the request and determine which category best fits. Return ONLY a JSON object with the following format:
{{
    ""categoryId"": <the numeric ID of the chosen category>,
    ""reasoning"": ""<brief explanation of why this category was chosen>""
}}

Choose the category ID that best matches the maintenance request. Be specific and accurate.";

                // Call AI service
                var aiResponse = await _openAIService.GenerateJsonAsync<CategorySelectionResponse>(prompt, maxTokens: 500);
                
                if (!aiResponse.Success || aiResponse.Data == null)
                {
                    _logger.LogWarning("AI failed to select category: {Error}", aiResponse.Message);
                    return (null, string.Empty);
                }

                var selectedCategoryId = aiResponse.Data.CategoryId;
                
                // Validate that the selected category ID exists
                var categoryExists = categories.Any(c => c.Id == selectedCategoryId);
                if (!categoryExists)
                {
                    _logger.LogWarning("AI selected invalid category ID {CategoryId}, available IDs: {AvailableIds}", 
                        selectedCategoryId, string.Join(", ", categories.Select(c => c.Id)));
                    return (null, string.Empty);
                }

                _logger.LogInformation("AI selected category ID {CategoryId} for maintenance request. Reasoning: {Reasoning}", 
                    selectedCategoryId, aiResponse.Data.Reasoning);

                return (selectedCategoryId, aiResponse.Data.Reasoning ?? string.Empty);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error using AI to choose maintenance category");
                return (null, string.Empty);
            }
        }

        private async Task<(EMaintenancePriority? Priority, string Reasoning)> ChoosePriorityWithAIAndReasoningAsync(string title, string description)
        {
            try
            {
                // Create prompt for AI
                var prompt = $@"You are a maintenance request priority assessment assistant. Based on the maintenance request details below, determine the appropriate priority level.

Priority Levels:
- Low: Non-urgent issues that can be addressed when convenient (cosmetic issues, minor repairs, routine maintenance)
- Medium: Standard maintenance requests that need attention but are not emergencies
- High: Urgent issues requiring prompt attention (safety hazards, water leaks, no heat/water/power, electrical issues, structural damage, security issues)

Maintenance Request Title: {title}
Maintenance Request Description: {description}

Analyze the request and determine the priority level. Consider:
- Safety concerns (fire, gas leaks, structural damage, security issues)
- Urgency keywords (leak, flood, fire, emergency, urgent, broken, no heat, no water, no power, electrical, gas, danger, safety)
- Impact on habitability (heating/cooling failures, plumbing emergencies, electrical issues)
- Cosmetic vs functional issues

Return ONLY a JSON object with the following format:
{{
    ""priority"": ""low"" or ""medium"" or ""high"",
    ""reasoning"": ""<brief explanation of why this priority was chosen>"" 
}}

Choose the priority that best matches the urgency and impact of the maintenance request. Be specific and accurate.";

                // Call AI service
                var aiResponse = await _openAIService.GenerateJsonAsync<PrioritySelectionResponse>(prompt, maxTokens: 500);
                
                if (!aiResponse.Success || aiResponse.Data == null)
                {
                    _logger.LogWarning("AI failed to select priority: {Error}", aiResponse.Message);
                    return (null, string.Empty);
                }

                var priorityString = aiResponse.Data.Priority?.ToLower();
                
                // Map string to enum
                EMaintenancePriority? selectedPriority = priorityString switch
                {
                    "low" => EMaintenancePriority.Low,
                    "medium" => EMaintenancePriority.Medium,
                    "high" => EMaintenancePriority.High,
                    _ => null
                };

                if (!selectedPriority.HasValue)
                {
                    _logger.LogWarning("AI selected invalid priority value: {Priority}, defaulting to Medium", priorityString);
                    return (EMaintenancePriority.Medium, "Default priority due to AI analysis failure");
                }

                _logger.LogInformation("AI selected priority {Priority} for maintenance request. Reasoning: {Reasoning}", 
                    selectedPriority.Value, aiResponse.Data.Reasoning);

                return (selectedPriority.Value, aiResponse.Data.Reasoning ?? string.Empty);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error using AI to choose maintenance priority");
                return (null, string.Empty);
            }
        }

        public async Task<ServiceResponse<MaintenanceAnalysisResult>> AnalyzeMaintenanceRequest(string title, string description)
        {
            try
            {
                // Generate title with AI if not provided
                string finalTitle;
                if (string.IsNullOrWhiteSpace(title) && !string.IsNullOrWhiteSpace(description))
                {
                    finalTitle = await GenerateTitleWithAIAsync(description);
                }
                else if (!string.IsNullOrWhiteSpace(title))
                {
                    finalTitle = title;
                }
                else
                {
                    finalTitle = "Maintenance Request";
                }

                // Get category using AI with reasoning (use generated title and description)
                var (categoryId, categoryReasoning) = await ChooseCategoryWithAIAndReasoningAsync(finalTitle, description);
                if (!categoryId.HasValue)
                {
                    return ServiceResponse<MaintenanceAnalysisResult>.CreateError(
                        "Category analysis failed",
                        "Unable to analyze and categorize the maintenance request. Please try again.",
                        "",
                        500
                    );
                }

                // Get category name
                var categories = await _maintenanceRequestRepository.GetMaintenanceCategories();
                var category = categories?.FirstOrDefault(c => c.Id == categoryId.Value);
                var categoryName = category?.Value ?? "Unknown";

                // Get priority using AI with reasoning (use generated title and description)
                var (priority, priorityReasoning) = await ChoosePriorityWithAIAndReasoningAsync(finalTitle, description);
                if (!priority.HasValue)
                {
                    priority = EMaintenancePriority.Medium; // Default fallback
                    priorityReasoning = "Default priority due to AI analysis failure";
                }

                var result = new MaintenanceAnalysisResult
                {
                    Title = finalTitle,
                    CategoryId = categoryId.Value,
                    CategoryName = categoryName,
                    Priority = priority.Value.ToString(),
                    CategoryReasoning = categoryReasoning,
                    PriorityReasoning = priorityReasoning
                };

                return new ServiceResponse<MaintenanceAnalysisResult>
                {
                    Data = result,
                    Message = "Maintenance request analyzed successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error analyzing maintenance request");
                return ServiceResponse<MaintenanceAnalysisResult>.CreateError("Error analyzing maintenance request", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadMaintenanceRequestDto>>> ReopenMaintenance(long requestId)
        {
            try
            {
                var requests = await _maintenanceRequestRepository.ReopenMaintenance(requestId);
                return new ServiceResponse<List<LoadMaintenanceRequestDto>>
                {
                    Data = requests,
                    Message = "Maintenance requests reopened successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reopening maintenance requests");
                return ServiceResponse<List<LoadMaintenanceRequestDto>>.CreateError("Error reopening maintenance requests", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadMaintenanceRequestDto>> ResolveMaintenance(long requestId)
        {
            try
            {
                var request = await _maintenanceRequestRepository.ResolveMaintenance(requestId);

                // Create notification for resolved maintenance
                try
                {
                    var property = await _propertyRepository.GetPropertyById(request.PropertyId);
                    if (property != null)
                    {
                        // Notify landlord
                        var landlordNotificationDto = new CreateNotificationDto
                        {
                            UserId = property.LandlordId,
                            OrganizationId = property.OrganizationId, // Set organization ID for filtering
                            Type = ENotificationType.Maintenance,
                            Title = "Maintenance Request Completed",
                            Message = $"Maintenance request '{request.Title}' for {request.PropertyName} has been completed",
                            RelatedId = request.Id,
                            SendEmail = true,
                            SendSMS = true
                        };

                        await _notificationService.CreateNotification(landlordNotificationDto);

                        // Notify tenant(s) associated with the unit
                        if (request.UnitId.HasValue)
                        {
                            try
                            {
                                // Get unit with lease and tenants
                                var unit = await _unitRepository.GetUnitById(request.UnitId.Value);
                                // Check both Lease.Tenants and direct Tenants (in case tenants are associated directly with unit)
                                var tenants = unit?.Lease?.Tenants ?? unit?.Tenants;
                                if (tenants != null)
                                {
                                    // Get all tenants with user accounts (UserId is not null)
                                    var tenantsWithAccounts = tenants
                                        .Where(t => t.UserId.HasValue && t.IsActive)
                                        .ToList();

                                    foreach (var tenant in tenantsWithAccounts)
                                    {
                                        if (tenant.UserId.HasValue)
                                        {
                                            var tenantNotificationDto = new CreateNotificationDto
                                            {
                                                UserId = tenant.UserId.Value,
                                                OrganizationId = property.OrganizationId, // Set organization ID for filtering (may be null for tenants)
                                                Type = ENotificationType.Maintenance,
                                                Title = "Maintenance Request Completed",
                                                Message = $"Your maintenance request '{request.Title}' has been completed",
                                                RelatedId = request.Id,
                                                SendEmail = true,
                                                SendSMS = true
                                            };

                                            await _notificationService.CreateNotification(tenantNotificationDto);
                                            _logger.LogInformation("Notification sent to tenant UserId {UserId} for resolved maintenance request {RequestId}", tenant.UserId.Value, request.Id);
                                        }
                                    }
                                }
                            }
                            catch (Exception tenantEx)
                            {
                                _logger.LogWarning(tenantEx, "Failed to send notification to tenant(s) for resolved maintenance request {RequestId}", requestId);
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to create notification for resolved maintenance {RequestId}", requestId);
                }

                return new ServiceResponse<LoadMaintenanceRequestDto>
                {
                    Data = request,
                    Message = "Maintenance request resolved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resolving maintenance request with ID {RequestId}", requestId);
                return ServiceResponse<LoadMaintenanceRequestDto>.CreateError("Error resolving maintenance request", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<LoadMaintenanceRequestDto>> AssignMaintenanceRequest(long maintenanceRequestId, AssignMaintenanceRequestDto dto)
        {
            try
            {
                var currentUser = await _userRepository.GetCurrentUser();
                if (currentUser == null)
                    return ServiceResponse<LoadMaintenanceRequestDto>.CreateError("Unauthorized", "User not found", null, 401);

                var result = await _maintenanceRequestRepository.AssignMaintenanceRequest(maintenanceRequestId, dto, currentUser.Id);
                if (result == null)
                    return ServiceResponse<LoadMaintenanceRequestDto>.CreateError("Not found", $"Maintenance request {maintenanceRequestId} not found", null, 404);

                return new ServiceResponse<LoadMaintenanceRequestDto>
                {
                    Data = result,
                    Message = "Maintenance request assigned successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error assigning maintenance request {RequestId}", maintenanceRequestId);
                return ServiceResponse<LoadMaintenanceRequestDto>.CreateError("Error assigning maintenance request", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<GenerateTenantMessageResultDto>> GenerateTenantMessage(long maintenanceRequestId)
        {
            try
            {
                var request = await _maintenanceRequestRepository.GetMaintenanceRequestById(maintenanceRequestId);
                if (request == null)
                    return ServiceResponse<GenerateTenantMessageResultDto>.CreateError("Not found", $"Maintenance request {maintenanceRequestId} not found", null, 404);

                var prompt = $@"You are helping a landlord communicate with their tenant about a maintenance request.

Maintenance Request: {request.Title}
Description: {request.Description}
Status: {request.Status}
Priority: {request.Priority}
Property: {request.PropertyName}
Unit: {request.UnitName}

Write a short, friendly message from the landlord to the tenant acknowledging their maintenance request.
- 2-3 sentences max
- Confirm you received it
- Give a realistic sense of next steps based on priority (High = addressing urgently, Medium/Low = will schedule)
- Do not make up specific dates or contractor names
- Warm but professional tone

Return ONLY a JSON object:
{{
    ""message"": ""<the message text>""
}}";

                var aiResponse = await _openAIService.GenerateJsonAsync<TenantMessageResponse>(prompt, maxTokens: 300);

                string messageText;
                if (!aiResponse.Success || aiResponse.Data == null || string.IsNullOrWhiteSpace(aiResponse.Data.Message))
                {
                    messageText = $"Hi, I wanted to let you know that I've received your maintenance request regarding \"{request.Title}\". I'll be looking into it and will follow up with you shortly.";
                }
                else
                {
                    messageText = aiResponse.Data.Message.Trim();
                }

                return new ServiceResponse<GenerateTenantMessageResultDto>
                {
                    Data = new GenerateTenantMessageResultDto { Message = messageText },
                    Message = "Message generated successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating tenant message for request {RequestId}", maintenanceRequestId);
                return ServiceResponse<GenerateTenantMessageResultDto>.CreateError("Error generating message", ex.Message, ex.InnerException?.Message);
            }
        }

        private class TenantMessageResponse
        {
            public string Message { get; set; } = string.Empty;
        }
    }
}