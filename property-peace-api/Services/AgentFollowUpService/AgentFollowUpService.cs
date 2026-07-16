using System.Text.Json;
using System.Text.Json.Nodes;
using Anthropic.SDK;
using Anthropic.SDK.Common;
using Anthropic.SDK.Messaging;
using brownstone_hub_api.Config;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.AgentFollowUp;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.Payments;
using brownstone_hub_api.Services.ActionSuppressionService;
using brownstone_hub_api.Services.AIFollowUpService;
using brownstone_hub_api.Utils;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using AnthropicMessage = Anthropic.SDK.Messaging.Message;

namespace brownstone_hub_api.Services.AgentFollowUpService
{
    public class AgentFollowUpService(
        ILeaseRepository leaseRepository,
        IPaymentRepository paymentRepository,
        IActionSuppressionService suppressionService,
        IAIFollowUpService aiFollowUpService,
        DataContext dataContext,
        IOptions<AnthropicSettings> anthropicSettings,
        ILogger<AgentFollowUpService> logger) : IAgentFollowUpService
    {
        private readonly ILeaseRepository _leaseRepository = leaseRepository;
        private readonly IPaymentRepository _paymentRepository = paymentRepository;
        private readonly IActionSuppressionService _suppressionService = suppressionService;
        private readonly IAIFollowUpService _aiFollowUpService = aiFollowUpService;
        private readonly DataContext _dataContext = dataContext;
        private readonly AnthropicSettings _settings = anthropicSettings.Value;
        private readonly ILogger<AgentFollowUpService> _logger = logger;

        public async Task<CollectionsSweepResultDto> RunOverdueRentSweepAsync(CancellationToken cancellationToken = default)
        {
            _logger.LogInformation("Collections Agent sweep started at {Time}", DateTime.UtcNow);

            var totals = new SweepAccumulator();

            var orgEntries = await _dataContext.Organizations
                .Where(o => o.OwnerId != null)
                .Where(o => _dataContext.Set<Lease>()
                    .Any(l => l.OrganizationId == o.Id && l.IsActive == true &&
                              !_dataContext.Set<Models.LeaseAgreement>().Any(la => la.LeaseId == l.Id && la.IsDrafted == true)))
                .Select(o => new { o.Id, o.OwnerId })
                .ToListAsync(cancellationToken);

            _logger.LogInformation("Found {Count} organizations with active leases to process", orgEntries.Count);

            foreach (var org in orgEntries)
            {
                if (cancellationToken.IsCancellationRequested) break;

                try
                {
                    var orgResult = await RunAgentForOrganizationAsync(org.Id, org.OwnerId!.Value, cancellationToken);
                    totals.Merge(orgResult);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Collections Agent sweep failed for organization {OrgId}", org.Id);
                }
            }

            _logger.LogInformation("Collections Agent sweep completed at {Time}", DateTime.UtcNow);

            return new CollectionsSweepResultDto
            {
                LeasesReviewed = totals.LeasesReviewed,
                MessagesSent = totals.MessagesSent,
                Suppressed = totals.Suppressed,
                FlaggedForReview = totals.FlaggedForReview,
                LateFeeRecommendations = totals.LateFeeRecommendations,
                ActionLog = totals.ActionLog,
                ActionLogEntries = totals.ActionLogEntries,
                SuppressedLeases = totals.SuppressedLeases
            };
        }

        public async Task<int> ForceFollowUpForLeaseAsync(long leaseId, IEnumerable<long>? tenantIds = null, CancellationToken cancellationToken = default)
        {
            var lease = await _leaseRepository.GetLeaseByIdForAdminAsync(leaseId);
            if (lease == null || lease.OrganizationId == null)
            {
                _logger.LogWarning("ForceFollowUp: lease {LeaseId} not found or missing org", leaseId);
                return 0;
            }

            var org = await _dataContext.Organizations
                .Where(o => o.Id == lease.OrganizationId)
                .Select(o => new { o.Id, o.OwnerId })
                .FirstOrDefaultAsync(cancellationToken);

            if (org?.OwnerId == null)
            {
                _logger.LogWarning("ForceFollowUp: no org/owner found for lease {LeaseId}", leaseId);
                return 0;
            }

            var requestedTenantIds = tenantIds?.Distinct().ToHashSet();
            var selectedTenants = lease.Tenants
                .Where(t => requestedTenantIds == null || requestedTenantIds.Count == 0 || requestedTenantIds.Contains(t.Id))
                .Where(t => !string.IsNullOrWhiteSpace(t.Email))
                .ToList();

            if (selectedTenants.Count == 0)
            {
                _logger.LogWarning("ForceFollowUp: no selected tenants with email found for lease {LeaseId}", leaseId);
                return 0;
            }

            var payments = await _paymentRepository.GetRentPaymentsByLeaseId(leaseId);
            var overdueAmount = RentCalculator.CalculateOverdueForLease(lease, payments);
            var status = RentCalculator.GetStatus(lease, payments);
            var today = DateTime.Today;
            var nextDueDate = lease.StartDate.HasValue && lease.EndDate.HasValue
                ? RentCalculator.CalculateNextDueDate(lease.StartDate.Value, lease.EndDate.Value, lease.RentDueDay)
                : (DateTime?)null;
            var rentDueDate = lease.StartDate.HasValue && lease.RentDueDay.HasValue
                ? CalculateLastRentDueDate(lease.StartDate.Value, lease.RentDueDay.Value, today)
                : nextDueDate;
            var daysOverdue = overdueAmount > 0 && rentDueDate.HasValue ? Math.Max(0, (today - rentDueDate.Value).Days) : 0;

            var sixMonthsAgo = today.AddMonths(-6);
            var recentPayments = payments
                .Where(p => p.PaymentDate >= sixMonthsAgo)
                .OrderByDescending(p => p.PaymentDate)
                .Take(8)
                .Select(p => new { date = p.PaymentDate.ToString("yyyy-MM-dd"), amount = p.Amount })
                .ToList();

            var client = new AnthropicClient(_settings.ApiKey);
            var systemPrompt = """
                You are the Collections Agent for a property management platform. The landlord manually selected
                specific tenants who should receive rent follow-ups for their unit/property.

                Reason about the lease status, balance, payment history, tenant name, property, and unit. Write a
                separate personalized follow-up for exactly the selected tenant provided in the user message.

                Rules:
                - Address the tenant by their own first name. Do not address multiple tenants as a group.
                - Mention the property/unit naturally when useful.
                - If rent is overdue, be warm, clear, and empathetic; mention the overdue balance, the rent due date, and how many days past due it is.
                - The in-app message should carry the useful reminder details because the portal notification will only be a short alert.
                - If the balance is not overdue but rent is upcoming/due, send a light reminder rather than an overdue notice.
                - Never threaten legal action, eviction, or use intimidating language.
                - Do not say you are an AI or mention internal data fields.
                - Return ONLY a JSON object with two keys:
                  "in_app_message": a friendly 2-3 sentence in-app message for this tenant
                  "email_message": a professional 3-5 sentence email body with greeting and closing, personalized to this tenant
                """;

            var sentCount = 0;
            foreach (var tenant in selectedTenants)
            {
                if (cancellationToken.IsCancellationRequested) break;

                var tenantName = $"{tenant.Firstname} {tenant.Lastname}".Trim();
                var fallbackRequest = new FollowUpMessageRequest(
                    lease.Id,
                    tenant.Id,
                    tenantName,
                    tenant.Firstname ?? string.Empty,
                    tenant.Email ?? string.Empty,
                    lease.PropertyName,
                    lease.UnitName,
                    overdueAmount > 0 ? "CollectionsAgent_Overdue" : "CollectionsAgent_PreDue",
                    3,
                    lease.RentAmount,
                    overdueAmount,
                    daysOverdue,
                    nextDueDate.HasValue ? (nextDueDate.Value - today).Days : 0,
                    nextDueDate?.ToString("yyyy-MM-dd") ?? string.Empty,
                    rentDueDate?.ToString("yyyy-MM-dd") ?? string.Empty,
                    false,
                    recentPayments.FirstOrDefault()?.date,
                    0,
                    0);
                var fallback = CreateFallbackFollowUpMessage(fallbackRequest);
                var inApp = fallback.InAppMessage;
                var email = fallback.EmailMessage;

                var userMsg = JsonSerializer.Serialize(new
                {
                    selected_tenant = new { tenant_id = tenant.Id, name = tenantName, first_name = tenant.Firstname, email = tenant.Email },
                    property = lease.PropertyName,
                    unit = lease.UnitName,
                    lease_id = lease.Id,
                    rent_amount = lease.RentAmount,
                    rent_due_day = lease.RentDueDay,
                    rent_status = status.ToString(),
                    overdue_amount = overdueAmount,
                    days_overdue = daysOverdue,
                    next_due_date = nextDueDate?.ToString("yyyy-MM-dd"),
                    rent_due_date = rentDueDate?.ToString("yyyy-MM-dd"),
                    recent_payments = recentPayments,
                    landlord_instruction = "Send a collection-agent follow-up only to this selected tenant for this unit/property. Make the email personal to this tenant."
                });

                var parameters = new MessageParameters
                {
                    Model = _settings.FastModel,
                    MaxTokens = 700,
                    Messages = [new AnthropicMessage(RoleType.User, userMsg)],
                    System = [new SystemMessage(systemPrompt)],
                    Temperature = 1.0m,
                    Stream = false
                };

                try
                {
                    var response = await client.Messages.GetClaudeMessageAsync(parameters, cancellationToken);
                    var raw = response.Content.OfType<TextContent>().FirstOrDefault()?.Text ?? "{}";
                    var jsonText = ExtractJsonObject(raw);
                    var json = jsonText != null ? JsonNode.Parse(jsonText) : JsonNode.Parse(raw);
                    inApp = GetJsonString(json, "in_app_message") ?? fallback.InAppMessage;
                    email = GetJsonString(json, "email_message") ?? fallback.EmailMessage;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "ForceFollowUp: using detailed deterministic fallback for lease {LeaseId}, tenant {TenantId}", leaseId, tenant.Id);
                }

                var result = await _aiFollowUpService.SendWithMessagesAsync(
                    "CollectionsAgent_Overdue", leaseId, inApp, email, 3, org.OwnerId.Value, org.Id, tenant.Id, isManual: true);

                _logger.LogInformation(
                    "ForceFollowUp for lease {LeaseId}, tenant {TenantId}: {Result}",
                    leaseId, tenant.Id, result.Success ? "sent" : result.Message);

                if (result.Success)
                {
                    sentCount++;
                }
            }

            if (sentCount > 0)
                await _dataContext.SaveChangesAsync(cancellationToken);

            return sentCount;
        }

