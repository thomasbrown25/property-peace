using System.Net;
using System.Text;
using brownstone_hub_api.Data;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Utils;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.DailySummaryEmailService
{
    public class DailySummaryEmailService(
        DataContext context,
        IEmailService emailService,
        IConfiguration configuration,
        ILogger<DailySummaryEmailService> logger) : IDailySummaryEmailService
    {
        private const string JobName = "DailySummaryEmail";
        private const string InitialRecipientAllowlistDefault = "tbrown@brownstonehub.com";
        private static readonly TimeSpan SendTimeEastern = new(10, 0, 0);
        private static readonly TimeSpan SendWindow = TimeSpan.FromMinutes(30);

        private readonly DataContext _context = context;
        private readonly IEmailService _emailService = emailService;
        private readonly IConfiguration _configuration = configuration;
        private readonly ILogger<DailySummaryEmailService> _logger = logger;

        public async Task RunDueDailySummariesAsync(CancellationToken cancellationToken = default)
        {
            var easternNow = GetEasternNow();
            if (easternNow.TimeOfDay < SendTimeEastern || easternNow.TimeOfDay >= SendTimeEastern.Add(SendWindow))
            {
                return;
            }

            await RunDailySummariesForDateAsync(easternNow.Date, cancellationToken);
        }

        public async Task RunImmediateDailySummariesAsync(CancellationToken cancellationToken = default)
        {
            var easternNow = GetEasternNow();
            await RunDailySummariesForDateAsync(easternNow.Date, cancellationToken, forceResend: true);
        }

        private async Task RunDailySummariesForDateAsync(DateTime easternDate, CancellationToken cancellationToken, bool forceResend = false)
        {
            var allowedRecipients = GetAllowedRecipients();
            if (allowedRecipients.Count == 0)
            {
                _logger.LogInformation("Daily summary email allowlist is empty; skipping.");
                return;
            }

            var users = await _context.Users
                .Where(u => !u.IsDeleted && !u.IsSuspended && allowedRecipients.Contains(u.Email.ToLower()))
                .ToListAsync(cancellationToken);

            foreach (var user in users)
            {
                await SendDailySummaryIfDueAsync(user, easternDate, cancellationToken, forceResend);
            }
        }

        public async Task<bool> UnsubscribeAsync(string token, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(token))
            {
                return false;
            }

            var settings = await _context.NotificationSettings
                .FirstOrDefaultAsync(s => s.DailySummaryUnsubscribeToken == token, cancellationToken);

            if (settings == null)
            {
                return false;
            }

            settings.DailySummaryEmail = false;
            settings.UpdatedDate = DateTime.Now;
            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }

        private async Task SendDailySummaryIfDueAsync(User user, DateTime easternDate, CancellationToken cancellationToken, bool forceResend = false)
        {
            var jobId = $"daily-summary-email:{user.Id}:{easternDate:yyyy-MM-dd}";
            var alreadySent = await _context.JobRunHistories
                .AnyAsync(j => j.JobId == jobId && j.Status == "Completed", cancellationToken);

            if (alreadySent && !forceResend)
            {
                return;
            }

            var settings = await _context.NotificationSettings
                .FirstOrDefaultAsync(s => s.UserId == user.Id, cancellationToken);

            if (settings == null)
            {
                settings = new NotificationSetting
                {
                    UserId = user.Id,
                    EmailAddress = user.Email,
                    DailySummaryUnsubscribeToken = Guid.NewGuid().ToString("N")
                };
                _context.NotificationSettings.Add(settings);
                await _context.SaveChangesAsync(cancellationToken);
            }
            else if (string.IsNullOrWhiteSpace(settings.DailySummaryUnsubscribeToken))
            {
                settings.DailySummaryUnsubscribeToken = Guid.NewGuid().ToString("N");
                await _context.SaveChangesAsync(cancellationToken);
            }

            if (!settings.EmailEnabled || !settings.DailySummaryEmail)
            {
                return;
            }

            var recipient = settings.EmailAddress;
            if (string.IsNullOrWhiteSpace(recipient))
            {
                recipient = user.Email;
            }

            if (!GetAllowedRecipients().Contains(recipient.Trim().ToLower()))
            {
                _logger.LogWarning("Skipping daily summary for user {UserId}; recipient {Recipient} is not allowlisted.", user.Id, recipient);
                return;
            }

            var run = new JobRunHistory
            {
                JobId = jobId,
                JobName = JobName,
                StartedAt = DateTime.UtcNow,
                Status = "Running"
            };
            _context.JobRunHistories.Add(run);
            await _context.SaveChangesAsync(cancellationToken);

            try
            {
                var summary = await BuildSummaryAsync(user, easternDate, cancellationToken);
                var unsubscribeUrl = BuildUnsubscribeUrl(settings.DailySummaryUnsubscribeToken!);
                var subject = $"Your Property Peace daily summary - {easternDate:MMM d}";
                var html = BuildHtmlEmail(user, summary, unsubscribeUrl, easternDate);
                var text = BuildPlainTextEmail(user, summary, unsubscribeUrl, easternDate);

                var sent = await _emailService.SendEmailAsync(recipient, subject, html, text, cancellationToken);
                run.CompletedAt = DateTime.UtcNow;
                run.Status = sent ? "Completed" : "Failed";
                run.Message = sent ? $"Daily summary submitted to {recipient}." : $"Email service returned false for {recipient}.";
                await _context.SaveChangesAsync(cancellationToken);
            }
            catch (Exception ex)
            {
                run.CompletedAt = DateTime.UtcNow;
                run.Status = "Failed";
                run.Message = ex.Message;
                await _context.SaveChangesAsync(cancellationToken);
                _logger.LogError(ex, "Failed to send daily summary email to user {UserId}", user.Id);
            }
        }

        private async Task<DailySummary> BuildSummaryAsync(User user, DateTime easternDate, CancellationToken cancellationToken)
        {
            var ownerOrgIds = await _context.Organizations
                .Where(o => !o.IsDeleted && o.IsActive &&
                    (o.OwnerId == user.Id || o.Members.Any(m => m.UserId == user.Id && m.IsActive && m.Role == "Owner")))
                .Select(o => o.Id)
                .ToListAsync(cancellationToken);

            var properties = await _context.Properties
                .Where(p => !p.IsDeleted && (p.LandlordId == user.Id || (p.OrganizationId.HasValue && ownerOrgIds.Contains(p.OrganizationId.Value))))
                .Select(p => new SummaryProperty(p.Id, p.Name ?? string.Empty, p.StreetAddress, p.OrganizationId))
                .ToListAsync(cancellationToken);

            var propertyIds = properties.Select(p => p.Id).Distinct().ToList();
            var dayStart = easternDate;
            var dayEnd = easternDate.AddDays(1);
            var recentStart = easternDate.AddDays(-1);
            var soon = easternDate.AddDays(7);
            var leaseExpiry = easternDate.AddDays(30);

            var unitCount = await _context.Units
                .CountAsync(u => propertyIds.Contains(u.PropertyId), cancellationToken);

            var payments = await _context.Payments
                .Include(p => p.Lease).ThenInclude(l => l.Unit).ThenInclude(u => u.Property)
                .Where(p => propertyIds.Contains(p.PropertyId) && p.PaymentDate >= recentStart && p.PaymentDate < dayEnd)
                .OrderByDescending(p => p.PaymentDate)
                .Take(8)
                .Select(p => new SummaryPayment(
                    p.Amount,
                    p.Status,
                    p.PaymentDate,
                    p.Method,
                    p.Lease.Unit.Property.Name ?? p.Lease.Unit.Property.StreetAddress,
                    p.Lease.Unit.Name))
                .ToListAsync(cancellationToken);

            var openMaintenanceQuery = _context.MaintenanceRequests
                .Include(m => m.Property)
                .Include(m => m.Unit)
                .Where(m => propertyIds.Contains(m.PropertyId) && m.Status != EMaintenanceStatus.Resolved);

            var openMaintenanceCount = await openMaintenanceQuery.CountAsync(cancellationToken);

            var openMaintenance = await openMaintenanceQuery
                .OrderByDescending(m => m.CreatedAt)
                .Take(8)
                .Select(m => new SummaryMaintenance(
                    m.Title,
                    m.Status.ToString(),
                    m.Priority.ToString(),
                    m.CreatedAt,
                    m.Property.Name ?? m.Property.StreetAddress,
                    m.Unit != null ? m.Unit.Name : m.UnitName))
                .ToListAsync(cancellationToken);

            var newMaintenanceCount = await _context.MaintenanceRequests
                .CountAsync(m => propertyIds.Contains(m.PropertyId) && m.CreatedAt >= recentStart && m.CreatedAt < dayEnd, cancellationToken);

            var dueTodayDay = easternDate.Day;
            var dueSoonDays = Enumerable.Range(0, 8).Select(offset => easternDate.AddDays(offset).Day).Distinct().ToList();

            var activeLeases = await _context.Leases
                .Include(l => l.Unit).ThenInclude(u => u.Property)
                .Include(l => l.TenantLeases).ThenInclude(tl => tl.Tenant)
                .Include(l => l.LeaseFees)
                .Where(l => !l.IsDeleted && l.IsActive && propertyIds.Contains(l.Unit.PropertyId))
                .ToListAsync(cancellationToken);

            var activeLeaseIds = activeLeases.Select(l => l.Id).ToList();
            var allLeasePayments = await _context.Payments
                .Where(p => activeLeaseIds.Contains(p.LeaseId))
                .Select(p => new LoadPaymentDto
                {
                    Id = p.Id,
                    LeaseId = p.LeaseId,
                    PropertyId = p.PropertyId,
                    Amount = p.Amount,
                    PaymentDate = p.PaymentDate,
                    Method = p.Method,
                    Status = p.Status
                })
                .ToListAsync(cancellationToken);

            var rentStatusItems = activeLeases
                .Select(l => new
                {
                    Lease = l,
                    AmountDue = GetUnpaidRentDueAsOfToday(ToLoadLeaseDto(l), allLeasePayments, easternDate),
                    DaysPastDue = GetDaysPastDue(l, easternDate),
                    GracePeriodDays = GetGracePeriodDays(l)
                })
                .Where(x => x.AmountDue > 0 && x.DaysPastDue > 0)
                .OrderByDescending(x => x.AmountDue)
                .ToList();

            var unpaidRentLeases = rentStatusItems
                .Where(x => !IsPastGracePeriod(x.DaysPastDue, x.GracePeriodDays))
                .Take(8)
                .Select(x => new SummaryLease(
                    x.Lease.Unit.Property.Name ?? x.Lease.Unit.Property.StreetAddress,
                    x.Lease.Unit.Name,
                    x.AmountDue,
                    x.Lease.RentDueDay,
                    GetLastDueDate(x.Lease.RentDueDay!.Value, easternDate),
                    x.Lease.EndDate,
                    GetTenantName(x.Lease)))
                .ToList();

            var overdueRentLeases = rentStatusItems
                .Where(x => IsPastGracePeriod(x.DaysPastDue, x.GracePeriodDays))
                .Take(8)
                .Select(x => new SummaryLease(
                    x.Lease.Unit.Property.Name ?? x.Lease.Unit.Property.StreetAddress,
                    x.Lease.Unit.Name,
                    x.AmountDue,
                    x.Lease.RentDueDay,
                    GetLastDueDate(x.Lease.RentDueDay!.Value, easternDate),
                    x.Lease.EndDate,
                    GetTenantName(x.Lease)))
                .ToList();

            var rentDueToday = activeLeases
                .Where(l => l.RentDueDay == dueTodayDay)
                .Select(l => new SummaryLease(l.Unit.Property.Name ?? l.Unit.Property.StreetAddress, l.Unit.Name, l.RentAmount, l.RentDueDay, easternDate.Date, l.EndDate, GetTenantName(l)))
                .Take(8)
                .ToList();

            var rentDueSoon = activeLeases
                .Where(l => l.RentDueDay.HasValue && l.RentDueDay != dueTodayDay && dueSoonDays.Contains(l.RentDueDay.Value))
                .Select(l => new SummaryLease(l.Unit.Property.Name ?? l.Unit.Property.StreetAddress, l.Unit.Name, l.RentAmount, l.RentDueDay, GetNextDueDate(l.RentDueDay!.Value, easternDate.Date), l.EndDate, GetTenantName(l)))
                .Take(8)
                .ToList();

            var expiringLeases = activeLeases
                .Where(l => l.EndDate.HasValue && l.EndDate.Value.Date >= dayStart && l.EndDate.Value.Date <= leaseExpiry)
                .OrderBy(l => l.EndDate)
                .Select(l => new SummaryLease(l.Unit.Property.Name ?? l.Unit.Property.StreetAddress, l.Unit.Name, l.RentAmount, l.RentDueDay, null, l.EndDate, GetTenantName(l)))
                .Take(8)
                .ToList();

            var attentionLeaseExpiry = easternDate.AddDays(60);
            var attentionItems = new List<SummaryAttentionItem>();

            attentionItems.AddRange(unpaidRentLeases
                .Take(3)
                .Select(l => new SummaryAttentionItem(
                    "UNPAID RENT",
                    $"Unpaid rent · {FormatPropertyUnit(l.PropertyName, l.UnitName)}",
                    BuildUnpaidRentDescription(l),
                    "High")));

            attentionItems.AddRange(overdueRentLeases
                .Take(3)
                .Select(l => new SummaryAttentionItem(
                    "OVERDUE RENT",
                    $"Overdue rent · {FormatPropertyUnit(l.PropertyName, l.UnitName)}",
                    BuildUnpaidRentDescription(l),
                    "High")));

            attentionItems.AddRange(openMaintenance
                .Where(m => string.Equals(m.Priority, "High", StringComparison.OrdinalIgnoreCase))
                .Take(3)
                .Select(m => new SummaryAttentionItem(
                    "URGENT",
                    m.Title,
                    FormatMaintenanceDescription(m),
                    "High")));

            attentionItems.AddRange(openMaintenance
                .Where(m => string.Equals(m.Priority, "Medium", StringComparison.OrdinalIgnoreCase))
                .Take(2)
                .Select(m => new SummaryAttentionItem(
                    "MAINTENANCE",
                    m.Title,
                    FormatMaintenanceDescription(m),
                    "Medium")));

            attentionItems.AddRange(activeLeases
                .Where(l => l.EndDate.HasValue && l.EndDate.Value.Date >= dayStart && l.EndDate.Value.Date <= attentionLeaseExpiry)
                .OrderBy(l => l.EndDate)
                .Take(3)
                .Select(l => new SummaryAttentionItem(
                    "LEASE",
                    $"Lease expires in {Math.Max(0, (l.EndDate!.Value.Date - easternDate.Date).Days)} day{(((l.EndDate!.Value.Date - easternDate.Date).Days) == 1 ? string.Empty : "s")} · {FormatPropertyUnit(l.Unit.Property.Name ?? l.Unit.Property.StreetAddress, l.Unit.Name)}",
                    "Auto-renewal not set · suggest renewal terms",
                    "Medium")));

            var failedPayments = await _context.Payments
                .Include(p => p.Lease).ThenInclude(l => l.Unit).ThenInclude(u => u.Property)
                .Where(p => propertyIds.Contains(p.PropertyId) && p.Status.ToLower() == "failed")
                .OrderByDescending(p => p.PaymentDate)
                .Take(2)
                .ToListAsync(cancellationToken);

            attentionItems.AddRange(failedPayments.Select(p => new SummaryAttentionItem(
                "PAYMENT",
                $"Payment failed · {FormatPropertyUnit(p.Lease.Unit.Property.Name ?? p.Lease.Unit.Property.StreetAddress, p.Lease.Unit.Name)}",
                $"{p.Amount:C0} — retry or contact tenant",
                "High")));

            var unreadMessageCount = await _context.Notifications
                .CountAsync(n => !n.IsRead && n.Type == ENotificationType.Message &&
                    (n.UserId == user.Id || (n.OrganizationId.HasValue && ownerOrgIds.Contains(n.OrganizationId.Value))), cancellationToken);

            if (unreadMessageCount > 0)
            {
                attentionItems.Add(new SummaryAttentionItem(
                    "MESSAGE",
                    $"{unreadMessageCount} unread tenant message{(unreadMessageCount == 1 ? string.Empty : "s")}",
                    "Respond to keep tenants informed",
                    "Low"));
            }

            var taskCandidates = await _context.LandlordTasks
                .Include(t => t.Property)
                .Where(t => t.OrganizationId.HasValue && ownerOrgIds.Contains(t.OrganizationId.Value) &&
                    t.Status == ETaskStatus.Open &&
                    (t.DueDate < dayEnd || t.IsRecurring) &&
                    (!t.RecurrenceEndDate.HasValue || t.RecurrenceEndDate.Value >= dayStart))
                .ToListAsync(cancellationToken);

            var todaysTasks = taskCandidates
                .Where(t => OccursOnDate(t, easternDate))
                .Select(t => new SummaryTask(
                    t.Title,
                    DateAtTime(easternDate, t.DueDate),
                    t.Category.ToString(),
                    t.Property?.Name ?? t.Property?.StreetAddress ?? string.Empty,
                    t.IsRecurring))
                .OrderBy(t => t.DueAt)
                .Take(12)
                .ToList();

            var calendarItems = new List<SummaryCalendarItem>();
            calendarItems.AddRange(rentDueToday.Select(l => new SummaryCalendarItem(
                $"Rent due · {FormatPropertyUnit(l.PropertyName, l.UnitName)}",
                easternDate.Date,
                "Rent & payments")));

            var leaseCalendarItems = await _context.Leases
                .Include(l => l.Unit).ThenInclude(u => u.Property)
                .Where(l => !l.IsDeleted && propertyIds.Contains(l.Unit.PropertyId) &&
                    ((l.StartDate.HasValue && l.StartDate.Value >= dayStart && l.StartDate.Value < dayEnd) ||
                     (l.EndDate.HasValue && l.EndDate.Value >= dayStart && l.EndDate.Value < dayEnd) ||
                     (l.EndDate.HasValue && l.EndDate.Value.AddDays(-90) >= dayStart && l.EndDate.Value.AddDays(-90) < dayEnd)))
                .ToListAsync(cancellationToken);

            foreach (var lease in leaseCalendarItems)
            {
                var location = FormatPropertyUnit(
                    lease.Unit.Property.Name ?? lease.Unit.Property.StreetAddress,
                    lease.Unit.Name);
                if (lease.StartDate?.Date == easternDate.Date)
                    calendarItems.Add(new SummaryCalendarItem($"Move-in · {location}", lease.StartDate.Value, "Leases & move dates"));
                if (lease.EndDate?.Date == easternDate.Date)
                    calendarItems.Add(new SummaryCalendarItem($"Move-out · {location}", lease.EndDate.Value, "Leases & move dates"));
                if (lease.EndDate?.AddDays(-90).Date == easternDate.Date)
                    calendarItems.Add(new SummaryCalendarItem($"Renewal window · {location}", lease.EndDate.Value.AddDays(-90), "Leases & move dates"));
            }

            var scheduledMaintenance = await _context.MaintenanceRequests
                .Include(m => m.Property)
                .Include(m => m.Unit)
                .Where(m => propertyIds.Contains(m.PropertyId) &&
                    m.ScheduledDate.HasValue && m.ScheduledDate.Value >= dayStart && m.ScheduledDate.Value < dayEnd &&
                    m.Status != EMaintenanceStatus.Cancelled)
                .OrderBy(m => m.ScheduledDate)
                .Take(12)
                .ToListAsync(cancellationToken);

            calendarItems.AddRange(scheduledMaintenance.Select(m => new SummaryCalendarItem(
                m.Title,
                m.ScheduledDate!.Value,
                $"Maintenance · {FormatPropertyUnit(m.Property.Name ?? m.Property.StreetAddress, m.Unit?.Name ?? m.UnitName)}")));

            var inspections = await _context.Checklists
                .Include(c => c.Property)
                .Include(c => c.Unit)
                .Where(c => propertyIds.Contains(c.PropertyId) &&
                    c.InspectionDate.HasValue && c.InspectionDate.Value >= dayStart && c.InspectionDate.Value < dayEnd)
                .OrderBy(c => c.InspectionDate)
                .Take(12)
                .ToListAsync(cancellationToken);

            calendarItems.AddRange(inspections.Select(c => new SummaryCalendarItem(
                string.IsNullOrWhiteSpace(c.Title) ? "Property checklist" : c.Title,
                c.InspectionDate!.Value,
                $"Checklist · {FormatPropertyUnit(c.Property.Name ?? c.Property.StreetAddress, c.Unit?.Name ?? string.Empty)}")));

            return new DailySummary(
                properties.Count,
                unitCount,
                payments,
                openMaintenance,
                openMaintenanceCount,
                newMaintenanceCount,
                rentDueToday,
                rentDueSoon,
                unpaidRentLeases,
                overdueRentLeases,
                expiringLeases,
                attentionItems.Take(8).ToList(),
                todaysTasks,
                calendarItems.OrderBy(item => item.StartsAt).Take(16).ToList());
        }

        private static bool OccursOnDate(LandlordTask task, DateTime date)
        {
            var target = date.Date;
            var first = task.DueDate.Date;
            if (target < first || task.RecurrenceEndDate?.Date < target)
                return false;

            if (!task.IsRecurring || task.RecurrenceType == ERecurrenceType.None)
                return first == target;

            var interval = Math.Max(1, task.RecurrenceInterval);
            return task.RecurrenceType switch
            {
                ERecurrenceType.Daily => (target - first).Days % interval == 0,
                ERecurrenceType.Weekly => (target - first).Days % (7 * interval) == 0,
                ERecurrenceType.Monthly => OccursMonthly(first, target, interval),
                ERecurrenceType.Yearly => OccursYearly(first, target, interval),
                _ => false
            };
        }

        private static bool OccursMonthly(DateTime first, DateTime target, int interval)
        {
            var months = (target.Year - first.Year) * 12 + target.Month - first.Month;
            return months >= 0 && months % interval == 0 && first.AddMonths(months).Date == target;
        }

        private static bool OccursYearly(DateTime first, DateTime target, int interval)
        {
            var years = target.Year - first.Year;
            return years >= 0 && years % interval == 0 && first.AddYears(years).Date == target;
        }

        private static DateTime DateAtTime(DateTime date, DateTime timeSource)
            => date.Date.Add(timeSource.TimeOfDay);

        private HashSet<string> GetAllowedRecipients()
        {
            var configured = _configuration["DailySummaryEmail:AllowedRecipients"] ?? InitialRecipientAllowlistDefault;
            return configured
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(e => e.ToLowerInvariant())
                .ToHashSet();
        }

        private string BuildUnsubscribeUrl(string token)
        {
            var apiBaseUrl = _configuration["ApiBaseUrl"] ?? _configuration["BackendBaseUrl"] ?? _configuration["FrontendBaseUrl"] ?? "https://brownstonehub.com";
            return $"{apiBaseUrl.TrimEnd('/')}/api/daily-summary/unsubscribe?token={WebUtility.UrlEncode(token)}";
        }

        private static DateTime GetEasternNow()
        {
            TimeZoneInfo eastern;
            try
            {
                eastern = TimeZoneInfo.FindSystemTimeZoneById("America/New_York");
            }
            catch (TimeZoneNotFoundException)
            {
                eastern = TimeZoneInfo.FindSystemTimeZoneById("Eastern Standard Time");
            }

            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, eastern);
        }

        private static string BuildHtmlEmail(User user, DailySummary summary, string unsubscribeUrl, DateTime easternDate)
        {
            var sb = new StringBuilder();
            sb.Append("""
<!DOCTYPE html>
<html>
<head>
  <meta charset='utf-8'>
  <meta name='viewport' content='width=device-width, initial-scale=1.0'>
  <style>
    body { margin:0; padding:0; background:#f4f4f3; color:#3f454d; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; }
    .outer { width:100%; background:#f4f4f3; padding:28px 0; }
    .wrap { max-width:680px; margin:0 auto; background:#ffffff; border-radius:10px; overflow:hidden; }
    .logo { padding:34px 28px 30px; text-align:center; background:#ffffff; border-bottom:1px solid #e8ecef; }
    .logo img { width:190px; max-width:70%; height:auto; display:inline-block; }
    .content { padding:34px 42px 38px; font-size:16px; line-height:1.65; }
    .eyebrow { margin:0 0 8px; color:#64707c; font-size:13px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
    h1 { margin:0 0 18px; color:#15212d; font-size:26px; line-height:1.25; font-weight:700; }
    h2 { margin:30px 0 12px; color:#15212d; font-size:18px; line-height:1.35; }
    p { margin:0 0 18px; }
    .snapshot { margin:20px 0 26px; }
    .card { background:#f8faf9; border:1px solid #e5ebe8; border-radius:10px; padding:16px 18px; margin:0 0 10px; }
    .card strong { display:block; color:#1464cc; font-size:24px; line-height:1; margin-bottom:8px; }
    .activity-card { border-radius:10px; padding:14px 16px; margin:0 0 10px; }
    .activity-card strong { color:#15212d; }
    .agenda-card { background:#f8faf9; border:1px solid #e5ebe8; }
    .payment-card { background:#f3faf5; border:1px solid #cfe8d6; }
    .lease-card.warning { background:#fff8e6; border:1px solid #f1d38a; color:#5f4508; }
    .lease-card.danger { background:#fff1f1; border:1px solid #f2b6b6; color:#6f1d1d; }
    .empty { background:#f3faf5; border:1px solid #cfe8d6; color:#245934; border-radius:10px; padding:16px 18px; margin:20px 0 24px; }
    ul { padding-left:20px; margin:8px 0 0; }
    li { margin:9px 0; }
    hr { border:0; border-top:1px solid #e1e5e8; margin:28px 0; }
    .footer { background:#062d42; color:#d8e2e7; padding:30px 28px; text-align:center; font-size:13px; line-height:1.6; }
    .footer a { color:#ffffff; font-weight:700; text-decoration:none; margin:0 12px; }
    .footer .reason { color:#d8e2e7; margin:18px auto 0; max-width:520px; font-size:12px; }
    .footer .unsubscribe { color:#ffffff; text-decoration:underline; margin:0; }
    .copyright { color:#a9bbc4; margin-top:18px; }
    @media only screen and (max-width: 640px) {
      .outer { padding:0; }
      .wrap { border-radius:0; }
      .content { padding:28px 24px 32px; }
    }
  </style>
</head>
<body>
  <div class='outer'>
    <div class='wrap'>
      <div class='logo'>
        <img src='https://propertypeace.io/images/logos/property-peace-dark.png' alt='Property Peace'>
      </div>
""");
            sb.Append("<div class='content'>");
            sb.Append($"<p class='eyebrow'>{Html(easternDate.ToString("dddd, MMMM d"))}</p>");
            sb.Append("<h1>Your Property Peace daily summary</h1>");
            sb.Append($"<p>Good morning{(!string.IsNullOrWhiteSpace(user.FirstName) ? ", " + Html(user.FirstName) : string.Empty)},</p>");
            sb.Append("<p>Here’s your recent payment activity and the items that need your attention today.</p>");

            AppendTodayTasksSection(sb, summary.TodaysTasks);
            AppendTodayCalendarSection(sb, summary.TodaysCalendar);
            AppendPaymentSection(sb, summary.Payments);
            AppendLeaseSection(sb, "Unpaid rent (past due date)", summary.UnpaidRentLeases, "amount due", "lease-card warning");
            AppendLeaseSection(sb, "Overdue rent (past grace period)", summary.OverdueLeases, "amount overdue", "lease-card danger");
            AppendNeedsAttentionSection(sb, summary);

            sb.Append("<hr>");
            sb.Append("<p>Thanks,<br>Property Peace</p>");
            sb.Append("</div>");
            sb.Append($"<div class='footer'><div><a href='https://propertypeace.io'>Website</a><a href='https://x.com/PropertyPeace'>Twitter / X</a><a href='https://www.instagram.com/propertypeace'>Instagram</a></div><div class='reason'>You’re receiving this because Daily Summary Emails are enabled in Property Peace notification settings.<br><a class='unsubscribe' href='{Html(unsubscribeUrl)}'>Unsubscribe from daily summary emails</a>. You can re-enable them anytime from Settings → Notifications.</div><div class='copyright'>© 2026 Property Peace. All rights reserved.</div></div>");
            sb.Append("</div></div></body></html>");
            return sb.ToString();
        }

        private static string BuildPlainTextEmail(User user, DailySummary summary, string unsubscribeUrl, DateTime easternDate)
        {
            var sb = new StringBuilder();
            sb.AppendLine($"Property Peace daily summary - {easternDate:dddd, MMMM d}");
            sb.AppendLine();
            AppendPlainTodayTasksSection(sb, summary.TodaysTasks);
            AppendPlainTodayCalendarSection(sb, summary.TodaysCalendar);
            AppendPlainPaymentSection(sb, summary.Payments);
            AppendPlainLeaseSection(sb, "Unpaid rent (past due date)", summary.UnpaidRentLeases);
            AppendPlainLeaseSection(sb, "Overdue rent (past grace period)", summary.OverdueLeases);
            AppendPlainNeedsAttentionSection(sb, summary);
            sb.AppendLine();
            sb.AppendLine($"Unsubscribe: {unsubscribeUrl}");
            return sb.ToString();
        }

        private static string Metric(string label, string value) => $"<div class='card'><strong>{Html(value)}</strong>{Html(label)}</div>";

        private static void AppendTodayTasksSection(StringBuilder sb, IReadOnlyCollection<SummaryTask> tasks)
        {
            sb.Append("<h2>Today’s tasks &amp; reminders</h2>");
            if (tasks.Count == 0)
            {
                sb.Append("<div class='empty'><strong>No tasks or reminders due today.</strong></div>");
                return;
            }

            foreach (var task in tasks)
            {
                var time = task.DueAt.TimeOfDay == TimeSpan.Zero ? "All day" : task.DueAt.ToString("h:mm tt");
                var property = string.IsNullOrWhiteSpace(task.PropertyName) ? string.Empty : $" · {task.PropertyName}";
                var recurring = task.IsRecurring ? " · Recurring" : string.Empty;
                sb.Append($"<div class='activity-card agenda-card'><strong>{Html(task.Title)}</strong><br>{Html(time)} · {Html(task.Category)}{Html(property)}{Html(recurring)}</div>");
            }
        }

        private static void AppendTodayCalendarSection(StringBuilder sb, IReadOnlyCollection<SummaryCalendarItem> items)
        {
            sb.Append("<h2>Today’s calendar</h2>");
            if (items.Count == 0)
            {
                sb.Append("<div class='empty'><strong>Nothing else is scheduled today.</strong></div>");
                return;
            }

            foreach (var item in items)
            {
                var time = item.StartsAt.TimeOfDay == TimeSpan.Zero ? "All day" : item.StartsAt.ToString("h:mm tt");
                sb.Append($"<div class='activity-card agenda-card'><strong>{Html(item.Title)}</strong><br>{Html(time)} · {Html(item.Detail)}</div>");
            }
        }

        private static void AppendPlainTodayTasksSection(StringBuilder sb, IReadOnlyCollection<SummaryTask> tasks)
        {
            sb.AppendLine("Today's tasks & reminders:");
            if (tasks.Count == 0)
                sb.AppendLine("- No tasks or reminders due today.");
            else
                foreach (var task in tasks)
                    sb.AppendLine($"- {FormatTime(task.DueAt)} — {task.Title}{(string.IsNullOrWhiteSpace(task.PropertyName) ? string.Empty : " — " + task.PropertyName)}{(task.IsRecurring ? " (recurring)" : string.Empty)}");
            sb.AppendLine();
        }

        private static void AppendPlainTodayCalendarSection(StringBuilder sb, IReadOnlyCollection<SummaryCalendarItem> items)
        {
            sb.AppendLine("Today's calendar:");
            if (items.Count == 0)
                sb.AppendLine("- Nothing else is scheduled today.");
            else
                foreach (var item in items)
                    sb.AppendLine($"- {FormatTime(item.StartsAt)} — {item.Title} — {item.Detail}");
            sb.AppendLine();
        }

        private static string FormatTime(DateTime date)
            => date.TimeOfDay == TimeSpan.Zero ? "All day" : date.ToString("h:mm tt");

        private static void AppendLeaseSection(StringBuilder sb, string title, IReadOnlyCollection<SummaryLease> leases, string amountLabel, string cardClass, bool showEndDate = false)
        {
            if (leases.Count == 0) return;
            sb.Append($"<h2>{Html(title)}</h2>");
            foreach (var lease in leases)
            {
                var amount = lease.Amount.HasValue ? $" — {amountLabel}: {lease.Amount.Value:C0}" : string.Empty;
                var due = lease.DueDate.HasValue ? $" — due {lease.DueDate.Value:M/d/yyyy}" : string.Empty;
                var end = showEndDate && lease.EndDate.HasValue ? $" — ends {lease.EndDate.Value:MMM d, yyyy}" : string.Empty;
                var tenant = string.IsNullOrWhiteSpace(lease.TenantName) ? string.Empty : $" — {lease.TenantName}";
                sb.Append($"<div class='activity-card {Html(cardClass)}'><strong>{Html(lease.PropertyName)}</strong> / {Html(lease.UnitName)}{Html(tenant)}{Html(amount)}{Html(due)}{Html(end)}</div>");
            }
        }

        private static void AppendPaymentSection(StringBuilder sb, IReadOnlyCollection<SummaryPayment> payments)
        {
            sb.Append("<h2>Recent payment activity</h2>");
            if (payments.Count == 0)
            {
                sb.Append("<div class='empty'><strong>No recent payment activity.</strong><br>No rent payments were recorded in the last day.</div>");
                return;
            }

            foreach (var payment in payments)
            {
                sb.Append($"<div class='activity-card payment-card'><strong>{payment.Amount:C0}</strong> {Html(payment.Status)} payment for {Html(payment.PropertyName)} / {Html(payment.UnitName)} on {payment.PaymentDate:MMM d}{(string.IsNullOrWhiteSpace(payment.Method) ? string.Empty : " via " + Html(payment.Method))}</div>");
            }
        }

        private static void AppendNeedsAttentionSection(StringBuilder sb, DailySummary summary)
        {
            sb.Append("<h2>Needs your attention</h2>");
            sb.Append("<div class='snapshot'>");
            sb.Append(Metric("Open maintenance", summary.OpenMaintenanceCount.ToString()));
            sb.Append("</div>");

            if (summary.AttentionItems.Count == 0)
            {
                sb.Append("<div class='empty'><strong>Everything looks good — no urgent items today.</strong><br>We’ll keep watching payments, maintenance, leases, and messages so nothing slips through the cracks.</div>");
                return;
            }

            sb.Append("<ul>");
            foreach (var item in summary.AttentionItems)
            {
                sb.Append($"<li><strong>{Html(item.Title)}</strong> — {Html(item.Description)} <span style='color:#64707c'>({Html(item.Priority)} · {Html(item.Type)})</span></li>");
            }
            sb.Append("</ul>");
        }

        private static void AppendMaintenanceSection(StringBuilder sb, IReadOnlyCollection<SummaryMaintenance> requests, int newCount)
        {
            if (requests.Count == 0) return;
            sb.Append($"<h2>Open maintenance{(newCount > 0 ? $" ({newCount} new in the last day)" : string.Empty)}</h2><ul>");
            foreach (var request in requests)
            {
                sb.Append($"<li><strong>{Html(request.Title)}</strong> — {Html(request.Status)}, {Html(request.Priority)} priority at {Html(request.PropertyName)}{(string.IsNullOrWhiteSpace(request.UnitName) ? string.Empty : " / " + Html(request.UnitName))}</li>");
            }
            sb.Append("</ul>");
        }

        private static void AppendPlainLeaseSection(StringBuilder sb, string title, IReadOnlyCollection<SummaryLease> leases, bool includeEndDate = false)
        {
            if (leases.Count == 0) return;
            sb.AppendLine(title + ":");
            foreach (var lease in leases)
            {
                var tenant = string.IsNullOrWhiteSpace(lease.TenantName) ? string.Empty : $" — {lease.TenantName}";
                var due = lease.DueDate.HasValue ? $" due {lease.DueDate.Value:M/d/yyyy}" : string.Empty;
                sb.AppendLine($"- {lease.PropertyName} / {lease.UnitName}{tenant} {(lease.Amount.HasValue ? lease.Amount.Value.ToString("C0") : string.Empty)}{due}{(includeEndDate && lease.EndDate.HasValue ? " ends " + lease.EndDate.Value.ToString("MMM d, yyyy") : string.Empty)}");
            }
            sb.AppendLine();
        }

        private static void AppendPlainPaymentSection(StringBuilder sb, IReadOnlyCollection<SummaryPayment> payments)
        {
            sb.AppendLine("Recent payment activity:");
            if (payments.Count == 0)
            {
                sb.AppendLine("- No recent payment activity. No rent payments were recorded in the last day.");
                sb.AppendLine();
                return;
            }

            foreach (var payment in payments)
            {
                sb.AppendLine($"- {payment.Amount:C0} {payment.Status} for {payment.PropertyName} / {payment.UnitName} on {payment.PaymentDate:MMM d}");
            }
            sb.AppendLine();
        }

        private static void AppendPlainNeedsAttentionSection(StringBuilder sb, DailySummary summary)
        {
            sb.AppendLine("Needs your attention:");
            sb.AppendLine($"Open maintenance: {summary.OpenMaintenanceCount}");
            if (summary.AttentionItems.Count == 0)
            {
                sb.AppendLine("- Everything looks good — no urgent items today.");
                sb.AppendLine();
                return;
            }

            foreach (var item in summary.AttentionItems)
            {
                sb.AppendLine($"- {item.Title} — {item.Description} ({item.Priority} · {item.Type})");
            }
            sb.AppendLine();
        }

        private static void AppendPlainMaintenanceSection(StringBuilder sb, IReadOnlyCollection<SummaryMaintenance> requests, int newCount)
        {
            if (requests.Count == 0) return;
            sb.AppendLine($"Open maintenance ({newCount} new in the last day):");
            foreach (var request in requests)
            {
                sb.AppendLine($"- {request.Title} — {request.Status}, {request.Priority} at {request.PropertyName} {request.UnitName}");
            }
            sb.AppendLine();
        }

        private static string BuildUnpaidRentDescription(SummaryLease lease)
        {
            var amount = lease.Amount.HasValue ? $"{lease.Amount.Value:C0} due" : "Unpaid balance";
            return string.IsNullOrWhiteSpace(lease.TenantName) ? amount : $"{lease.TenantName} · {amount}";
        }

        private static decimal GetUnpaidRentDueAsOfToday(LoadLeaseDto lease, List<LoadPaymentDto> payments, DateTime today)
        {
            if (!lease.StartDate.HasValue || !lease.EndDate.HasValue || !lease.RentDueDay.HasValue || !lease.RentAmount.HasValue || !lease.IsActive)
            {
                return 0m;
            }

            today = today.Date;
            var currentDueDay = GetActualRentDueDay(lease.RentDueDay.Value, today.Year, today.Month);
            var currentDueDate = new DateTime(today.Year, today.Month, currentDueDay);

            if (today < currentDueDate)
            {
                // Before this month's due date, only already-overdue prior balances belong in the daily summary.
                return RentCalculator.CalculateOverdueForLease(lease, payments);
            }

            return today == currentDueDate
                ? RentCalculator.GetAmountDueNow(lease, payments)
                : RentCalculator.CalculateOverdueForLease(lease, payments);
        }

        private static int GetDaysPastDue(Lease lease, DateTime today)
        {
            if (!lease.RentDueDay.HasValue)
            {
                return -1;
            }

            var lastDueDate = GetLastDueDate(lease.RentDueDay.Value, today.Date);
            return (today.Date - lastDueDate).Days;
        }

        private static DateTime GetLastDueDate(int rentDueDay, DateTime today)
        {
            var dueDay = GetActualRentDueDay(rentDueDay, today.Year, today.Month);
            var dueDate = new DateTime(today.Year, today.Month, dueDay);

            if (dueDate > today)
            {
                var previousMonth = today.AddMonths(-1);
                dueDay = GetActualRentDueDay(rentDueDay, previousMonth.Year, previousMonth.Month);
                dueDate = new DateTime(previousMonth.Year, previousMonth.Month, dueDay);
            }

            return dueDate;
        }

        private static DateTime GetNextDueDate(int rentDueDay, DateTime today)
        {
            var dueDay = GetActualRentDueDay(rentDueDay, today.Year, today.Month);
            var dueDate = new DateTime(today.Year, today.Month, dueDay);

            if (dueDate < today)
            {
                var nextMonth = today.AddMonths(1);
                dueDay = GetActualRentDueDay(rentDueDay, nextMonth.Year, nextMonth.Month);
                dueDate = new DateTime(nextMonth.Year, nextMonth.Month, dueDay);
            }

            return dueDate;
        }

        private static int GetActualRentDueDay(int rentDueDay, int year, int month)
        {
            if (rentDueDay == -1)
            {
                return DateTime.DaysInMonth(year, month);
            }

            return Math.Min(Math.Max(1, rentDueDay), DateTime.DaysInMonth(year, month));
        }

        private static int GetGracePeriodDays(Lease lease)
        {
            var lateFeeRule = lease.LeaseFees?.FirstOrDefault(f => f.IsLateFee && f.LateFeeType == "OneTime" && f.AppliedAfterDays.HasValue)
                ?? lease.LeaseFees?.FirstOrDefault(f => f.IsLateFee && f.AppliedAfterDays.HasValue);

            return lateFeeRule?.AppliedAfterDays ?? 0;
        }

        private static bool IsPastGracePeriod(int daysPastDue, int gracePeriodDays)
            => daysPastDue > 0 && daysPastDue >= Math.Max(1, gracePeriodDays);

        private static string GetTenantName(Lease lease)
        {
            return lease.TenantLeases
                .Select(tl => $"{tl.Tenant.Firstname} {tl.Tenant.Lastname}".Trim())
                .FirstOrDefault(name => !string.IsNullOrWhiteSpace(name)) ?? string.Empty;
        }

        private static LoadLeaseDto ToLoadLeaseDto(Lease lease)
        {
            return new LoadLeaseDto
            {
                Id = lease.Id,
                StartDate = lease.StartDate,
                EndDate = lease.EndDate,
                RentAmount = lease.RentAmount,
                RentDueDay = lease.RentDueDay,
                OverdueAmount = lease.OverdueAmount,
                IsActive = lease.IsActive,
                PropertyId = lease.Unit.PropertyId,
                PropertyName = lease.Unit.Property.Name ?? lease.Unit.Property.StreetAddress,
                UnitId = lease.UnitId,
                UnitName = lease.Unit.Name,
                LandlordId = lease.Unit.Property.LandlordId
            };
        }

        private static string FormatMaintenanceDescription(SummaryMaintenance maintenance)
        {
            var location = string.IsNullOrWhiteSpace(maintenance.UnitName)
                ? maintenance.PropertyName
                : $"{maintenance.PropertyName} · {maintenance.UnitName}";
            return string.IsNullOrWhiteSpace(location) ? "Vendor not yet assigned" : location;
        }

        private static string FormatPropertyUnit(string propertyName, string unitName)
            => string.IsNullOrWhiteSpace(unitName) ? propertyName : $"{propertyName} · {unitName}";

        private static string Html(string value) => WebUtility.HtmlEncode(value ?? string.Empty);
    }

    internal sealed record DailySummary(
        int PropertyCount,
        int UnitCount,
        IReadOnlyCollection<SummaryPayment> Payments,
        IReadOnlyCollection<SummaryMaintenance> OpenMaintenance,
        int OpenMaintenanceCount,
        int NewMaintenanceCount,
        IReadOnlyCollection<SummaryLease> RentDueToday,
        IReadOnlyCollection<SummaryLease> RentDueSoon,
        IReadOnlyCollection<SummaryLease> UnpaidRentLeases,
        IReadOnlyCollection<SummaryLease> OverdueLeases,
        IReadOnlyCollection<SummaryLease> ExpiringLeases,
        IReadOnlyCollection<SummaryAttentionItem> AttentionItems,
        IReadOnlyCollection<SummaryTask> TodaysTasks,
        IReadOnlyCollection<SummaryCalendarItem> TodaysCalendar);

    internal sealed record SummaryProperty(long Id, string Name, string StreetAddress, long? OrganizationId);
    internal sealed record SummaryPayment(decimal Amount, string Status, DateTime PaymentDate, string? Method, string PropertyName, string UnitName);
    internal sealed record SummaryMaintenance(string Title, string Status, string Priority, DateTime CreatedAt, string PropertyName, string? UnitName);
    internal sealed record SummaryLease(string PropertyName, string UnitName, decimal? Amount, int? RentDueDay, DateTime? DueDate, DateTime? EndDate, string TenantName);
    internal sealed record SummaryAttentionItem(string Type, string Title, string Description, string Priority);
    internal sealed record SummaryTask(string Title, DateTime DueAt, string Category, string PropertyName, bool IsRecurring);
    internal sealed record SummaryCalendarItem(string Title, DateTime StartsAt, string Detail);
}
