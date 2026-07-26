using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.AdminDashboard;
using brownstone_hub_api.Enums;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.AdminDashboard;

public sealed class AdminDashboardRepository : IAdminDashboardRepository
{
    private const int AttentionLimit = 8;
    private const int RecentAccountsLimit = 10;
    private readonly DataContext _context;

    public AdminDashboardRepository(DataContext context)
    {
        _context = context;
    }

    public async Task<AdminDashboardSummaryDto> GetSummaryAsync(
        int windowDays,
        DateTime generatedAtUtc,
        CancellationToken cancellationToken = default)
    {
        var windowStart = generatedAtUtc.AddDays(-windowDays);
        var today = generatedAtUtc.Date;
        var sevenDaysAgo = generatedAtUtc.AddDays(-7);
        var sevenDaysAhead = generatedAtUtc.AddDays(7);
        var thirtyDaysAhead = today.AddDays(30);

        var productionUsers = _context.Users.AsNoTracking()
            .Where(user => !user.IsDeleted && !user.IsSeeded && !user.IsDemo);
        var productionOrganizations = _context.Organizations.AsNoTracking()
            .Where(organization => !organization.IsDeleted
                && organization.Owner != null
                && !organization.Owner.IsDeleted
                && !organization.Owner.IsSeeded
                && !organization.Owner.IsDemo);

        var productionUserCount = await productionUsers.CountAsync(cancellationToken);
        var newUserCount = await productionUsers.CountAsync(user => user.CreateDate >= windowStart, cancellationToken);
        var recentlyActiveUserCount = await productionUsers.CountAsync(
            user => (user.LastLogin.HasValue && user.LastLogin.Value > user.LastVisited
                ? user.LastLogin.Value
                : user.LastVisited) >= windowStart,
            cancellationToken);
        var activeOrganizationCount = await productionOrganizations.CountAsync(
            organization => organization.IsActive,
            cancellationToken);
        var newOrganizationCount = await productionOrganizations.CountAsync(
            organization => organization.CreatedAt >= windowStart,
            cancellationToken);

        var productionSubscriptions = _context.Subscriptions.AsNoTracking()
            .Where(subscription =>
                (subscription.OwnerUserId.HasValue && _context.Users.Any(user =>
                    user.Id == subscription.OwnerUserId.Value && !user.IsDeleted && !user.IsSeeded && !user.IsDemo))
                || (subscription.User != null && !subscription.User.IsDeleted && !subscription.User.IsSeeded && !subscription.User.IsDemo)
                || (subscription.Organization != null && !subscription.Organization.IsDeleted
                    && subscription.Organization.Owner != null
                    && !subscription.Organization.Owner.IsDeleted
                    && !subscription.Organization.Owner.IsSeeded
                    && !subscription.Organization.Owner.IsDemo));

        var activePaidQuery = productionSubscriptions.Where(subscription =>
            subscription.Status == "Active"
            && (subscription.SubscriptionPlan.MonthlyPrice > 0 || subscription.SubscriptionPlan.AnnualPrice > 0));
        var activePaid = await activePaidQuery.CountAsync(cancellationToken);
        var trials = await productionSubscriptions.CountAsync(subscription => subscription.Status == "Trial", cancellationToken);
        var trialsEnding = await productionSubscriptions.CountAsync(subscription =>
            subscription.Status == "Trial"
            && subscription.TrialEnd >= generatedAtUtc
            && subscription.TrialEnd <= sevenDaysAhead,
            cancellationToken);
        var pastDueOrUnpaid = await productionSubscriptions.CountAsync(subscription =>
            subscription.Status == "PastDue" || subscription.Status == "Unpaid",
            cancellationToken);
        var scheduledCancellation = await productionSubscriptions.CountAsync(subscription =>
            subscription.CancelAtPeriodEnd && (subscription.Status == "Active" || subscription.Status == "Trial"),
            cancellationToken);
        var monthlyRunRate = await activePaidQuery
            .SumAsync(subscription => (decimal?)(subscription.BillingCycle == "Annual"
                ? subscription.SubscriptionPlan.AnnualPrice / 12m
                : subscription.SubscriptionPlan.MonthlyPrice), cancellationToken) ?? 0m;
        var statusMix = await productionSubscriptions
            .GroupBy(subscription => subscription.Status)
            .Select(group => new NamedCountDto { Name = group.Key, Count = group.Count() })
            .OrderByDescending(item => item.Count)
            .ToListAsync(cancellationToken);
        var planMix = await productionSubscriptions
            .Where(subscription => subscription.Status == "Active" || subscription.Status == "Trial")
            .GroupBy(subscription => subscription.SubscriptionPlan.Name)
            .Select(group => new NamedCountDto { Name = group.Key, Count = group.Count() })
            .OrderByDescending(item => item.Count)
            .ToListAsync(cancellationToken);

        var productionProperties = _context.Properties.AsNoTracking().Where(property =>
            !property.IsDeleted
            && ((property.Organization != null && !property.Organization.IsDeleted
                    && property.Organization.Owner != null
                    && !property.Organization.Owner.IsDeleted
                    && !property.Organization.Owner.IsSeeded
                    && !property.Organization.Owner.IsDemo)
                || (property.OrganizationId == null && !property.Landlord.IsDeleted
                    && !property.Landlord.IsSeeded && !property.Landlord.IsDemo)));
        var productionUnits = _context.Units.AsNoTracking().Where(unit =>
            !unit.Property.IsDeleted
            && ((unit.Property.Organization != null && !unit.Property.Organization.IsDeleted
                    && unit.Property.Organization.Owner != null
                    && !unit.Property.Organization.Owner.IsDeleted
                    && !unit.Property.Organization.Owner.IsSeeded
                    && !unit.Property.Organization.Owner.IsDemo)
                || (unit.Property.OrganizationId == null && !unit.Property.Landlord.IsDeleted
                    && !unit.Property.Landlord.IsSeeded && !unit.Property.Landlord.IsDemo)));
        var productionLeases = _context.Leases.AsNoTracking().Where(lease =>
            !lease.IsDeleted
            && !lease.Unit.Property.IsDeleted
            && ((lease.Unit.Property.Organization != null && !lease.Unit.Property.Organization.IsDeleted
                    && lease.Unit.Property.Organization.Owner != null
                    && !lease.Unit.Property.Organization.Owner.IsDeleted
                    && !lease.Unit.Property.Organization.Owner.IsSeeded
                    && !lease.Unit.Property.Organization.Owner.IsDemo)
                || (lease.Unit.Property.OrganizationId == null && !lease.Unit.Property.Landlord.IsDeleted
                    && !lease.Unit.Property.Landlord.IsSeeded && !lease.Unit.Property.Landlord.IsDemo)));

        var propertyCount = await productionProperties.CountAsync(cancellationToken);
        var unitCount = await productionUnits.CountAsync(cancellationToken);
        var currentLeases = productionLeases.Where(lease =>
            lease.IsActive
            && lease.StartDate.HasValue
            && lease.StartDate.Value <= today
            && lease.EndDate.HasValue
            && lease.EndDate.Value >= today);
        var occupiedUnits = await currentLeases
            .Select(lease => lease.UnitId)
            .Distinct()
            .CountAsync(cancellationToken);
        var activeLeases = await currentLeases.CountAsync(cancellationToken);
        var expiringLeases = await currentLeases.CountAsync(
            lease => lease.EndDate!.Value <= thirtyDaysAhead,
            cancellationToken);

        var productionMaintenance = _context.MaintenanceRequests.AsNoTracking().Where(request =>
            !request.Property.IsDeleted
            && ((request.Property.Organization != null && !request.Property.Organization.IsDeleted
                    && request.Property.Organization.Owner != null
                    && !request.Property.Organization.Owner.IsDeleted
                    && !request.Property.Organization.Owner.IsSeeded
                    && !request.Property.Organization.Owner.IsDemo)
                || (request.Property.OrganizationId == null && !request.Property.Landlord.IsDeleted
                    && !request.Property.Landlord.IsSeeded && !request.Property.Landlord.IsDemo)));
        var openMaintenance = productionMaintenance.Where(request => request.Status != EMaintenanceStatus.Resolved);
        var openMaintenanceCount = await openMaintenance.CountAsync(cancellationToken);
        var highPriorityMaintenance = await openMaintenance.CountAsync(
            request => request.Priority == EMaintenancePriority.High, cancellationToken);
        var staleMaintenance = await openMaintenance.CountAsync(
            request => request.UpdatedAt < sevenDaysAgo, cancellationToken);
        var unassignedMaintenance = await openMaintenance.CountAsync(
            request => request.AssignedToType == EAssignedToType.Unassigned, cancellationToken);

        var productionSupport = _context.SupportAndFeedbacks.AsNoTracking().Where(item =>
            !item.User.IsDeleted && !item.User.IsSeeded && !item.User.IsDemo);
        var unresolvedSupport = productionSupport.Where(item => !item.IsResolved);
        var unresolvedSupportCount = await unresolvedSupport.CountAsync(cancellationToken);
        var oldSupportCount = await unresolvedSupport.CountAsync(item => item.CreatedAt < sevenDaysAgo, cancellationToken);
        var newSupportCount = await productionSupport.CountAsync(item => item.CreatedAt >= windowStart, cancellationToken);
        var supportTypeRows = await unresolvedSupport
            .GroupBy(item => item.Type)
            .Select(group => new { Type = group.Key, Count = group.Count() })
            .ToListAsync(cancellationToken);
        var supportTypeMix = supportTypeRows
            .Select(item => new NamedCountDto { Name = item.Type.ToString(), Count = item.Count })
            .OrderByDescending(item => item.Count)
            .ToList();

        var jobsRunning = await _context.JobRunHistories.AsNoTracking()
            .CountAsync(job => job.Status == "Running", cancellationToken);
        var jobsFailed = await _context.JobRunHistories.AsNoTracking()
            .CountAsync(job => job.Status == "Failed" && job.StartedAt >= windowStart, cancellationToken);
        var latestJob = await _context.JobRunHistories.AsNoTracking()
            .OrderByDescending(job => job.StartedAt)
            .Select(job => new { job.JobName, job.Status, job.StartedAt })
            .FirstOrDefaultAsync(cancellationToken);

        var productionStorage = _context.StorageObjects.AsNoTracking().Where(storage =>
            !storage.IsDeleted
            && ((storage.Organization != null && !storage.Organization.IsDeleted
                    && storage.Organization.Owner != null
                    && !storage.Organization.Owner.IsDeleted
                    && !storage.Organization.Owner.IsSeeded
                    && !storage.Organization.Owner.IsDemo)
                || (storage.OrganizationId == null && storage.OwnerUser != null
                    && !storage.OwnerUser.IsDeleted && !storage.OwnerUser.IsSeeded && !storage.OwnerUser.IsDemo)
                || (storage.OrganizationId == null && storage.OwnerUserId == null && storage.UploadedByUser != null
                    && !storage.UploadedByUser.IsDeleted && !storage.UploadedByUser.IsSeeded && !storage.UploadedByUser.IsDemo)));
        var storedObjects = await productionStorage.CountAsync(cancellationToken);
        var storageBytes = await productionStorage.SumAsync(item => (long?)item.SizeBytes, cancellationToken) ?? 0L;

        var userGrowthRows = await productionUsers
            .Where(user => user.CreateDate >= windowStart)
            .GroupBy(user => user.CreateDate.Date)
            .Select(group => new { Date = group.Key, Count = group.Count() })
            .ToListAsync(cancellationToken);
        var organizationGrowthRows = await productionOrganizations
            .Where(organization => organization.CreatedAt >= windowStart)
            .GroupBy(organization => organization.CreatedAt.Date)
            .Select(group => new { Date = group.Key, Count = group.Count() })
            .ToListAsync(cancellationToken);
        var userGrowth = userGrowthRows.ToDictionary(row => row.Date, row => row.Count);
        var organizationGrowth = organizationGrowthRows.ToDictionary(row => row.Date, row => row.Count);
        var growth = Enumerable.Range(0, windowDays + 1)
            .Select(offset => generatedAtUtc.Date.AddDays(-windowDays + offset))
            .Select(date => new GrowthBucketDto
            {
                DateUtc = DateTime.SpecifyKind(date, DateTimeKind.Utc),
                Users = userGrowth.GetValueOrDefault(date),
                Organizations = organizationGrowth.GetValueOrDefault(date)
            })
            .ToList();

        var recentAccounts = await productionUsers
            .OrderByDescending(user => user.CreateDate)
            .Take(RecentAccountsLimit)
            .Select(user => new RecentAccountDto
            {
                UserId = user.Id,
                DisplayName = (user.FirstName + " " + user.LastName).Trim(),
                Email = user.Email,
                Company = user.Company,
                CreatedAtUtc = user.CreateDate,
                LastActiveAtUtc = user.LastLogin.HasValue && user.LastLogin.Value > user.LastVisited
                    ? user.LastLogin.Value
                    : user.LastVisited,
                IsSuspended = user.IsSuspended
            })
            .ToListAsync(cancellationToken);

        var attention = BuildAttentionQueue(
            pastDueOrUnpaid,
            trialsEnding,
            highPriorityMaintenance,
            staleMaintenance,
            unassignedMaintenance,
            unresolvedSupportCount,
            jobsFailed);

        return new AdminDashboardSummaryDto
        {
            GeneratedAtUtc = generatedAtUtc,
            WindowDays = windowDays,
            Accounts = new AccountMetricsDto
            {
                ProductionUsers = productionUserCount,
                NewUsers = newUserCount,
                ActiveOrganizations = activeOrganizationCount,
                NewOrganizations = newOrganizationCount,
                RecentlyActiveUsers = recentlyActiveUserCount
            },
            Subscriptions = new SubscriptionHealthDto
            {
                ActivePaid = activePaid,
                Trials = trials,
                TrialsEndingWithin7Days = trialsEnding,
                PastDueOrUnpaid = pastDueOrUnpaid,
                ScheduledCancellation = scheduledCancellation,
                ActivePaidListPriceMonthlyRunRate = monthlyRunRate,
                StatusMix = statusMix,
                PlanMix = planMix
            },
            Portfolio = new PortfolioMetricsDto
            {
                Properties = propertyCount,
                Units = unitCount,
                OccupiedUnits = occupiedUnits,
                VacantUnits = unitCount - occupiedUnits,
                OccupancyPercent = unitCount == 0 ? null : Math.Round(occupiedUnits * 100m / unitCount, 1),
                ActiveLeases = activeLeases,
                LeasesExpiringWithin30Days = expiringLeases
            },
            Maintenance = new MaintenanceMetricsDto
            {
                Open = openMaintenanceCount,
                HighPriority = highPriorityMaintenance,
                StaleOver7Days = staleMaintenance,
                Unassigned = unassignedMaintenance
            },
            Support = new SupportBacklogDto
            {
                Unresolved = unresolvedSupportCount,
                OlderThan7Days = oldSupportCount,
                NewWithinWindow = newSupportCount,
                TypeMix = supportTypeMix
            },
            System = new SystemPulseDto
            {
                JobsRunning = jobsRunning,
                JobsFailedWithinWindow = jobsFailed,
                LatestJobName = latestJob?.JobName,
                LatestJobStatus = latestJob?.Status,
                LatestJobStartedAtUtc = latestJob?.StartedAt,
                StoredObjects = storedObjects,
                StorageBytes = storageBytes
            },
            Growth = growth,
            AttentionQueue = attention,
            RecentAccounts = recentAccounts
        };
    }

