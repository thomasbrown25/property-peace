using System.Data;
using System.Security.Claims;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.ShortStay;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.ShortStay;

public sealed class ShortStayCalendarService(DataContext db, IHttpContextAccessor context, ILogger<ShortStayCalendarService> logger)
{
    private static ServiceResponse<T> Error<T>(string message, int status) =>
        ServiceResponse<T>.CreateError(message, statusCode: status, suppressDetailedErrors: true);
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

    private async Task<(Unit? Unit, int Status)> FindUnit(long id, long org, CancellationToken ct)
    {
        var unit = await db.Units.AsNoTracking().Include(u => u.Property).FirstOrDefaultAsync(u => u.Id == id &&
            u.Property.OrganizationId == org && !u.Property.IsDeleted &&
            (u.OrganizationId == null || u.OrganizationId == org), ct);
        if (unit is null) return (null, 404);
        if (unit.RentalMode != ERentalMode.ShortTerm || !IanaTimeZoneAttribute.IsValidZone(unit.Property.TimeZoneId))
            return (null, 409);
        return (unit, 200);
    }
    private static bool ValidRange(DateOnly start, DateOnly end) =>
        end.DayNumber > start.DayNumber && end.DayNumber - start.DayNumber <= 366;
    private static bool ValidRate(decimal rate) => rate >= 0.01m && rate <= 999999.99m && rate == decimal.Round(rate, 2);
    private static ShortStayBlockDto Map(ShortStayBlock block) =>
        new(block.Id, block.StartDate, block.EndDate, block.Reason, "OwnerBlock");

    public async Task<ServiceResponse<ShortStayCalendarDto>> Get(long unitId, DateOnly start, DateOnly end, CancellationToken ct = default)
    {
        if (Scope() is not { } scope) return Error<ShortStayCalendarDto>("Forbidden", 403);
        if (unitId <= 0 || !ValidRange(start, end)) return Error<ShortStayCalendarDto>("Invalid calendar range", 400);
        try
        {
            if (!await CanManage(scope, ct)) return Error<ShortStayCalendarDto>("Forbidden", 403);
            var (unit, status) = await FindUnit(unitId, scope.Org, ct);
            if (unit is null) return Error<ShortStayCalendarDto>("Unit unavailable for short-stay calendar", status);
            var blocks = await db.ShortStayBlocks.AsNoTracking().Where(b => b.UnitId == unitId && b.StartDate < end && b.EndDate > start)
                .OrderBy(b => b.StartDate).ThenBy(b => b.Id).ToListAsync(ct);
            // Project only safe fields: feed credentials and HMAC event keys must never enter the response.
            // Imported ids occupy the negative namespace so DELETE (which accepts only positive owner ids)
            // cannot mutate an imported occurrence, even when its positive database id matches a block id.
            var imported = await db.ShortStayIcalOccurrences.AsNoTracking()
                .Where(o => o.Subscription.UnitId == unitId && o.Subscription.OrgId == scope.Org &&
                    o.Subscription.Enabled && o.StartDate < end && o.EndDate > start)
                .Select(o => new { o.Id, o.StartDate, o.EndDate }).ToListAsync(ct);
            var claims = await db.ShortStayOccupancyClaims.AsNoTracking()
                .Where(c => c.UnitId == unitId && c.Reservation.OrganizationId == scope.Org &&
                    c.Date >= start && c.Date < end)
                .Select(c => new { c.Date, c.Reservation.Status }).ToListAsync(ct);
            var visibleBlocks = blocks.Select(Map).Concat(imported.Select(o =>
                    new ShortStayBlockDto(-o.Id, o.StartDate, o.EndDate, null, "Airbnb")))
                .Concat(claims.Select(c => new ShortStayBlockDto(long.MinValue + c.Date.DayNumber,
                    c.Date, c.Date.AddDays(1), null,
                    c.Status == ShortStayReservationStatus.Confirmed ? "Confirmed" : "Held")))
                .OrderBy(b => b.StartDate).ThenBy(b => b.Id).ToArray();
            var overrides = await db.ShortStayNightlyRateOverrides.AsNoTracking().Where(r => r.UnitId == unitId && r.Date >= start && r.Date < end)
                .ToDictionaryAsync(r => r.Date, r => r.NightlyRate, ct);
            var listing = await db.ShortStayListings.AsNoTracking().Where(l => l.UnitId == unitId)
                .Select(l => new { l.NightlyBasePrice, l.WeekendNightlyRate }).SingleOrDefaultAsync(ct);
            var baseRate = listing?.NightlyBasePrice;
            var nights = Enumerable.Range(0, end.DayNumber - start.DayNumber).Select(i =>
            {
                var day = start.AddDays(i);
                var hasOverride = overrides.TryGetValue(day, out var price);
                var weekend = (day.DayOfWeek is DayOfWeek.Friday or DayOfWeek.Saturday) && listing?.WeekendNightlyRate is not null;
                return new ShortStayNightDto(day, baseRate, hasOverride ? price : null,
                    hasOverride ? price : weekend ? listing!.WeekendNightlyRate : baseRate,
                    hasOverride ? "Override" : weekend ? "Weekend" : baseRate.HasValue ? "Base" : null);
            }).ToArray();
            return ServiceResponse<ShortStayCalendarDto>.CreateSuccess(new(unitId, unit.Property.TimeZoneId!, start, end,
                visibleBlocks, nights));
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex) { logger.LogError(ex, "Short-stay calendar read failed for unit {UnitId}", unitId); return Error<ShortStayCalendarDto>("Calendar unavailable", 503); }
    }

