using System.Collections.Frozen;
using brownstone_hub_api.Data;
using brownstone_hub_api.Entitlements.Decision;
using brownstone_hub_api.Entitlements.Policy;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Entitlements.Infrastructure;

/// <summary>Executes only feature-specific entitlement fact queries.</summary>
public interface IEntitlementFeatureFactsLoader
{
    Task<int> CountOrganizationUnitsAsync(long organizationId, CancellationToken cancellationToken);
    Task<bool> IsSmsNumberConfiguredAsync(long organizationId, CancellationToken cancellationToken);
}

public sealed class EfEntitlementFeatureFactsLoader(DataContext context) : IEntitlementFeatureFactsLoader
{
    public Task<int> CountOrganizationUnitsAsync(long organizationId, CancellationToken cancellationToken) =>
        context.Units
            .AsNoTracking()
            .Join(
                context.Properties.AsNoTracking().Where(property =>
                    property.OrganizationId == organizationId && !property.IsDeleted),
                unit => unit.PropertyId,
                property => property.Id,
                (unit, _) => unit)
            .CountAsync(cancellationToken);

    public Task<bool> IsSmsNumberConfiguredAsync(long organizationId, CancellationToken cancellationToken) =>
        context.OrganizationSmsNumbers
            .AsNoTracking()
            .AnyAsync(item => item.OrganizationId == organizationId && item.IsActive && item.IsPrimary, cancellationToken);
}