    private static IReadOnlyList<AttentionItemDto> BuildAttentionQueue(
        int delinquentSubscriptions,
        int trialsEnding,
        int highPriorityMaintenance,
        int staleMaintenance,
        int unassignedMaintenance,
        int unresolvedSupport,
        int failedJobs)
    {
        var items = new List<AttentionItemDto>();
        Add(items, delinquentSubscriptions, "billing-risk", "critical", "Billing follow-up", "Past-due or unpaid production subscriptions", "/admin/subscriptions");
        Add(items, highPriorityMaintenance, "high-maintenance", "critical", "High-priority maintenance", "Open high-priority requests across production portfolios", "/admin/users");
        Add(items, failedJobs, "failed-jobs", "critical", "Failed background jobs", "Jobs that failed in the selected reporting window", "/admin/jobs");
        Add(items, trialsEnding, "trials-ending", "warning", "Trials ending soon", "Production trials ending within seven days", "/admin/subscriptions");
        Add(items, staleMaintenance, "stale-maintenance", "warning", "Stale maintenance", "Open requests not updated for more than seven days", "/admin/users");
        Add(items, unassignedMaintenance, "unassigned-maintenance", "warning", "Unassigned maintenance", "Open requests with no assignee", "/admin/users");
        Add(items, unresolvedSupport, "support-backlog", "info", "Support backlog", "Unresolved production support and feedback items", "/admin/messages");
        return items.Take(AttentionLimit).ToList();
    }

    private static void Add(
        ICollection<AttentionItemDto> items,
        int count,
        string key,
        string severity,
        string title,
        string detail,
        string route)
    {
        if (count <= 0) return;
        items.Add(new AttentionItemDto
        {
            Key = key,
            Severity = severity,
            Title = title,
            Detail = detail,
            Count = count,
            Route = route
        });
    }
}
