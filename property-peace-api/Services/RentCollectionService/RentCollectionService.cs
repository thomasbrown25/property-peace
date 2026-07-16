
using brownstone_hub_api.Dtos.Dashboard;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Dtos.RentCollection;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Data;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.MaintenanceRequests;
using brownstone_hub_api.Repositories.Payments;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Services.PaymentService;
using brownstone_hub_api.Repositories.Users;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using brownstone_hub_api.Utils;

namespace brownstone_hub_api.Services.RentCollectionService
{
    public class RentCollectionService(IPropertyRepository propertyRepository, ILeaseRepository leaseRepository, IPaymentRepository paymentRepository, IPaymentService paymentService, IMaintenanceRequestRepository maintenanceRequestRepository, INotificationService notificationService, DataContext context, IHttpContextAccessor httpContextAccessor, IUserRepository userRepository, ILogger<RentCollectionService> logger) : IRentCollectionService
    {
        private readonly IPropertyRepository _propertyRepository = propertyRepository;
        private readonly ILeaseRepository _leaseRepository = leaseRepository;
        private readonly IPaymentRepository _paymentRepository = paymentRepository;
        private readonly IPaymentService _paymentService = paymentService;
        private readonly IMaintenanceRequestRepository _maintenanceRequestRepository = maintenanceRequestRepository;
        private readonly INotificationService _notificationService = notificationService;
        private readonly DataContext _context = context;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly ILogger<RentCollectionService> _logger = logger;
        private static readonly HashSet<string> BalanceCreditingStatuses = new(StringComparer.OrdinalIgnoreCase) { "Completed", "Paid" };
        private static readonly HashSet<string> PaymentIssueStatuses = new(StringComparer.OrdinalIgnoreCase) { "Failed", "Canceled", "Cancelled", "Disputed" };

        private long? GetOrganizationIdFromContext()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }


        public async Task<ServiceResponse<RentCollectionResponseDto>> GetRentCollection(long organizationId, long? propertyId = null, long? leaseId = null, bool lifetime = false)
        {
            try
            {
                // Get leases (filter by property if provided, always include archived)
                var leases = propertyId.HasValue
                    ? await _leaseRepository.GetLeasesByPropertyId(propertyId.Value, false, organizationId)
                    : await _leaseRepository.GetLeasesByOrganizationId(organizationId, false);

                // Filter by leaseId if provided
                if (leaseId.HasValue)
                {
                    leases = leases.Where(l => l.Id == leaseId.Value).ToList();
                }

                // Exclude draft leases from all rent/overdue/outstanding calculations
                leases = leases.Where(l => l.LeaseAgreement?.IsDrafted != true).ToList();

                var startOfMonth = new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1);
                var endOfMonth = startOfMonth.AddMonths(1);

                // 🔹 Total expected baseline (all leases monthly rent, regardless of payments)
                var totalMonthlyRent = leases.Where(l => l.RentAmount.HasValue).Sum(l => l.RentAmount!.Value);

                // 🔹 Expected this month (all leases active this month)
                var expectedThisMonth = RentCalculator.TotalExpected(leases, startOfMonth, endOfMonth);

                // 🔹 Get rent-only payments (lifetime scope) for balance/overdue calculation
                var payments = propertyId.HasValue
                    ? await _paymentRepository.GetLifetimeRentPaymentsByPropertyId(propertyId.Value)
                    : await _paymentRepository.GetLifetimeRentPaymentsByOrganizationId(organizationId);

                // Pre-group payments by LeaseId to avoid O(leases × payments) scans
                var paymentsByLease = payments
                    .GroupBy(p => p.LeaseId)
                    .ToDictionary(g => g.Key, g => g.ToList());

                // 🔹 Collected lifetime — only finalized payments count as collected.
                var collectedLifetime = payments
                    .Where(p => BalanceCreditingStatuses.Contains(p.Status ?? string.Empty))
                    .Sum(p => p.Amount);

                // 🔹 Collected this month — only finalized payments count as collected.
                var collectedThisMonth = payments
                    .Where(p => BalanceCreditingStatuses.Contains(p.Status ?? string.Empty) && p.PaymentDate >= startOfMonth && p.PaymentDate < endOfMonth)
                    .Sum(p => p.Amount);

                // 🔹 Remaining for this month (lease-level, prevents advance payments from hiding unpaid rents)
                // Note: Overdue leases are excluded from remaining - they should only appear in overdue
                decimal remainingThisMonth = 0;
                foreach (var lease in leases)
                {
                    if (!lease.StartDate.HasValue || lease.StartDate.Value > DateTime.Today || !lease.IsActive)
                        continue;

                    var leasePaymentList = paymentsByLease.TryGetValue(lease.Id, out var lp) ? lp : [];

                    // Skip overdue leases - they should not be counted in remaining
                    var leaseStatus = RentCalculator.GetStatus(lease, leasePaymentList);
                    if (leaseStatus == Enums.ERentStatus.Overdue)
                        continue;

                    var expectedForLease = RentCalculator.ExpectedForLease(lease, startOfMonth, endOfMonth);

                    var leaseCollectedThisMonth = leasePaymentList
                        .Where(p => BalanceCreditingStatuses.Contains(p.Status ?? string.Empty) && p.PaymentDate >= startOfMonth && p.PaymentDate < endOfMonth)
                        .Sum(p => p.Amount);

                    var leaseRemaining = expectedForLease - leaseCollectedThisMonth;
                    if (leaseRemaining > 0)
                        remainingThisMonth += leaseRemaining;
                }

                // 🔹 Outstanding (lifetime full balance due)
                var outstanding = Math.Max(RentCalculator.TotalOutstanding(leases, payments), 0);

                // 🔹 Overdue
                var overdue = RentCalculator.CalculateOverdue(leases, payments);

                // 🔹 Rent records for UI
                var rentRecords = leases.Select(l =>
                {
                    var leasePaymentList = paymentsByLease.TryGetValue(l.Id, out var lp) ? lp : [];

                    // Use the proper CalculateOverdueForLease method which checks if lease has started
                    var overdueAmount = RentCalculator.CalculateOverdueForLease(l, leasePaymentList);

                    // total finalized payments made for this lease (all payments are rent payments)
                    var leasePayments = leasePaymentList
                        .Where(p => BalanceCreditingStatuses.Contains(p.Status ?? string.Empty))
                        .Sum(p => p.Amount);
                    var paymentIssueCount = leasePaymentList.Count(p => PaymentIssueStatuses.Contains(p.Status ?? string.Empty));
                    var processingPayments = leasePaymentList
                        .Where(p => string.Equals(p.Status, "Processing", StringComparison.OrdinalIgnoreCase))
                        .ToList();
                    var oldestProcessingPaymentDate = processingPayments.Count > 0 ? processingPayments.Min(p => p.PaymentDate) : (DateTime?)null;
                    var hasLongProcessingPayment = oldestProcessingPaymentDate.HasValue && oldestProcessingPaymentDate.Value <= DateTime.UtcNow.AddDays(-5);
                    var paymentIssueSummary = paymentIssueCount > 0
                        ? $"{paymentIssueCount} failed, canceled, or disputed payment{(paymentIssueCount == 1 ? "" : "s")} need attention"
                        : hasLongProcessingPayment
                            ? "ACH payment has been processing for more than 5 days; review with Stripe before contacting the tenant"
                            : processingPayments.Count > 0
                                ? $"{processingPayments.Count} payment{(processingPayments.Count == 1 ? "" : "s")} processing"
                                : null;

                    // Calculate outstanding for entire lease period (expected - collected)
                    var outstanding = RentCalculator.OutstandingForLease(l, leasePaymentList);

                    return new RentRecordDto
                    {
                        Id = l.Id,
                        Tenants = l.Tenants.ToList(),
                        PropertyName = l.PropertyName,
                        PropertyType = Enum.Parse<Enums.EPropertyType>(l.PropertyType),
                        PropertyId = l.PropertyId,
                        UnitName = l.UnitName,
                        RentAmount = l.RentAmount ?? 0m,
                        DueDate = l.NextDueDate ?? DateTime.UtcNow,
                        LeaseId = l.Id,
                        OverdueAmount = overdueAmount,
                        AmountDueNow = RentCalculator.GetAmountDueNow(l, leasePaymentList),
                        CollectedLifetime = leasePayments, // Total rent payments collected for this lease
                        Outstanding = outstanding, // Total outstanding for entire lease period
                        Status = RentCalculator.GetStatus(l, leasePaymentList),
                        PropertyImageUrl = l.PropertyImageUrl, // Already populated by AutoMapper
                        UpdatedAt = l.UpdatedAt,
                        PaymentIssueCount = paymentIssueCount,
                        ProcessingPaymentCount = processingPayments.Count,
                        OldestProcessingPaymentDate = oldestProcessingPaymentDate,
                        HasLongProcessingPayment = hasLongProcessingPayment,
                        PaymentIssueSummary = paymentIssueSummary
                    };
                }).ToList();

                // 🔹 Response DTO
                var response = new RentCollectionResponseDto
                {
                    Summary = new RentCollectionSummaryDto
                    {
                        PropertyId = propertyId,
                        TotalMonthlyRent = totalMonthlyRent,
                        CollectedThisMonth = collectedThisMonth,
                        ExpectedThisMonth = expectedThisMonth,
                        RemainingThisMonth = remainingThisMonth,
                        Outstanding = outstanding,
                        Overdue = overdue,
                        CollectedLifetime = collectedLifetime,
                        LastUpdated = DateTime.UtcNow
                    },
                    RentRecords = rentRecords
                };

                return new ServiceResponse<RentCollectionResponseDto> { Data = response };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving rent collection");
                return ServiceResponse<RentCollectionResponseDto>.CreateError("Error retrieving rent collection", ex.Message);
            }
        }


        public async Task<ServiceResponse<RentRecordDto>> AddPayment(AddPaymentDto newPayment)
        {
            try
            {
                // Validate lease exists - get organizationId from context
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<RentRecordDto>.CreateError("Organization ID is required", "No organization context found");
                }

                var lease = await _leaseRepository.GetLeaseById(newPayment.LeaseId, organizationId.Value);
                if (lease == null || !lease.IsActive)
                {
                    return ServiceResponse<RentRecordDto>.CreateError("Lease not found or archived");
                }

                // Set method based on payment source
                // If CreatedByUserId is set, it's a manual entry by landlord
                // If Method is already set (e.g., from Stripe), keep it
                if (string.IsNullOrEmpty(newPayment.Method))
                {
                    if (newPayment.CreatedByUserId.HasValue)
                    {
                        newPayment.Method = "Manual Entry";
                    }
                    else
                    {
                        newPayment.Method = "Online Payment";
                    }
                }

                // Use PaymentService to ensure ledger entries are created
                var paymentServiceResponse = await _paymentService.AddPayment(newPayment);
                if (!paymentServiceResponse.Success)
                {
                    return ServiceResponse<RentRecordDto>.CreateError(paymentServiceResponse.Message ?? "Failed to add payment");
                }

                // Get the newly created payment ID from the response
                var newPaymentId = paymentServiceResponse.Data?.FirstOrDefault()?.Id;

                // Get landlord ID from lease property and create notification
                try
                {
                    var leaseWithProperty = await _context.Leases
                        .Include(l => l.Unit)
                            .ThenInclude(u => u.Property)
                        .FirstOrDefaultAsync(l => l.Id == newPayment.LeaseId);

                    if (leaseWithProperty != null)
                    {
                        var landlordId = leaseWithProperty.Unit.Property.LandlordId;

                        // Determine performer name
                        string? performedByName = null;
                        if (newPayment.CreatedByUserId.HasValue)
                        {
                            var user = await _userRepository.GetUser(newPayment.CreatedByUserId.Value);
                            performedByName = user != null ? $"{user.FirstName} {user.LastName}".Trim() : null;
                        }
                        else if (!string.IsNullOrEmpty(newPayment.Method) &&
                            (newPayment.Method.Contains("Online", StringComparison.OrdinalIgnoreCase) ||
                             newPayment.Method.Contains("Stripe", StringComparison.OrdinalIgnoreCase)))
                        {
                            performedByName = "Tenant Payment";
                        }
                        else
                        {
                            performedByName = "System";
                        }

                        // Create notification for payment confirmation
                        var notificationDto = new CreateNotificationDto
                        {
                            UserId = landlordId,
                            Type = ENotificationType.Payment,
                            Title = "Payment Received",
                            Message = $"Payment of ${newPayment.Amount:F2} was received for {lease.PropertyName} on {newPayment.PaymentDate:MM/dd/yyyy}",
                            RelatedId = newPayment.LeaseId,
                            SendEmail = true,
                            SendSMS = true,
                            PerformedByUserId = newPayment.CreatedByUserId,
                            PerformedByName = performedByName ?? "System"
                        };

                        await _notificationService.CreateNotification(notificationDto);
                    }
                }
                catch (Exception ex)
                {
                    // Log but don't fail payment processing if notification fails
                    _logger.LogWarning(ex, "Failed to create notification for payment {LeaseId}", newPayment.LeaseId);
                }

                // Return updated rent record (rent-only payments for balance/overdue)
                var payments = await _paymentRepository.GetRentPaymentsByLeaseId(newPayment.LeaseId);
                var rentPayments = payments.Sum(p => p.Amount); // All payments are rent payments

                var rentRecord = new RentRecordDto
                {
                    Id = lease.Id,
                    Tenants = lease.Tenants.ToList(),
                    PropertyName = lease.PropertyName,
                    PropertyType = Enum.Parse<Enums.EPropertyType>(lease.PropertyType),
                    UnitName = lease.UnitName,
                    RentAmount = lease.RentAmount ?? 0m,
                    DueDate = lease.NextDueDate ?? DateTime.UtcNow,
                    OverdueAmount = RentCalculator.CalculateOverdueForLease(lease, payments),
                    AmountDueNow = RentCalculator.GetAmountDueNow(lease, payments),
                    CollectedLifetime = rentPayments,
                    Outstanding = RentCalculator.OutstandingForLease(lease, payments),
                    LeaseId = lease.Id,
                    Status = RentCalculator.GetStatus(lease, payments)
                };

                return new ServiceResponse<RentRecordDto> { Data = rentRecord };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing payment");
                return ServiceResponse<RentRecordDto>.CreateError("Error processing payment", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> SendRentReminder(long leaseId)
        {
            try
            {
                // Get lease with tenants - filter by organizationId from context
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<bool>.CreateError("Organization ID is required", "No organization context found");
                }

                var lease = await _leaseRepository.GetLeaseById(leaseId, organizationId.Value);
                if (lease == null || !lease.IsActive)
                {
                    return ServiceResponse<bool>.CreateError("Lease not found or archived");
                }

                // Get rent-only payments to determine if overdue
                var payments = await _paymentRepository.GetRentPaymentsByLeaseId(leaseId);
                var status = RentCalculator.GetStatus(lease, payments);
                var today = DateTime.Today;
                if (!lease.StartDate.HasValue || !lease.EndDate.HasValue || !lease.RentDueDay.HasValue)
                    return ServiceResponse<bool>.CreateError("Lease is missing required date information");

                var nextDueDate = RentCalculator.CalculateNextDueDate(lease.StartDate.Value, lease.EndDate.Value, lease.RentDueDay.Value);
                var daysUntilDue = (nextDueDate - today).Days;

                // Determine message based on status
                string title;
                string message;
                if (status == Enums.ERentStatus.Overdue)
                {
                    var overdueAmount = RentCalculator.CalculateOverdueForLease(lease, payments);
                    title = "Rent Overdue Reminder";
                    message = $"Reminder: Your rent of ${lease.RentAmount:F2} for {lease.PropertyName} is overdue. Total overdue amount: ${overdueAmount:F2}. Please make a payment as soon as possible.";
                }
                else if (daysUntilDue <= 0)
                {
                    title = "Rent Due Today";
                    message = $"Reminder: Your rent of ${lease.RentAmount:F2} for {lease.PropertyName} is due today ({nextDueDate:MM/dd/yyyy}).";
                }
                else
                {
                    title = "Rent Due Reminder";
                    message = $"Reminder: Your rent of ${lease.RentAmount:F2} for {lease.PropertyName} is due in {daysUntilDue} day{(daysUntilDue == 1 ? "" : "s")} on {nextDueDate:MM/dd/yyyy}.";
                }

                // Send notifications to all tenants on the lease
                int notificationsSent = 0;
                foreach (var tenant in lease.Tenants)
                {
                    if (tenant.UserId.HasValue)
                    {
                        try
                        {
                            var tenantNotificationDto = new CreateNotificationDto
                            {
                                UserId = tenant.UserId.Value,
                                Type = ENotificationType.Rent,
                                Title = title,
                                Message = message,
                                RelatedId = leaseId,
                                SendEmail = true, // Always attempt to send, tenant settings will control actual delivery
                                SendSMS = true
                            };

                            await _notificationService.CreateNotification(tenantNotificationDto);
                            notificationsSent++;
                            _logger.LogInformation("Rent reminder sent to tenant UserId {UserId} for lease {LeaseId}", tenant.UserId.Value, leaseId);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Failed to send rent reminder to tenant UserId {UserId} for lease {LeaseId}", tenant.UserId.Value, leaseId);
                        }
                    }
                }

                if (notificationsSent == 0)
                {
                    return ServiceResponse<bool>.CreateError("No tenants with user accounts found on this lease");
                }

                _logger.LogInformation("Rent reminder sent to {Count} tenant(s) for lease {LeaseId}", notificationsSent, leaseId);
                return new ServiceResponse<bool> { Data = true, Message = $"Reminder sent to {notificationsSent} tenant(s)" };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending rent reminder for lease {LeaseId}", leaseId);
                return ServiceResponse<bool>.CreateError("Error sending rent reminder", ex.Message);
            }
        }
    }
}