        private async Task<SweepAccumulator> RunAgentForOrganizationAsync(long orgId, long landlordId, CancellationToken cancellationToken)
        {
            _logger.LogInformation("Running deterministic Collections Agent sweep for organization {OrgId}, landlord {LandlordId}", orgId, landlordId);
            var acc = new SweepAccumulator();

            var suppressions = await _suppressionService.GetActiveSuppressionsByOrganization(orgId);
            foreach (var s in suppressions)
                acc.SuppressionSet.Add((s.ActionType, s.EntityId));

            var leases = await _leaseRepository.GetLeasesByOrganizationId(orgId);
            var active = leases.Where(l => l.LeaseAgreement?.IsDrafted != true).ToList();
            acc.LeasesReviewed += active.Count;

            if (active.Count == 0)
                return acc;

            var leaseIds = active.Select(l => l.Id).ToList();
            var paymentsByLease = await _paymentRepository.GetRentPaymentsByLeaseIds(leaseIds);
            var today = DateTime.Today;
            var messageRequests = new List<FollowUpMessageRequest>();

            foreach (var lease in active)
            {
                if (cancellationToken.IsCancellationRequested) break;

                if (!lease.StartDate.HasValue || !lease.EndDate.HasValue ||
                    !lease.RentAmount.HasValue || !lease.RentDueDay.HasValue)
                    continue;

                var payments = paymentsByLease.GetValueOrDefault(lease.Id, []);
                var status = RentCalculator.GetStatus(lease, payments);
                var overdueAmount = RentCalculator.CalculateOverdueForLease(lease, payments);
                var nextDue = RentCalculator.CalculateNextDueDate(
                    lease.StartDate.Value, lease.EndDate.Value, lease.RentDueDay);
                var rentDueDate = CalculateLastRentDueDate(lease.StartDate.Value, lease.RentDueDay.Value, today);
                var daysUntilDue = (nextDue - today).Days;
                var daysOverdue = overdueAmount > 0 && today > rentDueDate
                    ? (today - rentDueDate).Days
                    : 0;

                string? actionType = null;
                if (status == ERentStatus.Overdue)
                    actionType = "CollectionsAgent_Overdue";
                else if (status == ERentStatus.UpcomingDue && daysUntilDue >= 0 && daysUntilDue <= 3)
                    actionType = "CollectionsAgent_PreDue";

                if (actionType == null)
                    continue;

                if (acc.SuppressionSet.Contains((actionType, lease.Id)))
                {
                    acc.Suppressed++;
                    if (actionType == "CollectionsAgent_Overdue" && !acc.SuppressedLeases.Any(s => s.LeaseId == lease.Id))
                    {
                        acc.SuppressedLeases.Add(new SuppressedLeaseDto
                        {
                            LeaseId = lease.Id,
                            TenantNames = string.Join(", ", lease.Tenants.Select(t => $"{t.Firstname} {t.Lastname}")),
                            PropertyName = string.Join("", [lease.PropertyName, lease.UnitName != null ? $", {lease.UnitName}" : ""])
                        });
                    }
                    continue;
                }

                var tenant = lease.Tenants.FirstOrDefault(t => !string.IsNullOrWhiteSpace(t.Email));
                if (tenant == null)
                {
                    _logger.LogWarning("Collections Agent skipped lease {LeaseId}: no tenant with email", lease.Id);
                    continue;
                }

                var lateFeeRule = lease.Fees.FirstOrDefault(f => f.IsLateFee && f.LateFeeType == "OneTime" && f.AppliedAfterDays.HasValue)
                               ?? lease.Fees.FirstOrDefault(f => f.IsLateFee && f.AppliedAfterDays.HasValue);

                var paymentSummary = BuildPaymentSummary(lease, payments, today);
                var suppressionDays = actionType == "CollectionsAgent_PreDue"
                    ? 3
                    : daysOverdue > 30 ? 3 : daysOverdue >= 15 ? 5 : 7;

                if (actionType == "CollectionsAgent_Overdue" && daysOverdue > 30)
                    AddFlagForReview(lease.Id, orgId, $"This lease is {daysOverdue} days past due with an overdue balance of {FormatCurrency(overdueAmount)}.", acc);

                if (actionType == "CollectionsAgent_Overdue" && lateFeeRule?.AppliedAfterDays is int graceDays && daysOverdue > graceDays)
                    AddLateFeeRecommendation(lease.Id, orgId, $"The rent is {daysOverdue} days past due, which is beyond the {graceDays}-day grace period configured for this lease.", acc);

                messageRequests.Add(new FollowUpMessageRequest(
                    lease.Id,
                    tenant.Id,
                    $"{tenant.Firstname} {tenant.Lastname}".Trim(),
                    tenant.Firstname ?? string.Empty,
                    tenant.Email ?? string.Empty,
                    lease.PropertyName,
                    lease.UnitName,
                    actionType,
                    suppressionDays,
                    lease.RentAmount,
                    overdueAmount,
                    daysOverdue,
                    daysUntilDue,
                    nextDue.ToString("yyyy-MM-dd"),
                    rentDueDate.ToString("yyyy-MM-dd"),
                    paymentSummary.IsRepeatLatePayer,
                    paymentSummary.LastPaymentDate?.ToString("yyyy-MM-dd"),
                    paymentSummary.LateCount,
                    paymentSummary.MissedCount));
            }

            if (messageRequests.Count == 0)
            {
                if (acc.PendingActions.Count > 0)
                {
                    _dataContext.CollectionsAgentActions.AddRange(acc.PendingActions);
                    await _dataContext.SaveChangesAsync(cancellationToken);
                }
                return acc;
            }

            var messagesByLease = await GenerateFollowUpMessagesAsync(messageRequests, cancellationToken);

            foreach (var request in messageRequests)
            {
                if (cancellationToken.IsCancellationRequested) break;

                var generated = messagesByLease.GetValueOrDefault(request.LeaseId)
                    ?? CreateFallbackFollowUpMessage(request);

                var result = await _aiFollowUpService.SendWithMessagesAsync(
                    request.ActionType,
                    request.LeaseId,
                    generated.InAppMessage,
                    generated.EmailMessage,
                    request.SuppressionDays,
                    landlordId,
                    orgId,
                    request.TenantId);

                if (result.Success)
                {
                    acc.MessagesSent++;
                    var label = request.ActionType == "CollectionsAgent_PreDue" ? "Pre-due reminder" : "Overdue follow-up";
                    var msg = $"{label} sent · {request.TenantName} · Lease #{request.LeaseId}";
                    acc.ActionLog.Add(msg);
                    acc.ActionLogEntries.Add(new ActionLogEntryDto { Message = msg, LeaseId = request.LeaseId, Type = "sent" });
                }
                else
                {
                    _logger.LogWarning("Collections Agent failed to send follow-up for lease {LeaseId}, tenant {TenantId}: {Message}",
                        request.LeaseId, request.TenantId, result.Message);
                }
            }

            if (acc.PendingActions.Count > 0)
            {
                _dataContext.CollectionsAgentActions.AddRange(acc.PendingActions);
                await _dataContext.SaveChangesAsync(cancellationToken);
            }

            _logger.LogInformation(
                "Deterministic Collections Agent finished for org {OrgId}: {MessagesSent} messages, {Suppressed} suppressed, {Flagged} flagged, {LateFees} late fee recommendations",
                orgId, acc.MessagesSent, acc.Suppressed, acc.FlaggedForReview, acc.LateFeeRecommendations);

            return acc;
        }

