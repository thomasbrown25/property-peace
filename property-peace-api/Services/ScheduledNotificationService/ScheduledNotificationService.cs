using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Dtos.Tenant;
using brownstone_hub_api.Dtos.NotificationSetting;
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Dtos.Expense;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.Notifications;
using brownstone_hub_api.Repositories.NotificationSettings;
using brownstone_hub_api.Repositories.Payments;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Expenses;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Services.AnnouncementService;
using brownstone_hub_api.Utils;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.ScheduledNotificationService
{
    public class ScheduledNotificationService(
        INotificationService notificationService,
        INotificationSettingRepository notificationSettingRepository,
        INotificationRepository notificationRepository,
        ILeaseRepository leaseRepository,
        IPaymentRepository paymentRepository,
        IPropertyRepository propertyRepository,
        IUserRepository userRepository,
        IExpenseRepository expenseRepository,
        IAnnouncementService announcementService,
        DataContext context,
        ILogger<ScheduledNotificationService> logger) : IScheduledNotificationService
    {
        private readonly INotificationService _notificationService = notificationService;
        private readonly INotificationSettingRepository _notificationSettingRepository = notificationSettingRepository;
        private readonly INotificationRepository _notificationRepository = notificationRepository;
        private readonly ILeaseRepository _leaseRepository = leaseRepository;
        private readonly IPaymentRepository _paymentRepository = paymentRepository;
        private readonly IPropertyRepository _propertyRepository = propertyRepository;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly IExpenseRepository _expenseRepository = expenseRepository;
        private readonly IAnnouncementService _announcementService = announcementService;
        private readonly DataContext _context = context;
        private readonly ILogger<ScheduledNotificationService> _logger = logger;

        public async Task ProcessScheduledNotifications()
        {
            try
            {
                _logger.LogInformation("Starting scheduled notification processing at {Time}", DateTime.Now);

                // Get all landlords
                var landlordIds = await GetAllLandlords();

                foreach (var landlordId in landlordIds)
                {
                    try
                    {
                        // Remind landlords to set up rent payments if lease uses platform but property not linked (every 5 days; does not depend on notification settings)
                        await ProcessRentPaymentSetupReminders(landlordId);

                        var settings = await _notificationSettingRepository.GetNotificationSettings(landlordId);
                        if (settings == null)
                            continue;

                        // Process rent reminders
                        if (settings.RentReminders.Email || settings.RentReminders.Phone || settings.RentReminders.InApp)
                        {
                            await ProcessRentReminders(landlordId, settings);
                        }

                        // Process overdue alerts
                        if (settings.OverdueAlerts.Email || settings.OverdueAlerts.Phone || settings.OverdueAlerts.InApp)
                        {
                            await ProcessOverdueAlerts(landlordId, settings);
                        }

                        // Process lease expiration alerts
                        if (settings.LeaseExpiration.Email || settings.LeaseExpiration.Phone || settings.LeaseExpiration.InApp)
                        {
                            await ProcessLeaseExpirationAlerts(landlordId, settings);
                        }

                        // Process upcoming recurring expense notifications
                        // Note: We'll use RentReminders preference for now (can add dedicated preference later)
                        if (settings.RentReminders.Email || settings.RentReminders.Phone || settings.RentReminders.InApp)
                        {
                            await ProcessUpcomingRecurringExpenseNotifications(landlordId, settings);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error processing notifications for landlord {LandlordId}", landlordId);
                    }
                }

                _logger.LogInformation("Completed scheduled notification processing at {Time}", DateTime.Now);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in scheduled notification processing");
            }
        }

        private async Task<List<long>> GetAllLandlords()
        {
            try
            {
                // Get unique landlord IDs from properties
                var landlordIds = await _context.Properties
                    .Select(p => p.LandlordId)
                    .Distinct()
                    .ToListAsync();

                return landlordIds;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all landlords");
                return new List<long>();
            }
        }

        /// <summary>
        /// Sends in-app and email reminders to landlords who have leases set to collect rent through the app
        /// but have not linked an operating bank account (OperatingAccountId) on the lease. Runs every 5 days.
        /// </summary>
        private async Task ProcessRentPaymentSetupReminders(long landlordId)
        {
            try
            {
                var leases = await _leaseRepository.GetLeasesByLandlordId(landlordId, isActive: true);
                var needsSetup = leases
                    .Where(l => l.RentCollectionByPlatform == true &&
                                (l.OperatingAccountId == null || l.OperatingAccountId == 0))
                    .ToList();

                if (needsSetup.Count == 0)
                    return;

                var since = DateTime.UtcNow.AddDays(-5);
                var alreadySent = await _notificationRepository.NotificationOfTypeExistsSince(
                    landlordId, ENotificationType.RentPaymentSetupReminder, since);
                if (alreadySent)
                {
                    _logger.LogDebug("Rent payment setup reminder already sent to landlord {LandlordId} in the last 5 days, skipping", landlordId);
                    return;
                }

                var firstLease = needsSetup[0];
                var propertyNames = needsSetup
                    .Select(l => l.PropertyName)
                    .Where(n => !string.IsNullOrWhiteSpace(n))
                    .Distinct()
                    .ToList();
                var propertyList = propertyNames.Count > 0
                    ? string.Join(", ", propertyNames.Take(3))
                    : "your property";
                if (propertyNames.Count > 3)
                    propertyList += $" and {propertyNames.Count - 3} more";

                const string title = "Set up rent payments";
                var message = needsSetup.Count == 1
                    ? $"Your lease for {propertyList} is set to collect rent through the app, but no bank account is linked yet. Link an operating account to start receiving payments."
                    : $"You have {needsSetup.Count} leases set to collect rent through the app ({propertyList}) with no bank account linked. Link an operating account to start receiving payments.";

                var notificationDto = new CreateNotificationDto
                {
                    UserId = landlordId,
                    Type = ENotificationType.RentPaymentSetupReminder,
                    Title = title,
                    Message = message,
                    RelatedId = firstLease.PropertyId,
                    SendEmail = true,
                    SendSMS = false
                };

                await _notificationService.CreateNotification(notificationDto);
                _logger.LogInformation("Sent rent payment setup reminder to landlord {LandlordId} for {Count} property/ies", landlordId, needsSetup.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing rent payment setup reminders for landlord {LandlordId}", landlordId);
            }
        }

        /// <summary>
        /// Sends one combined payment reminder per tenant per lease per day: rent, fees, and deposits due at 15, 2, 1, or 0 days.
        /// </summary>
        private async Task ProcessRentReminders(long landlordId, NotificationSettingDto settings)
        {
            try
            {
                var userSettings = await _userRepository.GetUserSettings(landlordId);
                var timezone = userSettings?.Timezone;
                var today = string.IsNullOrWhiteSpace(timezone) ? DateTime.Today : TimezoneHelper.GetLocalToday(timezone);

                var leases = await _leaseRepository.GetLeasesByLandlordId(landlordId, true);
                if (leases.Count == 0)
                    return;

                var leaseIds = leases.Select(l => l.Id).ToList();
                var rentPaymentsByLease = await _paymentRepository.GetRentPaymentsByLeaseIds(leaseIds);
                var allPaymentsByLease = await _paymentRepository.GetPaymentsByLeaseIds(leaseIds);

                foreach (var lease in leases)
                {
                    if (!lease.IsActive || lease.LeaseAgreement?.IsDrafted == true ||
                        !lease.StartDate.HasValue || !lease.EndDate.HasValue ||
                        lease.StartDate.Value > today)
                        continue;

                    var tenantsWithAccounts = lease.Tenants?.Where(t => t.UserId.HasValue).ToList() ?? new List<LoadTenantDto>();
                    if (tenantsWithAccounts.Count == 0)
                    {
                        _logger.LogDebug("Skipping lease {LeaseId}: no tenants with user accounts", lease.Id);
                        continue;
                    }

                    var allPaymentsForLease = allPaymentsByLease.GetValueOrDefault(lease.Id) ?? new List<LoadPaymentDto>();
                    var rentPayments = rentPaymentsByLease.GetValueOrDefault(lease.Id) ?? new List<LoadPaymentDto>();
                    var (title, message) = BuildCombinedPaymentReminder(lease, today, timezone, rentPayments, allPaymentsForLease);
                    if (title == null)
                        continue;

                    await SendReminderToTenantsAsync(lease.Id, tenantsWithAccounts, title, message);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing rent reminders for landlord {LandlordId}", landlordId);
            }
        }

        /// <summary>
        /// Builds one combined reminder (title, message) for a lease. Returns (null, null) if nothing is due at 15/2/1/0 days.
        /// </summary>
        private (string? Title, string? Message) BuildCombinedPaymentReminder(
            LoadLeaseDto lease,
            DateTime today,
            string? timezone,
            List<LoadPaymentDto> rentPayments,
            List<LoadPaymentDto> allPaymentsForLease)
        {
            static DateTime LocalDueDate(DateTime dueDate, string? tz)
            {
                if (string.IsNullOrWhiteSpace(tz)) return dueDate.Date;
                return TimezoneHelper.ConvertToLocal(DateTime.SpecifyKind(dueDate, DateTimeKind.Utc), tz).Date;
            }

            var reminderDays = new[] { 15, 2, 1, 0 };
            var lines = new List<string>();

            // Rent due at 15, 2, 1, 0 days (only if balance due)
            if (lease.RentAmount.HasValue && lease.RentDueDay.HasValue)
            {
                var nextDueDate = RentCalculator.CalculateNextDueDate(lease.StartDate!.Value, lease.EndDate!.Value, lease.RentDueDay.Value, timezone);
                var daysUntilDue = (nextDueDate - today).Days;
                if (reminderDays.Contains(daysUntilDue))
                {
                    var amountDue = RentCalculator.GetAmountDueNow(lease, rentPayments, timezone);
                    if (amountDue > 0)
                        lines.Add($"Rent: ${amountDue:F2} due {(daysUntilDue == 0 ? "today" : $"in {daysUntilDue} day{(daysUntilDue == 1 ? "" : "s")}")} ({nextDueDate:MM/dd/yyyy})");
                }
            }

            // Fees (exclude late fees)
            if (lease.Fees != null)
            {
                foreach (var fee in lease.Fees.Where(f => !f.IsLateFee))
                {
                    var localDue = LocalDueDate(fee.DueDate, timezone);
                    var daysUntilDue = (localDue - today).Days;
                    if (!reminderDays.Contains(daysUntilDue))
                        continue;
                    var paidForFee = allPaymentsForLease.Where(p => p.FeeId == fee.Id).Sum(p => p.Amount);
                    var balanceDue = fee.Amount - paidForFee;
                    if (balanceDue <= 0)
                        continue;
                    lines.Add($"{fee.Name}: ${balanceDue:F2} due {(daysUntilDue == 0 ? "today" : $"in {daysUntilDue} day{(daysUntilDue == 1 ? "" : "s")}")} ({localDue:MM/dd/yyyy})");
                }
            }

            // Other deposits (LeaseDeposit)
            if (lease.LeaseDeposits != null)
            {
                foreach (var dep in lease.LeaseDeposits)
                {
                    var localDue = LocalDueDate(dep.DueDate, timezone);
                    var daysUntilDue = (localDue - today).Days;
                    if (!reminderDays.Contains(daysUntilDue))
                        continue;
                    lines.Add($"{dep.Name}: ${dep.Amount:F2} due {(daysUntilDue == 0 ? "today" : $"in {daysUntilDue} day{(daysUntilDue == 1 ? "" : "s")}")} ({localDue:MM/dd/yyyy})");
                }
            }

            if (lines.Count == 0)
                return (null, null);

            var propName = lease.PropertyName ?? "your property";
            var title = $"Payment reminder: {propName}";
            var message = $"Reminder for {propName}: " + string.Join("; ", lines) + ".";
            return (title, message);
        }

        /// <summary>
        /// Sends one combined reminder to all tenants (one email, one in-app per tenant), with duplicate check per tenant per day.
        /// </summary>
        private async Task SendReminderToTenantsAsync(long leaseId, List<LoadTenantDto> tenants, string title, string message)
        {
            foreach (var tenant in tenants.Where(t => t.UserId.HasValue))
            {
                try
                {
                    if (await _notificationRepository.NotificationExistsToday(tenant.UserId!.Value, ENotificationType.Rent, leaseId, title))
                        continue;

                    await _notificationService.CreateNotification(new CreateNotificationDto
                    {
                        UserId = tenant.UserId!.Value,
                        Type = ENotificationType.Rent,
                        Title = title,
                        Message = message,
                        RelatedId = leaseId,
                        SendEmail = true,
                        SendSMS = true
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to send reminder to tenant {UserId} for lease {LeaseId}", tenant.UserId, leaseId);
                }
            }
        }

        /// <inheritdoc />
        public async Task ProcessRentRemindersForLeaseAsync(long leaseId)
        {
            var lease = await _leaseRepository.GetLeaseByIdForAdminAsync(leaseId);
            if (lease == null)
                throw new ArgumentException($"Lease {leaseId} not found.", nameof(leaseId));

            var landlordId = lease.LandlordId;
            var settings = await _notificationSettingRepository.GetNotificationSettings(landlordId);
            if (settings == null)
            {
                _logger.LogWarning("No notification settings for landlord {LandlordId}, skipping rent reminder for lease {LeaseId}", landlordId, leaseId);
                return;
            }

            if (!settings.RentReminders.Email && !settings.RentReminders.Phone)
            {
                _logger.LogDebug("Rent reminders disabled for landlord {LandlordId}, skipping lease {LeaseId}", landlordId, leaseId);
                return;
            }

            var userSettings = await _userRepository.GetUserSettings(landlordId);
            var timezone = userSettings?.Timezone;
            var today = string.IsNullOrWhiteSpace(timezone) ? DateTime.Today : TimezoneHelper.GetLocalToday(timezone);

            if (!lease.IsActive || lease.LeaseAgreement?.IsDrafted == true ||
                !lease.StartDate.HasValue || !lease.EndDate.HasValue ||
                lease.StartDate.Value > today)
            {
                _logger.LogInformation("Lease {LeaseId} not eligible for reminders (inactive, draft, or not started)", leaseId);
                return;
            }

            var tenantsWithAccounts = lease.Tenants?.Where(t => t.UserId.HasValue).ToList() ?? new List<LoadTenantDto>();
            if (tenantsWithAccounts.Count == 0)
            {
                _logger.LogInformation("Lease {LeaseId}: no tenants with user accounts", leaseId);
                return;
            }

            var allPaymentsByLease = await _paymentRepository.GetPaymentsByLeaseIds(new List<long> { leaseId });
            var allPaymentsForLease = allPaymentsByLease.GetValueOrDefault(leaseId) ?? new List<LoadPaymentDto>();
            var rentPaymentsByLease = await _paymentRepository.GetRentPaymentsByLeaseIds(new List<long> { leaseId });
            var rentPayments = rentPaymentsByLease.GetValueOrDefault(leaseId) ?? new List<LoadPaymentDto>();

            var (title, message) = BuildCombinedPaymentReminder(lease, today, timezone, rentPayments, allPaymentsForLease);
            if (title != null && message != null)
                await SendReminderToTenantsAsync(lease.Id, tenantsWithAccounts, title, message);
        }

        private async Task ProcessOverdueAlerts(long landlordId, NotificationSettingDto settings)
        {
            try
            {
                // Get user's timezone
                var userSettings = await _userRepository.GetUserSettings(landlordId);
                var timezone = userSettings?.Timezone;
                var today = string.IsNullOrWhiteSpace(timezone) ? DateTime.Today : TimezoneHelper.GetLocalToday(timezone);
                
                var leases = await _leaseRepository.GetLeasesByLandlordId(landlordId, true);
                var payments = await _paymentRepository.GetLifetimeRentPaymentsByLandlordId(landlordId);

                _logger.LogInformation("Processing overdue alerts for landlord {LandlordId}, found {LeaseCount} leases", landlordId, leases.Count);

                foreach (var lease in leases)
                {
                    if (!lease.IsActive || !lease.StartDate.HasValue || lease.StartDate.Value > today)
                    {
                        _logger.LogDebug("Skipping lease {LeaseId}: IsActive={IsActive}, StartDate={StartDate}, Today={Today}", 
                            lease.Id, lease.IsActive, lease.StartDate, today);
                        continue;
                    }

                    if (lease.LeaseAgreement?.IsDrafted == true)
                    {
                        _logger.LogDebug("Skipping draft lease {LeaseId} for overdue alerts", lease.Id);
                        continue;
                    }

                    var status = RentCalculator.GetStatus(lease, payments, timezone);
                    _logger.LogDebug("Lease {LeaseId} status: {Status}", lease.Id, status);

                    // Calculate days since the last rent due date. Landlord "rent not paid yet"
                    // alerts should be sparse: one alert per lease per rent cycle, after the
                    // lease grace period has passed (or one day after due date when no grace period exists).
                    var lastDueDate = CalculateLastDueDate(lease, today, timezone);
                    var daysOverdue = (today - lastDueDate).Days;

                    if (daysOverdue <= 0) continue; // Not past due yet

                    var lateFeeRule = lease.Fees?.FirstOrDefault(f => f.IsLateFee && f.LateFeeType == "OneTime" && f.AppliedAfterDays.HasValue)
                                  ?? lease.Fees?.FirstOrDefault(f => f.IsLateFee && f.AppliedAfterDays.HasValue);
                    var gracePeriodDays = lateFeeRule?.AppliedAfterDays ?? 0;
                    var alertDay = Math.Max(1, gracePeriodDays);

                    if (daysOverdue != alertDay)
                    {
                        _logger.LogDebug("Lease {LeaseId} is {DaysOverdue} day(s) past due date with alert day {AlertDay}; skipping landlord unpaid-rent alert", lease.Id, daysOverdue, alertDay);
                        continue;
                    }

                    var unpaidAmount = RentCalculator.CalculateOverdueForLease(lease, payments, timezone);
                    if (unpaidAmount <= 0)
                        continue;
                    var tenantNames = lease.Tenants?
                        .Where(t => t.IsActive)
                        .Select(t => $"{t.Firstname} {t.Lastname}".Trim())
                        .Where(n => !string.IsNullOrEmpty(n))
                        .ToList() ?? new List<string>();
                    var tenantLabel = tenantNames.Count switch
                    {
                        0 => "Your tenant",
                        1 => tenantNames[0],
                        _ => $"{tenantNames[0]} & others"
                    };
                    var title = $"{tenantLabel} hasn't paid their rent yet";
                    var alertWindowStart = lastDueDate.Date;
                    var alreadySentForCycle = await _notificationRepository.NotificationExistsSinceForLease(
                        landlordId,
                        ENotificationType.Rent,
                        lease.Id,
                        title,
                        alertWindowStart);

                    if (alreadySentForCycle)
                    {
                        _logger.LogDebug("Unpaid rent alert already sent for lease {LeaseId} in this rent cycle, skipping", lease.Id);
                        continue;
                    }

                    try
                    {
                        _logger.LogInformation("Creating unpaid rent alert for lease {LeaseId}, landlord {LandlordId}, days since due date: {DaysOverdue}, amount: {Amount}",
                            lease.Id, landlordId, daysOverdue, unpaidAmount);

                        var notificationDto = new CreateNotificationDto
                        {
                            UserId = landlordId,
                            Type = ENotificationType.Rent,
                            Title = title,
                            Message = $"Rent of ${lease.RentAmount!.Value:F2} is unpaid for {lease.PropertyName}. Amount due: ${unpaidAmount:F2}",
                            RelatedId = lease.Id,
                            // Landlords already receive unpaid-rent details in the daily summary;
                            // do not send a separate email alert for the same overdue tenant/rent event.
                            SendEmail = false,
                            SendSMS = settings.OverdueAlerts.Phone,
                            SendInApp = settings.OverdueAlerts.InApp
                        };

                        await _notificationService.CreateNotification(notificationDto);
                        _logger.LogInformation("Successfully created overdue alert notification for lease {LeaseId}", lease.Id);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to create overdue alert notification for lease {LeaseId}", lease.Id);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing overdue alerts for landlord {LandlordId}", landlordId);
            }
        }

        private async Task ProcessLeaseExpirationAlerts(long landlordId, NotificationSettingDto settings)
        {
            try
            {
                var today = DateTime.Today;
                var leases = await _leaseRepository.GetLeasesByLandlordId(landlordId, true);

                foreach (var lease in leases)
                {
                    if (!lease.IsActive || !lease.EndDate.HasValue || lease.EndDate.Value <= today)
                        continue;

                    var daysUntilExpiration = (lease.EndDate.Value.Date - today).Days;

                    // Send alerts at 90, 60, 30 days before expiration, and on expiration date
                    if (daysUntilExpiration == 90 || daysUntilExpiration == 60 || daysUntilExpiration == 30 || daysUntilExpiration == 0)
                    {
                        try
                        {
                            var title = daysUntilExpiration == 0 ? "Lease Expires Today" : "Lease Expiring Soon";
                            
                            // Check if we already sent this notification today to avoid duplicates
                            var alreadySent = await _notificationRepository.NotificationExistsToday(
                                landlordId, 
                                ENotificationType.Lease, 
                                lease.Id, 
                                title);

                            if (alreadySent)
                            {
                                _logger.LogInformation("Lease expiration notification already sent today for lease {LeaseId}, skipping", lease.Id);
                                continue;
                            }

                            var message = daysUntilExpiration == 0
                                ? $"Lease for {lease.PropertyName} expires today"
                                : $"Lease for {lease.PropertyName} expires in {daysUntilExpiration} days on {lease.EndDate!.Value:MM/dd/yyyy}";

                            var notificationDto = new CreateNotificationDto
                            {
                                UserId = landlordId,
                                Type = ENotificationType.Lease,
                                Title = title,
                                Message = message,
                                RelatedId = lease.Id,
                                SendEmail = settings.LeaseExpiration.Email,
                                SendSMS = settings.LeaseExpiration.Phone
                            };

                            await _notificationService.CreateNotification(notificationDto);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Failed to create lease expiration notification for lease {LeaseId}", lease.Id);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing lease expiration alerts for landlord {LandlordId}", landlordId);
            }
        }

        private DateTime CalculateLastDueDate(LoadLeaseDto lease, DateTime today, string? timezone = null)
        {
            // Check for required nullable fields
            if (!lease.StartDate.HasValue || !lease.EndDate.HasValue || !lease.RentDueDay.HasValue)
            {
                // Return a default date if required fields are missing
                return today;
            }

            // Use the same logic as RentCalculator for calculating the first due date
            DateTime firstDueDate;
            if (lease.RentDueDay.Value == lease.StartDate.Value.Day)
            {
                // Rent due day matches start day - first payment is due on the lease start date
                firstDueDate = lease.StartDate.Value;
            }
            else
            {
                firstDueDate = new DateTime(lease.StartDate.Value.Year, lease.StartDate.Value.Month, lease.RentDueDay.Value);
                if (firstDueDate < lease.StartDate.Value)
                {
                    // If due day is before start date, first payment is next month
                    firstDueDate = firstDueDate.AddMonths(1);
                }
            }

            // Find the last due date that has passed
            var lastDueDate = firstDueDate;
            
            // Calculate the current month's due date
            var currentDueDate = new DateTime(today.Year, today.Month, lease.RentDueDay.Value);
            
            // If today is past the current month's due date, that's the last due date
            if (today >= currentDueDate && currentDueDate >= firstDueDate)
            {
                lastDueDate = currentDueDate;
            }
            else
            {
                // Otherwise, find the last due date before today
                while (lastDueDate.AddMonths(1) <= today)
                {
                    var nextDueDate = lastDueDate.AddMonths(1);
                    if (nextDueDate > today)
                        break;
                    lastDueDate = nextDueDate;
                }
            }

            // Cap at lease end date
            if (lastDueDate > lease.EndDate.Value)
            {
                lastDueDate = lease.EndDate.Value;
            }

            return lastDueDate;
        }

        private async Task ProcessUpcomingRecurringExpenseNotifications(long landlordId, NotificationSettingDto settings)
        {
            try
            {
                var today = DateTime.Today;
                // Get all recurring expenses (expenses where IsRecurring is true)
                var recurringExpenses = await _expenseRepository.GetExpensesByLandlordId(landlordId, isRecurring: true);

                foreach (var recurringExpense in recurringExpenses)
                {
                    if (recurringExpense.IsPaused || 
                        recurringExpense.StartDate > today ||
                        (recurringExpense.EndDate.HasValue && recurringExpense.EndDate.Value < today))
                        continue;

                    if (!recurringExpense.NextOccurrenceDate.HasValue)
                        continue;

                    var daysUntilNext = (recurringExpense.NextOccurrenceDate.Value - today).Days;

                    // Send notifications at 7 days, 3 days, and 1 day before due date
                    if (daysUntilNext == 7 || daysUntilNext == 3 || daysUntilNext == 1)
                    {
                        try
                        {
                            var title = daysUntilNext == 1 
                                ? "Recurring Expense Due Tomorrow" 
                                : $"Recurring Expense Due in {daysUntilNext} Days";
                            
                            // Check if we already sent this notification today to avoid duplicates
                            var alreadySent = await _notificationRepository.NotificationExistsToday(
                                landlordId, 
                                ENotificationType.Expense, 
                                recurringExpense.Id, 
                                title);

                            if (alreadySent)
                            {
                                _logger.LogInformation("Recurring expense notification already sent today for {RecurringExpenseId}, skipping", recurringExpense.Id);
                                continue;
                            }

                            var message = $"Recurring expense '{recurringExpense.Name}' of ${recurringExpense.Amount:F2} is due on {recurringExpense.NextOccurrenceDate.Value:MM/dd/yyyy} for {recurringExpense.PropertyName ?? "property"}";

                            var notificationDto = new CreateNotificationDto
                            {
                                UserId = landlordId,
                                Type = ENotificationType.Expense,
                                Title = title,
                                Message = message,
                                RelatedId = recurringExpense.Id,
                                SendEmail = settings.RentReminders.Email, // Using RentReminders preference for now
                                SendSMS = settings.RentReminders.Phone
                            };

                            await _notificationService.CreateNotification(notificationDto);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Failed to create recurring expense notification for {RecurringExpenseId}", recurringExpense.Id);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing upcoming recurring expense notifications for landlord {LandlordId}", landlordId);
            }
        }

        public async Task ProcessScheduledAnnouncements()
        {
            try
            {
                _logger.LogInformation("Starting scheduled announcement processing at {Time}", DateTime.UtcNow);

                // Get all announcements that are scheduled and due to be sent
                var now = DateTime.UtcNow;
                var dueAnnouncements = await _context.Announcements
                    .Where(a => a.ScheduledAt.HasValue 
                        && a.ScheduledAt.Value <= now 
                        && !a.IsCompleted)
                    .ToListAsync();

                _logger.LogInformation("Found {Count} scheduled announcements due to be sent", dueAnnouncements.Count);

                foreach (var announcement in dueAnnouncements)
                {
                    try
                    {
                        _logger.LogInformation("Processing scheduled announcement {AnnouncementId} scheduled for {ScheduledAt}", 
                            announcement.Id, announcement.ScheduledAt);

                        var success = await _announcementService.SendScheduledAnnouncementAsync(announcement.Id);
                        
                        if (success)
                        {
                            _logger.LogInformation("Successfully sent scheduled announcement {AnnouncementId}", announcement.Id);
                        }
                        else
                        {
                            _logger.LogWarning("Failed to send scheduled announcement {AnnouncementId}", announcement.Id);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error processing scheduled announcement {AnnouncementId}", announcement.Id);
                    }
                }

                _logger.LogInformation("Completed scheduled announcement processing at {Time}", DateTime.UtcNow);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in scheduled announcement processing");
            }
        }
    }
}

