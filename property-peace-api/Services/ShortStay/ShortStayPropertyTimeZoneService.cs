using System.Data;
using System.Security.Claims;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.ShortStay;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.ShortStay;

public sealed class ShortStayPropertyTimeZoneService(DataContext db, IHttpContextAccessor context, ILogger<ShortStayPropertyTimeZoneService> logger)
{
    private static ServiceResponse<ShortStayPropertyTimeZoneDto> Error(string message, int status) =>
        ServiceResponse<ShortStayPropertyTimeZoneDto>.CreateError(message, statusCode: status, suppressDetailedErrors: true);

    private (long Org, long User)? Scope()
    {
        var http = context.HttpContext;
        if (http?.User.Identity?.IsAuthenticated != true ||
            http.Items.TryGetValue("OrganizationId", out var org) != true || org is not long organizationId || organizationId <= 0 ||
            http.Items.TryGetValue("UserId", out var user) != true || user is not long userId || userId <= 0 ||
            !long.TryParse(http.User.FindFirstValue(ClaimTypes.NameIdentifier), out var subject) || subject != userId)
            return null;
        return (organizationId, userId);
    }

    private Task<bool> CanManage((long Org, long User) scope, CancellationToken ct) =>
        db.OrganizationMembers.AsNoTracking().AnyAsync(m => m.OrganizationId == scope.Org && m.UserId == scope.User &&
            m.IsActive && m.Organization.IsActive && !m.Organization.IsDeleted &&
            (m.Role == "Owner" || m.Role == "Manager" && m.CanManageProperties), ct);

    public async Task<ServiceResponse<ShortStayPropertyTimeZoneDto>> Get(long propertyId, CancellationToken ct = default)
    {
        if (Scope() is not { } scope) return Error("Forbidden", 403);
        if (propertyId <= 0) return Error("Invalid property", 400);
        try
        {
            if (!await CanManage(scope, ct)) return Error("Forbidden", 403);
            // Project into a DTO rather than attaching a mutable Property to the context.
            var property = await db.Properties.AsNoTracking().Where(p => p.Id == propertyId &&
                p.OrganizationId == scope.Org && !p.IsDeleted)
                .Select(p => new ShortStayPropertyTimeZoneDto(p.Id, p.TimeZoneId)).SingleOrDefaultAsync(ct);
            return property is null ? Error("Property not found", 404) :
                ServiceResponse<ShortStayPropertyTimeZoneDto>.CreateSuccess(property);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            logger.LogError(ex, "Property time zone read unavailable for property {PropertyId}", propertyId);
            return Error("Property time zone unavailable", 503);
        }
    }

    public async Task<ServiceResponse<ShortStayPropertyTimeZoneDto>> Put(long propertyId, SaveShortStayPropertyTimeZoneDto? request, CancellationToken ct = default)
    {
        if (Scope() is not { } scope) return Error("Forbidden", 403);
        if (propertyId <= 0 || request is null || request.TimeZoneId?.Length > 128 ||
            !IanaTimeZoneAttribute.IsValidZone(request.TimeZoneId)) return Error("Invalid IANA time zone", 400);
        try
        {
            if (!await CanManage(scope, ct)) return Error("Forbidden", 403);
            if (!await db.Properties.AsNoTracking().AnyAsync(p => p.Id == propertyId &&
                p.OrganizationId == scope.Org && !p.IsDeleted, ct)) return Error("Property not found", 404);
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            // Inventory writers lock their unit row before writing. Lock every unit (and the
            // property-unit key range, including the empty range) before checking inventory,
            // so a sibling write or new unit cannot slip between the check and zone change.
            // Take unit locks before the property lock to match the writers' lock order.
            if (db.Database.IsSqlServer())
            {
                await db.Database.SqlQueryRaw<long>(
                    "SELECT Id AS Value FROM [property].[Units] WITH (UPDLOCK, HOLDLOCK) WHERE PropertyId = {0} ORDER BY Id", propertyId)
                    .ToListAsync(ct);
                await db.Database.SqlQueryRaw<long>(
                    "SELECT Id AS Value FROM [property].[Properties] WITH (UPDLOCK, HOLDLOCK) WHERE Id = {0} AND OrganizationId = {1} AND IsDeleted = 0", propertyId, scope.Org)
                    .SingleOrDefaultAsync(ct);
            }
            var property = await db.Properties.AsNoTracking()
                .Where(p => p.Id == propertyId && p.OrganizationId == scope.Org && !p.IsDeleted)
                .Select(p => new { p.TimeZoneId }).SingleOrDefaultAsync(ct);
            if (property is null) return Error("Property not found", 404);
            if (property.TimeZoneId == request.TimeZoneId)
            {
                await tx.CommitAsync(ct);
                return ServiceResponse<ShortStayPropertyTimeZoneDto>.CreateSuccess(new(propertyId, request.TimeZoneId));
            }
            if (property.TimeZoneId is not null &&
                (await db.ShortStayListings.AnyAsync(l => l.Unit.PropertyId == propertyId, ct) ||
                 await db.ShortStayBlocks.AnyAsync(b => b.Unit.PropertyId == propertyId, ct) ||
                 await db.ShortStayNightlyRateOverrides.AnyAsync(r => r.Unit.PropertyId == propertyId, ct) ||
                 // Disabled subscriptions and retained occurrences still carry local dates. Check
                 // under the same serializable property/unit locks as the other inventory.
                 await db.ShortStayIcalSubscriptions.AnyAsync(s => s.Unit.PropertyId == propertyId, ct) ||
                 await db.ShortStayIcalOccurrences.AnyAsync(o => o.Subscription.Unit.PropertyId == propertyId, ct)))
                return Error("Review and remove or migrate short-stay listings, blocks, rate overrides and Airbnb calendars before changing the property time zone", 409);
            // Recheck the org on the single-column update; never overwrite other property fields.
            var count = await db.Properties.Where(p => p.Id == propertyId && p.OrganizationId == scope.Org && !p.IsDeleted)
                .ExecuteUpdateAsync(setters => setters.SetProperty(p => p.TimeZoneId, request.TimeZoneId), ct);
            if (count == 0) return Error("Property not found", 404);
            await tx.CommitAsync(ct);
            return ServiceResponse<ShortStayPropertyTimeZoneDto>.CreateSuccess(new(propertyId, request.TimeZoneId));
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            logger.LogError(ex, "Property time zone write unavailable for property {PropertyId}", propertyId);
            return Error("Property time zone unavailable", 503);
        }
    }
}
