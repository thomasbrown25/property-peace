using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Activation;
using brownstone_hub_api.Enums;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.Activation;

/// <summary>
/// Evaluates activation against one deterministic, organization-owned rental chain. Tutorial state
/// and external providers are intentionally outside this read model.
/// </summary>
public sealed class ActivationService(DataContext db, TimeProvider timeProvider) : IActivationService
{
    private const string Owner = "Owner";
    private const string Manager = "Manager";
    private const string Viewer = "Viewer";
    private const int CandidateLimit = 64;

    public async Task<ActivationResponseDto> EvaluateAsync(
        long userId,
        long organizationId,
        CancellationToken cancellationToken = default)
    {
        if (userId <= 0 || organizationId <= 0)
            throw new ActivationAccessDeniedException();

        var evaluatedAt = timeProvider.GetUtcNow();
        var member = await db.OrganizationMembers.AsNoTracking()
            .Where(x => x.UserId == userId && x.OrganizationId == organizationId && x.IsActive
                && x.Organization.IsActive && !x.Organization.IsDeleted)
            .Select(x => new MemberAuthority(x.Role, x.CanManageProperties, x.CanManageTenants,
                x.CanManageLeases, x.CanManageBilling))
            .SingleOrDefaultAsync(cancellationToken);

        if (member is null || member.Role is not (Owner or Manager or Viewer))
            throw new ActivationAccessDeniedException();

        var accountComplete = await db.Users.AsNoTracking().AnyAsync(x =>
            x.Id == userId && !x.IsDeleted
            && x.FirstName != null && x.FirstName.Trim() != ""
            && x.LastName != null && x.LastName.Trim() != ""
            && x.Email != null && x.Email.Trim() != "", cancellationToken);

        // These are deliberately small scalar projections. Each candidate set is capped in SQL;
        // activation must never hydrate whole rental/payment rows or unbounded organization data.
        var leases = await db.Leases.AsNoTracking()
            .Where(x => !x.IsDeleted
                && x.Unit.Property.OrganizationId == organizationId && !x.Unit.Property.IsDeleted
                && (!x.OrganizationId.HasValue || x.OrganizationId == organizationId)
                && (!x.Unit.OrganizationId.HasValue || x.Unit.OrganizationId == organizationId))
            .OrderByDescending(x => x.IsActive
                && (x.LeaseAgreement == null || x.LeaseAgreement.IsDrafted != true)
                && x.StartDate.HasValue && x.StartDate.Value.Date <= evaluatedAt.UtcDateTime.Date
                && x.EndDate.HasValue && x.EndDate.Value.Date >= evaluatedAt.UtcDateTime.Date
                && x.EndDate > x.StartDate && x.RentAmount > 0 && x.RentDueDay >= 1 && x.RentDueDay <= 31
                && x.RentFrequency != null && x.RentFrequency != "")
            .ThenByDescending(x => x.TenantLeases.Any(tl => !tl.Tenant.IsDeleted
                && (!tl.Tenant.OrganizationId.HasValue || tl.Tenant.OrganizationId == organizationId)
                && (!tl.Tenant.UnitId.HasValue || tl.Tenant.UnitId == x.UnitId)))
            .ThenByDescending(x => x.Unit.IsOccupied || x.Unit.Property.IsOccupied)
            .ThenBy(x => x.Id)
            .Select(x => new LeaseFact(
                x.Id, x.UnitId, x.Unit.PropertyId, x.Unit.IsOccupied || x.Unit.Property.IsOccupied,
                x.IsActive, x.LeaseAgreement != null && x.LeaseAgreement.IsDrafted == true,
                x.StartDate, x.EndDate, x.RentAmount, x.RentDueDay, x.RentFrequency,
                x.RentCollectionOther == true,
                x.TenantLeases.Where(tl => !tl.Tenant.IsDeleted
                        && (!tl.Tenant.OrganizationId.HasValue || tl.Tenant.OrganizationId == organizationId)
                        && (!tl.Tenant.UnitId.HasValue || tl.Tenant.UnitId == x.UnitId))
                    .OrderBy(tl => tl.TenantId).Select(tl => (long?)tl.TenantId).FirstOrDefault()))
            .Take(CandidateLimit)
            .ToListAsync(cancellationToken);

        var listings = await db.Listings.AsNoTracking()
            .Where(x => x.Property.OrganizationId == organizationId && !x.Property.IsDeleted
                && (!x.OrganizationId.HasValue || x.OrganizationId == organizationId)
                && (!x.UnitId.HasValue || x.Unit != null && x.Unit.PropertyId == x.PropertyId
                    && (!x.Unit.OrganizationId.HasValue || x.Unit.OrganizationId == organizationId)))
            .OrderByDescending(x => x.Status != EListingStatus.Draft)
            .ThenByDescending(x => x.UnitId.HasValue)
            .ThenBy(x => x.Id)
            .Select(x => new ListingFact(x.Id, x.PropertyId, x.UnitId, x.Status))
            .Take(CandidateLimit)
            .ToListAsync(cancellationToken);

        var applications = await db.RentalApplications.AsNoTracking()
            .Where(x => x.Property.OrganizationId == organizationId && !x.Property.IsDeleted
                && (!x.OrganizationId.HasValue || x.OrganizationId == organizationId)
                && (!x.UnitId.HasValue || x.Unit != null && x.Unit.PropertyId == x.PropertyId
                    && (!x.Unit.OrganizationId.HasValue || x.Unit.OrganizationId == organizationId)))
            .OrderByDescending(x => x.SubmittedAt.HasValue || x.Status != EApplicationStatus.Draft)
            .ThenByDescending(x => x.UnitId.HasValue)
            .ThenBy(x => x.Id)
            .Select(x => new ApplicationFact(
                x.Id, x.PropertyId, x.UnitId, x.Status, x.SubmittedAt.HasValue, x.ConvertedToLeaseId))
            .Take(CandidateLimit)
            .ToListAsync(cancellationToken);

        LeaseFact? lease = leases.FirstOrDefault();
        long? propertyId = null;
        long? unitId = null;
        ListingFact? listing = null;
        ApplicationFact? application = null;

        if (lease is not null)
        {
            propertyId = lease.PropertyId;
            unitId = lease.UnitId;
            listing = listings.Where(x => SameRental(x.PropertyId, x.UnitId, propertyId.Value, unitId))
                .OrderByDescending(x => x.Status != EListingStatus.Draft)
                .ThenByDescending(x => x.UnitId == unitId).ThenBy(x => x.Id).FirstOrDefault();
            application = applications.Where(x =>
                    SameRental(x.PropertyId, x.UnitId, propertyId.Value, unitId)
                    && (!x.ConvertedToLeaseId.HasValue || x.ConvertedToLeaseId == lease.Id))
                .OrderByDescending(IsRealApplication).ThenByDescending(x => x.UnitId == unitId)
                .ThenBy(x => x.Id).FirstOrDefault();
        }
        else
        {
            application = applications.OrderByDescending(IsRealApplication)
                .ThenByDescending(x => x.UnitId.HasValue).ThenBy(x => x.Id).FirstOrDefault();
            if (application is not null)
            {
                propertyId = application.PropertyId;
                unitId = application.UnitId;
                listing = listings.Where(x => SameRental(x.PropertyId, x.UnitId, propertyId.Value, unitId))
                    .OrderByDescending(x => x.Status != EListingStatus.Draft)
                    .ThenByDescending(x => unitId.HasValue && x.UnitId == unitId).ThenBy(x => x.Id).FirstOrDefault();
            }
            else
            {
                listing = listings.OrderByDescending(x => x.Status != EListingStatus.Draft)
                    .ThenByDescending(x => x.UnitId.HasValue).ThenBy(x => x.Id).FirstOrDefault();
                if (listing is not null)
                {
                    propertyId = listing.PropertyId;
                    unitId = listing.UnitId;
                }
                else
                {
                    var unit = await db.Units.AsNoTracking()
                        .Where(x => x.Property.OrganizationId == organizationId && !x.Property.IsDeleted
                            && (!x.OrganizationId.HasValue || x.OrganizationId == organizationId))
                        .OrderBy(x => x.Id)
                        .Select(x => new UnitFact(x.Id, x.PropertyId))
                        .Take(1)
                        .SingleOrDefaultAsync(cancellationToken);
                    if (unit is not null)
                    {
                        unitId = unit.Id;
                        propertyId = unit.PropertyId;
                    }
                    else
                    {
                        propertyId = await db.Properties.AsNoTracking()
                            .Where(x => x.OrganizationId == organizationId && !x.IsDeleted)
                            .OrderBy(x => x.Id).Select(x => (long?)x.Id).Take(1)
                            .SingleOrDefaultAsync(cancellationToken);
                    }
                }
            }
        }

        // Candidate caps keep the broad scan bounded; targeted fallbacks ensure the selected rental's
        // related listing/application cannot be hidden behind another rental's first page.
        if (propertyId.HasValue && listing is null)
        {
            listing = await db.Listings.AsNoTracking()
                .Where(x => x.Property.OrganizationId == organizationId && !x.Property.IsDeleted
                    && (!x.OrganizationId.HasValue || x.OrganizationId == organizationId)
                    && x.PropertyId == propertyId.Value
                    && (!x.UnitId.HasValue || !unitId.HasValue || x.UnitId == unitId.Value)
                    && (!x.UnitId.HasValue || x.Unit != null && x.Unit.PropertyId == x.PropertyId
                        && (!x.Unit.OrganizationId.HasValue || x.Unit.OrganizationId == organizationId)))
                .OrderByDescending(x => x.Status != EListingStatus.Draft)
                .ThenByDescending(x => unitId.HasValue && x.UnitId == unitId)
                .ThenBy(x => x.Id)
                .Select(x => new ListingFact(x.Id, x.PropertyId, x.UnitId, x.Status))
                .FirstOrDefaultAsync(cancellationToken);
        }
        var selectedLeaseId = lease?.Id;
        if (propertyId.HasValue && application is null)
        {
            application = await db.RentalApplications.AsNoTracking()
                .Where(x => x.Property.OrganizationId == organizationId && !x.Property.IsDeleted
                    && (!x.OrganizationId.HasValue || x.OrganizationId == organizationId)
                    && x.PropertyId == propertyId.Value
                    && (!x.UnitId.HasValue || !unitId.HasValue || x.UnitId == unitId.Value)
                    && (!selectedLeaseId.HasValue || !x.ConvertedToLeaseId.HasValue || x.ConvertedToLeaseId == selectedLeaseId.Value)
                    && (!x.UnitId.HasValue || x.Unit != null && x.Unit.PropertyId == x.PropertyId
                        && (!x.Unit.OrganizationId.HasValue || x.Unit.OrganizationId == organizationId)))
                .OrderByDescending(x => x.SubmittedAt.HasValue || x.Status != EApplicationStatus.Draft)
                .ThenByDescending(x => unitId.HasValue && x.UnitId == unitId)
                .ThenBy(x => x.Id)
                .Select(x => new ApplicationFact(x.Id, x.PropertyId, x.UnitId, x.Status, x.SubmittedAt.HasValue, x.ConvertedToLeaseId))
                .FirstOrDefaultAsync(cancellationToken);
        }

        var tenantId = lease?.TenantId;
        var hasProperty = propertyId.HasValue;
        var hasUnit = unitId.HasValue;
        var meaningfulListing = listing is not null && listing.Status != EListingStatus.Draft;
        var realApplication = application is not null && IsRealApplication(application);
        var leaseConfigured = lease is not null && IsConfigured(lease, evaluatedAt.UtcDateTime.Date);
        var tenantAssigned = tenantId.HasValue;
        var occupiedLease = leaseConfigured && tenantAssigned;

        var inviteSent = false;
        var inviteAccepted = false;
        if (tenantId.HasValue)
        {
            var expiresAfter = evaluatedAt.UtcDateTime;
            var invites = db.TenantInvites.AsNoTracking().Where(x => x.TenantId == tenantId.Value
                && x.OrganizationId == organizationId);
            inviteAccepted = await invites.AnyAsync(x => x.IsUsed && x.UsedAt.HasValue, cancellationToken);
            inviteSent = inviteAccepted || await invites.AnyAsync(x => !x.IsUsed && x.ExpiresAt > expiresAfter,
                cancellationToken);
        }

        var rentScheduleConfigured = leaseConfigured;
        var manualTrackingConfigured = leaseConfigured && lease!.ManualTrackingConfigured;
        var canManageProperties = member.Role == Owner || member.Role == Manager && member.CanManageProperties;
        var canManageTenants = member.Role == Owner || member.Role == Manager && member.CanManageTenants;
        var canManageLeases = member.Role == Owner || member.Role == Manager && member.CanManageLeases;
        var canManageBilling = member.Role == Owner || member.Role == Manager && member.CanManageBilling;

        var paymentSetupCompleted = false;
        var currentlyReady = false;
        if (canManageBilling)
        {
            // Account identifiers/fingerprints are predicates only: the SQL result contains booleans,
            // and payment evidence is not queried or returned for members without billing authority.
            var paymentFacts = await (
                from review in db.StripeConnectedPayeeReviews.AsNoTracking()
                join payee in db.OrganizationMembers.AsNoTracking()
                    on review.UserId equals payee.UserId
                where review.ApprovedOrganizationId == organizationId
                    && payee.OrganizationId == organizationId && payee.IsActive
                    && (payee.Role == Owner || payee.Role == Manager)
                    && payee.User != null && !payee.User.IsDeleted
                    && payee.User.StripeAccountId != null && payee.User.StripeAccountId != ""
                    && payee.User.StripeAccountId == review.StripeAccountId
                    && review.Status == StripePayeeReviewStatus.PayoutApproved && review.ApprovedAt.HasValue
                    && review.PropertyAuthorityAttested
                orderby review.Id
                select new PaymentFact(true,
                    review.LastStripeSnapshotAt >= evaluatedAt.AddMinutes(-5)
                    && review.LastStripeSnapshotAt <= evaluatedAt.AddMinutes(1)
                    && review.StripeDetailsSubmitted && review.StripePayoutsEnabled && review.StripeTransfersActive
                    && review.StripeTransferCapabilityStatus == "active"
                    && review.CurrentlyDueRequirementCount == 0 && review.PastDueRequirementCount == 0
                    && (review.StripeDisabledReason == null || review.StripeDisabledReason == "")
                    && review.ExternalAccountFingerprint != null && review.ExternalAccountFingerprint != ""
                    && review.PayoutSchedulePolicy == "manual" && !review.InstantPayoutsAllowed))
                .Take(CandidateLimit).ToListAsync(cancellationToken);
            paymentSetupCompleted = paymentFacts.Count != 0;
            currentlyReady = paymentFacts.Any(x => x.CurrentlyReady);
        }

        var hasCommunication = false;
        if (propertyId.HasValue)
        {
            hasCommunication = await db.Messages.AsNoTracking().AnyAsync(x =>
                !x.IsDeleted
                && (x.Content != "" || x.AttachmentUrl != null && x.AttachmentUrl != "")
                && (!x.OrganizationId.HasValue || x.OrganizationId == organizationId)
                && (!x.Conversation.OrganizationId.HasValue || x.Conversation.OrganizationId == organizationId)
                && (!x.Conversation.PropertyId.HasValue || x.Conversation.PropertyId == propertyId)
                && (!x.Conversation.LeaseId.HasValue || x.Conversation.LeaseId == (lease == null ? null : lease.Id))
                && (!x.Conversation.TenantId.HasValue || x.Conversation.TenantId == tenantId)
                && (x.Conversation.PropertyId == propertyId
                    || lease != null && x.Conversation.LeaseId == lease.Id
                    || tenantId.HasValue && x.Conversation.TenantId == tenantId), cancellationToken);
        }

        var rentEvidence = new List<(string Key, bool Value)>
        {
            ("rentScheduleConfigured", rentScheduleConfigured),
            ("manualTrackingConfigured", manualTrackingConfigured)
        };
        if (canManageBilling)
        {
            rentEvidence.Add(("paymentSetupCompleted", paymentSetupCompleted));
            rentEvidence.Add(("currentlyReady", currentlyReady));
        }

        var steps = new List<ActivationStepDto>(8)
        {
            Step("account", accountComplete, true, member.Role, Evidence(("identityPresent", accountComplete))),
            Step("organization", true, false, member.Role, Evidence(("activeMembership", true))),
            Step("property-unit", hasProperty && hasUnit, canManageProperties, member.Role,
                Evidence(("hasProperty", hasProperty), ("hasUnit", hasUnit))),
            ListingStep(listing is not null, meaningfulListing, realApplication, occupiedLease,
                canManageProperties, member.Role),
            Step("lease", leaseConfigured, canManageLeases, member.Role,
                Evidence(("hasLease", lease is not null), ("leaseConfigured", leaseConfigured))),
            InviteStep(tenantAssigned, inviteSent, inviteAccepted, canManageTenants, member.Role),
            Step("rent-readiness", rentScheduleConfigured || manualTrackingConfigured, canManageLeases, member.Role,
                Evidence(rentEvidence.ToArray())),
            Step("communication", hasCommunication, canManageTenants, member.Role,
                Evidence(("hasCommunication", hasCommunication)))
        };

        var context = new ActivationContextDto(propertyId, unitId, listing?.Id, application?.Id,
            lease?.Id, tenantId);
        return new ActivationResponseDto(organizationId, member.Role, evaluatedAt, context,
            new ActivationProgressDto(steps.Count(x => x.Complete), steps.Count), steps);
    }

