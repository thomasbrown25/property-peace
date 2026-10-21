using System.Data;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using brownstone_hub_api.Data;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Stripe;

namespace brownstone_hub_api.Services.ShortStay;

public sealed record ShortStayHoldRequest(DateOnly CheckIn, DateOnly CheckOut, int Guests, string IdempotencyKey)
{
    [System.Text.Json.Serialization.JsonExtensionData]
    public Dictionary<string, System.Text.Json.JsonElement>? UnexpectedFields { get; init; }
}
public sealed record ShortStayHoldReceipt(string Code, DateOnly CheckIn, DateOnly CheckOut, int Guests,
    long TotalCents, long NightlySubtotalCents, long CleaningFeeCents, long TaxCents, DateTimeOffset ExpiresAtUtc,
    string AvailabilityWarning = "An imported calendar is not a real-time cross-channel lock; Airbnb double bookings remain possible.",
    long DiscountCents = 0, long GrossNightlySubtotalCents = 0);
public sealed record ShortStayHoldOutcome(int StatusCode, ShortStayHoldReceipt? Hold = null, string? Reason = null);

public interface IShortStayStripeEligibility
{
    Task<bool> IsEligibleAsync(string stripeAccountId, CancellationToken ct);
}

// Separate from rent approval: direct charges belong to the landlord's own connected account.
public sealed class ShortStayStripeEligibility(IConfiguration config, IStripeClient? client = null) : IShortStayStripeEligibility
{
    public async Task<bool> IsEligibleAsync(string stripeAccountId, CancellationToken ct)
    {
        var key = config["Stripe:SecretKey"];
        if (string.IsNullOrWhiteSpace(key)) return false;
        try
        {
            var accounts = new Stripe.AccountService(client ?? new StripeClient(key));
            var account = await accounts.GetAsync(stripeAccountId, null, null, ct);
            if (account.Id != stripeAccountId || account.DetailsSubmitted != true ||
                account.ChargesEnabled != true || account.PayoutsEnabled != true || account.Requirements is null ||
                account.Requirements.CurrentlyDue is null || account.Requirements.PastDue is null ||
                account.Requirements.CurrentlyDue.Count > 0 || account.Requirements.PastDue.Count > 0 ||
                !string.IsNullOrWhiteSpace(account.Requirements.DisabledReason)) return false;
            var capability = await accounts.Capabilities.GetAsync(stripeAccountId, "card_payments", null, null, ct);
            return capability.Status == "active";
        }
        catch (Exception ex) when (ex is StripeException or HttpRequestException or InvalidOperationException) { return false; }
    }
}

