using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace brownstone_hub_api.Services.StripeRentPayments
{
    public interface IStripeConnectedPayeeService
    {
        Task<StripeConnectedPayeeReview> RegisterAsync(long? userId, string stripeAccountId, bool detailsSubmitted, CancellationToken cancellationToken = default);
        Task<IReadOnlyList<StripeConnectedPayeeReview>> ListAsync(StripePayeeReviewStatus? status, CancellationToken cancellationToken = default);
        Task<StripeConnectedPayeeReview> BeginReviewAsync(string stripeAccountId, CancellationToken cancellationToken = default);
        Task<StripeConnectedPayeeReview> ApproveAsync(string stripeAccountId, long adminUserId, long organizationId, string evidence, string notes, bool propertyAuthorityAttested, CancellationToken cancellationToken = default);
        Task<StripeConnectedPayeeReview> SuspendAsync(string stripeAccountId, long? adminUserId, string reason, CancellationToken cancellationToken = default);
        Task<StripeConnectedPayeeReview?> SyncStripeSnapshotAsync(StripeConnectedAccountSnapshot snapshot, string? eventId, CancellationToken cancellationToken = default);
        Task<bool> IsApprovedDestinationAsync(long userId, long organizationId, string stripeAccountId, CancellationToken cancellationToken = default);
    }

    public sealed class StripeConnectedPayeeService(DataContext context, TimeProvider timeProvider) : IStripeConnectedPayeeService
    {
        private const string PiiError = "Approval evidence and notes must not contain raw identity data. Store raw identity data only in Stripe Dashboard and enter a case/reference ID or operational summary here.";

        private static readonly Regex[] ProhibitedApprovalContentPatterns =
        [
            // U.S. SSNs and EINs/tax IDs.
            new(@"(?<!\d)\d{3}[ -]\d{2}[ -]\d{4}(?!\d)", RegexOptions.Compiled | RegexOptions.CultureInvariant),
            new(@"(?<!\d)\d{2}-\d{7}(?!\d)", RegexOptions.Compiled | RegexOptions.CultureInvariant),
            new(@"\b(?:ssn|social\s+security(?:\s+number)?|ein|tax(?:payer)?(?:\s+identification)?\s*(?:id|number))\b\s*(?:no\.?|number|#)?\s*[:=#-]?\s*(?=[A-Z0-9-]{6,}\b)(?=[A-Z0-9-]*\d)[A-Z0-9-]{6,}", RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant),

            // Full card/bank numbers, including commonly pasted separators.
            new(@"(?<!\d)(?:\d[ -]?){12,19}(?!\d)", RegexOptions.Compiled | RegexOptions.CultureInvariant),
            new(@"\b(?:routing|bank\s+account|credit\s+card|debit\s+card|card)\s*(?:number|no\.?|#)?\s*[:=#-]?\s*(?:\d[ -]?){6,19}(?!\d)", RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant),

            // Dates are allowed in operational notes, but labeled birth dates are not.
            new(@"\b(?:dob|date\s+of\s+birth|birth\s*date)\b\s*[:=#-]?\s*(?:\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}[/.-]\d{1,2}[/.-]\d{1,2})", RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant),

            // Raw KYC fields/content and identity-document assets belong in Stripe.
            new("\\bkyc\\s+payload\\b|\\b(?:passport[_\\s-]*(?:number|no\\.?|#)|driver'?s?[_\\s-]*licen[cs]e[_\\s-]*(?:number|no\\.?|#)|identity[_\\s-]*document[_\\s-]*(?:number|image|front|back)|document[_\\s-]*number)\\b\\s*[:=]?\\s*[\"']?[A-Z0-9+/]", RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant),
            new(@"data:image/", RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant),
            new(@"https?://\S*(?:passport|driver(?:s)?[-_]?licen[cs]e|identity|id[-_]?document|kyc)\S*", RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant),
            new(@"\b(?:passport|driver'?s?[-_ ]*licen[cs]e|identity[-_ ]*document|id[-_ ]*document|kyc)[^\r\n]{0,80}\.(?:jpe?g|png|gif|webp|tiff?|bmp)\b", RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant),
            new(@"https?://\S+\.(?:jpe?g|png|gif|webp|tiff?|bmp)(?:[?#]\S*)?", RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)
        ];

        public async Task<StripeConnectedPayeeReview> RegisterAsync(long? userId, string stripeAccountId, bool detailsSubmitted, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(stripeAccountId)) throw new ArgumentException("Stripe account ID is required.", nameof(stripeAccountId));
            stripeAccountId = stripeAccountId.Trim();
            var now = timeProvider.GetUtcNow();

            var accountOwner = await context.StripeConnectedPayeeReviews
                .SingleOrDefaultAsync(x => x.StripeAccountId == stripeAccountId, cancellationToken);
            if (accountOwner != null)
            {
                if (accountOwner.UserId.HasValue && userId.HasValue && accountOwner.UserId.Value != userId.Value)
                    throw new InvalidOperationException("This Stripe connected account is already assigned to another user.");

                var isOrphanReassignment = !accountOwner.UserId.HasValue && userId.HasValue;
                if (isOrphanReassignment)
                {
                    ResetApprovalAndTrust(accountOwner, detailsSubmitted, now);
                    accountOwner.UserId = userId;
                }
                else
                    accountOwner.StripeDetailsSubmitted = detailsSubmitted;

                if (!isOrphanReassignment && accountOwner.Status == StripePayeeReviewStatus.Onboarding && detailsSubmitted)
                    accountOwner.Status = StripePayeeReviewStatus.StripeVerified;
                else if (!isOrphanReassignment && accountOwner.Status == StripePayeeReviewStatus.PayoutApproved && !detailsSubmitted)
                {
                    accountOwner.Status = StripePayeeReviewStatus.Suspended;
                    accountOwner.SuspendedAt = now;
                    accountOwner.SuspensionReason = "Stripe onboarding requirements regressed after approval.";
                }
                accountOwner.UpdatedAt = now;
                await DisableLinkedUserForReviewAsync(userId, stripeAccountId, accountOwner.Status, cancellationToken);
                await context.SaveChangesAsync(cancellationToken);
                return accountOwner;
            }

            StripeConnectedPayeeReview? review = null;
            if (userId.HasValue)
                review = await context.StripeConnectedPayeeReviews.SingleOrDefaultAsync(x => x.UserId == userId.Value, cancellationToken);

            if (review != null)
            {
                // A destination-account change invalidates every approval and trust fact associated with the old bank/account.
                review.StripeAccountId = stripeAccountId;
                ResetApprovalAndTrust(review, detailsSubmitted, now);
            }
            else
            {
                review = new StripeConnectedPayeeReview
                {
                    UserId = userId,
                    StripeAccountId = stripeAccountId,
                    Status = detailsSubmitted ? StripePayeeReviewStatus.StripeVerified : StripePayeeReviewStatus.Onboarding,
                    StripeDetailsSubmitted = detailsSubmitted,
                    PayoutSchedulePolicy = "manual",
                    InstantPayoutsAllowed = false,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                context.StripeConnectedPayeeReviews.Add(review);
            }

            await DisableLinkedUserForReviewAsync(userId, stripeAccountId, review.Status, cancellationToken);
            await context.SaveChangesAsync(cancellationToken);
            return review;
        }

        private static void ResetApprovalAndTrust(StripeConnectedPayeeReview review, bool detailsSubmitted, DateTimeOffset now)
        {
            review.Status = detailsSubmitted ? StripePayeeReviewStatus.StripeVerified : StripePayeeReviewStatus.Onboarding;
            review.StripeDetailsSubmitted = detailsSubmitted;
            review.ApprovedAt = null;
            review.ApprovedByUserId = null;
            review.ApprovalEvidence = null;
            review.ApprovalNotes = null;
            review.PropertyAuthorityAttested = false;
            review.ApprovedOrganizationId = null;
            review.SuspendedAt = null;
            review.SuspendedByUserId = null;
            review.SuspensionReason = null;
            review.LastStripeSnapshotAt = null;
            review.StripePayoutsEnabled = false;
            review.StripeTransfersActive = false;
            review.StripeTransferCapabilityStatus = null;
            review.CurrentlyDueRequirementCount = 0;
            review.PastDueRequirementCount = 0;
            review.StripeDisabledReason = null;
            review.ExternalAccountFingerprint = null;
            review.LastStripeEventId = null;
            review.PayoutSchedulePolicy = "manual";
            review.InstantPayoutsAllowed = false;
            review.UpdatedAt = now;
        }

        private async Task DisableLinkedUserForReviewAsync(long? userId, string stripeAccountId, StripePayeeReviewStatus status,
            CancellationToken cancellationToken)
        {
            if (!userId.HasValue) return;
            var user = await context.Users.FindAsync([userId.Value], cancellationToken);
            if (user == null) return;
            user.StripeAccountId = stripeAccountId;
            user.StripeAccountEnabled = status == StripePayeeReviewStatus.PayoutApproved;
            user.StripeAccountStatus = status switch
            {
                StripePayeeReviewStatus.PayoutApproved => "payout_approved",
                StripePayeeReviewStatus.StripeVerified or StripePayeeReviewStatus.UnderReview => "stripe_verified_pending_review",
                StripePayeeReviewStatus.Suspended => "suspended",
                _ => "pending"
            };
        }

        public async Task<IReadOnlyList<StripeConnectedPayeeReview>> ListAsync(StripePayeeReviewStatus? status, CancellationToken cancellationToken = default)
        {
            var query = context.StripeConnectedPayeeReviews.AsNoTracking();
            if (status.HasValue) query = query.Where(x => x.Status == status.Value);
            return await query.OrderBy(x => x.Status).ThenBy(x => x.CreatedAt).ToListAsync(cancellationToken);
        }

        public async Task<StripeConnectedPayeeReview> BeginReviewAsync(string stripeAccountId, CancellationToken cancellationToken = default)
        {
            var review = await GetRequiredAsync(stripeAccountId, cancellationToken);
            var now = timeProvider.GetUtcNow();
            if (review.Status == StripePayeeReviewStatus.Suspended)
            {
                if (!HasFreshHealthySnapshot(review, now))
                    throw new InvalidOperationException("A fresh healthy Stripe snapshot is required before a suspended payee can resume review.");

                // Remediation never restores trust. An administrator may explicitly restart
                // review only after a fresh healthy Stripe snapshot, and every prior approval
                // and authority assertion must be collected again.
                review.ApprovedAt = null;
                review.ApprovedByUserId = null;
                review.ApprovalEvidence = null;
                review.ApprovalNotes = null;
                review.PropertyAuthorityAttested = false;
                review.ApprovedOrganizationId = null;
                review.SuspendedAt = null;
                review.SuspendedByUserId = null;
                review.SuspensionReason = null;
            }
            if (!review.StripeDetailsSubmitted)
                throw new InvalidOperationException("Stripe onboarding must be completed before internal review.");
            review.Status = StripePayeeReviewStatus.UnderReview;
            review.UpdatedAt = now;
            await DisableLinkedUserForReviewAsync(review.UserId, stripeAccountId, review.Status, cancellationToken);
            await context.SaveChangesAsync(cancellationToken);
            return review;
        }

        private static bool HasFreshHealthySnapshot(StripeConnectedPayeeReview review, DateTimeOffset now) =>
            review.LastStripeSnapshotAt is { } capturedAt
            && capturedAt <= now.AddMinutes(1)
            && capturedAt >= now.AddMinutes(-5)
            && review.StripeDetailsSubmitted
            && review.StripePayoutsEnabled
            && review.StripeTransfersActive
            && string.Equals(review.StripeTransferCapabilityStatus, "active", StringComparison.OrdinalIgnoreCase)
            && review.CurrentlyDueRequirementCount == 0
            && review.PastDueRequirementCount == 0
            && string.IsNullOrWhiteSpace(review.StripeDisabledReason)
            && !string.IsNullOrWhiteSpace(review.ExternalAccountFingerprint)
            && string.Equals(review.PayoutSchedulePolicy, "manual", StringComparison.OrdinalIgnoreCase)
            && !review.InstantPayoutsAllowed;

        public async Task<StripeConnectedPayeeReview> ApproveAsync(string stripeAccountId, long adminUserId, long organizationId, string evidence, string notes,
            bool propertyAuthorityAttested, CancellationToken cancellationToken = default)
        {
            if (adminUserId <= 0) throw new ArgumentException("Approving administrator is required.", nameof(adminUserId));
            if (organizationId <= 0) throw new ArgumentException("Approved organization scope is required.", nameof(organizationId));
            if (string.IsNullOrWhiteSpace(evidence)) throw new ArgumentException("Approval evidence reference is required.", nameof(evidence));
            if (string.IsNullOrWhiteSpace(notes)) throw new ArgumentException("Approval notes are required.", nameof(notes));
            if (!propertyAuthorityAttested) throw new ArgumentException("Property-authority attestation is required.", nameof(propertyAuthorityAttested));
            if (evidence.Length > 500 || notes.Length > 2000) throw new ArgumentException("Approval evidence or notes exceed the allowed length.");
            ValidateApprovalContent(evidence, nameof(evidence));
            ValidateApprovalContent(notes, nameof(notes));

            var review = await GetRequiredAsync(stripeAccountId, cancellationToken);
            if (review.Status is not (StripePayeeReviewStatus.UnderReview or StripePayeeReviewStatus.StripeVerified))
                throw new InvalidOperationException("Only a Stripe-verified payee under review can be approved.");
            if (!review.UserId.HasValue || !await context.OrganizationMembers.AnyAsync(x => x.UserId == review.UserId
                    && x.OrganizationId == organizationId && x.IsActive
                    && (x.Role == "Owner" || x.Role == "Manager"), cancellationToken))
                throw new InvalidOperationException("The payee is not an active owner or manager in the approved organization.");
            var now = timeProvider.GetUtcNow();
            if (!HasFreshHealthySnapshot(review, now))
                throw new InvalidOperationException("A fresh, healthy Stripe snapshot with manual-only payouts is required before approval.");
            review.Status = StripePayeeReviewStatus.PayoutApproved;
            review.ApprovedAt = now;
            review.ApprovedByUserId = adminUserId;
            review.ApprovalEvidence = evidence.Trim();
            review.ApprovalNotes = notes.Trim();
            review.PropertyAuthorityAttested = true;
            review.ApprovedOrganizationId = organizationId;
            review.SuspendedAt = null;
            review.SuspendedByUserId = null;
            review.SuspensionReason = null;
            review.InstantPayoutsAllowed = false;
            review.PayoutSchedulePolicy = "manual";
            review.UpdatedAt = now;
            if (review.UserId.HasValue)
            {
                var user = await context.Users.FindAsync([review.UserId.Value], cancellationToken);
                if (user != null)
                {
                    user.StripeAccountEnabled = true;
                    user.StripeAccountStatus = "payout_approved";
                }
            }
            await context.SaveChangesAsync(cancellationToken);
            return review;
        }

        private static void ValidateApprovalContent(string value, string parameterName)
        {
            if (ProhibitedApprovalContentPatterns.Any(pattern => pattern.IsMatch(value)))
                throw new ArgumentException(PiiError, parameterName);
        }

        public async Task<StripeConnectedPayeeReview> SuspendAsync(string stripeAccountId, long? adminUserId, string reason, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(reason)) throw new ArgumentException("Suspension reason is required.", nameof(reason));
            // Treat a shared destination ID as a risk signal: every current user carrying the
            // disputed account is disabled, regardless of review linkage or review existence.
            var linkedUsers = await context.Users
                .Where(x => x.StripeAccountId == stripeAccountId)
                .ToListAsync(cancellationToken);
            foreach (var linkedUser in linkedUsers)
            {
                linkedUser.StripeAccountEnabled = false;
                linkedUser.StripeAccountStatus = "suspended";
            }

            var review = await context.StripeConnectedPayeeReviews
                .SingleOrDefaultAsync(x => x.StripeAccountId == stripeAccountId, cancellationToken);
            if (review == null)
            {
                // A missing review must fail closed rather than leaving a disputed destination
                // eligible forever. Bind it only when ownership is unique and does not conflict
                // with another review; the matching users were already disabled above.
                long? safeUserId = null;
                if (linkedUsers.Count == 1)
                {
                    var candidateUserId = linkedUsers[0].Id;
                    if (!await context.StripeConnectedPayeeReviews
                        .AnyAsync(x => x.UserId == candidateUserId, cancellationToken))
                        safeUserId = candidateUserId;
                }
                var now = timeProvider.GetUtcNow();
                review = new StripeConnectedPayeeReview
                {
                    UserId = safeUserId,
                    StripeAccountId = stripeAccountId,
                    Status = StripePayeeReviewStatus.Suspended,
                    CreatedAt = now,
                    UpdatedAt = now,
                    SuspendedAt = now,
                    SuspendedByUserId = adminUserId,
                    SuspensionReason = TruncateReason(reason),
                    InstantPayoutsAllowed = false,
                    PayoutSchedulePolicy = "manual"
                };
                context.StripeConnectedPayeeReviews.Add(review);
            }
            // Suspension is a one-way safety transition until an explicit remediation/review flow
            // clears it. Webhook retries must not replace the original incident provenance.
            else if (review.Status != StripePayeeReviewStatus.Suspended)
            {
                Suspend(review, adminUserId, reason);
            }
            await DisableLinkedUserAsync(review, cancellationToken);
            await context.SaveChangesAsync(cancellationToken);
            return review;
        }

        public async Task<StripeConnectedPayeeReview?> SyncStripeSnapshotAsync(StripeConnectedAccountSnapshot snapshot, string? eventId, CancellationToken cancellationToken = default)
        {
            var review = await context.StripeConnectedPayeeReviews.SingleOrDefaultAsync(x => x.StripeAccountId == snapshot.StripeAccountId, cancellationToken);
            if (review == null) return null;
            if (!string.IsNullOrWhiteSpace(eventId) && review.LastStripeEventId == eventId) return review;

            var previousFingerprint = review.ExternalAccountFingerprint;
            review.LastStripeSnapshotAt = snapshot.RetrievedAt;
            review.StripeDetailsSubmitted = snapshot.DetailsSubmitted;
            review.StripePayoutsEnabled = snapshot.PayoutsEnabled;
            review.StripeTransfersActive = snapshot.TransfersActive;
            review.StripeTransferCapabilityStatus = snapshot.TransferCapabilityStatus;
            review.CurrentlyDueRequirementCount = snapshot.CurrentlyDue.Count;
            review.PastDueRequirementCount = snapshot.PastDue.Count;
            review.StripeDisabledReason = snapshot.DisabledReason;
            review.PayoutSchedulePolicy = snapshot.PayoutSchedulePolicy?.Trim() ?? "unknown";
            // Stripe's available_payout_methods reports technical eligibility, not
            // Property Peace authorization. Property Peace never authorizes instant
            // payouts; the only money movement implemented here is a platform transfer,
            // and connected-account payout scheduling must remain manual.
            review.InstantPayoutsAllowed = false;
            review.LastStripeEventId = eventId;
            // The snapshot is authoritative. Clear stale destination trust when Stripe no
            // longer reports an eligible external account instead of retaining the old value.
            review.ExternalAccountFingerprint = string.IsNullOrWhiteSpace(snapshot.ExternalAccountFingerprint)
                ? null
                : snapshot.ExternalAccountFingerprint.Trim();
            review.UpdatedAt = timeProvider.GetUtcNow();

            var restriction = RestrictionReason(snapshot);
            if (restriction != null)
                Suspend(review, null, restriction);
            else if (review.Status == StripePayeeReviewStatus.PayoutApproved
                && (string.IsNullOrWhiteSpace(previousFingerprint)
                    || string.IsNullOrWhiteSpace(snapshot.ExternalAccountFingerprint)
                    || !string.Equals(previousFingerprint, snapshot.ExternalAccountFingerprint, StringComparison.Ordinal)))
                Suspend(review, null, "Stripe external bank account changed; internal re-review is required.");
            else if (review.Status == StripePayeeReviewStatus.Onboarding && snapshot.DetailsSubmitted)
                review.Status = StripePayeeReviewStatus.StripeVerified;

            if (review.Status == StripePayeeReviewStatus.Suspended)
                await DisableLinkedUserAsync(review, cancellationToken);
            await context.SaveChangesAsync(cancellationToken);
            return review;
        }

        public static string? RestrictionReason(StripeConnectedAccountSnapshot snapshot)
        {
            if (!snapshot.DetailsSubmitted) return "Stripe details are no longer submitted.";
            if (!snapshot.PayoutsEnabled) return "Stripe payouts are disabled.";
            if (!snapshot.TransfersActive || !string.Equals(snapshot.TransferCapabilityStatus, "active", StringComparison.OrdinalIgnoreCase))
                return "Stripe transfer capability is not active.";
            if (snapshot.CurrentlyDue.Count > 0) return "Stripe has currently-due requirements.";
            if (snapshot.PastDue.Count > 0) return "Stripe has past-due requirements.";
            if (!string.IsNullOrWhiteSpace(snapshot.DisabledReason)) return $"Stripe disabled the account: {snapshot.DisabledReason}.";
            if (string.IsNullOrWhiteSpace(snapshot.ExternalAccountFingerprint))
                return "Stripe has no eligible payout destination.";
            if (!string.Equals(snapshot.PayoutSchedulePolicy, "manual", StringComparison.OrdinalIgnoreCase))
                return "Stripe payout schedule is not manual.";
            // InstantPayoutMethodsAvailable is Stripe eligibility, not authorization.
            // Internal authorization remains false and there is no Payout API path.
            return null;
        }

        public Task<bool> IsApprovedDestinationAsync(long userId, long organizationId, string stripeAccountId,
            CancellationToken cancellationToken = default) =>
            context.StripeConnectedPayeeReviews.AnyAsync(x => x.UserId == userId
                && x.ApprovedOrganizationId == organizationId
                && x.StripeAccountId == stripeAccountId
                && x.Status == StripePayeeReviewStatus.PayoutApproved
                && x.PropertyAuthorityAttested
                && context.OrganizationMembers.Any(member => member.UserId == userId
                    && member.OrganizationId == organizationId
                    && member.IsActive
                    && (member.Role == "Owner" || member.Role == "Manager")), cancellationToken);

        private async Task<StripeConnectedPayeeReview> GetRequiredAsync(string stripeAccountId, CancellationToken cancellationToken) =>
            await context.StripeConnectedPayeeReviews.SingleOrDefaultAsync(x => x.StripeAccountId == stripeAccountId, cancellationToken)
            ?? throw new KeyNotFoundException("Connected payee review was not found.");

        private void Suspend(StripeConnectedPayeeReview review, long? adminUserId, string reason)
        {
            var now = timeProvider.GetUtcNow();
            review.Status = StripePayeeReviewStatus.Suspended;
            review.SuspendedAt = now;
            review.SuspendedByUserId = adminUserId;
            review.SuspensionReason = TruncateReason(reason);
            review.UpdatedAt = now;
        }

        private static string TruncateReason(string reason)
        {
            var trimmed = reason.Trim();
            return trimmed.Length <= 1000 ? trimmed : trimmed[..1000];
        }

        private async Task DisableLinkedUserAsync(StripeConnectedPayeeReview review, CancellationToken cancellationToken)
        {
            if (review.UserId.HasValue)
            {
                var user = await context.Users.FindAsync([review.UserId.Value], cancellationToken);
                if (user != null)
                {
                    user.StripeAccountEnabled = false;
                    user.StripeAccountStatus = "suspended";
                }
            }
        }
    }
}