    private static bool IsConfigured(LeaseFact x, DateTime evaluatedDate) => x.IsActive && !x.IsDraft
        && x.StartDate.HasValue && x.StartDate.Value.Date <= evaluatedDate.Date
        && x.EndDate.HasValue && x.EndDate.Value.Date >= evaluatedDate.Date
        && x.EndDate > x.StartDate && x.RentAmount > 0 && x.RentDueDay is >= 1 and <= 31
        && !string.IsNullOrWhiteSpace(x.RentFrequency);

    private static bool IsRealApplication(ApplicationFact x) =>
        x.Submitted || x.Status != EApplicationStatus.Draft;

    private static bool SameRental(long candidatePropertyId, long? candidateUnitId,
        long propertyId, long? unitId) => candidatePropertyId == propertyId
        && (!candidateUnitId.HasValue || !unitId.HasValue || candidateUnitId == unitId);

    private static ActivationStepDto ListingStep(bool hasListing, bool meaningfulListing,
        bool realApplication, bool occupiedPath, bool authorized, string role)
    {
        var evidence = Evidence(("hasListing", hasListing),
            ("hasSubmittedApplication", realApplication), ("occupiedPath", occupiedPath));
        if (occupiedPath)
            return new ActivationStepDto("listing-application", "notApplicable", true, false, false, evidence);
        return Step("listing-application", meaningfulListing || realApplication, authorized, role, evidence);
    }

