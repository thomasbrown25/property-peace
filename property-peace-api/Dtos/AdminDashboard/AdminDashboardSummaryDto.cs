namespace brownstone_hub_api.Dtos.AdminDashboard;

public sealed class AdminDashboardSummaryDto
{
    public DateTime GeneratedAtUtc { get; init; }
    public int WindowDays { get; init; }
    public string DataScope { get; init; } = "Production accounts only; deleted, seeded, and demo users are excluded.";
    public AccountMetricsDto Accounts { get; init; } = new();
    public SubscriptionHealthDto Subscriptions { get; init; } = new();
    public PortfolioMetricsDto Portfolio { get; init; } = new();
    public MaintenanceMetricsDto Maintenance { get; init; } = new();
    public SupportBacklogDto Support { get; init; } = new();
    public SystemPulseDto System { get; init; } = new();
    public IReadOnlyList<GrowthBucketDto> Growth { get; init; } = [];
    public IReadOnlyList<AttentionItemDto> AttentionQueue { get; init; } = [];
    public IReadOnlyList<RecentAccountDto> RecentAccounts { get; init; } = [];
}

public sealed class AccountMetricsDto
{
    public int ProductionUsers { get; init; }
    public int NewUsers { get; init; }
    public int ActiveOrganizations { get; init; }
    public int NewOrganizations { get; init; }
    public int RecentlyActiveUsers { get; init; }
}

public sealed class SubscriptionHealthDto
{
    public int ActivePaid { get; init; }
    public int Trials { get; init; }
    public int TrialsEndingWithin7Days { get; init; }
    public int PastDueOrUnpaid { get; init; }
    public int ScheduledCancellation { get; init; }
    public decimal ActivePaidListPriceMonthlyRunRate { get; init; }
    public string RunRateLabel { get; init; } = "Active paid list-price monthly run rate (annual plans divided by 12; excludes discounts and taxes)";
    public IReadOnlyList<NamedCountDto> StatusMix { get; init; } = [];
    public IReadOnlyList<NamedCountDto> PlanMix { get; init; } = [];
}

public sealed class PortfolioMetricsDto
{
    public int Properties { get; init; }
    public int Units { get; init; }
    public int OccupiedUnits { get; init; }
    public int VacantUnits { get; init; }
    public decimal? OccupancyPercent { get; init; }
    public int ActiveLeases { get; init; }
    public int LeasesExpiringWithin30Days { get; init; }
}

public sealed class MaintenanceMetricsDto
{
    public int Open { get; init; }
    public int HighPriority { get; init; }
    public int StaleOver7Days { get; init; }
    public int Unassigned { get; init; }
}

public sealed class SupportBacklogDto
{
    public int Unresolved { get; init; }
    public int OlderThan7Days { get; init; }
    public int NewWithinWindow { get; init; }
    public IReadOnlyList<NamedCountDto> TypeMix { get; init; } = [];
}

public sealed class SystemPulseDto
{
    public int JobsRunning { get; init; }
    public int JobsFailedWithinWindow { get; init; }
    public string? LatestJobName { get; init; }
    public string? LatestJobStatus { get; init; }
    public DateTime? LatestJobStartedAtUtc { get; init; }
    public int StoredObjects { get; init; }
    public long StorageBytes { get; init; }
}

public sealed class GrowthBucketDto
{
    public DateTime DateUtc { get; init; }
    public int Users { get; init; }
    public int Organizations { get; init; }
}

public sealed class NamedCountDto
{
    public string Name { get; init; } = string.Empty;
    public int Count { get; init; }
}

public sealed class AttentionItemDto
{
    public string Key { get; init; } = string.Empty;
    public string Severity { get; init; } = "info";
    public string Title { get; init; } = string.Empty;
    public string Detail { get; init; } = string.Empty;
    public int Count { get; init; }
    public string Route { get; init; } = "/admin/dashboard";
}

public sealed class RecentAccountDto
{
    public long UserId { get; init; }
    public string DisplayName { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string? Company { get; init; }
    public DateTime CreatedAtUtc { get; init; }
    public DateTime LastActiveAtUtc { get; init; }
    public bool IsSuspended { get; init; }
}
