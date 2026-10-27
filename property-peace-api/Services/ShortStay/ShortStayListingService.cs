using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Security.Claims;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.ShortStay;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.ShortStay;

public sealed class ShortStayListingService(DataContext db, IHttpContextAccessor context, ILogger<ShortStayListingService> logger)
{
    private static ServiceResponse<ShortStayListingDraftDto?> Error(string message, int status) =>
        ServiceResponse<ShortStayListingDraftDto?>.CreateError(message, statusCode: status, suppressDetailedErrors: true);

    private (long Org, long User)? Scope()
    {
        var http = context.HttpContext;
        if (http?.Items.TryGetValue("OrganizationId", out var org) != true || org is not long organizationId || organizationId <= 0 ||
            http.Items.TryGetValue("UserId", out var user) != true || user is not long userId || userId <= 0 ||
            !long.TryParse(http.User.FindFirstValue(ClaimTypes.NameIdentifier), out var subject) || subject != userId)
            return null;
        return (organizationId, userId);
    }

    private Task<bool> CanManage((long Org, long User) scope, CancellationToken ct) =>
        db.OrganizationMembers.AsNoTracking().AnyAsync(m =>
            m.OrganizationId == scope.Org && m.UserId == scope.User && m.IsActive &&
            m.Organization.IsActive && !m.Organization.IsDeleted &&
            (m.Role == "Owner" || m.Role == "Manager" && m.CanManageProperties), ct);

    private Task<Unit?> AuthorizedUnit(long unitId, long org, CancellationToken ct) =>
        db.Units.AsNoTracking().Include(u => u.Property).FirstOrDefaultAsync(u => u.Id == unitId &&
            u.Property.OrganizationId == org && !u.Property.IsDeleted &&
            (u.OrganizationId == null || u.OrganizationId == org), ct);

    private static ShortStayListingDraftDto Map(ShortStayListing listing, string zone) => new()
    {
        UnitId = listing.UnitId, TimeZoneId = zone, NightlyBasePrice = listing.NightlyBasePrice,
        WeekendNightlyRate = listing.WeekendNightlyRate, WeeklyDiscountPercent = listing.WeeklyDiscountPercent,
        MonthlyDiscountPercent = listing.MonthlyDiscountPercent,
        MinimumNights = listing.MinimumNights, Capacity = listing.Capacity, CleaningFee = listing.CleaningFee,
        LodgingTaxRatePercent = listing.LodgingTaxRatePercent,
        TaxPolicyAttestedAtUtc = listing.TaxPolicyAttestedAtUtc,
        TaxPolicyAttestedByUserId = listing.TaxPolicyAttestedByUserId,
        CheckInTime = listing.CheckInTime, CheckOutTime = listing.CheckOutTime,
        HouseRules = listing.HouseRules, Amenities = listing.Amenities, CancellationPolicy = listing.CancellationPolicy,
        PublicTitle = listing.PublicTitle, PublicSummary = listing.PublicSummary
    };

    public async Task<ServiceResponse<ShortStayListingDraftDto?>> Get(long unitId, CancellationToken ct = default)
    {
        if (Scope() is not { } scope) return Error("Forbidden", 403);
        if (unitId <= 0) return Error("Invalid unit", 400);
        try
        {
            if (!await CanManage(scope, ct)) return Error("Forbidden", 403);
            var unit = await AuthorizedUnit(unitId, scope.Org, ct);
            if (unit is null) return Error("Unit not found", 404);
            if (unit.RentalMode != ERentalMode.ShortTerm) return Error("Unit is not short-term", 409);
            if (!IanaTimeZoneAttribute.IsValidZone(unit.Property.TimeZoneId)) return Error("Property requires a valid IANA time zone", 409);
            var listing = await db.ShortStayListings.AsNoTracking().SingleOrDefaultAsync(l => l.UnitId == unitId, ct);
            if (listing is { Status: not ShortStayListingStatus.Draft }) return Error("Listing is not a draft", 409);
            return ServiceResponse<ShortStayListingDraftDto?>.CreateSuccess(
                listing is null ? null : Map(listing, unit.Property.TimeZoneId!));
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            logger.LogError(ex, "Short-stay listing read unavailable for unit {UnitId}", unitId);
            return Error("Short-stay listing unavailable", 503);
        }
    }

