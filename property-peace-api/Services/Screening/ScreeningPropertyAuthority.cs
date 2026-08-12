using brownstone_hub_api.Data;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.Screening;

/// <summary>
/// The single tenant-screening staff authority boundary. Organization capability is necessary but
/// never sufficient: the actor must also be the order property's landlord or primary manager.
/// </summary>
public interface IScreeningPropertyAuthority
{
    Task EnsureOrganizationCapabilityAsync(long organizationId, long actorUserId,
        CancellationToken cancellationToken = default);
    Task EnsurePropertyAuthorityAsync(long organizationId, long actorUserId, long propertyId,
        CancellationToken cancellationToken = default);
}

public sealed class ScreeningPropertyAuthority(DataContext db) : IScreeningPropertyAuthority
{
    private readonly DataContext _db = db ?? throw new ArgumentNullException(nameof(db));

    public async Task EnsureOrganizationCapabilityAsync(long organizationId, long actorUserId,
        CancellationToken cancellationToken = default)
    {
        if (organizationId <= 0 || actorUserId <= 0) throw new ArgumentOutOfRangeException(nameof(actorUserId));
        var capable = await _db.OrganizationMembers.AsNoTracking().AnyAsync(x =>
            x.OrganizationId == organizationId && x.UserId == actorUserId && x.IsActive &&
            (x.Role == "Owner" || x.Role == "Manager" || x.CanManageTenants), cancellationToken);
        if (!capable) throw new ScreeningAuthorizationException();
    }

    public async Task EnsurePropertyAuthorityAsync(long organizationId, long actorUserId, long propertyId,
        CancellationToken cancellationToken = default)
    {
        if (propertyId <= 0) throw new ArgumentOutOfRangeException(nameof(propertyId));
        await EnsureOrganizationCapabilityAsync(organizationId, actorUserId, cancellationToken);
        var assigned = await _db.Properties.AsNoTracking().AnyAsync(x => x.Id == propertyId &&
            x.OrganizationId == organizationId && !x.IsDeleted &&
            (x.LandlordId == actorUserId || x.PrimaryManagerId == actorUserId), cancellationToken);
        if (!assigned) throw new ScreeningAuthorizationException();
    }
}
