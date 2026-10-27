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
    Task<List<long>> GetTenantLeaseOrganizationIdsAsync(long userId, CancellationToken cancellationToken = default);
    Task<bool> HasTenantLeaseInOrganizationAsync(long userId, long leaseId, long organizationId, CancellationToken cancellationToken = default);
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
    public Task<bool> HasTenantLeaseInOrganizationAsync(long userId, long leaseId, long organizationId, CancellationToken cancellationToken = default) =>
        dataContext.TenantLeases.AsNoTracking().AnyAsync(link =>
            link.Tenant.UserId == userId && !link.Tenant.IsDeleted &&
            link.Tenant.OrganizationId == organizationId && link.LeaseId == leaseId &&
            !link.Lease.IsDeleted &&
            link.Lease.OrganizationId == organizationId &&
            !link.Lease.Unit.Property.IsDeleted && link.Lease.Unit.Property.OrganizationId == organizationId &&
            link.Lease.Unit.Property.Organization!.IsActive && !link.Lease.Unit.Property.Organization.IsDeleted,
            cancellationToken);
    // Tenant self-service authority is distinct from organization membership.
    public Task<List<long>> GetTenantLeaseOrganizationIdsAsync(long userId, CancellationToken cancellationToken = default) =>
        dataContext.TenantLeases.AsNoTracking()
            .Where(link => link.Tenant.UserId == userId && !link.Tenant.IsDeleted &&
                !link.Lease.IsDeleted &&
                !link.Lease.Unit.Property.IsDeleted &&
                link.Lease.Unit.Property.OrganizationId != null &&
                link.Lease.Unit.Property.OrganizationId == link.Lease.OrganizationId &&
                link.Tenant.OrganizationId == link.Lease.OrganizationId &&
                link.Lease.Unit.Property.Organization!.IsActive &&
                !link.Lease.Unit.Property.Organization.IsDeleted)
            .Select(link => link.Lease.OrganizationId!.Value)
            .Distinct().ToListAsync(cancellationToken);
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
