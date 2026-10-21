using System.Data;
using System.Security.Claims;
using brownstone_hub_api.Data;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.ShortStayStripe;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.ShortStay;

public sealed record ShortStayPaymentReceipt(string PaymentIntentId, string? ClientSecret, DateTimeOffset ExpiresAtUtc, string ConnectedAccountId);
public sealed record ShortStayPaymentOutcome(int StatusCode, ShortStayPaymentReceipt? Payment = null, string? Reason = null);

// A PendingPayment reservation owns its claims even if the provider call or DB attach fails.
// The deterministic create key lets a later request recover the same provider intent.
public sealed class ShortStayStartPaymentService(DataContext db, IHttpContextAccessor context, IConfiguration config,
    IShortStayStripeEligibility eligibility, IShortStayDirectChargeGateway gateway, TimeProvider clock)
{
    public async Task<ShortStayPaymentOutcome> Start(string code, CancellationToken ct)
    {
        var http = context.HttpContext;
        if (http?.User.Identity?.IsAuthenticated != true ||
            http.Items.TryGetValue("UserId", out var actor) != true || actor is not long guest || guest <= 0 ||
            !long.TryParse(http.User.FindFirstValue(ClaimTypes.NameIdentifier), out var claim) || claim != guest)
            return new(403, Reason: "authentication_required");
        if (!config.GetValue<bool>("ShortStayBooking:Enabled") || !config.GetValue<bool>("ShortStayBooking:PaymentsEnabled"))
            return new(503, Reason: "feature_disabled");
        if (string.IsNullOrEmpty(code) || code.Length != 32 || code.Any(c => !Uri.IsHexDigit(c)))
            return new(404, Reason: "hold_unavailable");
        var preliminary = await db.ShortStayReservations.AsNoTracking().SingleOrDefaultAsync(r => r.PublicCode == code, ct);
        if (preliminary is null || preliminary.GuestUserId != guest) return new(404, Reason: "hold_unavailable");
        var now = clock.GetUtcNow();
        if (preliminary.HoldExpiresAtUtc <= now || preliminary.Status is not (ShortStayReservationStatus.Held or ShortStayReservationStatus.PendingPayment))
            return new(409, Reason: "hold_no_longer_active");
        bool eligible;
        try { eligible = await eligibility.IsEligibleAsync(preliminary.DestinationStripeAccountId, ct); }
        catch (Exception) when (!ct.IsCancellationRequested) { eligible = false; }
        if (!eligible) return new(503, Reason: "stripe_unavailable");

        // This transaction only reserves the operation. Never hold the unit lock over Stripe I/O.
        db.ChangeTracker.Clear();
        ShortStayReservation r;
        await using (var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct))
        {
            if (db.Database.IsSqlServer())
                await db.Database.SqlQueryRaw<long>(
                    "SELECT Id AS Value FROM [property].[Units] WITH (UPDLOCK, HOLDLOCK) WHERE Id = {0}", preliminary.UnitId)
                    .SingleOrDefaultAsync(ct);
            r = await db.ShortStayReservations.SingleOrDefaultAsync(x => x.PublicCode == code, ct)
                ?? throw new InvalidOperationException("Reservation disappeared during payment start.");
            now = clock.GetUtcNow();
            if (r.GuestUserId != guest) return new(404, Reason: "hold_unavailable");
            if (r.HoldExpiresAtUtc <= now || r.Status is not (ShortStayReservationStatus.Held or ShortStayReservationStatus.PendingPayment))
                return new(409, Reason: "hold_no_longer_active");
            var denial = await CheckReservationAsync(r, guest, ct);
            if (denial is not null) return denial;
            if (r.Status == ShortStayReservationStatus.Held)
            {
                r.BeginPayment(now);
                await db.SaveChangesAsync(ct);
            }
            await tx.CommitAsync(ct);
        }
        return await CompletePaymentAsync(r, guest, ct);
    }

    private async Task<ShortStayPaymentOutcome?> CheckReservationAsync(ShortStayReservation r, long guest, CancellationToken ct)
    {
            if (r.HoldExpiresAtUtc <= clock.GetUtcNow() || r.Status is not (ShortStayReservationStatus.Held or ShortStayReservationStatus.PendingPayment))
                return new(409, Reason: "hold_no_longer_active");
            if (r.TotalCents is < 50 or > 200_000 || r.Currency != "usd" ||
                r.CheckOutDate.DayNumber - r.CheckInDate.DayNumber is < 1 or > 30 ||
                await db.ShortStayOccupancyClaims.CountAsync(c => c.ReservationId == r.Id && c.UnitId == r.UnitId &&
                    c.Date >= r.CheckInDate && c.Date < r.CheckOutDate, ct) != r.CheckOutDate.DayNumber - r.CheckInDate.DayNumber ||
                await db.ShortStayOccupancyClaims.CountAsync(c => c.ReservationId == r.Id, ct) != r.CheckOutDate.DayNumber - r.CheckInDate.DayNumber)
                return new(409, Reason: "hold_unavailable");
            var unit = await db.Units.AsNoTracking().Include(u => u.Property).ThenInclude(p => p.Organization)
                .SingleOrDefaultAsync(u => u.Id == r.UnitId && u.PropertyId == r.PropertyId &&
                    u.RentalMode == ERentalMode.ShortTerm && u.Property.OrganizationId == r.OrganizationId &&
                    (u.OrganizationId == null || u.OrganizationId == r.OrganizationId) && !u.Property.IsDeleted &&
                    u.Property.Organization!.IsActive && !u.Property.Organization.IsDeleted &&
                    db.ShortStayListings.Any(l => l.UnitId == u.Id && l.Status == ShortStayListingStatus.Published), ct);
            if (unit is null) return new(409, Reason: "listing_unavailable");
            if (guest == unit.Property.LandlordId || await db.OrganizationMembers.AnyAsync(m => m.OrganizationId == r.OrganizationId && m.UserId == guest && m.IsActive, ct))
                return new(403, Reason: "self_booking_prohibited");
            if (unit.Property.LandlordId != r.PayeeUserId) return new(503, Reason: "payee_unavailable");
            var account = await db.Users.AsNoTracking().Where(u => u.Id == r.PayeeUserId && !u.IsDeleted && !u.IsSuspended)
                .Select(u => u.StripeAccountId).SingleOrDefaultAsync(ct);
            if (string.IsNullOrWhiteSpace(account) || account != account.Trim() || account != r.DestinationStripeAccountId ||
                !await db.OrganizationMembers.AnyAsync(m => m.OrganizationId == r.OrganizationId && m.UserId == r.PayeeUserId &&
                    m.IsActive && m.CanManageProperties && (m.Role == "Owner" || m.Role == "Manager"), ct))
                return new(503, Reason: "payee_unavailable");
            if (ShortStayCollectionPolicy.Required(config, "RequireApplicationApproval"))
            {
                var policy = ShortStayCollectionPolicy.Available(config);
                if (policy is null) return new(503, Reason: "payee_unavailable");
                var apps = await db.ShortStayCollectionApplications.AsNoTracking()
                    .Where(a => a.OrganizationId == r.OrganizationId && a.ApplicantUserId == r.PayeeUserId &&
                        a.Status != ShortStayCollectionApplicationStatus.Rejected)
                    .Select(a => new { a.Status, a.StripeAccountId, a.FeePolicyConsentVersion, a.AuthorityAttestedAt,
                        a.SubmittedAt, a.ApprovedAt, a.SuspendedAt, a.IdentityVerifiedAt, a.IdentityVerificationSessionId,
                        PropertyIds = a.Properties.Select(p => p.PropertyId).ToArray() }).Take(2).ToListAsync(ct);
                if (apps.Count != 1 || apps[0].Status != ShortStayCollectionApplicationStatus.PayoutApproved ||
                    apps[0].SuspendedAt != null || apps[0].StripeAccountId != account ||
                    apps[0].FeePolicyConsentVersion != policy.Value.Version || apps[0].AuthorityAttestedAt == null ||
                    apps[0].SubmittedAt == null || apps[0].ApprovedAt == null ||
                    (ShortStayCollectionPolicy.Required(config, "RequireIdentityForApplicationApproval") &&
                        (apps[0].IdentityVerifiedAt == null || string.IsNullOrWhiteSpace(apps[0].IdentityVerificationSessionId))) ||
                    apps[0].PropertyIds.Length is < 1 or > 50 ||
                    apps[0].PropertyIds.Distinct().Count() != apps[0].PropertyIds.Length ||
                    !apps[0].PropertyIds.Contains(r.PropertyId)) return new(503, Reason: "payee_unavailable");
            }
            return null;
    }

    private async Task<ShortStayPaymentOutcome> CompletePaymentAsync(ShortStayReservation r, long guest, CancellationToken ct)
    {
        ShortStayIntent intent;
        try
        {
            intent = r.StripePaymentIntentId is not null
                ? await gateway.RetrieveForGuestPaymentAsync(r.DestinationStripeAccountId, r.StripePaymentIntentId,
                    r.TotalCents, r.Currency, r.PublicCode, ct)
                : await gateway.CreatePaymentIntentAsync(r.DestinationStripeAccountId, r.TotalCents, r.Currency,
                    r.PublicCode, $"shortstay:{r.OperationId}:create", ct);
        }
        catch (Exception) when (!ct.IsCancellationRequested) { return new(503, Reason: "stripe_unavailable"); }
        if (!Matches(r, intent) || intent.Status != "requires_payment_method" || string.IsNullOrWhiteSpace(intent.ClientSecret) ||
            r.StripePaymentIntentId is not null && intent.PaymentIntentId != r.StripePaymentIntentId)
            return new(503, Reason: "stripe_unavailable");

        db.ChangeTracker.Clear();
        ShortStayPaymentOutcome? denial = null;
        try
        {
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            if (db.Database.IsSqlServer())
                await db.Database.SqlQueryRaw<long>(
                    "SELECT Id AS Value FROM [property].[Units] WITH (UPDLOCK, HOLDLOCK) WHERE Id = {0}", r.UnitId)
                    .SingleOrDefaultAsync(ct);
            var current = await db.ShortStayReservations.SingleAsync(x => x.Id == r.Id, ct);
            if (!config.GetValue<bool>("ShortStayBooking:Enabled") || !config.GetValue<bool>("ShortStayBooking:PaymentsEnabled"))
                denial = new(503, Reason: "feature_disabled");
            var http = context.HttpContext;
            if (http?.User.Identity?.IsAuthenticated != true || http.Items.TryGetValue("UserId", out var actor) != true ||
                actor is not long id || id != guest || !long.TryParse(http.User.FindFirstValue(ClaimTypes.NameIdentifier), out var claim) || claim != guest)
                denial = new(403, Reason: "authentication_required");
            if (current.GuestUserId != guest || current.OperationId != r.OperationId ||
                current.DestinationStripeAccountId != r.DestinationStripeAccountId || current.TotalCents != r.TotalCents ||
                current.PublicCode != r.PublicCode || current.StripePaymentIntentId is not null && current.StripePaymentIntentId != intent.PaymentIntentId)
                denial = new(409, Reason: "payment_unavailable");
            else
            {
                denial ??= await CheckReservationAsync(current, guest, ct);
                bool ready;
                try { ready = await eligibility.IsEligibleAsync(current.DestinationStripeAccountId, ct); }
                catch (Exception) when (!ct.IsCancellationRequested) { ready = false; }
                if (!ready) denial = new(503, Reason: "stripe_unavailable");
                if (denial is null && current.StripePaymentIntentId is null)
                {
                    current.AttachPaymentIntent(intent.PaymentIntentId, clock.GetUtcNow());
                    await db.SaveChangesAsync(ct);
                }
            }
            if (denial is null)
            {
                await tx.CommitAsync(ct);
                return new(200, new(intent.PaymentIntentId, intent.ClientSecret, current.HoldExpiresAtUtc, current.DestinationStripeAccountId));
            }
        }
        catch (Exception) when (!ct.IsCancellationRequested)
        {
            db.ChangeTracker.Clear();
            return new(503, Reason: "payment_unavailable"); // Ambiguous attach: retry uses same idempotency key.
        }
        // Do not release claims on failed or ambiguous cancellation; reconciliation owns terminal cleanup.
        try { await gateway.CancelAsync(r.DestinationStripeAccountId, intent.PaymentIntentId,
            $"shortstay:{r.OperationId}:cancel", ct); }
        catch (Exception) when (!ct.IsCancellationRequested) { /* retain claims and fail closed */ }
        return denial!;
    }

    private static bool Matches(ShortStayReservation r, ShortStayIntent i) =>
        !string.IsNullOrWhiteSpace(i.PaymentIntentId) && i.AccountId == r.DestinationStripeAccountId &&
        i.AmountCents == r.TotalCents && i.Currency == r.Currency && i.ReservationCode == r.PublicCode;
}