        private async Task<Dictionary<long, GeneratedFollowUpMessage>> GenerateFollowUpMessagesAsync(
            List<FollowUpMessageRequest> requests,
            CancellationToken cancellationToken)
        {
            var result = new Dictionary<long, GeneratedFollowUpMessage>();
            if (requests.Count == 0)
                return result;

            var client = new AnthropicClient(_settings.ApiKey);
            const int batchSize = 8;

            for (var offset = 0; offset < requests.Count; offset += batchSize)
            {
                if (cancellationToken.IsCancellationRequested) break;

                var batch = requests.Skip(offset).Take(batchSize).ToList();
                var systemPrompt = """
                    You write concise rent reminder messages for a property management platform.
                    Return ONLY a JSON array. Do not include markdown or commentary.

                    For each input item, return an object with:
                    - lease_id
                    - in_app_message: friendly, conversational, 2-4 sentences
                    - email_message: professional but empathetic, 3-5 sentences with greeting and closing

                    Rules:
                    - Address the tenant by first name.
                    - Never threaten eviction, legal action, penalties, or use intimidating language.
                    - Do not say you are an AI or mention internal fields.
                    - For overdue rent, include the overdue balance, rent due date, days past due, and an invitation to reach out about payment options.
                    - For upcoming rent, keep it light and mention the upcoming due date.
                    - If repeat late-payer context is present, gently mention autopay or a structured payment plan.
                    """;

                var userMessage = JsonSerializer.Serialize(new
                {
                    today = DateTime.Today.ToString("yyyy-MM-dd"),
                    followups = batch.Select(r => new
                    {
                        lease_id = r.LeaseId,
                        tenant_first_name = r.TenantFirstName,
                        tenant_name = r.TenantName,
                        property = r.PropertyName,
                        unit = r.UnitName,
                        action_type = r.ActionType,
                        rent_amount = r.RentAmount,
                        overdue_amount = r.OverdueAmount,
                        days_overdue = r.DaysOverdue,
                        days_until_due = r.DaysUntilDue,
                        next_due_date = r.NextDueDate,
                        rent_due_date = r.RentDueDate,
                        is_repeat_late_payer = r.IsRepeatLatePayer,
                        last_payment_date = r.LastPaymentDate,
                        late_count = r.LateCount,
                        missed_count = r.MissedCount
                    })
                });

                var parameters = new MessageParameters
                {
                    Model = _settings.FastModel,
                    MaxTokens = Math.Min(4096, 700 + (batch.Count * 450)),
                    Messages = [new AnthropicMessage(RoleType.User, userMessage)],
                    System = [new SystemMessage(systemPrompt)],
                    Temperature = 0.4m,
                    Stream = false
                };

                try
                {
                    var response = await client.Messages.GetClaudeMessageAsync(parameters, cancellationToken);
                    var raw = response.Content.OfType<TextContent>().FirstOrDefault()?.Text ?? "[]";
                    foreach (var message in ParseGeneratedFollowUpMessages(raw))
                    {
                        if (!string.IsNullOrWhiteSpace(message.InAppMessage) && !string.IsNullOrWhiteSpace(message.EmailMessage))
                            result[message.LeaseId] = message;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to generate batched follow-up messages for {Count} leases", batch.Count);
                }
            }

            return result;
        }

        private static string? ExtractJsonObject(string raw)
        {
            var trimmed = raw.Trim();
            var objectStart = trimmed.IndexOf('{');
            var objectEnd = trimmed.LastIndexOf('}');
            return objectStart >= 0 && objectEnd >= objectStart
                ? trimmed[objectStart..(objectEnd + 1)]
                : null;
        }

        private static string? GetJsonString(JsonNode? json, string key)
        {
            if (json is not JsonObject obj)
                return null;

            foreach (var property in obj)
            {
                if (string.Equals(property.Key, key, StringComparison.OrdinalIgnoreCase))
                    return property.Value?.GetValue<string>();
            }

            return null;
        }

        private static List<GeneratedFollowUpMessage> ParseGeneratedFollowUpMessages(string raw)
        {
            var trimmed = raw.Trim();
            var arrayStart = trimmed.IndexOf('[');
            var arrayEnd = trimmed.LastIndexOf(']');
            if (arrayStart >= 0 && arrayEnd >= arrayStart)
                trimmed = trimmed[arrayStart..(arrayEnd + 1)];

            var json = JsonNode.Parse(trimmed)?.AsArray();
            if (json == null)
                return [];

            var messages = new List<GeneratedFollowUpMessage>();
            foreach (var item in json)
            {
                if (item == null) continue;
                var leaseId = item["lease_id"]?.GetValue<long>() ?? 0;
                if (leaseId == 0) continue;
                messages.Add(new GeneratedFollowUpMessage(
                    leaseId,
                    item["in_app_message"]?.GetValue<string>() ?? string.Empty,
                    item["email_message"]?.GetValue<string>() ?? string.Empty));
            }
            return messages;
        }

        private static PaymentSummary BuildPaymentSummary(LoadLeaseDto lease, List<LoadPaymentDto> payments, DateTime today)
        {
            if (!lease.StartDate.HasValue || !lease.EndDate.HasValue || !lease.RentDueDay.HasValue || !lease.RentAmount.HasValue)
                return new PaymentSummary(false, null, 0, 0);

            var sixMonthsAgo = today.AddMonths(-6);
            var allDueDates = RentCalculator
                .GetRentDueDatesForLease(lease.StartDate.Value, lease.EndDate.Value, lease.RentDueDay)
                .OrderBy(d => d)
                .ToList();
            var pastDueDates = allDueDates
                .Where(d => d >= sixMonthsAgo && d < today)
                .ToList();

            int lateCount = 0, missedCount = 0;
            foreach (var dueDate in pastDueDates)
            {
                var periodsThrough = allDueDates.Count(d => d <= dueDate);
                var expectedThrough = periodsThrough * lease.RentAmount.Value;
                var paidByDueDate = payments.Where(p => p.PaymentDate.Date <= dueDate).Sum(p => p.Amount);
                var paidBy30DaysAfter = payments.Where(p => p.PaymentDate.Date <= dueDate.AddDays(30)).Sum(p => p.Amount);

                if (paidByDueDate >= expectedThrough)
                    continue;
                if (paidBy30DaysAfter >= expectedThrough)
                    lateCount++;
                else
                    missedCount++;
            }

            var lastPaymentDate = payments.OrderByDescending(p => p.PaymentDate).FirstOrDefault()?.PaymentDate;
            return new PaymentSummary(lateCount + missedCount >= 3, lastPaymentDate, lateCount, missedCount);
        }

        private static GeneratedFollowUpMessage CreateFallbackFollowUpMessage(FollowUpMessageRequest request)
        {
            var property = string.Join("", [request.PropertyName, request.UnitName != null ? $", {request.UnitName}" : ""]);
            if (request.ActionType == "CollectionsAgent_PreDue")
            {
                var inApp = $"Hi {request.TenantFirstName}, this is a friendly reminder that rent for {property} is due on {request.NextDueDate}. Please reach out if you have any questions.";
                var email = $"Hi {request.TenantFirstName},\n\nThis is a friendly reminder that rent for {property} is due on {request.NextDueDate}. Please reach out if you have any questions or need help with anything.\n\nThank you.";
                return new GeneratedFollowUpMessage(request.LeaseId, inApp, email);
            }
            else
            {
                var inApp = $"Hi {request.TenantFirstName}, this is a reminder that the rent balance for {property} is {FormatCurrency(request.OverdueAmount)} and was due on {request.RentDueDate}. It is currently {request.DaysOverdue} days past due, so please reach out if you have questions or would like to discuss payment options.";
                var email = $"Hi {request.TenantFirstName},\n\nThis is a reminder that the rent balance for {property} is {FormatCurrency(request.OverdueAmount)} and was due on {request.RentDueDate}. It is currently {request.DaysOverdue} days past due. Please reach out if you have questions or would like to discuss payment options.\n\nThank you.";
                return new GeneratedFollowUpMessage(request.LeaseId, inApp, email);
            }
        }

        private static string FormatCurrency(decimal? amount) => amount.HasValue ? amount.Value.ToString("C") : "the current balance";

        private void AddFlagForReview(long leaseId, long orgId, string reason, SweepAccumulator acc)
        {
            _logger.LogWarning(
                "Collections Agent flagged lease {LeaseId} in org {OrgId} for manual review. Reason: {Reason}",
                leaseId, orgId, reason);
            acc.FlaggedForReview++;
            var flagMsg = $"Flagged for review · Lease #{leaseId}: {reason}";
            acc.ActionLog.Add(flagMsg);
            acc.ActionLogEntries.Add(new ActionLogEntryDto { Message = flagMsg, LeaseId = leaseId, Type = "flagged" });
            acc.PendingActions.Add(new CollectionsAgentAction
            {
                OrganizationId = orgId,
                LeaseId = leaseId,
                ActionType = "flagged",
                Message = flagMsg,
                CreatedAt = DateTime.UtcNow,
                IsManual = false
            });
        }

        private void AddLateFeeRecommendation(long leaseId, long orgId, string reason, SweepAccumulator acc)
        {
            _logger.LogWarning(
                "Collections Agent recommends a late fee for lease {LeaseId} in org {OrgId}. Reason: {Reason}. Requires landlord approval.",
                leaseId, orgId, reason);
            acc.LateFeeRecommendations++;
            var feeMsg = $"Late fee recommended · Lease #{leaseId}: {reason}";
            acc.ActionLog.Add(feeMsg);
            acc.ActionLogEntries.Add(new ActionLogEntryDto { Message = feeMsg, LeaseId = leaseId, Type = "late_fee" });
            acc.PendingActions.Add(new CollectionsAgentAction
            {
                OrganizationId = orgId,
                LeaseId = leaseId,
                ActionType = "late_fee",
                Message = feeMsg,
                CreatedAt = DateTime.UtcNow,
                IsManual = false
            });
        }

        // ── Tool Dispatch ─────────────────────────────────────────────────────────

        private async Task<string> DispatchToolAsync(
            string toolName,
            JsonNode? input,
            long orgId,
            long landlordId,
            SweepAccumulator acc,
            CancellationToken cancellationToken)
        {
            try
            {
                return toolName switch
                {
                    "get_all_lease_statuses" => await GetAllLeaseStatuses(orgId, acc),
                    "get_payment_history"    => await GetPaymentHistory(input, acc),
                    "check_suppression"      => CheckSuppression(input, acc),
                    "send_followup"          => await SendFollowUp(input, landlordId, orgId, acc),
                    "flag_for_review"        => FlagForReview(input, orgId, acc),
                    "recommend_late_fee"     => RecommendLateFee(input, orgId, acc),
                    _ => JsonSerializer.Serialize(new { error = $"Unknown tool: {toolName}" })
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Tool {Tool} failed for org {OrgId}", toolName, orgId);
                return JsonSerializer.Serialize(new { error = ex.Message });
            }
        }

        // ── Tool Implementations ──────────────────────────────────────────────────

        private async Task<string> GetAllLeaseStatuses(long orgId, SweepAccumulator acc)
        {
            // Full load needed for Tenants + Fees (late fee grace period detection)
            var leases = await _leaseRepository.GetLeasesByOrganizationId(orgId);
            var active = leases.Where(l => l.LeaseAgreement?.IsDrafted != true).ToList();
            acc.LeasesReviewed += active.Count;

            if (active.Count == 0)
                return JsonSerializer.Serialize(new { leases = Array.Empty<object>(), count = 0 });

            var leaseIds = active.Select(l => l.Id).ToList();
            var paymentsByLease = await _paymentRepository.GetRentPaymentsByLeaseIds(leaseIds);

            // Populate cache so GetPaymentHistory and CheckSuppression skip DB round-trips
            foreach (var lease in active)
            {
                acc.LeaseCache[lease.Id] = lease;
                acc.PaymentsCache[lease.Id] = paymentsByLease.GetValueOrDefault(lease.Id, []);
            }

            var today = DateTime.Today;
            var result = new List<object>();

            foreach (var lease in active)
            {
                if (!lease.StartDate.HasValue || !lease.EndDate.HasValue ||
                    !lease.RentAmount.HasValue || !lease.RentDueDay.HasValue)
                    continue;

                var payments = paymentsByLease.GetValueOrDefault(lease.Id, []);
                var status = RentCalculator.GetStatus(lease, payments);
                var overdueAmount = RentCalculator.CalculateOverdueForLease(lease, payments);

                var nextDue = RentCalculator.CalculateNextDueDate(
                    lease.StartDate.Value, lease.EndDate.Value, lease.RentDueDay);
                var rentDueDate = lease.RentDueDay.HasValue
                    ? CalculateLastRentDueDate(lease.StartDate.Value, lease.RentDueDay.Value, today)
                    : nextDue;
                var daysUntilDue = (nextDue - today).Days;
                var daysOverdue = overdueAmount > 0 && today > rentDueDate
                    ? (today - rentDueDate).Days
                    : 0;

                // Late fee rule — grace period is the AppliedAfterDays on the first one-time late fee
                var lateFeeRule = lease.Fees.FirstOrDefault(f => f.IsLateFee && f.LateFeeType == "OneTime" && f.AppliedAfterDays.HasValue)
                               ?? lease.Fees.FirstOrDefault(f => f.IsLateFee && f.AppliedAfterDays.HasValue);

                var statusStr = status switch
                {
                    ERentStatus.Overdue => "overdue",
                    ERentStatus.UpcomingDue when daysUntilDue >= 0 && daysUntilDue <= 3 => "upcoming_due",
                    _ => "up_to_date"
                };

                if (statusStr == "up_to_date") continue;

                result.Add(new
                {
                    lease_id = lease.Id,
                    tenant_names = string.Join(", ", lease.Tenants.Select(t => $"{t.Firstname} {t.Lastname}")),
                    property_name = lease.PropertyName,
                    unit_name = lease.UnitName,
                    rent_amount = lease.RentAmount,
                    status = statusStr,
                    overdue_amount = overdueAmount,
                    days_overdue = daysOverdue,
                    days_until_due = daysUntilDue,
                    next_due_date = nextDue.ToString("yyyy-MM-dd"),
                    rent_due_date = rentDueDate.ToString("yyyy-MM-dd"),
                    has_late_fee_rule = lateFeeRule != null,
                    late_fee_grace_days = lateFeeRule?.AppliedAfterDays
                });
            }

            return JsonSerializer.Serialize(new { leases = result, count = result.Count });
        }

        private static DateTime CalculateLastRentDueDate(DateTime leaseStart, int rentDueDay, DateTime today)
        {
            static DateTime DueDateForMonth(int year, int month, int dueDay)
            {
                var actualDueDay = Math.Min(Math.Max(1, dueDay), DateTime.DaysInMonth(year, month));
                return new DateTime(year, month, actualDueDay);
            }

            var currentMonthDueDate = DueDateForMonth(today.Year, today.Month, rentDueDay);
            var dueDate = today > currentMonthDueDate
                ? currentMonthDueDate
                : DueDateForMonth(today.AddMonths(-1).Year, today.AddMonths(-1).Month, rentDueDay);

            var firstDueDate = DueDateForMonth(leaseStart.Year, leaseStart.Month, rentDueDay);
            if (firstDueDate < leaseStart.Date)
            {
                var nextMonth = firstDueDate.AddMonths(1);
                firstDueDate = DueDateForMonth(nextMonth.Year, nextMonth.Month, rentDueDay);
            }

            return dueDate < firstDueDate ? firstDueDate : dueDate;
        }

        private async Task<string> GetPaymentHistory(JsonNode? input, SweepAccumulator acc)
        {
            var leaseId = input!["lease_id"]!.GetValue<long>();

            // Serve from cache populated by GetAllLeaseStatuses — no extra DB round-trip
            if (!acc.LeaseCache.TryGetValue(leaseId, out var lease))
            {
                // Fallback for safety (e.g. if called before GetAllLeaseStatuses)
                lease = await _leaseRepository.GetLeaseByIdForAdminAsync(leaseId);
            }

            if (lease == null || !lease.StartDate.HasValue || !lease.EndDate.HasValue ||
                !lease.RentDueDay.HasValue || !lease.RentAmount.HasValue)
                return JsonSerializer.Serialize(new { error = "Lease not found or missing required fields" });

            var payments = acc.PaymentsCache.TryGetValue(leaseId, out var cached)
                ? cached
                : await _paymentRepository.GetRentPaymentsByLeaseId(leaseId);
            var today = DateTime.Today;
            var sixMonthsAgo = today.AddMonths(-6);

            var allDueDates = RentCalculator
                .GetRentDueDatesForLease(lease.StartDate.Value, lease.EndDate.Value, lease.RentDueDay)
                .OrderBy(d => d)
                .ToList();

            // Only due dates that have already passed within the analysis window
            var pastDueDates = allDueDates
                .Where(d => d >= sixMonthsAgo && d < today)
                .ToList();

            int onTimeCount = 0, lateCount = 0, missedCount = 0;

            foreach (var dueDate in pastDueDates)
            {
                // How much should have been paid by this due date (cumulative from lease start)
                var periodsThrough = allDueDates.Count(d => d <= dueDate);
                var expectedThrough = periodsThrough * lease.RentAmount.Value;

                var paidByDueDate      = payments.Where(p => p.PaymentDate.Date <= dueDate).Sum(p => p.Amount);
                var paidBy30DaysAfter  = payments.Where(p => p.PaymentDate.Date <= dueDate.AddDays(30)).Sum(p => p.Amount);

                if (paidByDueDate >= expectedThrough)
                    onTimeCount++;
                else if (paidBy30DaysAfter >= expectedThrough)
                    lateCount++;
                else
                    missedCount++;
            }

            var isRepeatLatePayer = lateCount + missedCount >= 3;
            var lastPaymentDate = payments.OrderByDescending(p => p.PaymentDate).FirstOrDefault()?.PaymentDate;
            var totalPaidLast6 = payments.Where(p => p.PaymentDate >= sixMonthsAgo).Sum(p => p.Amount);

            return JsonSerializer.Serialize(new
            {
                lease_id = leaseId,
                months_analyzed = pastDueDates.Count,
                on_time_count = onTimeCount,
                late_count = lateCount,
                missed_count = missedCount,
                is_repeat_late_payer = isRepeatLatePayer,
                last_payment_date = lastPaymentDate?.ToString("yyyy-MM-dd"),
                total_paid_last_6_months = totalPaidLast6
            });
        }

        private string CheckSuppression(JsonNode? input, SweepAccumulator acc)
        {
            var leaseId = input!["lease_id"]!.GetValue<long>();
            var actionType = input["action_type"]?.GetValue<string>() ?? "CollectionsAgent_Overdue";

            // Check in-memory set pre-loaded at org-run start — no DB round-trip
            var isSuppressed = acc.SuppressionSet.Contains((actionType, leaseId));
            if (isSuppressed)
            {
                acc.Suppressed++;
                // Only track overdue suppressed leases for the "follow up anyway" UI
                if (actionType == "CollectionsAgent_Overdue" && !acc.SuppressedLeases.Any(s => s.LeaseId == leaseId))
                {
                    // Tenant names + property already in lease cache — no extra DB call
                    if (acc.LeaseCache.TryGetValue(leaseId, out var lease))
                    {
                        acc.SuppressedLeases.Add(new SuppressedLeaseDto
                        {
                            LeaseId = leaseId,
                            TenantNames = string.Join(", ", lease.Tenants.Select(t => $"{t.Firstname} {t.Lastname}")),
                            PropertyName = string.Join("", [lease.PropertyName, lease.UnitName != null ? $", {lease.UnitName}" : ""])
                        });
                    }
                }
            }
            return JsonSerializer.Serialize(new { lease_id = leaseId, action_type = actionType, is_suppressed = isSuppressed });
        }

        private async Task<string> SendFollowUp(JsonNode? input, long landlordId, long orgId, SweepAccumulator acc)
        {
            var leaseId = input!["lease_id"]!.GetValue<long>();
            var actionType = input["action_type"]?.GetValue<string>() ?? "CollectionsAgent_Overdue";
            var inAppMessage = input["in_app_message"]?.GetValue<string>() ?? "";
            var emailMessage = input["email_message"]?.GetValue<string>() ?? "";
            var suppressionDays = input["suppression_days"]!.GetValue<int>();

            var result = await _aiFollowUpService.SendWithMessagesAsync(
                actionType, leaseId, inAppMessage, emailMessage, suppressionDays, landlordId, orgId);

            if (result.Success)
            {
                acc.MessagesSent++;
                var label = actionType == "CollectionsAgent_PreDue" ? "Pre-due reminder" : "Overdue follow-up";
                var msg = $"{label} sent · Lease #{leaseId}";
                acc.ActionLog.Add(msg);
                acc.ActionLogEntries.Add(new ActionLogEntryDto { Message = msg, LeaseId = leaseId, Type = "sent" });
                acc.PendingActions.Add(new CollectionsAgentAction
                {
                    OrganizationId = orgId,
                    LeaseId = leaseId,
                    ActionType = "sent",
                    Message = msg,
                    CreatedAt = DateTime.UtcNow,
                    IsManual = false
                });
            }

            return JsonSerializer.Serialize(new
            {
                success = result.Success,
                message = result.Message,
                lease_id = leaseId,
                action_type = actionType
            });
        }

        private string FlagForReview(JsonNode? input, long orgId, SweepAccumulator acc)
        {
            var leaseId = input!["lease_id"]!.GetValue<long>();
            var reason = input["reason"]?.GetValue<string>() ?? "Flagged by Collections Agent";
            _logger.LogWarning(
                "Collections Agent flagged lease {LeaseId} in org {OrgId} for manual review. Reason: {Reason}",
                leaseId, orgId, reason);
            acc.FlaggedForReview++;
            var flagMsg = $"Flagged for review · Lease #{leaseId}: {reason}";
            acc.ActionLog.Add(flagMsg);
            acc.ActionLogEntries.Add(new ActionLogEntryDto { Message = flagMsg, LeaseId = leaseId, Type = "flagged" });
            acc.PendingActions.Add(new CollectionsAgentAction
            {
                OrganizationId = orgId,
                LeaseId = leaseId,
                ActionType = "flagged",
                Message = flagMsg,
                CreatedAt = DateTime.UtcNow,
                IsManual = false
            });
            return JsonSerializer.Serialize(new { flagged = true, lease_id = leaseId, reason });
        }

        private string RecommendLateFee(JsonNode? input, long orgId, SweepAccumulator acc)
        {
            var leaseId = input!["lease_id"]!.GetValue<long>();
            var reason = input["reason"]?.GetValue<string>() ?? "Late fee triggered by lease rules";
            _logger.LogWarning(
                "Collections Agent recommends a late fee for lease {LeaseId} in org {OrgId}. Reason: {Reason}. Requires landlord approval.",
                leaseId, orgId, reason);
            acc.LateFeeRecommendations++;
            var feeMsg = $"Late fee recommended · Lease #{leaseId}: {reason}";
            acc.ActionLog.Add(feeMsg);
            acc.ActionLogEntries.Add(new ActionLogEntryDto { Message = feeMsg, LeaseId = leaseId, Type = "late_fee" });
            acc.PendingActions.Add(new CollectionsAgentAction
            {
                OrganizationId = orgId,
                LeaseId = leaseId,
                ActionType = "late_fee",
                Message = feeMsg,
                CreatedAt = DateTime.UtcNow,
                IsManual = false
            });
            return JsonSerializer.Serialize(new
            {
                recommended = true,
                lease_id = leaseId,
                reason,
                note = "Requires landlord approval before applying."
            });
        }

        // ── Tool Definitions ──────────────────────────────────────────────────────

        private static List<Anthropic.SDK.Common.Tool> BuildTools()
        {
            var getAllLeaseStatusesSchema = JsonNode.Parse("""
                {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
                """)!;

            var getPaymentHistorySchema = JsonNode.Parse("""
                {
                    "type": "object",
                    "properties": {
                        "lease_id": {
                            "type": "integer",
                            "description": "The lease ID to retrieve payment history for"
                        }
                    },
                    "required": ["lease_id"]
                }
                """)!;

            var checkSuppressionSchema = JsonNode.Parse("""
                {
                    "type": "object",
                    "properties": {
                        "lease_id": {
                            "type": "integer",
                            "description": "The lease ID to check suppression for"
                        },
                        "action_type": {
                            "type": "string",
                            "description": "CollectionsAgent_PreDue for pre-due reminders, CollectionsAgent_Overdue for overdue follow-ups",
                            "enum": ["CollectionsAgent_PreDue", "CollectionsAgent_Overdue"]
                        }
                    },
                    "required": ["lease_id", "action_type"]
                }
                """)!;

            var sendFollowUpSchema = JsonNode.Parse("""
                {
                    "type": "object",
                    "properties": {
                        "lease_id": {
                            "type": "integer",
                            "description": "The lease ID to send a follow-up for"
                        },
                        "action_type": {
                            "type": "string",
                            "description": "CollectionsAgent_PreDue for pre-due reminders, CollectionsAgent_Overdue for overdue follow-ups",
                            "enum": ["CollectionsAgent_PreDue", "CollectionsAgent_Overdue"]
                        },
                        "in_app_message": {
                            "type": "string",
                            "description": "Friendly, conversational in-app message (2-3 sentences)"
                        },
                        "email_message": {
                            "type": "string",
                            "description": "Professional but empathetic email body (3-5 sentences, with greeting and closing)"
                        },
                        "suppression_days": {
                            "type": "integer",
                            "description": "Days before another message can be sent: 3 for pre-due, 3-7 for overdue based on severity"
                        }
                    },
                    "required": ["lease_id", "action_type", "in_app_message", "email_message", "suppression_days"]
                }
                """)!;

            var flagForReviewSchema = JsonNode.Parse("""
                {
                    "type": "object",
                    "properties": {
                        "lease_id": {
                            "type": "integer",
                            "description": "The lease ID to flag for manual landlord review"
                        },
                        "reason": {
                            "type": "string",
                            "description": "Why this lease needs manual review"
                        }
                    },
                    "required": ["lease_id", "reason"]
                }
                """)!;

            var recommendLateFeeSchema = JsonNode.Parse("""
                {
                    "type": "object",
                    "properties": {
                        "lease_id": {
                            "type": "integer",
                            "description": "The lease ID to recommend a late fee for"
                        },
                        "reason": {
                            "type": "string",
                            "description": "Which lease rule triggered this recommendation and how many days past grace period"
                        }
                    },
                    "required": ["lease_id", "reason"]
                }
                """)!;

            return
            [
                new Function("get_all_lease_statuses",
                    "Get all active leases with their current payment status (up_to_date, upcoming_due, overdue), overdue amounts, days overdue, next due date, and late fee rule info",
                    getAllLeaseStatusesSchema),

                new Function("get_payment_history",
                    "Get 6-month payment history for a lease: on-time count, late count, missed count, repeat late payer flag, and last payment date",
                    getPaymentHistorySchema),

                new Function("check_suppression",
                    "Check whether a message was recently sent for this lease and action type — prevents over-messaging tenants",
                    checkSuppressionSchema),

                new Function("send_followup",
                    "Send a personalized follow-up message to the tenant and set suppression to prevent repeat messages",
                    sendFollowUpSchema),

                new Function("flag_for_review",
                    "Flag a lease for manual landlord review (e.g. severely overdue, repeat non-payer, unusual pattern)",
                    flagForReviewSchema),

                new Function("recommend_late_fee",
                    "Log a late fee recommendation that requires explicit landlord approval before being applied — never applies fees automatically",
                    recommendLateFeeSchema)
            ];
        }

        // ── History ───────────────────────────────────────────────────────────────

        public async Task<CollectionsHistoryPageDto> GetCollectionsHistoryAsync(long orgId, int page, int pageSize, CancellationToken cancellationToken = default)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = _dataContext.CollectionsAgentActions
                .Where(a => a.OrganizationId == orgId)
                .OrderByDescending(a => a.CreatedAt);

            var totalCount = await query.CountAsync(cancellationToken);

            var pageItems = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(a => new
                {
                    a.Id,
                    a.LeaseId,
                    a.TenantId,
                    a.TenantNameSnapshot,
                    a.PropertyNameSnapshot,
                    a.UnitNameSnapshot,
                    a.ActionType,
                    a.FollowUpType,
                    a.Message,
                    a.InAppMessage,
                    a.EmailSubject,
                    a.EmailMessage,
                    a.ConversationId,
                    a.MessageId,
                    a.EmailSent,
                    a.SuppressionDays,
                    a.CreatedAt,
                    a.IsManual
                })
                .ToListAsync(cancellationToken);

            // Batch-fetch tenant names and property info for the current page
            var leaseIds = pageItems.Select(a => a.LeaseId).Distinct().ToList();

            var leaseInfo = await _dataContext.Leases
                .Where(l => leaseIds.Contains(l.Id))
                .Select(l => new { l.Id, PropertyName = l.Unit.Property.Name, UnitName = (string?)l.Unit.Name })
                .ToDictionaryAsync(l => l.Id, cancellationToken);

            var tenantsByLease = await _dataContext.TenantLeases
                .Where(tl => leaseIds.Contains(tl.LeaseId))
                .Select(tl => new { tl.LeaseId, Name = tl.Tenant.Firstname + " " + tl.Tenant.Lastname })
                .ToListAsync(cancellationToken);

            var tenantNamesByLease = tenantsByLease
                .GroupBy(x => x.LeaseId)
                .ToDictionary(g => g.Key, g => string.Join(", ", g.Select(x => x.Name)));

            var items = pageItems.Select(a =>
            {
                leaseInfo.TryGetValue(a.LeaseId, out var info);
                var propertyDisplay = info != null
                    ? (info.UnitName != null ? $"{info.PropertyName}, {info.UnitName}" : info.PropertyName)
                    : string.Join("", [a.PropertyNameSnapshot, !string.IsNullOrWhiteSpace(a.UnitNameSnapshot) ? $", {a.UnitNameSnapshot}" : ""]);
                return new CollectionsHistoryItemDto
                {
                    Id = a.Id,
                    LeaseId = a.LeaseId,
                    TenantId = a.TenantId,
                    TenantNames = !string.IsNullOrWhiteSpace(a.TenantNameSnapshot)
                        ? a.TenantNameSnapshot
                        : tenantNamesByLease.GetValueOrDefault(a.LeaseId, ""),
                    PropertyName = propertyDisplay,
                    ActionType = a.ActionType,
                    FollowUpType = a.FollowUpType,
                    Message = a.Message,
                    InAppMessage = a.InAppMessage,
                    EmailSubject = a.EmailSubject,
                    EmailMessage = a.EmailMessage,
                    ConversationId = a.ConversationId,
                    MessageId = a.MessageId,
                    EmailSent = a.EmailSent,
                    SuppressionDays = a.SuppressionDays,
                    CreatedAt = a.CreatedAt,
                    IsManual = a.IsManual
                };
            }).ToList();

            return new CollectionsHistoryPageDto
            {
                Items = items,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize
            };
        }

        public async Task<AgentDashboardSummaryDto> GetAgentDashboardSummaryAsync(long orgId, CancellationToken cancellationToken = default)
        {
            var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);

            var thisMonthActions = await _dataContext.CollectionsAgentActions
                .Where(a => a.OrganizationId == orgId && a.CreatedAt >= monthStart)
                .GroupBy(a => a.ActionType)
                .Select(g => new { ActionType = g.Key, Count = g.Count() })
                .ToListAsync(cancellationToken);

            var lastRunAt = await _dataContext.CollectionsAgentActions
                .Where(a => a.OrganizationId == orgId)
                .OrderByDescending(a => a.CreatedAt)
                .Select(a => (DateTime?)a.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);

            var followUpsSent = thisMonthActions.FirstOrDefault(a => a.ActionType == "sent")?.Count ?? 0;
            var totalThisMonth = thisMonthActions.Sum(a => a.Count);

            return new AgentDashboardSummaryDto
            {
                Collections = new CollectionsAgentSummaryDto
                {
                    FollowUpsSentThisMonth = followUpsSent,
                    ActionsThisMonth = totalThisMonth,
                    LastRunAt = lastRunAt
                }
            };
        }

