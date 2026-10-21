using System.Data;
using System.Security.Claims;
using System.Text.RegularExpressions;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.ShortStay;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.ShortStay;

public sealed class ShortStayGuidebookDraftService(DataContext db, IHttpContextAccessor context, ILogger<ShortStayGuidebookDraftService> logger)
{
    private static ServiceResponse<ShortStayGuidebookDraftDto?> Error(string message, int status) =>
        ServiceResponse<ShortStayGuidebookDraftDto?>.CreateError(message, statusCode: status, suppressDetailedErrors: true);

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

    private Task<bool> AuthorizedUnit(long unitId, long org, CancellationToken ct) =>
        db.Units.AsNoTracking().AnyAsync(u => u.Id == unitId && u.Property.OrganizationId == org &&
            !u.Property.IsDeleted && (u.OrganizationId == null || u.OrganizationId == org), ct);

    private static ShortStayGuidebookDraftDto Map(ShortStayGuidebookDraft draft) =>
        new(draft.UnitId, draft.HouseRules, draft.ArrivalOverview, draft.LocalNotes);

    // Defense in depth: redactable credentials and contact information do not belong in this draft.
    // Heuristics cannot guarantee PII detection; drafts must remain owner-only.
    private static readonly Regex Sensitive = new(@"\b(?:wi[ -]?fi|password|passcode|pin|access[ -]?code|door[ -]?code|lockbox|keypad|security[ -]?code|entry[ -]?code|secret|credential)\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b(?:\+?\d[\d ().-]{7,}\d)\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled, TimeSpan.FromMilliseconds(100));

    private static bool Valid(string? value) => value is null ||
        (value.Length <= 2000 && !Sensitive.IsMatch(value) &&
         !Regex.IsMatch(value, @"<\s*/?\s*[a-z][^>]*>", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100)) &&
         !value.Any(c => char.IsControl(c) && c is not '\n' and not '\r' and not '\t'));

    public async Task<ServiceResponse<ShortStayGuidebookDraftDto?>> Get(long unitId, CancellationToken ct = default)
    {
        if (Scope() is not { } scope) return Error("Forbidden", 403);
        if (unitId <= 0) return Error("Invalid unit", 400);
        try
        {
            if (!await CanManage(scope, ct)) return Error("Forbidden", 403);
            if (!await AuthorizedUnit(unitId, scope.Org, ct)) return Error("Unit not found", 404);
            if (!await db.Units.AsNoTracking().AnyAsync(u => u.Id == unitId && u.RentalMode == ERentalMode.ShortTerm, ct))
                return Error("Unit is not short-term", 409);
            var draft = await db.ShortStayGuidebookDrafts.AsNoTracking().SingleOrDefaultAsync(x => x.UnitId == unitId, ct);
            return ServiceResponse<ShortStayGuidebookDraftDto?>.CreateSuccess(draft is null ? null : Map(draft));
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            logger.LogError(ex, "Guidebook draft read unavailable for unit {UnitId}", unitId);
            return Error("Guidebook draft unavailable", 503);
        }
    }

    public async Task<ServiceResponse<ShortStayGuidebookDraftDto?>> Put(long unitId, SaveShortStayGuidebookDraftDto? request, CancellationToken ct = default)
    {
        if (Scope() is not { } scope) return Error("Forbidden", 403);
        if (unitId <= 0 || request is null || !Valid(request.HouseRules) || !Valid(request.ArrivalOverview) || !Valid(request.LocalNotes))
            return Error("Invalid guidebook draft: use public-safe plain text of at most 2000 characters per field", 400);
        try
        {
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            // Rental-mode changes lock this row first. Check authorization and mode after acquiring it.
            if (db.Database.IsSqlServer())
                await db.Database.SqlQueryRaw<long>(
                    "SELECT Id AS Value FROM [property].[Units] WITH (UPDLOCK, HOLDLOCK) WHERE Id = {0}", unitId)
                    .SingleOrDefaultAsync(ct);
            if (!await CanManage(scope, ct)) return Error("Forbidden", 403);
            var unit = await db.Units.AsNoTracking().Where(u => u.Id == unitId && u.Property.OrganizationId == scope.Org &&
                !u.Property.IsDeleted && (u.OrganizationId == null || u.OrganizationId == scope.Org))
                .Select(u => new { u.RentalMode }).SingleOrDefaultAsync(ct);
            if (unit is null) return Error("Unit not found", 404);
            if (unit.RentalMode != ERentalMode.ShortTerm) return Error("Unit is not short-term", 409);
            var draft = await db.ShortStayGuidebookDrafts.SingleOrDefaultAsync(x => x.UnitId == unitId, ct);
            var created = draft is null;
            if (created)
            {
                draft = new ShortStayGuidebookDraft { UnitId = unitId };
                db.ShortStayGuidebookDrafts.Add(draft);
            }
            draft!.HouseRules = request.HouseRules;
            draft.ArrivalOverview = request.ArrivalOverview;
            draft.LocalNotes = request.LocalNotes;
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return ServiceResponse<ShortStayGuidebookDraftDto?>.CreateSuccess(Map(draft),
                created ? "Draft created" : "Draft updated", created ? 201 : 200);
        }
        catch (OperationCanceledException) { throw; }
        catch (DbUpdateException ex) when (ex.InnerException is Microsoft.Data.SqlClient.SqlException sql &&
            (sql.Number == 2601 || sql.Number == 2627))
        {
            return Error("Guidebook draft already exists for unit", 409);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Guidebook draft write unavailable for unit {UnitId}", unitId);
            return Error("Guidebook draft unavailable", 503);
        }
    }

    /// <summary>Permanently discard the owner's manual draft; blank PUT fields never discard it.</summary>
    public async Task<ServiceResponse<ShortStayGuidebookDraftDto?>> Delete(long unitId, CancellationToken ct = default)
    {
        if (Scope() is not { } scope) return Error("Forbidden", 403);
        if (unitId <= 0) return Error("Invalid unit", 400);
        try
        {
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            // Serialize with both PUT and rental-mode conversion, then recheck scope and mode.
            if (db.Database.IsSqlServer())
                await db.Database.SqlQueryRaw<long>(
                    "SELECT Id AS Value FROM [property].[Units] WITH (UPDLOCK, HOLDLOCK) WHERE Id = {0}", unitId)
                    .SingleOrDefaultAsync(ct);
            if (!await CanManage(scope, ct)) return Error("Forbidden", 403);
            var unit = await db.Units.AsNoTracking().Where(u => u.Id == unitId && u.Property.OrganizationId == scope.Org &&
                !u.Property.IsDeleted && (u.OrganizationId == null || u.OrganizationId == scope.Org))
                .Select(u => new { u.RentalMode }).SingleOrDefaultAsync(ct);
            if (unit is null) return Error("Unit not found", 404);
            if (unit.RentalMode != ERentalMode.ShortTerm) return Error("Unit is not short-term", 409);
            var draft = await db.ShortStayGuidebookDrafts.SingleOrDefaultAsync(x => x.UnitId == unitId, ct);
            if (draft is not null)
            {
                db.ShortStayGuidebookDrafts.Remove(draft);
                await db.SaveChangesAsync(ct);
            }
            await tx.CommitAsync(ct);
            return ServiceResponse<ShortStayGuidebookDraftDto?>.CreateSuccess(null, "Guidebook draft permanently discarded");
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            logger.LogError(ex, "Guidebook draft discard unavailable for unit {UnitId}", unitId);
            return Error("Guidebook draft unavailable", 503);
        }
    }
}