    private static ActivationStepDto InviteStep(bool tenantAssigned, bool sent, bool accepted, bool authorized, string role)
    {
        var evidence = Evidence(("tenantAssigned", tenantAssigned), ("inviteSent", sent), ("inviteAccepted", accepted));
        if (sent)
            return new ActivationStepDto("tenant-invite", accepted ? "complete" : "waiting", true, false, false, evidence);
        return Step("tenant-invite", tenantAssigned, authorized, role, evidence);
    }

    private static ActivationStepDto Step(string key, bool complete, bool authorized, string role,
        IReadOnlyDictionary<string, bool> evidence)
    {
        if (complete) return new ActivationStepDto(key, "complete", true, false, false, evidence);
        var ownerActionRequired = !authorized && role != Owner;
        return new ActivationStepDto(key, ownerActionRequired ? "blocked" : "incomplete", false,
            authorized, ownerActionRequired, evidence);
    }

    private static IReadOnlyDictionary<string, bool> Evidence(params (string Key, bool Value)[] values) =>
        values.ToDictionary(x => x.Key, x => x.Value, StringComparer.Ordinal);

    private sealed record MemberAuthority(string Role, bool CanManageProperties, bool CanManageTenants,
        bool CanManageLeases, bool CanManageBilling);
    private sealed record LeaseFact(long Id, long UnitId, long PropertyId, bool Occupied,
        bool IsActive, bool IsDraft, DateTime? StartDate, DateTime? EndDate, decimal? RentAmount, int? RentDueDay,
        string? RentFrequency, bool ManualTrackingConfigured, long? TenantId);
    private sealed record ListingFact(long Id, long PropertyId, long? UnitId, EListingStatus Status);
    private sealed record ApplicationFact(long Id, long PropertyId, long? UnitId,
        EApplicationStatus Status, bool Submitted, long? ConvertedToLeaseId);
    private sealed record UnitFact(long Id, long PropertyId);
    private sealed record PaymentFact(bool SetupCompleted, bool CurrentlyReady);
}