        private record FollowUpMessageRequest(
            long LeaseId,
            long TenantId,
            string TenantName,
            string TenantFirstName,
            string TenantEmail,
            string? PropertyName,
            string? UnitName,
            string ActionType,
            int SuppressionDays,
            decimal? RentAmount,
            decimal? OverdueAmount,
            int DaysOverdue,
            int DaysUntilDue,
            string NextDueDate,
            string RentDueDate,
            bool IsRepeatLatePayer,
            string? LastPaymentDate,
            int LateCount,
            int MissedCount);

        private record GeneratedFollowUpMessage(long LeaseId, string InAppMessage, string EmailMessage);

        private record PaymentSummary(bool IsRepeatLatePayer, DateTime? LastPaymentDate, int LateCount, int MissedCount);

        // ── Accumulator ───────────────────────────────────────────────────────────

        private class SweepAccumulator
        {
            public int LeasesReviewed { get; set; }
            public int MessagesSent { get; set; }
            public int Suppressed { get; set; }
            public int FlaggedForReview { get; set; }
            public int LateFeeRecommendations { get; set; }
            public List<string> ActionLog { get; } = [];
            public List<ActionLogEntryDto> ActionLogEntries { get; } = [];
            public List<SuppressedLeaseDto> SuppressedLeases { get; } = [];
            public List<CollectionsAgentAction> PendingActions { get; } = [];

            // ── Per-org cache (not merged — populated fresh per org run) ──────────
            /// <summary>Leases loaded by GetAllLeaseStatuses, keyed by lease ID.</summary>
            public Dictionary<long, LoadLeaseDto> LeaseCache { get; } = [];
            /// <summary>Payments loaded by GetAllLeaseStatuses, keyed by lease ID.</summary>
            public Dictionary<long, List<LoadPaymentDto>> PaymentsCache { get; } = [];
            /// <summary>Active suppressions loaded once at org-run start, keyed by (actionType, entityId).</summary>
            public HashSet<(string ActionType, long EntityId)> SuppressionSet { get; } = [];

            public void Merge(SweepAccumulator other)
            {
                LeasesReviewed += other.LeasesReviewed;
                MessagesSent += other.MessagesSent;
                Suppressed += other.Suppressed;
                FlaggedForReview += other.FlaggedForReview;
                LateFeeRecommendations += other.LateFeeRecommendations;
                ActionLog.AddRange(other.ActionLog);
                ActionLogEntries.AddRange(other.ActionLogEntries);
                SuppressedLeases.AddRange(other.SuppressedLeases);
                // Caches are not merged — they are per-org only
            }
        }
    }
}
