using brownstone_hub_api.Dtos.AICopilot;
using brownstone_hub_api.Dtos.ActionSuppression;
using brownstone_hub_api.Dtos.Conversation;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.Message;
using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Dtos.Tenant;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.Payments;
using brownstone_hub_api.Repositories.Tenants;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.ActionSuppressionService;
using brownstone_hub_api.Services.ConversationService;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Services.MessageService;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Services.OpenAIService;
using brownstone_hub_api.Utils;
using brownstone_hub_api.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.AIFollowUpService
{
    public class AIFollowUpService(
        IOpenAIService openAIService,
        IConversationService conversationService,
        IMessageService messageService,
        IEmailService emailService,
        INotificationService notificationService,
        IActionSuppressionService suppressionService,
        ILeaseRepository leaseRepository,
        IPaymentRepository paymentRepository,
        ITenantRepository tenantRepository,
        IUserRepository userRepository,
        IHttpContextAccessor httpContextAccessor,
        DataContext dataContext,
        ILogger<AIFollowUpService> logger) : IAIFollowUpService
    {
        private readonly IOpenAIService _openAIService = openAIService;
        private readonly IConversationService _conversationService = conversationService;
        private readonly IMessageService _messageService = messageService;
        private readonly IEmailService _emailService = emailService;
        private readonly INotificationService _notificationService = notificationService;
        private readonly IActionSuppressionService _suppressionService = suppressionService;
        private readonly ILeaseRepository _leaseRepository = leaseRepository;
        private readonly IPaymentRepository _paymentRepository = paymentRepository;
        private readonly ITenantRepository _tenantRepository = tenantRepository;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly DataContext _dataContext = dataContext;
        private readonly ILogger<AIFollowUpService> _logger = logger;

        private long? GetOrganizationIdFromContext()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }

        private async Task<long?> GetCurrentUserIdAsync()
        {
            var user = await _userRepository.GetCurrentUser();
            return user?.Id;
        }

        public async Task<ServiceResponse<object>> SendAIFollowUpAsync(SendAIFollowUpDto request, long landlordId)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<object>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                // Get context based on action type
                var context = await GetContextForActionType(request.ActionType, request.EntityId, organizationId.Value);
                if (context == null)
                {
                    return ServiceResponse<object>.CreateError("Invalid context", "Could not retrieve context for the action", "", 404);
                }

                string conversationMessage;
                string emailMessage;
                int suppressionDays;

                var hasOverrides = !string.IsNullOrEmpty(request.InAppMessageOverride)
                    && !string.IsNullOrEmpty(request.EmailBodyOverride);

                if (hasOverrides)
                {
                    // User reviewed and edited the content — use it directly, skip AI generation
                    conversationMessage = request.InAppMessageOverride!;
                    emailMessage = request.EmailBodyOverride!;
                    suppressionDays = 7; // default when skipping AI suppression calc
                }
                else
                {
                    // Generate two separate messages: one for conversation (conversational) and one for email (formal)
                    var conversationMessagePrompt = BuildConversationMessagePrompt(request.ActionType, context);
                    var emailMessagePrompt = BuildEmailMessagePrompt(request.ActionType, context);

                    var conversationMessageResponse = await _openAIService.GenerateTextAsync(conversationMessagePrompt, maxTokens: 500);
                    var emailMessageResponse = await _openAIService.GenerateTextAsync(emailMessagePrompt, maxTokens: 500);

                    if (!conversationMessageResponse.Success || string.IsNullOrEmpty(conversationMessageResponse.Data))
                    {
                        return ServiceResponse<object>.CreateError("Failed to generate conversation message", conversationMessageResponse.Message ?? "AI service error", "", 500);
                    }

                    if (!emailMessageResponse.Success || string.IsNullOrEmpty(emailMessageResponse.Data))
                    {
                        return ServiceResponse<object>.CreateError("Failed to generate email message", emailMessageResponse.Message ?? "AI service error", "", 500);
                    }

                    conversationMessage = conversationMessageResponse.Data;
                    emailMessage = emailMessageResponse.Data;

                    // Calculate suppression duration using AI
                    var suppressionPrompt = BuildSuppressionDurationPrompt(request.ActionType, context);
                    var suppressionResponse = await _openAIService.GenerateTextAsync(suppressionPrompt, maxTokens: 50);
                    suppressionDays = ParseSuppressionDays(suppressionResponse.Data ?? "7");
                }

                // Get tenant information for conversation and email
                var tenantInfo = await GetTenantInfoForAction(request.ActionType, request.EntityId);
                if (tenantInfo == null || string.IsNullOrEmpty(tenantInfo.Email))
                {
                    return ServiceResponse<object>.CreateError("Tenant not found", "Could not find tenant email for this action", "", 404);
                }

                // Get landlord information for email signature
                var landlord = await _userRepository.GetUser(landlordId);
                if (landlord == null)
                {
                    return ServiceResponse<object>.CreateError("Landlord not found", "Could not find landlord information", "", 404);
                }

                // Create or get conversation
                var conversation = await GetOrCreateConversation(request.ActionType, request.EntityId, landlordId, tenantInfo, organizationId.Value);
                if (conversation == null)
                {
                    return ServiceResponse<object>.CreateError("Failed to create conversation", "Could not create or retrieve conversation", "", 500);
                }

                // Add conversational message to conversation (for tenant portal)
                var messageDto = new AddMessageDto
                {
                    ConversationId = conversation.Id,
                    Content = conversationMessage
                };
                var messageResult = await _messageService.AddMessage(messageDto);
                if (!messageResult.Success)
                {
                    _logger.LogError("Failed to add message to conversation {ConversationId}", conversation.Id);
                }

                // Send formal email notification
                var emailSubject = !string.IsNullOrEmpty(request.EmailSubjectOverride)
                    ? request.EmailSubjectOverride
                    : GetEmailSubject(request.ActionType, context);
                var emailSent = await _emailService.SendEmailAsync(
                    tenantInfo.Email,
                    emailSubject,
                    BuildEmailHtml(emailMessage, context, tenantInfo.Name, landlord),
                    emailMessage
                );

                if (!emailSent)
                {
                    _logger.LogWarning("Failed to send email to {Email} for follow-up", tenantInfo.Email);
                }

                // Create notification (only if tenant has a user account)
                if (tenantInfo.UserId.HasValue)
                {
                    try
                    {
                        var notificationDto = new CreateNotificationDto
                        {
                            UserId = tenantInfo.UserId.Value,
                            OrganizationId = organizationId,
                            Type = ENotificationType.Message,
                            Title = GetNotificationTitle(request.ActionType, context, emailSubject),
                            Message = GetNotificationMessage(request.ActionType, context, conversationMessage),
                            RelatedId = conversation.Id,
                            SendEmail = false, // Already sent email above
                            SendSMS = false,
                            PerformedByUserId = landlordId
                        };
                        await _notificationService.CreateNotification(notificationDto);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to create notification for follow-up");
                    }
                }

                // Notify the landlord that the AI follow-up actually went out.
                // This is especially important on mobile, where landlords rely on notifications for tenant messages and Percy activity.
                try
                {
                    var landlordNotificationDto = new CreateNotificationDto
                    {
                        UserId = landlordId,
                        OrganizationId = organizationId,
                        Type = request.ActionType?.Contains("Rent", StringComparison.OrdinalIgnoreCase) == true
                            ? ENotificationType.Rent
                            : ENotificationType.Message,
                        Title = "Percy AI follow-up sent",
                        Message = BuildPercyFollowUpNotificationMessage(request.ActionType, context, tenantInfo.Name),
                        RelatedId = conversation.Id,
                        SendEmail = false,
                        SendSMS = false,
                        PerformedByUserId = landlordId,
                        PerformedByName = "Percy"
                    };
                    await _notificationService.CreateNotification(landlordNotificationDto);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to create landlord notification for AI follow-up");
                }

                // Create suppression record
                var suppressionDto = new AddActionSuppressionDto
                {
                    ActionType = request.ActionType,
                    EntityId = request.EntityId,
                    SuppressedUntil = DateTime.UtcNow.AddDays(suppressionDays),
                    Reason = $"AI follow-up sent. Suppressed for {suppressionDays} days."
                };
                await _suppressionService.CreateSuppression(suppressionDto, organizationId.Value, landlordId);

                await RecordCollectionsFollowUpHistoryAsync(
                    request.ActionType,
                    request.EntityId,
                    organizationId.Value,
                    tenantInfo,
                    conversation.Id,
                    messageResult.Data?.Id,
                    conversationMessage,
                    emailSubject,
                    emailMessage,
                    emailSent,
                    suppressionDays,
                    isManual: true);

                return ServiceResponse<object>.CreateSuccess(new { 
                    conversationId = conversation.Id,
                    messageId = messageResult.Data?.Id,
                    suppressionDays 
                }, "AI follow-up sent successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending AI follow-up for action {ActionType} on entity {EntityId}", request.ActionType, request.EntityId);
                return ServiceResponse<object>.CreateError("Error sending follow-up", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<AIFollowUpPreviewDto>> PreviewAIFollowUpAsync(SendAIFollowUpDto request)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                    return ServiceResponse<AIFollowUpPreviewDto>.CreateError("Organization ID is required", "No organization context found", "", 400);

                var context = await GetContextForActionType(request.ActionType, request.EntityId, organizationId.Value);
                if (context == null)
                    return ServiceResponse<AIFollowUpPreviewDto>.CreateError("Invalid context", "Could not retrieve context for the action", "", 404);

                var conversationPrompt = BuildConversationMessagePrompt(request.ActionType, context);
                var emailPrompt = BuildEmailMessagePrompt(request.ActionType, context);

                var conversationTask = _openAIService.GenerateTextAsync(conversationPrompt, maxTokens: 500);
                var emailTask = _openAIService.GenerateTextAsync(emailPrompt, maxTokens: 500);
                await Task.WhenAll(conversationTask, emailTask);

                var conversationResponse = conversationTask.Result;
                var emailResponse = emailTask.Result;

                if (!conversationResponse.Success || string.IsNullOrEmpty(conversationResponse.Data))
                    return ServiceResponse<AIFollowUpPreviewDto>.CreateError("Failed to generate preview", conversationResponse.Message ?? "AI service error", "", 500);

                if (!emailResponse.Success || string.IsNullOrEmpty(emailResponse.Data))
                    return ServiceResponse<AIFollowUpPreviewDto>.CreateError("Failed to generate preview", emailResponse.Message ?? "AI service error", "", 500);

                return ServiceResponse<AIFollowUpPreviewDto>.CreateSuccess(new AIFollowUpPreviewDto
                {
                    InAppMessage = conversationResponse.Data,
                    EmailSubject = GetEmailSubject(request.ActionType, context),
                    EmailBody = emailResponse.Data
                }, "Preview generated successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating AI follow-up preview for {ActionType}", request.ActionType);
                return ServiceResponse<AIFollowUpPreviewDto>.CreateError("Error generating preview", ex.Message, ex.InnerException?.Message);
            }
        }

        private async Task<Dictionary<string, object>?> GetContextForActionType(string actionType, long entityId, long organizationId)
        {
            try
            {
                switch (actionType)
                {
                    case "sendAIFollowUp_OverdueRent":
                    case "CollectionsAgent_Overdue":
                    case "CollectionsAgent_PreDue":
                        var lease = await _leaseRepository.GetLeaseById(entityId, organizationId);
                        if (lease == null) return null;
                        if (lease.LeaseAgreement?.IsDrafted == true) return null; // Draft leases do not count towards overdue

                        var payments = await _paymentRepository.GetRentPaymentsByLeaseId(entityId);
                        var overdueAmount = RentCalculator.CalculateOverdueForLease(lease, payments);
                        var status = RentCalculator.GetStatus(lease, payments);
                        
                        // Calculate days overdue
                        var today = DateTime.Today;
                        var lastDueDate = CalculateLastDueDate(lease, today);
                        var daysOverdue = (today - lastDueDate).Days;

                        // Determine if property is multi-unit
                        var isMultiUnit = string.Equals(lease.PropertyType, "MultiUnit", StringComparison.OrdinalIgnoreCase);

                        return new Dictionary<string, object>
                        {
                            { "leaseId", lease.Id },
                            { "propertyName", lease.PropertyName },
                            { "unitName", lease.UnitName },
                            { "isMultiUnit", isMultiUnit },
                            { "tenantNames", string.Join(", ", lease.Tenants.Select(t => $"{t.Firstname} {t.Lastname}")) },
                            { "overdueAmount", overdueAmount },
                            { "daysOverdue", daysOverdue },
                            { "rentAmount", lease.RentAmount },
                            { "rentDueDay", lease.RentDueDay },
                            { "rentDueDate", lastDueDate }
                        };

                    case "sendAIFollowUp_TenantAccount":
                        var tenant = await _tenantRepository.GetTenantById(entityId);
                        if (tenant == null) return null;

                        // Determine if property is multi-unit
                        var tenantIsMultiUnit = !string.IsNullOrEmpty(tenant.PropertyType) && 
                                                string.Equals(tenant.PropertyType, "MultiUnit", StringComparison.OrdinalIgnoreCase);

                        return new Dictionary<string, object>
                        {
                            { "tenantId", tenant.Id },
                            { "tenantName", $"{tenant.Firstname} {tenant.Lastname}" },
                            { "propertyName", tenant.PropertyName ?? "Unknown Property" },
                            { "unitName", tenant.UnitName },
                            { "isMultiUnit", tenantIsMultiUnit }
                        };

                    case "sendAIFollowUp_LeaseSigning":
                        var leaseForSigning = await _leaseRepository.GetLeaseById(entityId, organizationId);
                        if (leaseForSigning == null) return null;

                        // Determine if property is multi-unit
                        var leaseSigningIsMultiUnit = string.Equals(leaseForSigning.PropertyType, "MultiUnit", StringComparison.OrdinalIgnoreCase);

                        return new Dictionary<string, object>
                        {
                            { "leaseId", leaseForSigning.Id },
                            { "propertyName", leaseForSigning.PropertyName },
                            { "unitName", leaseForSigning.UnitName },
                            { "isMultiUnit", leaseSigningIsMultiUnit },
                            { "tenantNames", string.Join(", ", leaseForSigning.Tenants.Select(t => $"{t.Firstname} {t.Lastname}")) },
                            { "startDate", leaseForSigning.StartDate },
                            { "endDate", leaseForSigning.EndDate },
                            { "rentAmount", leaseForSigning.RentAmount }
                        };

                    case "sendAIFollowUp_Deposit":
                        var leaseForDeposit = await _leaseRepository.GetLeaseById(entityId, organizationId);
                        if (leaseForDeposit == null) return null;

                        // Get total deposits received (not refunded) for this lease
                        var totalDepositsReceived = await _dataContext.Deposits
                            .Where(d => d.LeaseId == entityId && d.OrganizationId == organizationId && d.RefundedDate == null)
                            .SumAsync(d => (decimal?)d.Amount) ?? 0m;

                        var depositOwed = leaseForDeposit.DepositAmount - totalDepositsReceived;

                        // Determine if property is multi-unit
                        var depositIsMultiUnit = string.Equals(leaseForDeposit.PropertyType, "MultiUnit", StringComparison.OrdinalIgnoreCase);

                        return new Dictionary<string, object>
                        {
                            { "leaseId", leaseForDeposit.Id },
                            { "propertyName", leaseForDeposit.PropertyName },
                            { "unitName", leaseForDeposit.UnitName },
                            { "isMultiUnit", depositIsMultiUnit },
                            { "tenantNames", string.Join(", ", leaseForDeposit.Tenants.Select(t => $"{t.Firstname} {t.Lastname}")) },
                            { "depositAmount", leaseForDeposit.DepositAmount },
                            { "depositOwed", depositOwed },
                            { "depositPaid", totalDepositsReceived }
                        };

                    default:
                        return null;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting context for action {ActionType} on entity {EntityId}", actionType, entityId);
                return null;
            }
        }

        private DateTime CalculateLastDueDate(LoadLeaseDto lease, DateTime today)
        {
            if (!lease.StartDate.HasValue || !lease.RentDueDay.HasValue)
                return today;
            
            var firstDueDate = new DateTime(lease.StartDate.Value.Year, lease.StartDate.Value.Month, lease.RentDueDay.Value);
            if (firstDueDate < lease.StartDate.Value)
            {
                firstDueDate = firstDueDate.AddMonths(1);
            }

            var lastDueDate = firstDueDate;
            while (lastDueDate.AddMonths(1) <= today)
            {
                lastDueDate = lastDueDate.AddMonths(1);
            }

            return lastDueDate;
        }

        private string FormatPropertyReference(Dictionary<string, object> context)
        {
            var propertyName = context["propertyName"]?.ToString() ?? "the property";
            var isMultiUnit = context.ContainsKey("isMultiUnit") && context["isMultiUnit"] is bool multiUnit && multiUnit;
            
            if (isMultiUnit && context.ContainsKey("unitName") && !string.IsNullOrEmpty(context["unitName"]?.ToString()))
            {
                return $"{propertyName} - {context["unitName"]}";
            }
            
            return propertyName;
        }

        private static bool IsOverdueRentAction(string actionType)
            => actionType is "sendAIFollowUp_OverdueRent" or "CollectionsAgent_Overdue";

        private string GetNotificationTitle(string actionType, Dictionary<string, object>? context, string fallbackTitle)
        {
            return IsOverdueRentAction(actionType) && context != null
                ? "Rent overdue"
                : fallbackTitle;
        }

        private string GetNotificationMessage(string actionType, Dictionary<string, object>? context, string fallbackMessage)
        {
            if (!IsOverdueRentAction(actionType) || context == null)
            {
                return fallbackMessage;
            }

            return BuildRentOverdueNotificationMessage(context);
        }

        private string BuildRentOverdueNotificationMessage(Dictionary<string, object> context)
        {
            var dueDate = GetRentDueDate(context);
            var dueDateText = dueDate.HasValue
                ? dueDate.Value.ToString("MMMM d, yyyy")
                : $"the {context.GetValueOrDefault("rentDueDay", "rent due date")} of the month";
            var daysOverdue = Convert.ToInt32(context.GetValueOrDefault("daysOverdue", 0));
            var dayText = daysOverdue == 1 ? "1 day" : $"{daysOverdue} days";

            return $"Rent was due on {dueDateText} and is {dayText} past due.";
        }

        private static DateTime? GetRentDueDate(Dictionary<string, object> context)
        {
            if (!context.TryGetValue("rentDueDate", out var rawDueDate) || rawDueDate == null)
            {
                return null;
            }

            return rawDueDate switch
            {
                DateTime dueDate => dueDate,
                DateTimeOffset dueDateOffset => dueDateOffset.Date,
                string dueDateText when DateTime.TryParse(dueDateText, out var parsedDueDate) => parsedDueDate,
                _ => null
            };
        }

        private string BuildOverdueRentMessageDetailInstructions(Dictionary<string, object> context)
        {
            var propertyRef = FormatPropertyReference(context);
            var dueDate = GetRentDueDate(context);
            var dueDateText = dueDate.HasValue
                ? dueDate.Value.ToString("MMMM d, yyyy")
                : $"the {context["rentDueDay"]} of the month";

            return $"The tenant at {propertyRef} has an overdue rent payment of ${context["overdueAmount"]:F2}. " +
                $"Rent was due on {dueDateText}, which is {context["daysOverdue"]} days past due. " +
                $"The monthly rent is ${context["rentAmount"]:F2}. ";
        }

        private string BuildConversationMessagePrompt(string actionType, Dictionary<string, object> context)
        {
            var basePrompt = "You are a landlord sending a direct message to a tenant through a messaging system. Write a conversational, friendly message as if you're texting or chatting with them directly. Be personable and approachable, not overly formal. ";
            
            switch (actionType)
            {
                case "sendAIFollowUp_OverdueRent":
                    return $"{basePrompt}" +
                        BuildOverdueRentMessageDetailInstructions(context) +
                        $"Write a friendly, conversational direct message that includes the overdue amount, rent due date, and how many days past due it is. " +
                        $"Make the message more detailed than a notification, since the tenant portal notification will only be a short alert. " +
                        $"Be understanding but clear, and ask them to reach out if they need to discuss payment options, autopay, or a structured payment plan. " +
                        $"Keep it concise (3-4 sentences).";

                case "sendAIFollowUp_TenantAccount":
                    var propertyRef2 = FormatPropertyReference(context);
                    return $"{basePrompt}" +
                        $"The tenant {context["tenantName"]} at {propertyRef2} has not yet created their account. " +
                        $"Write a friendly, conversational message encouraging them to create their account so they can access their tenant portal, view their lease, make payments, and communicate with you. " +
                        $"Keep it brief (2-3 sentences) and friendly.";

                case "sendAIFollowUp_LeaseSigning":
                    var propertyRef3 = FormatPropertyReference(context);
                    return $"{basePrompt}" +
                        $"The lease for {propertyRef3} starting on {context["startDate"]:MM/dd/yyyy} " +
                        $"has not been signed yet by the tenant(s): {context["tenantNames"]}. " +
                        $"The monthly rent is ${context["rentAmount"]:F2}. " +
                        $"Write a friendly, conversational message reminding them to sign the lease. " +
                        $"Keep it brief (2-3 sentences).";

                case "sendAIFollowUp_Deposit":
                    var propertyRef4 = FormatPropertyReference(context);
                    return $"{basePrompt}" +
                        $"The tenant(s) {context["tenantNames"]} at {propertyRef4} " +
                        $"still owe ${context["depositOwed"]:F2} of the ${context["depositAmount"]:F2} security deposit. " +
                        $"They have paid ${context["depositPaid"]:F2} so far. " +
                        $"Write a friendly, conversational message reminding them about the outstanding deposit. " +
                        $"Keep it brief (2-3 sentences) and ask them to reach out to discuss payment options.";

                default:
                    return basePrompt + "Write a friendly, conversational follow-up message.";
            }
        }

        private string BuildEmailMessagePrompt(string actionType, Dictionary<string, object> context)
        {
            var basePrompt = "You are a professional property management assistant. Write a formal email message to a tenant. Use proper email format with greeting, body, and closing. ";
            
            switch (actionType)
            {
                case "sendAIFollowUp_OverdueRent":
                    var emailPropertyRef1 = FormatPropertyReference(context);
                    return $"{basePrompt}" +
                        BuildOverdueRentMessageDetailInstructions(context) +
                        $"The property is {emailPropertyRef1}. " +
                        $"Start with 'Dear [Tenant's Name],' then write 3-5 professional sentences that include the overdue amount, rent due date, and how many days past due it is. " +
                        $"End with 'Best regards,' followed by '[Your Name]' and '[Your Contact Information]'. " +
                        $"Make it professional but friendly. Include a clear call to action asking them to contact you at their earliest convenience to discuss and resolve this matter.";

                case "sendAIFollowUp_TenantAccount":
                    var emailPropertyRef2 = FormatPropertyReference(context);
                    return $"{basePrompt}" +
                        $"The tenant {context["tenantName"]} at {emailPropertyRef2} has not yet created their account. " +
                        $"Start with 'Dear [Tenant's Name],' then write 2-3 professional sentences encouraging them to create their account. " +
                        $"End with 'Best regards,' followed by '[Your Name]' and '[Your Contact Information]'.";

                case "sendAIFollowUp_LeaseSigning":
                    var emailPropertyRef3 = FormatPropertyReference(context);
                    return $"{basePrompt}" +
                        $"The lease for {emailPropertyRef3} starting on {context["startDate"]:MM/dd/yyyy} " +
                        $"has not been signed yet by the tenant(s): {context["tenantNames"]}. " +
                        $"The monthly rent is ${context["rentAmount"]:F2}. " +
                        $"Start with 'Dear [Tenant's Name],' then write 2-3 professional sentences reminding them to sign. " +
                        $"End with 'Best regards,' followed by '[Your Name]' and '[Your Contact Information]'.";

                case "sendAIFollowUp_Deposit":
                    var emailPropertyRef4 = FormatPropertyReference(context);
                    return $"{basePrompt}" +
                        $"The tenant(s) {context["tenantNames"]} at {emailPropertyRef4} " +
                        $"still owe ${context["depositOwed"]:F2} of the ${context["depositAmount"]:F2} security deposit. " +
                        $"They have paid ${context["depositPaid"]:F2} so far. " +
                        $"Start with 'Dear [Tenant's Name],' then write 2-3 professional sentences about the outstanding deposit. " +
                        $"End with 'Best regards,' followed by '[Your Name]' and '[Your Contact Information]'. " +
                        $"Make it professional but friendly. Include a clear call to action asking them to contact you to discuss payment options.";

                default:
                    return basePrompt + "Write a formal email follow-up message with proper greeting and closing.";
            }
        }

        private string BuildSuppressionDurationPrompt(string actionType, Dictionary<string, object> context)
        {
            var urgency = DetermineUrgency(actionType, context);
            
            return $"Based on the following situation, determine how many days to wait before sending another follow-up message. " +
                $"Action type: {actionType}. " +
                $"Urgency level: {urgency}. " +
                $"Context: {string.Join(", ", context.Select(kvp => $"{kvp.Key}={kvp.Value}"))}. " +
                $"Respond with ONLY a number (e.g., 3, 7, 14) representing the number of days. " +
                $"Higher urgency = shorter suppression (3-5 days), Medium urgency = medium suppression (7-10 days), Low urgency = longer suppression (14+ days).";
        }

        private string DetermineUrgency(string actionType, Dictionary<string, object> context)
        {
            switch (actionType)
            {
                case "sendAIFollowUp_OverdueRent":
                    var daysOverdue = Convert.ToInt32(context.GetValueOrDefault("daysOverdue", 0));
                    var amount = Convert.ToDecimal(context.GetValueOrDefault("overdueAmount", 0m));
                    if (daysOverdue > 14 || amount > 2000) return "High";
                    if (daysOverdue > 7 || amount > 1000) return "Medium";
                    return "Low";

                case "sendAIFollowUp_LeaseSigning":
                    return "Medium"; // Lease signing is important but not urgent

                case "sendAIFollowUp_TenantAccount":
                    return "Low"; // Account creation is less urgent

                case "sendAIFollowUp_Deposit":
                    return "Medium"; // Deposit payment is important but not as urgent as rent

                default:
                    return "Medium";
            }
        }

        private int ParseSuppressionDays(string response)
        {
            // Extract number from AI response
            var match = System.Text.RegularExpressions.Regex.Match(response, @"\d+");
            if (match.Success && int.TryParse(match.Value, out var days))
            {
                // Clamp between 1 and 30 days
                return Math.Max(1, Math.Min(30, days));
            }
            return 7; // Default to 7 days
        }

        private async Task<TenantInfo?> GetTenantInfoForAction(string actionType, long entityId)
        {
            try
            {
                switch (actionType)
                {
                    case "sendAIFollowUp_OverdueRent":
                    case "CollectionsAgent_Overdue":
                    case "CollectionsAgent_PreDue":
                    case "sendAIFollowUp_LeaseSigning":
                    case "sendAIFollowUp_Deposit":
                        var organizationIdForTenantInfo = GetOrganizationIdFromContext();
                        if (!organizationIdForTenantInfo.HasValue) return null;
                        var lease = await _leaseRepository.GetLeaseById(entityId, organizationIdForTenantInfo.Value);
                        if (lease == null || !lease.Tenants.Any()) return null;
                        
                        var firstTenant = lease.Tenants.First();
                        return new TenantInfo
                        {
                            TenantId = firstTenant.Id,
                            Email = firstTenant.Email,
                            UserId = firstTenant.UserId,
                            Name = $"{firstTenant.Firstname} {firstTenant.Lastname}"
                        };

                    case "sendAIFollowUp_TenantAccount":
                        var tenant = await _tenantRepository.GetTenantById(entityId);
                        if (tenant == null) return null;
                        
                        return new TenantInfo
                        {
                            TenantId = tenant.Id,
                            Email = tenant.Email,
                            UserId = tenant.UserId,
                            Name = $"{tenant.Firstname} {tenant.Lastname}"
                        };

                    default:
                        return null;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting tenant info for action {ActionType} on entity {EntityId}", actionType, entityId);
                return null;
            }
        }

        private async Task<LoadConversationDto?> GetOrCreateConversation(string actionType, long entityId, long landlordId, TenantInfo tenantInfo, long organizationId)
        {
            try
            {
                // Try to find existing conversation
                var conversations = await _conversationService.GetConversationsByLandlordId(landlordId, includeArchived: false);
                if (conversations.Success && conversations.Data != null)
                {
                    var existing = conversations.Data.FirstOrDefault(c => 
                        c.TenantId == tenantInfo.TenantId && 
                        !c.IsArchived);
                    
                    if (existing != null)
                    {
                        return existing;
                    }
                }

                // Create new conversation
                var conversationDto = new AddConversationDto
                {
                    Title = GetConversationTitle(actionType, tenantInfo),
                    Description = "AI-generated follow-up message",
                    IsGroupChat = false,
                    ParticipantUserIds = tenantInfo.UserId.HasValue ? [tenantInfo.UserId.Value] : [],
                    TenantId = tenantInfo.TenantId
                };

                // Set related entity based on action type
                switch (actionType)
                {
                    case "sendAIFollowUp_OverdueRent":
                    case "CollectionsAgent_Overdue":
                    case "CollectionsAgent_PreDue":
                    case "sendAIFollowUp_LeaseSigning":
                    case "sendAIFollowUp_Deposit":
                        conversationDto.LeaseId = entityId;
                        break;
                    case "sendAIFollowUp_TenantAccount":
                        conversationDto.TenantId = entityId;
                        break;
                }

                var result = await _conversationService.AddConversation(conversationDto, landlordId);
                return result.Success ? result.Data : null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting or creating conversation for tenant {TenantId}", tenantInfo.TenantId);
                return null;
            }
        }

        private string GetConversationTitle(string actionType, TenantInfo tenantInfo)
        {
            return actionType switch
            {
                "sendAIFollowUp_OverdueRent" => $"Rent Payment Reminder - {tenantInfo.Name}",
                "CollectionsAgent_Overdue" => $"Rent Payment Reminder - {tenantInfo.Name}",
                "sendAIFollowUp_TenantAccount" => $"Account Creation Reminder - {tenantInfo.Name}",
                "sendAIFollowUp_LeaseSigning" => $"Lease Signing Reminder - {tenantInfo.Name}",
                "sendAIFollowUp_Deposit" => $"Deposit Payment Reminder - {tenantInfo.Name}",
                _ => $"Follow-up - {tenantInfo.Name}"
            };
        }

        private string GetEmailSubject(string actionType, Dictionary<string, object> context)
        {
            return actionType switch
            {
                "sendAIFollowUp_OverdueRent" => $"Friendly Reminder: Overdue Rent Payment for {FormatPropertyReference(context)}",
                "CollectionsAgent_Overdue" => $"Friendly Reminder: Overdue Rent Payment for {FormatPropertyReference(context)}",
                "sendAIFollowUp_TenantAccount" => $"Create Your Tenant Account - {context["propertyName"]}",
                "sendAIFollowUp_LeaseSigning" => $"Lease Signing Reminder - {context["propertyName"]}",
                "sendAIFollowUp_Deposit" => $"Security Deposit Reminder for {FormatPropertyReference(context)}",
                _ => "Message from Your Landlord"
            };
        }

        private string BuildEmailHtml(string message, Dictionary<string, object> context, string tenantName, User landlord)
        {
            // Build landlord name
            var landlordName = $"{landlord.FirstName} {landlord.LastName}".Trim();
            if (string.IsNullOrEmpty(landlordName))
            {
                landlordName = landlord.Email ?? "Your Landlord";
            }

            // Build landlord contact information
            var contactInfoParts = new List<string>();
            if (!string.IsNullOrEmpty(landlord.Email))
            {
                contactInfoParts.Add(landlord.Email);
            }
            if (!string.IsNullOrEmpty(landlord.PhoneNumber))
            {
                contactInfoParts.Add(landlord.PhoneNumber);
            }
            var contactInfo = contactInfoParts.Count > 0 
                ? string.Join(" | ", contactInfoParts)
                : "Please contact us through your tenant portal or reply to this email.";

            // Replace placeholders in the message
            var formattedMessage = message
                .Replace("[Tenant's Name]", tenantName)
                .Replace("[Your Name]", landlordName)
                .Replace("[Your Contact Information]", contactInfo);
            
            return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #1976d2; color: white; padding: 20px; text-align: center; }}
        .content {{ background-color: #f9f9f9; padding: 20px; margin-top: 20px; }}
        .footer {{ margin-top: 20px; padding: 10px; text-align: center; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class='container'>
        <div class='header'>
            <h1>Property Peace</h1>
        </div>
        <div class='content'>
            <p>{formattedMessage.Replace("\n", "<br>")}</p>
        </div>
        <div class='footer'>
            <p>This is an automated notification from Property Peace.</p>
            <p>You can manage your notification preferences in your account settings.</p>
        </div>
    </div>
</body>
</html>";
        }

        public async Task<ServiceResponse<object>> SendWithMessagesAsync(
            string actionType,
            long entityId,
            string inAppMessage,
            string emailMessage,
            int suppressionDays,
            long landlordId,
            long organizationId,
            long? tenantId = null,
            bool isManual = false)
        {
            try
            {
                var tenantInfo = await GetTenantInfoForActionInternal(actionType, entityId, organizationId, tenantId);
                if (tenantInfo == null || string.IsNullOrEmpty(tenantInfo.Email))
                    return ServiceResponse<object>.CreateError("Tenant not found", "Could not find tenant for this action", "", 404);

                var landlord = await _userRepository.GetUser(landlordId);
                if (landlord == null)
                    return ServiceResponse<object>.CreateError("Landlord not found", "Could not find landlord information", "", 404);

                var context = await GetContextForActionType(actionType, entityId, organizationId);
                var emailSubject = context != null
                    ? GetEmailSubject(actionType, context)
                    : "Message from Your Landlord";

                var conversation = await GetOrCreateConversation(actionType, entityId, landlordId, tenantInfo, organizationId);
                if (conversation == null)
                    return ServiceResponse<object>.CreateError("Failed to create conversation", "Could not create or retrieve conversation", "", 500);

                var messageDto = new AddMessageDto { ConversationId = conversation.Id, Content = inAppMessage };
                var messageResult = await _messageService.AddMessage(messageDto);
                if (!messageResult.Success)
                    _logger.LogError("Failed to add message to conversation {ConversationId}", conversation.Id);

                var emailHtml = context != null
                    ? BuildEmailHtml(emailMessage, context, tenantInfo.Name, landlord)
                    : emailMessage;

                var emailSent = await _emailService.SendEmailAsync(tenantInfo.Email, emailSubject, emailHtml, emailMessage);
                if (!emailSent)
                    _logger.LogWarning("Failed to send email to {Email} for agent follow-up", tenantInfo.Email);

                if (tenantInfo.UserId.HasValue)
                {
                    try
                    {
                        await _notificationService.CreateNotification(new CreateNotificationDto
                        {
                            UserId = tenantInfo.UserId.Value,
                            OrganizationId = organizationId,
                            Type = ENotificationType.Message,
                            Title = GetNotificationTitle(actionType, context, emailSubject),
                            Message = GetNotificationMessage(actionType, context, inAppMessage),
                            RelatedId = conversation.Id,
                            SendEmail = false,
                            SendSMS = false,
                            PerformedByUserId = landlordId
                        });
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to create notification for agent follow-up");
                    }
                }

                try
                {
                    await _notificationService.CreateNotification(new CreateNotificationDto
                    {
                        UserId = landlordId,
                        OrganizationId = organizationId,
                        Type = actionType.Contains("Rent", StringComparison.OrdinalIgnoreCase) || actionType.Contains("CollectionsAgent", StringComparison.OrdinalIgnoreCase)
                            ? ENotificationType.Rent
                            : ENotificationType.Message,
                        Title = "Percy AI follow-up sent",
                        Message = BuildPercyFollowUpNotificationMessage(actionType, context, tenantInfo.Name),
                        RelatedId = conversation.Id,
                        SendEmail = false,
                        SendSMS = false,
                        PerformedByUserId = landlordId,
                        PerformedByName = "Percy"
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to create landlord notification for agent follow-up");
                }

                await _suppressionService.CreateSuppression(new AddActionSuppressionDto
                {
                    ActionType = actionType,
                    EntityId = entityId,
                    SuppressedUntil = DateTime.UtcNow.AddDays(suppressionDays),
                    Reason = $"AI agent follow-up sent. Suppressed for {suppressionDays} days."
                }, organizationId, landlordId);

                await RecordCollectionsFollowUpHistoryAsync(
                    actionType,
                    entityId,
                    organizationId,
                    tenantInfo,
                    conversation.Id,
                    messageResult.Data?.Id,
                    inAppMessage,
                    emailSubject,
                    emailMessage,
                    emailSent,
                    suppressionDays,
                    isManual);

                return ServiceResponse<object>.CreateSuccess(new
                {
                    conversationId = conversation.Id,
                    messageId = messageResult.Data?.Id,
                    suppressionDays
                }, "AI agent follow-up sent successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in SendWithMessagesAsync for action {ActionType} on entity {EntityId}", actionType, entityId);
                return ServiceResponse<object>.CreateError("Error sending follow-up", ex.Message, ex.InnerException?.Message);
            }
        }

        private static string GetFriendlyActionName(string? actionType)
        {
            return actionType switch
            {
                "CollectionsAgent_Overdue" => "overdue rent",
                "CollectionsAgent_PreDue" => "upcoming rent",
                "sendAIFollowUp_OverdueRent" => "overdue rent",
                "sendAIFollowUp_LeaseSigning" => "lease signing",
                "sendAIFollowUp_Deposit" => "deposit payment",
                "sendAIFollowUp_TenantAccount" => "tenant account setup",
                _ => "a tenant follow-up"
            };
        }

        private static string BuildPercyFollowUpNotificationMessage(string? actionType, Dictionary<string, object>? context, string tenantName)
        {
            var actionName = GetFriendlyActionName(actionType);
            var propertyName = context != null && context.TryGetValue("propertyName", out var propertyNameValue)
                ? propertyNameValue?.ToString()
                : null;

            var propertyClause = !string.IsNullOrWhiteSpace(propertyName)
                && !string.Equals(propertyName, "Unknown Property", StringComparison.OrdinalIgnoreCase)
                    ? $" on {propertyName}"
                    : string.Empty;

            return $"Percy followed up with {tenantName} about {actionName}{propertyClause}.";
        }

        private static bool IsCollectionsFollowUpType(string? actionType)
        {
            return actionType == "CollectionsAgent_Overdue"
                || actionType == "CollectionsAgent_PreDue"
                || actionType == "sendAIFollowUp_OverdueRent";
        }

        private async Task RecordCollectionsFollowUpHistoryAsync(
            string actionType,
            long leaseId,
            long organizationId,
            TenantInfo tenantInfo,
            long conversationId,
            long? messageId,
            string inAppMessage,
            string emailSubject,
            string emailMessage,
            bool emailSent,
            int suppressionDays,
            bool isManual)
        {
            if (!IsCollectionsFollowUpType(actionType))
                return;

            try
            {
                var leaseSnapshot = await _dataContext.Leases
                    .Where(l => l.Id == leaseId && l.OrganizationId == organizationId)
                    .Select(l => new
                    {
                        PropertyName = l.Unit.Property.Name,
                        UnitName = (string?)l.Unit.Name
                    })
                    .FirstOrDefaultAsync();

                var followUpLabel = actionType == "CollectionsAgent_PreDue"
                    ? "Pre-due reminder"
                    : "Overdue follow-up";

                var propertyDisplay = leaseSnapshot == null
                    ? $"Lease #{leaseId}"
                    : string.Join("", [leaseSnapshot.PropertyName, !string.IsNullOrWhiteSpace(leaseSnapshot.UnitName) ? $", {leaseSnapshot.UnitName}" : ""]);

                _dataContext.CollectionsAgentActions.Add(new CollectionsAgentAction
                {
                    OrganizationId = organizationId,
                    LeaseId = leaseId,
                    TenantId = tenantInfo.TenantId,
                    TenantNameSnapshot = tenantInfo.Name,
                    PropertyNameSnapshot = leaseSnapshot?.PropertyName ?? string.Empty,
                    UnitNameSnapshot = leaseSnapshot?.UnitName ?? string.Empty,
                    ActionType = "sent",
                    FollowUpType = actionType,
                    Message = $"{followUpLabel} sent · {tenantInfo.Name} · {propertyDisplay}",
                    InAppMessage = inAppMessage,
                    EmailSubject = emailSubject,
                    EmailMessage = emailMessage,
                    ConversationId = conversationId,
                    MessageId = messageId,
                    EmailSent = emailSent,
                    SuppressionDays = suppressionDays,
                    CreatedAt = DateTime.UtcNow,
                    IsManual = isManual
                });

                await _dataContext.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to persist Collections Agent history for action {ActionType}, lease {LeaseId}, message {MessageId}", actionType, leaseId, messageId);
            }
        }

        // Internal helper that accepts an explicit organizationId (used by agent which has no HTTP context)
        private async Task<TenantInfo?> GetTenantInfoForActionInternal(string actionType, long entityId, long organizationId, long? tenantId = null)
        {
            try
            {
                switch (actionType)
                {
                    case "sendAIFollowUp_OverdueRent":
                    case "CollectionsAgent_Overdue":
                    case "CollectionsAgent_PreDue":
                    case "sendAIFollowUp_LeaseSigning":
                    case "sendAIFollowUp_Deposit":
                        var lease = await _leaseRepository.GetLeaseById(entityId, organizationId);
                        if (lease == null || !lease.Tenants.Any()) return null;
                        var firstTenant = tenantId.HasValue
                            ? lease.Tenants.FirstOrDefault(t => t.Id == tenantId.Value)
                            : lease.Tenants.First();
                        if (firstTenant == null) return null;
                        return new TenantInfo
                        {
                            TenantId = firstTenant.Id,
                            Email = firstTenant.Email,
                            UserId = firstTenant.UserId,
                            Name = $"{firstTenant.Firstname} {firstTenant.Lastname}"
                        };

                    case "sendAIFollowUp_TenantAccount":
                        var tenant = await _tenantRepository.GetTenantById(entityId);
                        if (tenant == null) return null;
                        return new TenantInfo
                        {
                            TenantId = tenant.Id,
                            Email = tenant.Email,
                            UserId = tenant.UserId,
                            Name = $"{tenant.Firstname} {tenant.Lastname}"
                        };

                    default:
                        return null;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting tenant info for action {ActionType} on entity {EntityId}", actionType, entityId);
                return null;
            }
        }

        private class TenantInfo
        {
            public long TenantId { get; set; }
            public string? Email { get; set; }
            public long? UserId { get; set; }
            public string Name { get; set; } = string.Empty;
        }
    }
}
