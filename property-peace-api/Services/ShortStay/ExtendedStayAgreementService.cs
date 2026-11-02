using System.Data;
using System.Security.Claims;
using brownstone_hub_api.Data;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.ShortStay;

public sealed record CreateExtendedStayAgreement(DateOnly StartDate, DateOnly EndDate, string OccupantName);
public sealed record ExtendedStayAgreementView(long Id, long UnitId, DateOnly StartDate, DateOnly EndDate,
    string OccupantName, DateTime CreatedAtUtc, string Status = "DraftUnsigned");

public sealed class ExtendedStayAgreementService(DataContext db, IHttpContextAccessor context, IHostEnvironment environment)
{
    private static ServiceResponse<T> Error<T>(string message, int code) =>
        ServiceResponse<T>.CreateError(message, statusCode: code, suppressDetailedErrors: true);
    private static ExtendedStayAgreementView View(ExtendedStayAgreement a) =>
        new(a.Id, a.UnitId, a.StartDate, a.EndDate, a.OccupantName, a.CreatedAtUtc);
    private (long Org, long User)? Scope()
    {
        var http = context.HttpContext;
        if (http?.User.Identity?.IsAuthenticated != true ||
            http.Items.TryGetValue("OrganizationId", out var org) != true || org is not long orgId || orgId <= 0 ||
            http.Items.TryGetValue("UserId", out var actor) != true || actor is not long userId || userId <= 0 ||
            !long.TryParse(http.User.FindFirstValue(ClaimTypes.NameIdentifier), out var subject) || subject != userId)
            return null;
        return (orgId, userId);
    }
    private async Task<int> Validate(long unitId, (long Org, long User) scope, CancellationToken ct)
    {
        if (!await db.OrganizationMembers.AsNoTracking().AnyAsync(m => m.OrganizationId == scope.Org && m.UserId == scope.User &&
            m.Role == "Owner" && m.IsActive && m.Organization.IsActive && !m.Organization.IsDeleted, ct)) return 403;
        var unit = await db.Units.AsNoTracking().Where(u => u.Id == unitId &&
            u.Property.OrganizationId == scope.Org && !u.Property.IsDeleted &&
            (u.OrganizationId == null || u.OrganizationId == scope.Org))
            .Select(u => (ERentalMode?)u.RentalMode).SingleOrDefaultAsync(ct);
        return unit is null ? 404 : unit == ERentalMode.ShortTerm ? 200 : 409;
    }
    public async Task<ServiceResponse<IReadOnlyList<ExtendedStayAgreementView>>> List(long unitId, CancellationToken ct = default)
    {
        if (!environment.IsDevelopment()) return Error<IReadOnlyList<ExtendedStayAgreementView>>("Unavailable", 404);
        if (Scope() is not { } scope) return Error<IReadOnlyList<ExtendedStayAgreementView>>("Forbidden", 403);
        if (unitId <= 0) return Error<IReadOnlyList<ExtendedStayAgreementView>>("Invalid unit", 400);
        try
        {
            var status = await Validate(unitId, scope, ct);
            if (status != 200) return Error<IReadOnlyList<ExtendedStayAgreementView>>("Unavailable", status);
            var rows = await db.Set<ExtendedStayAgreement>().AsNoTracking().Where(a => a.UnitId == unitId && a.OrganizationId == scope.Org)
                .OrderBy(a => a.StartDate).ThenBy(a => a.Id).ToListAsync(ct);
            return ServiceResponse<IReadOnlyList<ExtendedStayAgreementView>>.CreateSuccess(rows.Select(View).ToArray());
        }
        catch (OperationCanceledException) { throw; }
        catch { return Error<IReadOnlyList<ExtendedStayAgreementView>>("Agreement storage unavailable", 503); }
    }
    public async Task<ServiceResponse<ExtendedStayAgreementView>> Create(long unitId, CreateExtendedStayAgreement? request, CancellationToken ct = default)
    {
        if (!environment.IsDevelopment()) return Error<ExtendedStayAgreementView>("Unavailable", 404);
        if (Scope() is not { } scope) return Error<ExtendedStayAgreementView>("Forbidden", 403);
        if (unitId <= 0 || request is null || request.StartDate >= request.EndDate ||
            string.IsNullOrWhiteSpace(request.OccupantName) || request.OccupantName.Trim().Length > 200)
            return Error<ExtendedStayAgreementView>("Invalid agreement", 400);
        try
        {
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            // Same unit mutex as owner blocks, Airbnb sync, quote and guest holds. Never rely on a preflight read.
            if (db.Database.IsSqlServer())
                await db.Database.SqlQueryRaw<long>(
                    "SELECT Id AS Value FROM [property].[Units] WITH (UPDLOCK, HOLDLOCK) WHERE Id = {0}", unitId).SingleOrDefaultAsync(ct);
            var status = await Validate(unitId, scope, ct);
            if (status != 200) return Error<ExtendedStayAgreementView>("Unavailable", status);
            var start = request.StartDate; var end = request.EndDate;
            if (await db.ShortStayBlocks.AnyAsync(b => b.UnitId == unitId && b.StartDate < end && b.EndDate > start, ct) ||
                await db.ShortStayOccupancyClaims.AnyAsync(c => c.UnitId == unitId && c.Date >= start && c.Date < end, ct) ||
                await db.ShortStayIcalOccurrences.AnyAsync(o => o.Subscription.UnitId == unitId &&
                    o.Subscription.OrgId == scope.Org && o.Subscription.Enabled && o.StartDate < end && o.EndDate > start, ct) ||
                await db.Set<ExtendedStayAgreement>().AnyAsync(a => a.UnitId == unitId && a.StartDate < end && a.EndDate > start, ct))
                return Error<ExtendedStayAgreementView>("Dates already occupied", 409);
            var agreement = new ExtendedStayAgreement { UnitId = unitId, OrganizationId = scope.Org,
                CreatedByUserId = scope.User, StartDate = start, EndDate = end,
                OccupantName = request.OccupantName.Trim(), CreatedAtUtc = DateTime.UtcNow };
            db.Set<ExtendedStayAgreement>().Add(agreement);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return ServiceResponse<ExtendedStayAgreementView>.CreateSuccess(View(agreement), statusCode: 201);
        }
        catch (OperationCanceledException) { throw; }
        catch (DbUpdateException) { return Error<ExtendedStayAgreementView>("Agreement conflict", 409); }
        catch { return Error<ExtendedStayAgreementView>("Agreement storage unavailable", 503); }
    }
}