    public async Task<ServiceResponse<ShortStayListingDraftDto?>> Put(long unitId, SaveShortStayListingDto? request, CancellationToken ct = default)
    {
        if (Scope() is not { } scope) return Error("Forbidden", 403);
        if (unitId <= 0 || request is null) return Error("Invalid listing draft", 400);
        if (!CentPrecisionAttribute.IsValidPrice(request.NightlyBasePrice))
            return Error("NightlyBasePrice must have no more than two decimal places", 400);
        if (!CentPrecisionAttribute.IsValidPrice(request.CleaningFee) ||
            request.WeekendNightlyRate is { } weekend && !CentPrecisionAttribute.IsValidPrice(weekend) ||
            request.WeeklyDiscountPercent is { } weekly && decimal.Round(weekly, 2) != weekly ||
            request.MonthlyDiscountPercent is { } monthly && decimal.Round(monthly, 2) != monthly)
            return Error("Pricing must have no more than two decimal places for cents and discount percentages", 400);
        if (!Validator.TryValidateObject(request, new ValidationContext(request), new List<ValidationResult>(), true))
            return Error("Invalid listing draft", 400);
        if (request.LodgingTaxRatePercent is { } taxRate && decimal.Round(taxRate, 4) != taxRate)
            return Error("LodgingTaxRatePercent must have no more than four decimal places", 400);
        if (request.LodgingTaxRatePercent.HasValue != request.AttestLodgingTaxResponsibility)
            return Error("Tax rate and owner responsibility affirmation must be provided together", 400);
        try
        {
            if (!await CanManage(scope, ct)) return Error("Forbidden", 403);
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            // The rental-mode writer locks this same row before reading mode. Serialize both
            // decisions to prevent a listing write against a stale short-term mode.
            if (db.Database.IsSqlServer())
                await db.Database.SqlQueryRaw<long>(
                    "SELECT Id AS Value FROM [property].[Units] WITH (UPDLOCK, HOLDLOCK) WHERE Id = {0}", unitId)
                    .SingleOrDefaultAsync(ct);
            var unit = await AuthorizedUnit(unitId, scope.Org, ct);
            if (unit is null) return Error("Unit not found", 404);
            if (unit.RentalMode != ERentalMode.ShortTerm) return Error("Unit is not short-term", 409);
            if (!IanaTimeZoneAttribute.IsValidZone(unit.Property.TimeZoneId)) return Error("Property requires a valid IANA time zone", 409);
            var listing = await db.ShortStayListings.SingleOrDefaultAsync(l => l.UnitId == unitId, ct);
            var created = listing is null;
            if (created)
            {
                listing = new ShortStayListing { UnitId = unitId, Status = ShortStayListingStatus.Draft };
                db.ShortStayListings.Add(listing);
            }
            // This endpoint only edits draft data; it cannot publish or change ownership.
            if (listing!.Status != ShortStayListingStatus.Draft) return Error("Published listing cannot be edited as a draft", 409);
            listing.NightlyBasePrice = request.NightlyBasePrice;
            // Pricing additions are optional on legacy PUT payloads. Only supplied values mutate
            // an existing draft; a supplied JSON null explicitly clears the weekend rate.
            if (request.HasWeekendNightlyRate) listing.WeekendNightlyRate = request.WeekendNightlyRate;
            if (request.WeeklyDiscountPercent is { } weeklyDiscount) listing.WeeklyDiscountPercent = weeklyDiscount;
            if (request.MonthlyDiscountPercent is { } monthlyDiscount) listing.MonthlyDiscountPercent = monthlyDiscount;
            listing.MinimumNights = request.MinimumNights;
            listing.Capacity = request.Capacity;
            listing.CleaningFee = request.CleaningFee;
            // An acknowledgement only attests a newly configured or changed rate. Replaying
            // the saved rate on an unrelated draft edit must not rewrite historical evidence.
            if (listing.LodgingTaxRatePercent != request.LodgingTaxRatePercent)
            {
                listing.LodgingTaxRatePercent = request.LodgingTaxRatePercent;
                listing.TaxPolicyAttestedAtUtc = request.AttestLodgingTaxResponsibility ? DateTime.UtcNow : null;
                listing.TaxPolicyAttestedByUserId = request.AttestLodgingTaxResponsibility ? scope.User : null;
            }
            listing.CheckInTime = request.CheckInTime;
            listing.CheckOutTime = request.CheckOutTime;
            listing.HouseRules = request.HouseRules;
            listing.Amenities = request.Amenities;
            listing.CancellationPolicy = request.CancellationPolicy;
            // Older clients omit these nullable fields. Preserve the owner's curated copy
            // when editing pricing, calendar or tax details through an older client.
            if (request.PublicTitle is not null) listing.PublicTitle = ShortStayPublicCopy.PlainText(request.PublicTitle);
            if (request.PublicSummary is not null) listing.PublicSummary = ShortStayPublicCopy.PlainText(request.PublicSummary);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return ServiceResponse<ShortStayListingDraftDto?>.CreateSuccess(Map(listing, unit.Property.TimeZoneId!),
                created ? "Draft created" : "Draft updated", created ? 201 : 200);
        }
        catch (OperationCanceledException) { throw; }
        catch (DbUpdateException ex) when (ex.InnerException is Microsoft.Data.SqlClient.SqlException sql &&
            (sql.Number == 2601 || sql.Number == 2627))
        {
            return Error("Listing already exists for unit", 409);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Short-stay listing write unavailable for unit {UnitId}", unitId);
            return Error("Short-stay listing unavailable", 503);
        }
    }
}