public sealed class ShortStayHoldService(DataContext db, IHttpContextAccessor context, IConfiguration config,
    IShortStayStripeEligibility stripe, TimeProvider clock)
{
    private static ShortStayHoldReceipt Receipt(ShortStayReservation r) => new(r.PublicCode, r.CheckInDate, r.CheckOutDate,
        r.GuestCount, r.TotalCents, r.NightlySubtotalCents, r.CleaningFeeCents, r.TaxCents, r.HoldExpiresAtUtc,
        DiscountCents: r.DiscountCents, GrossNightlySubtotalCents: checked(r.NightlySubtotalCents + r.DiscountCents));

    public async Task<ShortStayHoldOutcome> Create(long unitId, ShortStayHoldRequest request, CancellationToken ct)
    {
        var http = context.HttpContext;
        if (http?.User.Identity?.IsAuthenticated != true ||
            http.Items.TryGetValue("UserId", out var actor) != true || actor is not long userId || userId <= 0 ||
            !long.TryParse(http.User.FindFirstValue(ClaimTypes.NameIdentifier), out var subject) || subject != userId)
            return new(403, Reason: "authentication_required");
        if (!config.GetValue<bool>("ShortStayBooking:Enabled")) return new(503, Reason: "feature_disabled");
        if (unitId <= 0 || request.Guests < 1 || request.CheckOut.DayNumber - request.CheckIn.DayNumber is < 1 or > 30 ||
            string.IsNullOrWhiteSpace(request.IdempotencyKey) || request.IdempotencyKey.Length > 128 ||
            request.IdempotencyKey.Any(c => c < 33 || c > 126)) return new(400, Reason: "invalid_request");
        var now = clock.GetUtcNow();
        var material = $"{userId}:{unitId}:{request.IdempotencyKey.Length}:{request.IdempotencyKey}";
        var operation = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(material)))[..32];
        try
        {
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            if (db.Database.IsSqlServer())
                await db.Database.SqlQueryRaw<long>(
                    "SELECT Id AS Value FROM [property].[Units] WITH (UPDLOCK, HOLDLOCK) WHERE Id = {0}", unitId)
                    .SingleOrDefaultAsync(ct);
            // Resolve the public resource before consulting a previous operation: neither a selected
            // organization nor an old receipt grants access to an unpublished listing.
            var unit = await db.Units.AsNoTracking().Include(u => u.Property).ThenInclude(p => p.Organization)
                .SingleOrDefaultAsync(u => u.Id == unitId && u.Property.OrganizationId != null &&
                    (u.OrganizationId == null || u.OrganizationId == u.Property.OrganizationId) &&
                    !u.Property.IsDeleted && u.Property.Organization!.IsActive && !u.Property.Organization.IsDeleted &&
                    u.RentalMode == ERentalMode.ShortTerm &&
                    db.ShortStayListings.Any(l => l.UnitId == u.Id && l.Status == ShortStayListingStatus.Published), ct);
            if (unit is null) return new(404, Reason: "unit_unavailable");
            var property = unit.Property;
            var orgId = property.OrganizationId!.Value;
            if (userId == property.LandlordId || await db.OrganizationMembers.AnyAsync(m => m.OrganizationId == orgId && m.UserId == userId && m.IsActive, ct))
                return new(403, Reason: "self_booking_prohibited");
            var previous = await db.ShortStayReservations.AsNoTracking().SingleOrDefaultAsync(r => r.OperationId == operation, ct);
            if (previous != null)
            {
                if (previous.OrganizationId != orgId) return new(404, Reason: "unit_unavailable");
                if (previous.GuestUserId != userId || previous.UnitId != unitId || previous.CheckInDate != request.CheckIn ||
                    previous.CheckOutDate != request.CheckOut || previous.GuestCount != request.Guests)
                    return new(409, Reason: "idempotency_mismatch");
                if (previous.Status != ShortStayReservationStatus.Held || previous.HoldExpiresAtUtc <= now)
                    return new(409, Reason: "hold_no_longer_active");
                return new(200, Receipt(previous));
            }
            if (!IanaTimeZoneAttribute.IsValidZone(property.TimeZoneId))
                return new(409, Reason: "listing_unavailable");
            var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(now,
                TimeZoneInfo.FindSystemTimeZoneById(property.TimeZoneId!)).DateTime);
            if (request.CheckIn <= today) return new(400, Reason: "dates_must_be_future_local_nights");
            var payeeId = property.LandlordId;
            var accountId = await db.Users.AsNoTracking().Where(u => u.Id == payeeId && !u.IsDeleted && !u.IsSuspended)
                .Select(u => u.StripeAccountId).SingleOrDefaultAsync(ct);
            if (payeeId <= 0 || string.IsNullOrWhiteSpace(accountId) || accountId != accountId.Trim() ||
                !await db.OrganizationMembers.AnyAsync(m => m.OrganizationId == orgId && m.UserId == payeeId && m.IsActive &&
                    m.CanManageProperties && (m.Role == "Owner" || m.Role == "Manager"), ct))
                return new(503, Reason: "payee_unavailable");
            if (ShortStayCollectionPolicy.Required(config, "RequireApplicationApproval"))
            {
                var policy = ShortStayCollectionPolicy.Available(config);
                if (policy is null) return new(503, Reason: "payee_unavailable");
                var apps = await db.ShortStayCollectionApplications.AsNoTracking()
                    .Where(a => a.OrganizationId == orgId && a.ApplicantUserId == payeeId &&
                        a.Status != ShortStayCollectionApplicationStatus.Rejected)
                    .Select(a => new { a.Status, a.StripeAccountId, a.FeePolicyConsentVersion, a.AuthorityAttestedAt,
                        a.SubmittedAt, a.ApprovedAt, a.SuspendedAt, a.IdentityVerifiedAt, a.IdentityVerificationSessionId,
                        PropertyIds = a.Properties.Select(p => p.PropertyId).ToArray() })
                    .Take(2).ToListAsync(ct);
                if (apps.Count != 1 || apps[0].Status != ShortStayCollectionApplicationStatus.PayoutApproved ||
                    apps[0].SuspendedAt is not null || apps[0].StripeAccountId != accountId ||
                    apps[0].FeePolicyConsentVersion != policy.Value.Version || apps[0].AuthorityAttestedAt is null ||
                    apps[0].SubmittedAt is null || apps[0].ApprovedAt is null ||
                    ShortStayCollectionPolicy.Required(config, "RequireIdentityForApplicationApproval") &&
                    (apps[0].IdentityVerifiedAt is null || string.IsNullOrWhiteSpace(apps[0].IdentityVerificationSessionId)) ||
                    apps[0].PropertyIds.Length is < 1 or > 50 ||
                    apps[0].PropertyIds.Distinct().Count() != apps[0].PropertyIds.Length ||
                    !apps[0].PropertyIds.Contains(property.Id)) return new(503, Reason: "payee_unavailable");
            }
            var listing = await db.ShortStayListings.AsNoTracking().SingleOrDefaultAsync(l => l.UnitId == unitId, ct);
            var rates = await db.ShortStayNightlyRateOverrides.AsNoTracking().Where(r => r.UnitId == unitId && r.Date >= request.CheckIn && r.Date < request.CheckOut)
                .ToDictionaryAsync(r => r.Date, r => r.NightlyRate, ct);
            var occupied = await db.ShortStayBlocks.AsNoTracking().Where(b => b.UnitId == unitId && b.StartDate < request.CheckOut && b.EndDate > request.CheckIn)
                .Select(b => new ShortStayOccupiedRange(b.StartDate, b.EndDate, "OwnerBlock")).ToListAsync(ct);
            var subscriptions = await db.ShortStayIcalSubscriptions.AsNoTracking().Where(s => s.UnitId == unitId && s.OrgId == orgId && s.Enabled)
                .Select(s => new { s.LastSuccessAtUtc, s.ConsecutiveFailures, s.FailureCode, s.LastAttemptAtUtc }).ToListAsync(ct);
            occupied.AddRange(await db.ShortStayIcalOccurrences.AsNoTracking().Where(o => o.Subscription.UnitId == unitId && o.Subscription.OrgId == orgId && o.Subscription.Enabled &&
                o.StartDate < request.CheckOut && o.EndDate > request.CheckIn).Select(o => new ShortStayOccupiedRange(o.StartDate, o.EndDate, "Airbnb")).ToListAsync(ct));
            var utc = now.UtcDateTime;
            var fresh = subscriptions.Count > 0 && subscriptions.All(s => s.LastSuccessAtUtc.HasValue && s.LastSuccessAtUtc <= utc &&
                s.LastSuccessAtUtc >= utc.AddHours(-24) && s.ConsecutiveFailures == 0 && s.FailureCode == null &&
                (s.LastAttemptAtUtc == null || s.LastAttemptAtUtc <= s.LastSuccessAtUtc));
            var quote = ShortStayQuoteCalculator.Calculate(new(request.CheckIn, request.CheckOut, request.Guests),
                new ShortStayQuoteFacts(unitId, property.TimeZoneId!, true, listing?.Status == ShortStayListingStatus.Published,
                    listing?.NightlyBasePrice ?? 0, listing?.CleaningFee ?? 0, listing?.MinimumNights ?? 1, listing?.Capacity ?? 0,
                    rates, occupied, fresh, true, true, listing is not null, HasCalendarFeed: subscriptions.Count > 0,
                    LodgingTaxRatePercent: listing?.LodgingTaxRatePercent, TaxPolicyAttestedAtUtc: listing?.TaxPolicyAttestedAtUtc,
                    TaxPolicyAttestedByUserId: listing?.TaxPolicyAttestedByUserId, QuoteAsOfUtc: utc,
                    WeekendNightlyRate: listing?.WeekendNightlyRate,
                    WeeklyDiscountPercent: listing?.WeeklyDiscountPercent ?? 0m,
                    MonthlyDiscountPercent: listing?.MonthlyDiscountPercent ?? 0m));
            if (quote.Status != "preflight_available" || !quote.EstimatedTotalCents.HasValue)
                return new(409, Reason: quote.Reason);
            // Product ceiling is $2,000, deliberately lower than Stripe's technical limit.
            if (quote.EstimatedTotalCents.Value > 200_000) return new(400, Reason: "amount_limit");
            var claims = await db.ShortStayOccupancyClaims.Include(c => c.Reservation).Where(c => c.UnitId == unitId &&
                c.Date >= request.CheckIn && c.Date < request.CheckOut).ToListAsync(ct);
            if (claims.Any(c => c.Reservation.Status != ShortStayReservationStatus.Held || c.Reservation.HoldExpiresAtUtc > now))
                return new(409, Reason: "nights_claimed_or_payment_unresolved");
            bool eligible;
            try { eligible = await stripe.IsEligibleAsync(accountId, ct); }
            catch (Exception) when (!ct.IsCancellationRequested) { eligible = false; }
            if (!eligible) return new(503, Reason: "stripe_unavailable");
            foreach (var expired in claims.Select(c => c.Reservation).Distinct())
            {
                expired.ExpireHold(now);
                db.ShortStayOccupancyClaims.RemoveRange(await db.ShortStayOccupancyClaims.Where(c => c.ReservationId == expired.Id).ToListAsync(ct));
            }
            var reservation = ShortStayReservation.CreateHold(unitId, property.Id, orgId, userId, payeeId,
                accountId, request.CheckIn, request.CheckOut, request.Guests,
                quote.Nights.Select(n => n.AmountCents).ToArray(), now.AddMinutes(10), now,
                quote.CleaningFeeCents!.Value, quote.TaxCents!.Value, operation,
                discountCents: quote.DiscountCents ?? 0);
            db.ShortStayReservations.Add(reservation);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return new(201, Receipt(reservation));
        }
        catch (DbUpdateException) { db.ChangeTracker.Clear(); return new(409, Reason: "concurrent_claim"); }
    }
}