    // The mode-switch writer takes this same lock before checking mode. Hold it through the
    // write and re-read the unit under it; block overlap and rate upserts serialize per unit.
    private async Task<ServiceResponse<T>> Write<T>(long unitId, Func<CancellationToken, Task<ServiceResponse<T>>> action, CancellationToken ct)
    {
        if (Scope() is not { } scope) return Error<T>("Forbidden", 403);
        if (unitId <= 0) return Error<T>("Invalid unit", 400);
        try
        {
            if (!await CanManage(scope, ct)) return Error<T>("Forbidden", 403);
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            if (db.Database.IsSqlServer())
                await db.Database.SqlQueryRaw<long>(
                    "SELECT Id AS Value FROM [property].[Units] WITH (UPDLOCK, HOLDLOCK) WHERE Id = {0}", unitId)
                    .SingleOrDefaultAsync(ct);
            var (unit, status) = await FindUnit(unitId, scope.Org, ct);
            if (unit is null) return Error<T>("Unit unavailable for short-stay calendar", status);
            var response = await action(ct);
            if (response.Success)
            {
                await db.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);
            }
            return response;
        }
        catch (OperationCanceledException) { throw; }
        catch (DbUpdateException ex) when (ex.InnerException is Microsoft.Data.SqlClient.SqlException sql && (sql.Number == 2601 || sql.Number == 2627))
        { return Error<T>("Calendar date already exists", 409); }
        catch (Exception ex) { logger.LogError(ex, "Short-stay calendar write failed for unit {UnitId}", unitId); return Error<T>("Calendar unavailable", 503); }
    }

    public Task<ServiceResponse<ShortStayBlockDto>> PostBlock(long unitId, SaveShortStayBlockDto? request, CancellationToken ct = default)
    {
        if (request is null || !ValidRange(request.StartDate, request.EndDate) || request.Reason?.Length > 500)
            return Task.FromResult(Error<ShortStayBlockDto>("Invalid block range or reason", 400));
        return Write(unitId, async token =>
        {
            if (await db.ShortStayBlocks.AnyAsync(b => b.UnitId == unitId && b.StartDate < request.EndDate && b.EndDate > request.StartDate, token))
                return Error<ShortStayBlockDto>("Block overlaps an existing owner block", 409);
            if (await db.ShortStayOccupancyClaims.AnyAsync(c => c.UnitId == unitId &&
                c.Date >= request.StartDate && c.Date < request.EndDate, token))
                return Error<ShortStayBlockDto>("Block overlaps a held or confirmed night", 409);
            var block = new ShortStayBlock { UnitId = unitId, StartDate = request.StartDate, EndDate = request.EndDate, Reason = request.Reason };
            db.ShortStayBlocks.Add(block);
            // Save here to return the generated block id within the transaction.
            await db.SaveChangesAsync(token);
            return ServiceResponse<ShortStayBlockDto>.CreateSuccess(Map(block), statusCode: 201);
        }, ct);
    }
    public Task<ServiceResponse<bool>> DeleteBlock(long unitId, long blockId, CancellationToken ct = default)
    {
        if (blockId <= 0) return Task.FromResult(Error<bool>("Invalid block", 400));
        return Write(unitId, async token =>
        {
            var block = await db.ShortStayBlocks.SingleOrDefaultAsync(b => b.UnitId == unitId && b.Id == blockId, token);
            if (block is null) return Error<bool>("Block not found", 404);
            db.ShortStayBlocks.Remove(block);
            return ServiceResponse<bool>.CreateSuccess(true);
        }, ct);
    }
    public Task<ServiceResponse<IReadOnlyList<ShortStayRateDto>>> PutRateRange(long unitId, SaveShortStayRateRangeDto? request, CancellationToken ct = default)
    {
        if (request is null || !ValidRange(request.StartDate, request.EndDate) || !ValidRate(request.NightlyRate))
            return Task.FromResult(Error<IReadOnlyList<ShortStayRateDto>>("Invalid rate range or nightly rate", 400));
        return Write(unitId, async token =>
        {
            var existing = await db.ShortStayNightlyRateOverrides
                .Where(r => r.UnitId == unitId && r.Date >= request.StartDate && r.Date < request.EndDate)
                .ToDictionaryAsync(r => r.Date, token);
            var result = new List<ShortStayRateDto>(request.EndDate.DayNumber - request.StartDate.DayNumber);
            for (var date = request.StartDate; date < request.EndDate; date = date.AddDays(1))
            {
                if (!existing.TryGetValue(date, out var row))
                {
                    row = new ShortStayNightlyRateOverride { UnitId = unitId, Date = date };
                    db.ShortStayNightlyRateOverrides.Add(row);
                }
                row.NightlyRate = request.NightlyRate;
                result.Add(new(date, row.NightlyRate));
            }
            return ServiceResponse<IReadOnlyList<ShortStayRateDto>>.CreateSuccess(result);
        }, ct);
    }

    public Task<ServiceResponse<ShortStayRateDto>> PutRate(long unitId, DateOnly date, SaveShortStayRateDto? request, CancellationToken ct = default)
    {
        if (request is null || !ValidRate(request.NightlyRate))
            return Task.FromResult(Error<ShortStayRateDto>("Invalid nightly rate; use cents between 0.01 and 999999.99", 400));
        return Write(unitId, async token =>
        {
            var rate = await db.ShortStayNightlyRateOverrides.SingleOrDefaultAsync(r => r.UnitId == unitId && r.Date == date, token);
            var created = rate is null;
            if (created) { rate = new ShortStayNightlyRateOverride { UnitId = unitId, Date = date }; db.ShortStayNightlyRateOverrides.Add(rate); }
            rate!.NightlyRate = request.NightlyRate;
            return ServiceResponse<ShortStayRateDto>.CreateSuccess(new(date, rate.NightlyRate), statusCode: created ? 201 : 200);
        }, ct);
    }
    public Task<ServiceResponse<bool>> DeleteRate(long unitId, DateOnly date, CancellationToken ct = default) =>
        Write(unitId, async token =>
        {
            var rate = await db.ShortStayNightlyRateOverrides.SingleOrDefaultAsync(r => r.UnitId == unitId && r.Date == date, token);
            if (rate is null) return Error<bool>("Rate override not found", 404);
            db.ShortStayNightlyRateOverrides.Remove(rate);
            return ServiceResponse<bool>.CreateSuccess(true);
        }, ct);
}
