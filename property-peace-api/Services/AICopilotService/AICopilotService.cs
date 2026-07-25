using brownstone_hub_api.Dtos.AICopilot;
using brownstone_hub_api.Dtos.ActionSuppression;
using brownstone_hub_api.Dtos.Application;
using brownstone_hub_api.Dtos.Checklist;
using brownstone_hub_api.Dtos.Conversation;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.MaintenanceRequest;
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Dtos.Property;
using brownstone_hub_api.Dtos.Tenant;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Applications;
using brownstone_hub_api.Repositories.Checklists;
using brownstone_hub_api.Repositories.Conversations;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.MaintenanceRequests;
using brownstone_hub_api.Repositories.Payments;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Tenants;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Dtos.UserSetting;
using brownstone_hub_api.Services.ActionSuppressionService;
using brownstone_hub_api.Services.OpenAIService;
using brownstone_hub_api.Utils;
using brownstone_hub_api.Data;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace brownstone_hub_api.Services.AICopilotService
{
    public partial class AICopilotService(
        IPropertyRepository propertyRepository,
        ITenantRepository tenantRepository,
        ILeaseRepository leaseRepository,
        IPaymentRepository paymentRepository,
        IMaintenanceRequestRepository maintenanceRequestRepository,
        IApplicationRepository applicationRepository,
        IChecklistRepository checklistRepository,
        IConversationRepository conversationRepository,
        IActionSuppressionService actionSuppressionService,
        IUserRepository userRepository,
        DataContext dataContext,
        IOpenAIService openAIService,
        ILogger<AICopilotService> logger) : IAICopilotService
    {
        private readonly IPropertyRepository _propertyRepository = propertyRepository;
        private readonly ITenantRepository _tenantRepository = tenantRepository;
        private readonly ILeaseRepository _leaseRepository = leaseRepository;
        private readonly IPaymentRepository _paymentRepository = paymentRepository;
        private readonly IMaintenanceRequestRepository _maintenanceRequestRepository = maintenanceRequestRepository;
        private readonly IApplicationRepository _applicationRepository = applicationRepository;
        private readonly IChecklistRepository _checklistRepository = checklistRepository;
        private readonly IConversationRepository _conversationRepository = conversationRepository;
        private readonly IActionSuppressionService _actionSuppressionService = actionSuppressionService;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly DataContext _dataContext = dataContext;
        private readonly IOpenAIService _openAIService = openAIService;
        private readonly ILogger<AICopilotService> _logger = logger;

        public async Task<ServiceResponse<OrganizationSummaryDto>> GetOrganizationSummary(long organizationId)
        {
            try
            {
                // Get current user and their AI summary preferences
                var user = await _userRepository.GetCurrentUser();
                SettingsDto? userSettings = null;
                if (user != null)
                {
                    userSettings = await _userRepository.GetUserSettings(user.Id);
                    // Use defaults if no settings exist
                    if (userSettings == null)
                    {
                        userSettings = new SettingsDto
                        {
                            AiSummaryEnabled = true,
                            AiSummaryCheckTenantAccounts = true,
                            AiSummaryCheckMoveInChecklist = true,
                            AiSummaryCheckMoveOutChecklist = true,
                            AiSummaryCheckApplicationsSentSigned = true,
                            AiSummaryCheckUnpaidSecurityDeposits = true
                        };
                    }
                }
                else
                {
                    // Default preferences if no user
                    userSettings = new SettingsDto
                    {
                        AiSummaryEnabled = true,
                        AiSummaryCheckTenantAccounts = true,
                        AiSummaryCheckMoveInChecklist = true,
                        AiSummaryCheckMoveOutChecklist = true,
                        AiSummaryCheckApplicationsSentSigned = true,
                        AiSummaryCheckUnpaidSecurityDeposits = true
                    };
                }

                // Fetch all data sequentially to avoid DbContext threading issues
                // DbContext is not thread-safe, so parallel operations on the same instance will fail
                var properties = await _propertyRepository.GetPropertiesByOrganizationId(organizationId);
                var leases = await _leaseRepository.GetLeasesByOrganizationId(organizationId, true);
                var payments = await _paymentRepository.GetLifetimeRentPaymentsByOrganizationId(organizationId);
                var maintenanceRequests = await _maintenanceRequestRepository.GetCurrentMaintenanceByOrganizationId(organizationId);
                var applications = await _applicationRepository.GetApplicationsByOrganizationId(organizationId);
                var conversations = await _conversationRepository.GetConversationsByOrganizationId(organizationId, includeArchived: false);

                // Cleanup expired and resolved suppressions
                await _actionSuppressionService.CleanupExpiredSuppressions(organizationId);
                await _actionSuppressionService.CleanupResolvedIssues(organizationId);

                // Get active suppressions
                var activeSuppressions = await _actionSuppressionService.GetActiveSuppressionsByOrganization(organizationId);
                var suppressedActions = activeSuppressions.Select(s => new SuppressedActionDto
                {
                    ActionType = s.ActionType,
                    EntityId = s.EntityId,
                    SuppressedUntil = s.SuppressedUntil,
                    Reason = s.Reason
                }).ToList();

                // Build summary
                var summary = new OrganizationSummaryDto
                {
                    Properties = BuildPropertySummaries(properties ?? []),
                    Tenants = BuildTenantSummaries(leases ?? [], payments ?? []),
                    RentStatus = BuildRentStatus(leases ?? [], payments ?? [], activeSuppressions),
                    MaintenanceRequests = BuildMaintenanceSummaries(maintenanceRequests ?? []),
                    Applications = BuildApplicationSummaries(applications ?? []),
                    LeaseExpirations = BuildLeaseExpirationSummaries(leases ?? []),
                    UpcomingLeases = await BuildUpcomingLeaseSummaries(leases ?? [], organizationId),
                    Leases = BuildLeaseSummaries(leases ?? [], activeSuppressions, userSettings),
                    ImportantTasks = await BuildImportantTasks(leases ?? [], applications ?? [], activeSuppressions, organizationId, userSettings),
                    UrgentMessages = await BuildUrgentMessageSummaries(conversations ?? [], organizationId),
                    SuppressedActions = suppressedActions,
                    VacantUnits = BuildVacantUnitsSummaries(properties ?? [], leases ?? [])
                };

                return new ServiceResponse<OrganizationSummaryDto>
                {
                    Data = summary,
                    Message = "Organization summary retrieved successfully."
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving organization summary for organization {OrganizationId}", organizationId);
                return ServiceResponse<OrganizationSummaryDto>.CreateError("Error retrieving organization summary", ex.Message);
            }
        }

        private List<PropertySummaryDto> BuildPropertySummaries(List<LoadPropertyDto> properties)
        {
            return properties.Select(p => new PropertySummaryDto
            {
                Id = p.Id,
                Name = p.Name,
                Address = p.StreetAddress ?? string.Empty,
                UnitCount = p.Units?.Count ?? 0,
                OccupancyRate = p.Units?.Count > 0
                    ? (decimal)(p.Units.Count(u =>
                        u.Lease != null &&
                        u.Lease.IsActive &&
                        u.Lease.EndDate.HasValue &&
                        u.Lease.EndDate.Value >= DateTime.UtcNow.Date) / (double)p.Units.Count) * 100
                    : 0
            }).ToList();
        }

        private List<TenantSummaryDto> BuildTenantSummaries(List<LoadLeaseDto> leases, List<LoadPaymentDto> payments)
        {
            var tenantSummaries = new List<TenantSummaryDto>();
            var today = DateTime.Today;

            foreach (var lease in leases.Where(l => l.IsActive && l.Tenants.Any() &&
                l.StartDate.HasValue && l.EndDate.HasValue && l.RentAmount.HasValue && l.RentDueDay.HasValue && l.LeaseAgreement?.IsDrafted != true))
            {
                var leaseStatus = lease.IsActive ? "Active" : "Inactive";
                var leasePayments = payments.Where(p => p.LeaseId == lease.Id).ToList();
                var totalPaid = leasePayments.Sum(p => p.Amount);

                // Calculate expected rent through today
                var monthsElapsed = ((today.Year - lease.StartDate!.Value.Year) * 12) + today.Month - lease.StartDate!.Value.Month + 1;
                if (monthsElapsed < 0) monthsElapsed = 0;
                var expectedThroughToday = monthsElapsed * lease.RentAmount!.Value;

                var paymentStatus = "UpToDate";
                int? daysOverdue = null;
                decimal? amountOverdue = null;

                if (totalPaid < expectedThroughToday)
                {
                    var dueDateThisMonth = new DateTime(today.Year, today.Month, lease.RentDueDay!.Value);
                    if (today > dueDateThisMonth)
                    {
                        paymentStatus = "Overdue";
                        amountOverdue = expectedThroughToday - totalPaid;
                        daysOverdue = (today - dueDateThisMonth).Days;
                    }
                    else
                    {
                        paymentStatus = "DueSoon";
                    }
                }

                foreach (var tenant in lease.Tenants)
                {
                    tenantSummaries.Add(new TenantSummaryDto
                    {
                        Id = tenant.Id,
                        Name = $"{tenant.Firstname} {tenant.Lastname}".Trim(),
                        Email = tenant.Email ?? string.Empty,
                        PropertyName = lease.PropertyName,
                        UnitName = lease.UnitName,
                        LeaseStatus = leaseStatus,
                        PaymentStatus = paymentStatus,
                        DaysOverdue = daysOverdue,
                        AmountOverdue = amountOverdue,
                        HasAccount = tenant.UserId.HasValue && tenant.UserId.Value > 0
                        // Note: TenantSignedAt would need to be added to LoadTenantDto to track individual tenant signing
                    });
                }
            }

            return tenantSummaries;
        }

        private RentStatusSummaryDto BuildRentStatus(List<LoadLeaseDto> leases, List<LoadPaymentDto> payments, List<LoadActionSuppressionDto> activeSuppressions)
        {
            var today = DateTime.Today;
            var startOfMonth = new DateTime(today.Year, today.Month, 1);
            var endOfMonth = startOfMonth.AddMonths(1);

            var activeLeases = leases.Where(l => l.IsActive && l.StartDate <= today && l.LeaseAgreement?.IsDrafted != true).ToList();

            var totalExpected = RentCalculator.TotalExpected(activeLeases, startOfMonth, endOfMonth);
            var totalCollected = payments
                .Where(p => p.PaymentDate >= startOfMonth && p.PaymentDate < endOfMonth)
                .Sum(p => p.Amount);

            var overdueList = new List<OverdueRentDto>();
            var dueSoonList = new List<DueSoonRentDto>();

            foreach (var lease in activeLeases.Where(l => l.StartDate.HasValue && l.RentAmount.HasValue && l.RentDueDay.HasValue))
            {
                var leasePayments = payments.Where(p => p.LeaseId == lease.Id).ToList();
                var totalPaid = leasePayments.Sum(p => p.Amount);

                var monthsElapsed = ((today.Year - lease.StartDate!.Value.Year) * 12) + today.Month - lease.StartDate!.Value.Month + 1;
                if (monthsElapsed < 0) monthsElapsed = 0;
                var expectedThroughToday = monthsElapsed * lease.RentAmount!.Value;

                var dueDateThisMonth = new DateTime(today.Year, today.Month, lease.RentDueDay!.Value);

                if (totalPaid < expectedThroughToday)
                {
                    // Get all tenant names for this lease
                    var tenantNames = lease.Tenants
                        .Select(t => $"{t.Firstname} {t.Lastname}".Trim())
                        .ToList();

                    if (today > dueDateThisMonth)
                    {
                        // Check if this overdue rent action is suppressed
                        var isSuppressed = activeSuppressions.Any(s => 
                            s.ActionType == "sendAIFollowUp_OverdueRent" && 
                            s.EntityId == lease.Id);

                        // Overdue — only count previous months' missed payments, not the current month
                        var monthsBeforeCurrent = Math.Max(0, monthsElapsed - 1);
                        var expectedThroughPreviousMonth = monthsBeforeCurrent * lease.RentAmount!.Value;
                        var overdueAmount = Math.Max(0m, expectedThroughPreviousMonth - totalPaid);
                        var daysOverdue = (today - dueDateThisMonth).Days;

                        // Only add to overdue list if not suppressed (suppressed items will be mentioned in summary but not shown as action needed)
                        if (!isSuppressed)
                        {
                            overdueList.Add(new OverdueRentDto
                            {
                                LeaseId = lease.Id,
                                PropertyName = lease.PropertyName,
                                UnitName = lease.UnitName,
                                TenantNames = tenantNames,
                                Amount = overdueAmount,
                                RentAmount = lease.RentAmount!.Value,
                                DaysOverdue = daysOverdue
                            });
                        }
                    }
                    else
                    {
                        // Due soon or due today - one entry per lease, not per tenant
                        var dueAmount = lease.RentAmount ?? 0m;
                        var isDueToday = today == dueDateThisMonth;
                        dueSoonList.Add(new DueSoonRentDto
                        {
                            LeaseId = lease.Id,
                            PropertyName = lease.PropertyName,
                            UnitName = lease.UnitName,
                            TenantNames = tenantNames,
                            Amount = dueAmount,
                            DueDate = dueDateThisMonth,
                            IsDueToday = isDueToday
                        });
                    }
                }
            }

            return new RentStatusSummaryDto
            {
                TotalExpected = totalExpected,
                TotalCollected = totalCollected,
                Overdue = overdueList,
                DueSoon = dueSoonList
            };
        }

        private List<MaintenanceRequestSummaryDto> BuildMaintenanceSummaries(List<LoadMaintenanceRequestDto> maintenanceRequests)
        {
            var today = DateTime.Today;

            return maintenanceRequests.Select(mr => new MaintenanceRequestSummaryDto
            {
                Id = mr.Id,
                Title = mr.Title ?? "Maintenance Request",
                PropertyName = mr.PropertyName,
                TenantName = null, // LoadMaintenanceRequestDto doesn't have TenantName
                Priority = mr.Priority.ToString() ?? "Medium",
                Status = mr.Status.ToString() ?? "Pending",
                CreatedAt = mr.CreatedAt,
                DaysOpen = (today - mr.CreatedAt.Date).Days,
                HasVendorAssigned = mr.VendorId.HasValue
            }).ToList();
        }

        private List<VacantUnitDto> BuildVacantUnitsSummaries(List<LoadPropertyDto> properties, List<LoadLeaseDto> leases)
        {
            var today = DateTime.Today;
            var vacantUnits = new List<VacantUnitDto>();

            // Build a lookup of unitId → most recently ended lease end date
            var lastLeaseEndByUnit = leases
                .Where(l => !l.IsActive && l.UnitId > 0 && l.EndDate.HasValue)
                .GroupBy(l => l.UnitId)
                .ToDictionary(g => g.Key, g => g.Max(l => l.EndDate!.Value.Date));

            // Set of unit IDs that currently have an active lease
            var activeLeaseUnitIds = leases
                .Where(l => l.IsActive)
                .Select(l => l.UnitId)
                .ToHashSet();

            foreach (var property in properties)
            {
                if (property.Units == null) continue;

                foreach (var unit in property.Units)
                {
                    if (activeLeaseUnitIds.Contains(unit.Id)) continue;

                    var daysVacant = lastLeaseEndByUnit.TryGetValue(unit.Id, out var lastEnd)
                        ? (today - lastEnd).Days
                        : 0;

                    vacantUnits.Add(new VacantUnitDto
                    {
                        UnitId = unit.Id,
                        UnitName = unit.Name,
                        PropertyId = property.Id,
                        PropertyName = property.Name,
                        ListedRentAmount = unit.RentAmount,
                        DaysVacant = daysVacant
                    });
                }
            }

            return vacantUnits;
        }

        private List<ApplicationSummaryDto> BuildApplicationSummaries(List<LoadRentalApplicationDto> applications)
        {
            var today = DateTime.Today;

            return applications
                .Where(a => a.Status == EApplicationStatus.Submitted || a.Status == EApplicationStatus.UnderReview)
                .Select(app => new ApplicationSummaryDto
                {
                    Id = app.Id,
                    ApplicantName = $"{app.FirstName} {app.LastName}".Trim(),
                    PropertyName = app.PropertyName,
                    UnitName = app.UnitName,
                    Status = app.Status.ToString(),
                    SubmittedAt = app.CreatedAt,
                    DaysPending = (today - app.CreatedAt.Date).Days
                })
                .ToList();
        }

        private List<LeaseExpirationSummaryDto> BuildLeaseExpirationSummaries(List<LoadLeaseDto> leases)
        {
            var today = DateTime.Today;
            var sixtyDaysFromNow = today.AddDays(60);

            return leases
                .Where(l => l.IsActive && l.EndDate >= today && l.EndDate <= sixtyDaysFromNow)
                .SelectMany(lease => lease.Tenants.Select(tenant => new LeaseExpirationSummaryDto
                {
                    Id = lease.Id,
                    TenantName = $"{tenant.Firstname} {tenant.Lastname}".Trim(),
                    PropertyName = lease.PropertyName,
                    UnitName = lease.UnitName,
                    ExpirationDate = lease.EndDate ?? DateTime.UtcNow,
                    DaysUntilExpiration = lease.EndDate.HasValue ? (lease.EndDate.Value.Date - today).Days : 0
                }))
                .ToList();
        }

        private async Task<List<UpcomingLeaseSummaryDto>> BuildUpcomingLeaseSummaries(List<LoadLeaseDto> leases, long organizationId)
        {
            var today = DateTime.Today;
            var upcomingLeases = leases
                .Where(l => l.IsActive && l.StartDate > today && l.Tenants.Any())
                .ToList();

            if (!upcomingLeases.Any())
            {
                return new List<UpcomingLeaseSummaryDto>();
            }

            // OPTIMIZATION: Batch fetch all applications and checklists upfront instead of per-lease queries
            var propertyIds = upcomingLeases.Select(l => l.PropertyId).Distinct().ToList();
            var allApplications = new List<LoadRentalApplicationDto>();
            foreach (var propertyId in propertyIds)
            {
                var apps = await _applicationRepository.GetApplicationsByPropertyId(propertyId);
                allApplications.AddRange(apps);
            }

            var leaseIds = upcomingLeases.Select(l => l.Id).Distinct().ToList();
            var unitIds = upcomingLeases.Where(l => l.UnitId > 0).Select(l => l.UnitId).Distinct().ToList();
            
            // Batch fetch checklists by lease IDs
            var allChecklistsByLease = new Dictionary<long, List<LoadChecklistDto>>();
            foreach (var leaseId in leaseIds)
            {
                var checklists = await _checklistRepository.GetChecklistsByLeaseId(leaseId);
                if (checklists.Any())
                {
                    allChecklistsByLease[leaseId] = checklists;
                }
            }

            // Batch fetch checklists by unit IDs (for fallback)
            var allChecklistsByUnit = new Dictionary<long, List<LoadChecklistDto>>();
            foreach (var unitId in unitIds)
            {
                var checklists = await _checklistRepository.GetChecklistsByUnitId(unitId);
                if (checklists.Any())
                {
                    allChecklistsByUnit[unitId] = checklists;
                }
            }

            var result = new List<UpcomingLeaseSummaryDto>();

            foreach (var lease in upcomingLeases)
            {
                // Check if there's an application for this unit/property (from batched data)
                var hasApplication = allApplications.Any(a =>
                    a.PropertyId == lease.PropertyId &&
                    a.UnitId == lease.UnitId &&
                    (a.Status == Enums.EApplicationStatus.Submitted ||
                     a.Status == Enums.EApplicationStatus.UnderReview ||
                     a.Status == Enums.EApplicationStatus.Approved));

                // Get checklists from batched data
                var checklists = new List<LoadChecklistDto>();
                if (allChecklistsByLease.TryGetValue(lease.Id, out var leaseChecklists))
                {
                    checklists = leaseChecklists;
                }
                // If no checklists found by LeaseId, try by UnitId (fallback)
                else if (lease.UnitId > 0 && allChecklistsByUnit.TryGetValue(lease.UnitId, out var unitChecklists))
                {
                    checklists = unitChecklists;
                }

                var moveInChecklist = checklists.FirstOrDefault(c => c.ChecklistType == Enums.ETenantDocumentType.MoveInChecklist);
                // Use the IsCompleted field from the checklist - this is the source of truth
                var checklistCompleted = moveInChecklist != null && moveInChecklist.IsCompleted;

                result.Add(new UpcomingLeaseSummaryDto
                {
                    LeaseId = lease.Id,
                    PropertyId = lease.PropertyId,
                    PropertyName = lease.PropertyName,
                    UnitName = lease.UnitName,
                    TenantNames = lease.Tenants
                        .Select(t => $"{t.Firstname} {t.Lastname}".Trim())
                        .ToList(),
                    StartDate = lease.StartDate ?? DateTime.UtcNow,
                    EndDate = lease.EndDate ?? DateTime.UtcNow,
                    RentAmount = lease.RentAmount ?? 0m,
                    DaysUntilStart = lease.StartDate.HasValue ? (lease.StartDate.Value.Date - today).Days : 0,
                    HasApplication = hasApplication,
                    ChecklistCompleted = checklistCompleted
                });
            }

            return result.OrderBy(l => l.StartDate).ToList();
        }

        private async Task<List<ImportantTaskSummaryDto>> BuildImportantTasks(List<LoadLeaseDto> leases, List<LoadRentalApplicationDto> applications, List<LoadActionSuppressionDto> activeSuppressions, long organizationId, SettingsDto? userSettings)
        {
            var tasks = new List<ImportantTaskSummaryDto>();
            var today = DateTime.Today;

            // Check for leases expiring soon (within 30 days)
            var expiringLeases = leases.Where(l => l.IsActive && l.EndDate >= today && l.EndDate <= today.AddDays(30));
            foreach (var lease in expiringLeases)
            {
                tasks.Add(new ImportantTaskSummaryDto
                {
                    Type = "LeaseExpiration",
                    Description = lease.EndDate.HasValue 
                        ? $"Lease for {lease.PropertyName} - {lease.UnitName} expires in {(lease.EndDate.Value.Date - today).Days} days"
                        : $"Lease for {lease.PropertyName} - {lease.UnitName} expires soon",
                    DueDate = lease.EndDate ?? DateTime.UtcNow,
                    Priority = "High"
                });
            }

            // Check for applications pending for more than 7 days
            var oldApplications = applications
                .Where(a => (a.Status == EApplicationStatus.Submitted || a.Status == EApplicationStatus.UnderReview)
                    && (today - a.CreatedAt.Date).Days > 7);

            foreach (var app in oldApplications)
            {
                tasks.Add(new ImportantTaskSummaryDto
                {
                    Type = "PendingApplication",
                    Description = $"Application from {app.FirstName} {app.LastName} has been pending for {(today - app.CreatedAt.Date).Days} days",
                    DueDate = null,
                    Priority = "Medium"
                });
            }

            // Check for unsigned leases (if enabled in settings)
            if (userSettings?.AiSummaryCheckApplicationsSentSigned ?? true)
            {
                var unsignedLeases = leases.Where(l => l.IsActive &&
                    (l.LeaseAgreement?.SignatureStatus == Enums.ESignatureStatus.NotSent ||
                     l.LeaseAgreement?.SignatureStatus == Enums.ESignatureStatus.Sent ||
                     l.LeaseAgreement?.SignatureStatus == Enums.ESignatureStatus.InProgress ||
                     l.LeaseAgreement?.SignatureStatus == Enums.ESignatureStatus.PartiallySigned));

                foreach (var lease in unsignedLeases)
                {
                    // Check if lease signing follow-up is suppressed
                    var isSuppressed = activeSuppressions.Any(s => 
                        s.ActionType == "sendAIFollowUp_LeaseSigning" && 
                        s.EntityId == lease.Id);

                    if (isSuppressed) continue; // Skip if suppressed

                    var daysSinceSent = lease.LeaseAgreement?.SignatureSentAt.HasValue == true
                        ? (today - lease.LeaseAgreement.SignatureSentAt!.Value.Date).Days
                        : (int?)null;

                    var statusDesc = lease.LeaseAgreement?.SignatureStatus switch
                    {
                        Enums.ESignatureStatus.NotSent => "lease agreement created but no one has signed yet",
                        Enums.ESignatureStatus.Sent => "sent for signature",
                        Enums.ESignatureStatus.InProgress => "in progress",
                        Enums.ESignatureStatus.PartiallySigned => "partially signed",
                        _ => "pending signature"
                    };

                    var description = lease.LeaseAgreement?.SignatureStatus == Enums.ESignatureStatus.NotSent
                        ? $"Lease for {lease.PropertyName} - {lease.UnitName}: {statusDesc}"
                        : daysSinceSent.HasValue
                            ? $"Lease for {lease.PropertyName} - {lease.UnitName} has been {statusDesc} ({daysSinceSent} days ago)"
                            : $"Lease for {lease.PropertyName} - {lease.UnitName} has been {statusDesc}";

                    tasks.Add(new ImportantTaskSummaryDto
                    {
                        Type = "UnsignedLease",
                        Description = description,
                        DueDate = lease.LeaseAgreement?.SignatureExpiresAt,
                        Priority = daysSinceSent.HasValue && daysSinceSent.Value > 7 ? "High" : "Medium"
                    });
                }
            }

            // Check for tenants without accounts on active leases (if enabled in settings)
            if (userSettings?.AiSummaryCheckTenantAccounts ?? true)
            {
                foreach (var lease in leases.Where(l => l.IsActive && l.Tenants.Any()))
                {
                    var tenantsWithoutAccounts = lease.Tenants
                        .Where(t => !t.UserId.HasValue || t.UserId.Value == 0)
                        .ToList();

                    if (tenantsWithoutAccounts.Any())
                    {
                        // Check if any tenant account creation follow-up is suppressed
                        var suppressedTenantIds = activeSuppressions
                            .Where(s => s.ActionType == "sendAIFollowUp_TenantAccount")
                            .Select(s => s.EntityId)
                            .ToHashSet();

                        var unsuppressedTenants = tenantsWithoutAccounts
                            .Where(t => !suppressedTenantIds.Contains(t.Id))
                            .ToList();

                        if (unsuppressedTenants.Any())
                        {
                            var tenantNames = string.Join(", ", unsuppressedTenants.Select(t => $"{t.Firstname} {t.Lastname}".Trim()));
                            tasks.Add(new ImportantTaskSummaryDto
                            {
                                Type = "TenantAccountCreation",
                                Description = $"Tenants on lease for {lease.PropertyName} - {lease.UnitName} have not created accounts: {tenantNames}",
                                DueDate = null,
                                Priority = "Medium"
                            });
                        }
                    }
                }
            }

            // OPTIMIZATION: Batch fetch checklists for move-in checklist checks
            var moveInLeases = leases.Where(l => l.IsActive && l.StartDate <= today && l.StartDate >= today.AddDays(-30)).ToList();
            var moveInLeaseIds = moveInLeases.Select(l => l.Id).Distinct().ToList();
            var moveInUnitIds = moveInLeases.Where(l => l.UnitId > 0).Select(l => l.UnitId).Distinct().ToList();
            
            var moveInChecklistsByLease = new Dictionary<long, List<LoadChecklistDto>>();
            foreach (var leaseId in moveInLeaseIds)
            {
                var checklists = await _checklistRepository.GetChecklistsByLeaseId(leaseId);
                if (checklists.Any())
                {
                    moveInChecklistsByLease[leaseId] = checklists;
                }
            }

            var moveInChecklistsByUnit = new Dictionary<long, List<LoadChecklistDto>>();
            foreach (var unitId in moveInUnitIds)
            {
                var checklists = await _checklistRepository.GetChecklistsByUnitId(unitId);
                if (checklists.Any())
                {
                    moveInChecklistsByUnit[unitId] = checklists;
                }
            }

            // Check for incomplete move-in checklists (if enabled in settings)
            if (userSettings?.AiSummaryCheckMoveInChecklist ?? true)
            {
                foreach (var lease in moveInLeases)
                {
                    // Get checklists from batched data
                    var checklists = new List<LoadChecklistDto>();
                    if (moveInChecklistsByLease.TryGetValue(lease.Id, out var leaseChecklists))
                    {
                        checklists = leaseChecklists;
                    }
                    // If no checklists found by LeaseId, try by UnitId (fallback)
                    else if (lease.UnitId > 0 && moveInChecklistsByUnit.TryGetValue(lease.UnitId, out var unitChecklists))
                    {
                        checklists = unitChecklists;
                    }

                    var moveInChecklist = checklists.FirstOrDefault(c => c.ChecklistType == Enums.ETenantDocumentType.MoveInChecklist);
                    
                    // If checklist exists but not completed, add as task
                    if (moveInChecklist != null && !moveInChecklist.IsCompleted)
                    {
                        var daysSinceStart = lease.StartDate.HasValue ? (today - lease.StartDate.Value.Date).Days : 0;
                        tasks.Add(new ImportantTaskSummaryDto
                        {
                            Type = "IncompleteMoveInChecklist",
                            Description = $"Move-in checklist for {lease.PropertyName} - {lease.UnitName} is incomplete ({daysSinceStart} days since lease start)",
                            DueDate = lease.StartDate ?? DateTime.UtcNow,
                            Priority = daysSinceStart > 7 ? "High" : "Medium"
                        });
                    }
                    // If no checklist exists for a lease that started recently, add as task
                    else if (moveInChecklist == null && lease.StartDate.HasValue && lease.StartDate.Value <= today && lease.StartDate.Value >= today.AddDays(-7))
                    {
                        tasks.Add(new ImportantTaskSummaryDto
                        {
                            Type = "MissingMoveInChecklist",
                            Description = $"Move-in checklist is missing for {lease.PropertyName} - {lease.UnitName}",
                            DueDate = lease.StartDate ?? DateTime.UtcNow,
                            Priority = "Medium"
                        });
                    }
                }
            }

            // OPTIMIZATION: Batch fetch checklists for move-out checklist checks
            var moveOutLeases = leases.Where(l => !l.IsActive && l.EndDate >= today.AddDays(-60) && l.EndDate <= today).ToList();
            var moveOutLeaseIds = moveOutLeases.Select(l => l.Id).Distinct().ToList();
            var moveOutUnitIds = moveOutLeases.Where(l => l.UnitId > 0).Select(l => l.UnitId).Distinct().ToList();
            
            var moveOutChecklistsByLease = new Dictionary<long, List<LoadChecklistDto>>();
            foreach (var leaseId in moveOutLeaseIds)
            {
                var checklists = await _checklistRepository.GetChecklistsByLeaseId(leaseId);
                if (checklists.Any())
                {
                    moveOutChecklistsByLease[leaseId] = checklists;
                }
            }

            var moveOutChecklistsByUnit = new Dictionary<long, List<LoadChecklistDto>>();
            foreach (var unitId in moveOutUnitIds)
            {
                var checklists = await _checklistRepository.GetChecklistsByUnitId(unitId);
                if (checklists.Any())
                {
                    moveOutChecklistsByUnit[unitId] = checklists;
                }
            }

            // Check for incomplete move-out checklists (if enabled in settings)
            if (userSettings?.AiSummaryCheckMoveOutChecklist ?? true)
            {
                foreach (var lease in moveOutLeases)
                {
                    // Get checklists from batched data
                    var checklists = new List<LoadChecklistDto>();
                    if (moveOutChecklistsByLease.TryGetValue(lease.Id, out var leaseChecklists))
                    {
                        checklists = leaseChecklists;
                    }
                    // If no checklists found by LeaseId, try by UnitId (fallback)
                    else if (lease.UnitId > 0 && moveOutChecklistsByUnit.TryGetValue(lease.UnitId, out var unitChecklists))
                    {
                        checklists = unitChecklists;
                    }

                    var moveOutChecklist = checklists.FirstOrDefault(c => c.ChecklistType == Enums.ETenantDocumentType.MoveOutChecklist);
                    
                    // If checklist exists but not completed, add as task
                    if (moveOutChecklist != null && !moveOutChecklist.IsCompleted)
                    {
                        var daysSinceEnd = lease.EndDate.HasValue ? (today - lease.EndDate.Value.Date).Days : 0;
                        tasks.Add(new ImportantTaskSummaryDto
                        {
                            Type = "IncompleteMoveOutChecklist",
                            Description = $"Move-out checklist for {lease.PropertyName} - {lease.UnitName} is incomplete ({daysSinceEnd} days since lease ended)",
                            DueDate = lease.EndDate ?? DateTime.UtcNow,
                            Priority = daysSinceEnd > 7 ? "High" : "Medium"
                        });
                    }
                    // If no checklist exists for a lease that ended recently, add as task
                    else if (moveOutChecklist == null && lease.EndDate.HasValue && lease.EndDate.Value <= today && lease.EndDate.Value >= today.AddDays(-7))
                    {
                        tasks.Add(new ImportantTaskSummaryDto
                        {
                            Type = "MissingMoveOutChecklist",
                            Description = $"Move-out checklist is missing for {lease.PropertyName} - {lease.UnitName}",
                            DueDate = lease.EndDate ?? DateTime.UtcNow,
                            Priority = "Medium"
                        });
                    }
                }
            }

            // Check for unpaid deposits on active leases (if enabled in settings)
            if (userSettings?.AiSummaryCheckUnpaidSecurityDeposits ?? true)
            {
                var leasesWithDeposits = leases.Where(l => l.IsActive && l.DepositAmount > 0 && l.LeaseAgreement?.IsDrafted != true).ToList();
                if (leasesWithDeposits.Any())
                {
                    // OPTIMIZATION: Batch fetch all deposits in one query instead of per-lease
                    var leaseIdsWithDeposits = leasesWithDeposits.Select(l => l.Id).Distinct().ToList();
                    var allDeposits = await _dataContext.Deposits
                        .Where(d => leaseIdsWithDeposits.Contains(d.LeaseId) && 
                                    d.OrganizationId == organizationId && 
                                    d.RefundedDate == null)
                        .GroupBy(d => d.LeaseId)
                        .Select(g => new { LeaseId = g.Key, TotalAmount = g.Sum(d => d.Amount) })
                        .ToDictionaryAsync(x => x.LeaseId, x => x.TotalAmount);

                    foreach (var lease in leasesWithDeposits)
                    {
                        // Check if deposit follow-up is suppressed
                        var isSuppressed = activeSuppressions.Any(s => 
                            s.ActionType == "sendAIFollowUp_Deposit" && 
                            s.EntityId == lease.Id);

                        if (isSuppressed) continue; // Skip if suppressed

                        // Get total deposits received from batched data
                        var totalDepositsReceived = allDeposits.TryGetValue(lease.Id, out var amount) ? amount : 0;

                        // Check if deposit is unpaid or partially paid
                        if (totalDepositsReceived < lease.DepositAmount)
                        {
                            var depositOwed = lease.DepositAmount - totalDepositsReceived;
                            var tenantNames = string.Join(", ", lease.Tenants.Select(t => $"{t.Firstname} {t.Lastname}".Trim()));

                            tasks.Add(new ImportantTaskSummaryDto
                            {
                                Type = "UnpaidDeposit",
                                Description = $"Deposit of ${depositOwed:F2} is still owed for {lease.PropertyName} - {lease.UnitName} by {tenantNames}",
                                DueDate = null,
                                Priority = "Medium"
                            });
                        }
                    }
                }
            }

            return tasks;
        }

        private List<LeaseSummaryDto> BuildLeaseSummaries(List<LoadLeaseDto> leases, List<LoadActionSuppressionDto> activeSuppressions, SettingsDto? userSettings)
        {
            var today = DateTime.Today;
            var leaseSummaries = new List<LeaseSummaryDto>();

            foreach (var lease in leases.Where(l => l.IsActive))
            {
                var tenantSigningInfo = lease.Tenants.Select(tenant => new TenantSigningInfoDto
                {
                    TenantId = tenant.Id,
                    TenantName = $"{tenant.Firstname} {tenant.Lastname}".Trim(),
                    Email = tenant.Email,
                    HasAccount = tenant.UserId.HasValue && tenant.UserId.Value > 0,
                    HasSigned = false, // This would require TenantSignedAt in LoadTenantDto
                    SignedAt = null // This would require TenantSignedAt in LoadTenantDto
                }).ToList();

                var tasksNeeded = new List<string>();

                // Check if lease signing follow-up is suppressed
                var isLeaseSigningSuppressed = activeSuppressions.Any(s => 
                    s.ActionType == "sendAIFollowUp_LeaseSigning" && 
                    s.EntityId == lease.Id);

                // Determine tasks needed based on lease agreement status
                var agreementStatus = lease.LeaseAgreement?.SignatureStatus;
                if (agreementStatus == Enums.ESignatureStatus.NotSent)
                {
                    if (!isLeaseSigningSuppressed)
                    {
                        tasksNeeded.Add("Send lease for signature");
                    }
                }
                else if (agreementStatus == Enums.ESignatureStatus.Sent ||
                         agreementStatus == Enums.ESignatureStatus.InProgress ||
                         agreementStatus == Enums.ESignatureStatus.PartiallySigned)
                {
                    if (lease.LeaseAgreement?.SignatureExpiresAt.HasValue == true && lease.LeaseAgreement.SignatureExpiresAt!.Value < today)
                    {
                        tasksNeeded.Add("Signature expired - resend lease for signature");
                    }
                    else if (!isLeaseSigningSuppressed)
                    {
                        tasksNeeded.Add("Follow up on pending signatures");
                    }

                    if (!lease.LeaseAgreement?.LandlordSignedAt.HasValue == true)
                    {
                        tasksNeeded.Add("Landlord signature pending");
                    }

                    var unsignedTenants = tenantSigningInfo.Where(t => !t.HasSigned).ToList();
                    if (unsignedTenants.Any())
                    {
                        tasksNeeded.Add($"Tenant signatures pending: {string.Join(", ", unsignedTenants.Select(t => t.TenantName))}");
                    }
                }
                else if (agreementStatus == Enums.ESignatureStatus.Declined)
                {
                    tasksNeeded.Add("Lease signature declined - review and resend if needed");
                }
                else if (agreementStatus == Enums.ESignatureStatus.Expired)
                {
                    tasksNeeded.Add("Lease signature expired - resend for signature");
                }
                else if (agreementStatus == Enums.ESignatureStatus.Cancelled)
                {
                    tasksNeeded.Add("Lease signature cancelled - review and resend if needed");
                }

                // Check for tenants without accounts (if enabled in settings)
                if (userSettings?.AiSummaryCheckTenantAccounts ?? true)
                {
                    var tenantsWithoutAccounts = tenantSigningInfo.Where(t => !t.HasAccount).ToList();
                    if (tenantsWithoutAccounts.Any())
                    {
                        // Filter out tenants with suppressed follow-ups
                        var suppressedTenantIds = activeSuppressions
                            .Where(s => s.ActionType == "sendAIFollowUp_TenantAccount")
                            .Select(s => s.EntityId)
                            .ToHashSet();

                        var unsuppressedTenants = tenantsWithoutAccounts
                            .Where(t => !suppressedTenantIds.Contains(t.TenantId))
                            .ToList();

                        if (unsuppressedTenants.Any())
                        {
                            tasksNeeded.Add($"Invite tenants to create accounts: {string.Join(", ", unsuppressedTenants.Select(t => t.TenantName))}");
                        }
                    }
                }

                leaseSummaries.Add(new LeaseSummaryDto
                {
                    LeaseId = lease.Id,
                    PropertyId = lease.PropertyId,
                    PropertyName = lease.PropertyName,
                    UnitName = lease.UnitName,
                    Tenants = tenantSigningInfo,
                    SignatureStatus = lease.LeaseAgreement?.SignatureStatus.ToString(),
                    SignatureSentAt = lease.LeaseAgreement?.SignatureSentAt,
                    SignatureCompletedAt = lease.LeaseAgreement?.SignatureCompletedAt,
                    SignatureExpiresAt = lease.LeaseAgreement?.SignatureExpiresAt,
                    LandlordSignedBy = lease.LeaseAgreement?.LandlordSignedBy,
                    LandlordSignedAt = lease.LeaseAgreement?.LandlordSignedAt,
                    StartDate = lease.StartDate ?? DateTime.UtcNow,
                    EndDate = lease.EndDate ?? DateTime.UtcNow,
                    RentAmount = lease.RentAmount ?? 0m,
                    IsActive = lease.IsActive,
                    TasksNeeded = tasksNeeded
                });
            }

            return leaseSummaries;
        }

        private async Task<List<UrgentMessageSummaryDto>> BuildUrgentMessageSummaries(List<LoadConversationDto> conversations, long organizationId)
        {
            // Get active suppressions to filter out permanently suppressed conversations
            // OPTIMIZATION: Use async/await instead of blocking .Result
            var activeSuppressions = await _actionSuppressionService.GetActiveSuppressionsByOrganization(organizationId);
            
            var suppressedConversationIds = activeSuppressions
                .Where(s => s.ActionType == "urgentConversation")
                .Select(s => s.EntityId)
                .ToHashSet();
            
            var urgentConversations = conversations
                .Where(c => c.HasUrgentItems 
                    && !string.IsNullOrEmpty(c.UrgentItemsJson)
                    && !suppressedConversationIds.Contains(c.Id))
                .OrderByDescending(c => c.UrgentItemsDetectedAt ?? c.LastMessageAt ?? c.CreatedAt)
                .ToList();

            var urgentMessageSummaries = new List<UrgentMessageSummaryDto>();

            foreach (var conversation in urgentConversations)
            {
                var urgentItems = new List<UrgentItemSummaryDto>();

                // Parse urgent items from JSON
                if (!string.IsNullOrEmpty(conversation.UrgentItemsJson))
                {
                    try
                    {
                        var options = new JsonSerializerOptions
                        {
                            PropertyNameCaseInsensitive = true
                        };
                        var urgentItemsJson = JsonSerializer.Deserialize<List<UrgentItemSummaryDto>>(conversation.UrgentItemsJson, options);
                        if (urgentItemsJson != null)
                        {
                            urgentItems = urgentItemsJson;
                        }
                    }
                    catch (JsonException ex)
                    {
                        _logger.LogWarning(ex, "Failed to parse urgent items JSON for conversation {ConversationId}", conversation.Id);
                        // If parsing fails, create a default urgent item from the AI summary
                        if (!string.IsNullOrEmpty(conversation.AiSummary))
                        {
                            urgentItems.Add(new UrgentItemSummaryDto
                            {
                                Type = "general",
                                Description = conversation.AiSummary,
                                Severity = "medium",
                                MessageExcerpt = conversation.LastMessagePreview
                            });
                        }
                    }
                }

                urgentMessageSummaries.Add(new UrgentMessageSummaryDto
                {
                    ConversationId = conversation.Id,
                    Title = conversation.Title ?? "Conversation",
                    TenantName = conversation.TenantName,
                    PropertyName = conversation.PropertyName,
                    UnitName = null, // UnitName is not available in LoadConversationDto
                    AiSummary = conversation.AiSummary,
                    UrgentItems = urgentItems,
                    UrgentItemsDetectedAt = conversation.UrgentItemsDetectedAt,
                    LastMessageAt = conversation.LastMessageAt
                });
            }

            return urgentMessageSummaries;
        }
    }
}

