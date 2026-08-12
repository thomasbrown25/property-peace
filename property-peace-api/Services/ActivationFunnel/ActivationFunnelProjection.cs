using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.ActivationFunnel;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.ActivationFunnel;

public interface IActivationFunnelProjection
{
    Task<ActivationFunnelReportDto> GetAsync(DateTimeOffset startUtc, DateTimeOffset endUtc,
        CancellationToken cancellationToken = default);
}

public sealed class ActivationFunnelProjection(DataContext db) : IActivationFunnelProjection
{
    public const int MaximumRangeDays = 366;

    public async Task<ActivationFunnelReportDto> GetAsync(DateTimeOffset startUtc, DateTimeOffset endUtc,
        CancellationToken cancellationToken = default)
    {
        ValidateRange(startUtc, endUtc);
        var rows = await db.ActivationMilestoneOccurrences.AsNoTracking()
            .Where(x => x.OccurredAtUtc >= startUtc.UtcDateTime && x.OccurredAtUtc < endUtc.UtcDateTime)
            .GroupBy(x => x.Milestone)
            .Select(group => new
            {
                Milestone = group.Key,
                Occurrences = group.Count(),
                Organizations = group.Select(x => x.OrganizationId).Distinct().Count(),
                Estimated = group.Count(x => x.IsTimestampEstimated)
            }).ToListAsync(cancellationToken);
        var byMilestone = rows.ToDictionary(x => x.Milestone, StringComparer.Ordinal);
        var milestones = ActivationMilestones.All.Select(milestone => byMilestone.TryGetValue(milestone, out var row)
            ? new ActivationFunnelMilestoneDto(milestone, row.Occurrences, row.Organizations, row.Estimated)
            : new ActivationFunnelMilestoneDto(milestone, 0, 0, 0)).ToArray();
        return new ActivationFunnelReportDto(startUtc, endUtc, milestones);
    }

    private static void ValidateRange(DateTimeOffset startUtc, DateTimeOffset endUtc)
    {
        if (startUtc.Offset != TimeSpan.Zero || endUtc.Offset != TimeSpan.Zero)
            throw new ArgumentException("Funnel boundaries must use UTC (offset 00:00).");
        if (endUtc <= startUtc) throw new ArgumentOutOfRangeException(nameof(endUtc), "End must be after start.");
        if (endUtc - startUtc > TimeSpan.FromDays(MaximumRangeDays))
            throw new ArgumentOutOfRangeException(nameof(endUtc), $"Range cannot exceed {MaximumRangeDays} days.");
    }
}
