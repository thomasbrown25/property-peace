using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Security;

/// <summary>
/// Resolves organization membership only when both the organization and membership
/// are currently eligible to authorize organization-scoped access.
/// </summary>
public interface IOrganizationAuthorityResolver
{
    Task<bool> HasActiveMembershipAsync(
        long userId,
        long organizationId,
        CancellationToken cancellationToken = default);

    Task<OrganizationMember?> ResolveActiveMemberAsync(
        long userId,
        long organizationId,
        CancellationToken cancellationToken = default);
}

public sealed class OrganizationAuthorityResolver(DataContext dataContext) : IOrganizationAuthorityResolver
{
    public async Task<bool> HasActiveMembershipAsync(
        long userId,
        long organizationId,
        CancellationToken cancellationToken = default) =>
        await ResolveActiveMemberAsync(userId, organizationId, cancellationToken) is not null;

    public Task<OrganizationMember?> ResolveActiveMemberAsync(
        long userId,
        long organizationId,
        CancellationToken cancellationToken = default) =>
        dataContext.OrganizationMembers
            .AsNoTracking()
            .Where(member =>
                member.UserId == userId &&
                member.OrganizationId == organizationId &&
                member.IsActive &&
                member.Organization.IsActive &&
                !member.Organization.IsDeleted)
            .SingleOrDefaultAsync(cancellationToken);
}
