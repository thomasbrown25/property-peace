using brownstone_hub_api.Data;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.ShortStay;

// Server-internal advisory snapshot only. This is NOT authorization to book, charge, or pay out.
// Never return provider identifiers, identity evidence, or account details.
public sealed record ShortStayCollectionReadiness(bool IsReady, bool CollectionEligible,
    bool BookingEnabled, bool PaymentsEnabled, string[] ReasonCodes);

public sealed class ShortStayCollectionReadinessService(DataContext db, IConfiguration configuration,
    ILogger<ShortStayCollectionReadinessService> logger)
{
    private static ShortStayCollectionReadiness NotReady(string reason) => new(false, false, false, false, [reason]);

    public async Task<ShortStayCollectionReadiness> Check(long unitId, long payeeUserId,
        long organizationId, CancellationToken ct = default)
    {
        if (unitId <= 0 || payeeUserId <= 0 || organizationId <= 0)
            return NotReady("scope_unavailable");
        try
        {
            // No authoritative pre-Connect PP identity binding exists yet. Never interpret an
            // old application identity session as evidence that pre-Connect identity was met.
            if (ShortStayCollectionPolicy.Required(configuration, "RequireIdentityBeforeConnect"))
                return NotReady("identity_unavailable");
            var requireApplication = ShortStayCollectionPolicy.Required(configuration, "RequireApplicationApproval");
            var requireApplicationIdentity = ShortStayCollectionPolicy.Required(configuration, "RequireIdentityForApplicationApproval");
            var policy = requireApplication ? ShortStayCollectionPolicy.Available(configuration) : null;
            if (requireApplication && policy is null) return NotReady("policy_unavailable");

            // Check the requested unit's *own* property, not any eligible unit elsewhere in the portfolio.
            var propertyId = await db.Units.AsNoTracking()
                .Where(u => u.Id == unitId && u.RentalMode == ERentalMode.ShortTerm &&
                    (u.OrganizationId == null || u.OrganizationId == organizationId) &&
                    u.Property.OrganizationId == organizationId && !u.Property.IsDeleted &&
                    u.Property.Organization!.IsActive && !u.Property.Organization.IsDeleted)
                .Select(u => (long?)u.PropertyId).SingleOrDefaultAsync(ct);
            if (propertyId is null) return NotReady("scope_unavailable");

            var account = await db.Users.AsNoTracking()
                .Where(u => u.Id == payeeUserId && !u.IsDeleted && !u.IsSuspended)
                .Select(u => u.StripeAccountId).SingleOrDefaultAsync(ct);
            if (string.IsNullOrWhiteSpace(account) || account != account.Trim() ||
                !await db.OrganizationMembers.AsNoTracking().AnyAsync(m => m.OrganizationId == organizationId &&
                    m.UserId == payeeUserId && m.IsActive && m.CanManageProperties &&
                    (m.Role == "Owner" || m.Role == "Manager") && m.Organization.IsActive && !m.Organization.IsDeleted, ct))
                return NotReady("payee_unavailable");

            if (requireApplication)
            {
                // Immutable submitted child scope is the authority; approval of a sibling is insufficient.
                var applications = await db.ShortStayCollectionApplications.AsNoTracking()
                .Where(a => a.OrganizationId == organizationId && a.ApplicantUserId == payeeUserId &&
                    a.Status != ShortStayCollectionApplicationStatus.Rejected)
                .Select(a => new { a.Status, a.StripeAccountId, a.FeePolicyConsentVersion,
                    a.AuthorityAttestedAt, a.SubmittedAt, a.ApprovedAt, a.IdentityVerifiedAt,
                    a.IdentityVerificationSessionId, a.SuspendedAt,
                    PropertyIds = a.Properties.Select(p => p.PropertyId).ToArray() })
                .Take(2).ToListAsync(ct);
                if (applications.Count != 1) return NotReady("application_unavailable");
                var app = applications[0];
                if (app.Status != ShortStayCollectionApplicationStatus.PayoutApproved || app.SuspendedAt is not null ||
                    app.StripeAccountId != account || app.FeePolicyConsentVersion != policy!.Value.Version ||
                    app.AuthorityAttestedAt is null || app.SubmittedAt is null || app.ApprovedAt is null ||
                    (requireApplicationIdentity && (app.IdentityVerifiedAt is null || string.IsNullOrWhiteSpace(app.IdentityVerificationSessionId))) ||
                    app.PropertyIds.Length is < 1 or > 50 || app.PropertyIds.Distinct().Count() != app.PropertyIds.Length ||
                    !app.PropertyIds.Contains(propertyId.Value))
                    return NotReady("application_unavailable");
            }

            // A recent persisted snapshot is only advisory, not a live Stripe eligibility check.
            // Checkout and payout must re-fetch Stripe capabilities at their own authorization boundaries.
            var reviews = await db.StripeConnectedPayeeReviews.AsNoTracking()
                .Where(r => r.StripeAccountId == account || r.UserId == payeeUserId).Take(2).ToListAsync(ct);
            if (reviews.Count != 1) return NotReady("payee_unavailable");
            var review = reviews[0];
            var now = DateTimeOffset.UtcNow;
            if (review.UserId != payeeUserId || review.StripeAccountId != account ||
                (review.ApprovedOrganizationId is not null && review.ApprovedOrganizationId != organizationId) ||
                review.Status == StripePayeeReviewStatus.Suspended || review.SuspendedAt is not null ||
                (requireApplication && (review.ApprovedOrganizationId != organizationId ||
                    review.Status != StripePayeeReviewStatus.PayoutApproved || review.ApprovedAt is null)) ||
                review.LastStripeSnapshotAt is not { } snapshot || snapshot < now.AddMinutes(-5) || snapshot > now.AddMinutes(1) ||
                !review.StripeDetailsSubmitted || !review.StripePayoutsEnabled || !review.StripeTransfersActive ||
                !string.Equals(review.StripeTransferCapabilityStatus, "active", StringComparison.OrdinalIgnoreCase) ||
                review.CurrentlyDueRequirementCount != 0 || review.PastDueRequirementCount != 0 ||
                !string.IsNullOrWhiteSpace(review.StripeDisabledReason) || string.IsNullOrWhiteSpace(review.ExternalAccountFingerprint) ||
                !string.Equals(review.PayoutSchedulePolicy, "manual", StringComparison.OrdinalIgnoreCase) || review.InstantPayoutsAllowed)
                return NotReady("payee_unavailable");

            if (ShortStayCollectionPolicy.Required(configuration, "RequireIdentityBeforeConnect") ||
                ShortStayCollectionPolicy.Required(configuration, "RequireApplicationApproval") != requireApplication ||
                ShortStayCollectionPolicy.Required(configuration, "RequireIdentityForApplicationApproval") != requireApplicationIdentity ||
                requireApplication && ShortStayCollectionPolicy.Available(configuration) != policy)
                return NotReady("policy_unavailable");

            // No short-stay checkout or published booking surface exists. Even explicit config values
            // cannot turn this advisory eligibility result into a booking/payment authorization.
            return new(false, true, false, false, ["booking_unavailable", "payments_unavailable"]);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            logger.LogWarning("Short-stay collection readiness unavailable: {Type}", ex.GetType().Name);
            return NotReady("unavailable");
        }
    }
}