/// <summary>
/// Reads entitlement facts for one explicit authenticated user and organization scope.
/// No ambient organization or user/owner subscription fallback is permitted here.
/// </summary>
public sealed class EfEntitlementDecisionFactsProvider(
    DataContext context,
    IEntitlementFeatureFactsLoader featureFactsLoader) : IEntitlementDecisionFactsProvider
{
    private static readonly IReadOnlySet<AddOnKey> NoAddOns =
        Array.Empty<AddOnKey>().ToFrozenSet();

    private static readonly IReadOnlyDictionary<ReadinessDependencyKey, bool> NoReadiness =
        new Dictionary<ReadinessDependencyKey, bool>().ToFrozenDictionary();

    public async Task<EntitlementDecisionFacts?> GetFactsAsync(
        string authenticatedUserId,
        long organizationId,
        FeatureKey feature,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!long.TryParse(authenticatedUserId, out var userId) || userId <= 0 || organizationId <= 0)
        {
            return null;
        }

        var definition = EntitlementCatalog.Features.SingleOrDefault(item => item.Key == feature);
        if (definition is null)
        {
            return null;
        }

        var organization = await context.Organizations
            .AsNoTracking()
            .Where(item => item.Id == organizationId)
            .Select(item => new OrganizationAuthorityFacts(item.Id, true, item.IsActive, item.IsDeleted))
            .SingleOrDefaultAsync(cancellationToken)
            ?? new OrganizationAuthorityFacts(organizationId, false, false, false);

        var member = await context.OrganizationMembers
            .AsNoTracking()
            .Where(item => item.OrganizationId == organizationId && item.UserId == userId)
            .Select(item => new MemberProjection(
                item.OrganizationId,
                item.IsActive,
                item.Role,
                item.CanManageProperties,
                item.CanManageTenants,
                item.CanManageLeases,
                item.CanManageMaintenance,
                item.CanManageBilling,
                item.CanManageMembers))
            .SingleOrDefaultAsync(cancellationToken);

        var membership = member is null
            ? new OrganizationMembershipFacts(
                organizationId, MembershipState.Missing, null, null, Array.Empty<OrganizationPermission>())
            : new OrganizationMembershipFacts(
                member.OrganizationId,
                member.IsActive ? MembershipState.Active : MembershipState.Inactive,
                ParseRole(member.Role),
                member.Role,
                Permissions(member));

        var subscriptionProjection = await context.Subscriptions
            .AsNoTracking()
            .Where(item => item.OrganizationId == organizationId)
            .Select(item => new SubscriptionProjection(
                item.OrganizationId!.Value,
                item.SubscriptionPlan.Name,
                item.Status,
                item.CurrentPeriodEnd,
                item.TrialEnd,
                item.CancelAtPeriodEnd,
                item.PausedAtPeriodEnd,
                item.CancelledAt,
                item.PausedAt))
            .SingleOrDefaultAsync(cancellationToken);

        var subscription = subscriptionProjection is null
            ? null
            : new OrganizationSubscriptionFacts(
                subscriptionProjection.OrganizationId,
                subscriptionProjection.PlanName,
                new SubscriptionLifecycleFacts(
                    subscriptionProjection.Status,
                    ToUtcOffset(subscriptionProjection.CurrentPeriodEnd),
                    ToUtcOffset(subscriptionProjection.TrialEnd),
                    subscriptionProjection.CancelAtPeriodEnd,
                    subscriptionProjection.PauseAtPeriodEnd,
                    ToUtcOffset(subscriptionProjection.CancelledAt),
                    ToUtcOffset(subscriptionProjection.PausedAt)));

        int? currentUsage = null;
        if (definition.PlanAccess.Any(access => access.Quota is not null))
        {
            currentUsage = await featureFactsLoader.CountOrganizationUnitsAsync(organizationId, cancellationToken);
        }

        IReadOnlyDictionary<ReadinessDependencyKey, bool> readiness = NoReadiness;
        if (definition.ReadinessDependencies.Count > 0)
        {
            if (definition.ReadinessDependencies.Count != 1 ||
                definition.ReadinessDependencies[0] != ReadinessDependencyKeys.SmsNumberConfigured)
            {
                throw new InvalidOperationException("Unsupported entitlement readiness dependency.");
            }

            var smsNumberConfigured = await featureFactsLoader
                .IsSmsNumberConfiguredAsync(organizationId, cancellationToken);
            readiness = new Dictionary<ReadinessDependencyKey, bool>
            {
                [ReadinessDependencyKeys.SmsNumberConfigured] = smsNumberConfigured
            }.ToFrozenDictionary();
        }

        return new EntitlementDecisionFacts(
            authenticatedUserId,
            organization,
            membership,
            subscription,
            currentUsage,
            NoAddOns,
            readiness);
    }

    private static OrganizationRole? ParseRole(string? role)
    {
        if (string.Equals(role, nameof(OrganizationRole.Owner), StringComparison.OrdinalIgnoreCase))
        {
            return OrganizationRole.Owner;
        }

        if (string.Equals(role, nameof(OrganizationRole.Manager), StringComparison.OrdinalIgnoreCase))
        {
            return OrganizationRole.Manager;
        }

        if (string.Equals(role, nameof(OrganizationRole.Viewer), StringComparison.OrdinalIgnoreCase))
        {
            return OrganizationRole.Viewer;
        }

        return null;
    }

    private static IReadOnlyCollection<OrganizationPermission> Permissions(MemberProjection member)
    {
        var permissions = new List<OrganizationPermission>(6);
        if (member.CanManageProperties) permissions.Add(OrganizationPermission.ManageProperties);
        if (member.CanManageTenants) permissions.Add(OrganizationPermission.ManageTenants);
        if (member.CanManageLeases) permissions.Add(OrganizationPermission.ManageLeases);
        if (member.CanManageMaintenance) permissions.Add(OrganizationPermission.ManageMaintenance);
        if (member.CanManageBilling) permissions.Add(OrganizationPermission.ManageBilling);
        if (member.CanManageMembers) permissions.Add(OrganizationPermission.ManageMembers);
        return permissions.AsReadOnly();
    }

    private static DateTimeOffset? ToUtcOffset(DateTime? value) =>
        value.HasValue
            ? new DateTimeOffset(DateTime.SpecifyKind(value.Value, DateTimeKind.Utc))
            : null;

    private sealed record MemberProjection(
        long OrganizationId,
        bool IsActive,
        string? Role,
        bool CanManageProperties,
        bool CanManageTenants,
        bool CanManageLeases,
        bool CanManageMaintenance,
        bool CanManageBilling,
        bool CanManageMembers);

    private sealed record SubscriptionProjection(
        long OrganizationId,
        string? PlanName,
        string? Status,
        DateTime? CurrentPeriodEnd,
        DateTime? TrialEnd,
        bool CancelAtPeriodEnd,
        bool PauseAtPeriodEnd,
        DateTime? CancelledAt,
        DateTime? PausedAt);
}
