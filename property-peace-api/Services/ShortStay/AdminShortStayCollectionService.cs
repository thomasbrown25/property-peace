using System.Data;
using System.Security.Claims;
using System.Text.RegularExpressions;
using brownstone_hub_api.Data;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.ShortStay;

public sealed record AdminShortStayCollectionItem(long Id, long OrganizationId, long ApplicantUserId,
    ShortStayCollectionApplicationStatus Status, long[] PropertyIds, long RowVersion,
    DateTimeOffset? SubmittedAt, DateTimeOffset? ApprovedAt);
public sealed record ApproveShortStayCollectionRequest(string CaseReference, bool? PropertyAuthorityConfirmed);
public sealed record ShortStayCollectionReasonRequest(string? ReasonCode);

// No Stripe session URL, account ID, KYC payload or reviewer notes leave this boundary.
public sealed class AdminShortStayCollectionService(DataContext db, IHttpContextAccessor accessor,
    IConfiguration configuration, ILogger<AdminShortStayCollectionService> logger,
    IStripeShortStayIdentityGateway? identityGateway = null)
{
    private static readonly Regex Reference = new("^[A-Za-z0-9]{4,64}$", RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private static readonly HashSet<string> ReasonCodes = ["scope_changed", "payee_ineligible", "identity_failed", "authority_revoked", "policy_mismatch", "other"];
    private static ServiceResponse<T> Error<T>(string message, int code) =>
        ServiceResponse<T>.CreateError(message, statusCode: code, suppressDetailedErrors: true);
    private long Actor
    {
        get
        {
            var http = accessor.HttpContext;
            if (http?.User.Identity?.IsAuthenticated != true || !http.User.IsInRole("Admin")) return 0;
            if (!long.TryParse(http.User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) || id <= 0) return 0;
            if (http.Items.TryGetValue("UserId", out var item) && (item is not long userId || userId != id)) return 0;
            return id;
        }
    }
    private Task<bool> ActiveAdmin(long id, CancellationToken ct) => db.Users.AsNoTracking().AnyAsync(u =>
        u.Id == id && !u.IsDeleted && !u.IsSuspended && u.UserRoles.Any(r => r.Role.RoleName == "Admin"), ct);
    private static AdminShortStayCollectionItem Map(ShortStayCollectionApplication a) =>
        new(a.Id, a.OrganizationId, a.ApplicantUserId, a.Status,
            a.Properties.Select(p => p.PropertyId).Order().ToArray(), a.RowVersion, a.SubmittedAt, a.ApprovedAt);
    private bool IdentityEnabled => identityGateway is not null &&
        string.Equals(configuration["Stripe:IdentityEnabled"], "true", StringComparison.OrdinalIgnoreCase);
    private bool RequireIdentity => ShortStayCollectionPolicy.Required(configuration, "RequireIdentityForApplicationApproval");

    public async Task<ServiceResponse<AdminShortStayCollectionItem[]>> List(CancellationToken ct = default)
    {
        var actor = Actor;
        if (actor == 0) return Error<AdminShortStayCollectionItem[]>("Forbidden", 403);
        try
        {
            if (!await ActiveAdmin(actor, ct)) return Error<AdminShortStayCollectionItem[]>("Forbidden", 403);
            var apps = await db.ShortStayCollectionApplications.AsNoTracking().Include(a => a.Properties)
                .Where(a => a.Status != ShortStayCollectionApplicationStatus.Draft)
                .OrderByDescending(a => a.Id).Take(100).ToListAsync(ct);
            return ServiceResponse<AdminShortStayCollectionItem[]>.CreateSuccess(apps.Select(Map).ToArray());
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex) { logger.LogError(ex, "Collection review list unavailable"); return Error<AdminShortStayCollectionItem[]>("Unavailable", 503); }
    }

    public Task<ServiceResponse<AdminShortStayCollectionItem>> BeginReview(long id, CancellationToken ct = default) =>
        Mutate(id, "review", null, ct);
    public Task<ServiceResponse<AdminShortStayCollectionItem>> Suspend(long id, string? reasonCode = null, CancellationToken ct = default) =>
        Mutate(id, "suspend", reasonCode, ct);
    public Task<ServiceResponse<AdminShortStayCollectionItem>> Reject(long id, string? reasonCode = null, CancellationToken ct = default) =>
        Mutate(id, "reject", reasonCode, ct);
    public Task<ServiceResponse<AdminShortStayCollectionItem>> Approve(long id, string? caseReference, bool propertyAuthorityConfirmed, CancellationToken ct = default) =>
        propertyAuthorityConfirmed ? Mutate(id, "approve", caseReference, ct) :
            Task.FromResult(Error<AdminShortStayCollectionItem>("Property authority confirmation required", 400));

    private async Task LockScope(ShortStayCollectionApplication app, long actor, CancellationToken ct)
    {
        if (!db.Database.IsSqlServer()) return;
        // Consistent lock order: admin, organization, applicant, membership, payee, properties, application.
        foreach (var userId in new[] { actor, app.ApplicantUserId }.Distinct().Order())
            await db.Database.SqlQueryRaw<long>("SELECT Id AS Value FROM [core].[Users] WITH (UPDLOCK, HOLDLOCK) WHERE Id = {0}", userId).ToListAsync(ct);
        await db.Database.SqlQueryRaw<long>("SELECT Id AS Value FROM [organization].[Organizations] WITH (UPDLOCK, HOLDLOCK) WHERE Id = {0}", app.OrganizationId).ToListAsync(ct);
        await db.Database.SqlQueryRaw<long>("SELECT Id AS Value FROM [organization].[OrganizationMembers] WITH (UPDLOCK, HOLDLOCK) WHERE OrganizationId = {0} AND UserId = {1}", app.OrganizationId, app.ApplicantUserId).ToListAsync(ct);
        await db.Database.SqlQueryRaw<long>("SELECT Id AS Value FROM [financial].[StripeConnectedPayeeReviews] WITH (UPDLOCK, HOLDLOCK) WHERE StripeAccountId = {0} OR UserId = {1}", app.StripeAccountId, app.ApplicantUserId).ToListAsync(ct);
        foreach (var propertyId in app.Properties.Select(x => x.PropertyId).Order())
            await db.Database.SqlQueryRaw<long>("SELECT Id AS Value FROM [property].[Properties] WITH (UPDLOCK, HOLDLOCK) WHERE Id = {0}", propertyId).ToListAsync(ct);
        await db.Database.SqlQueryRaw<long>("SELECT Id AS Value FROM [financial].[ShortStayCollectionApplications] WITH (UPDLOCK, HOLDLOCK) WHERE Id = {0}", app.Id).ToListAsync(ct);
    }

    private async Task<bool> ScopeValid(ShortStayCollectionApplication app, CancellationToken ct)
    {
        var ids = app.Properties.Select(x => x.PropertyId).ToArray();
        var policy = ShortStayCollectionPolicy.Available(configuration);
        if (ids.Length is < 1 or > 50 || ids.Distinct().Count() != ids.Length ||
            policy is null || app.FeePolicyConsentVersion != policy.Value.Version ||
            app.AuthorityAttestedAt is null || app.SubmittedAt is null || string.IsNullOrWhiteSpace(app.StripeAccountId)) return false;
        if (!await db.OrganizationMembers.AsNoTracking().AnyAsync(m => m.OrganizationId == app.OrganizationId &&
            m.UserId == app.ApplicantUserId && m.IsActive && m.CanManageProperties &&
            (m.Role == "Owner" || m.Role == "Manager") && m.Organization.IsActive && !m.Organization.IsDeleted, ct)) return false;
        if (!await db.Users.AsNoTracking().AnyAsync(u => u.Id == app.ApplicantUserId && !u.IsDeleted && !u.IsSuspended && u.StripeAccountId == app.StripeAccountId, ct)) return false;
        return await db.Properties.AsNoTracking().CountAsync(p => ids.Contains(p.Id) && p.OrganizationId == app.OrganizationId &&
            !p.IsDeleted && p.Units.Any(u => u.RentalMode == ERentalMode.ShortTerm &&
                (u.OrganizationId == null || u.OrganizationId == app.OrganizationId)), ct) == ids.Length;
    }
    private async Task<bool> PayeeValid(ShortStayCollectionApplication app, CancellationToken ct)
    {
        var reviews = await db.StripeConnectedPayeeReviews.AsNoTracking().Where(r =>
            r.StripeAccountId == app.StripeAccountId || r.UserId == app.ApplicantUserId).Take(2).ToListAsync(ct);
        if (reviews.Count != 1) return false;
        var r = reviews[0];
        var now = DateTimeOffset.UtcNow;
        return r.UserId == app.ApplicantUserId && r.StripeAccountId == app.StripeAccountId &&
            r.ApprovedOrganizationId == app.OrganizationId && r.Status == StripePayeeReviewStatus.PayoutApproved &&
            r.ApprovedAt is not null && r.LastStripeSnapshotAt is { } snapshot &&
            snapshot >= now.AddMinutes(-5) && snapshot <= now.AddMinutes(1) &&
            r.StripeDetailsSubmitted && r.StripePayoutsEnabled && r.StripeTransfersActive &&
            string.Equals(r.StripeTransferCapabilityStatus, "active", StringComparison.OrdinalIgnoreCase) &&
            r.CurrentlyDueRequirementCount == 0 && r.PastDueRequirementCount == 0 &&
            string.IsNullOrWhiteSpace(r.StripeDisabledReason) && !string.IsNullOrWhiteSpace(r.ExternalAccountFingerprint) &&
            string.Equals(r.PayoutSchedulePolicy, "manual", StringComparison.OrdinalIgnoreCase) && !r.InstantPayoutsAllowed;
    }
    private async Task<ServiceResponse<AdminShortStayCollectionItem>> Mutate(long id, string action, string? input, CancellationToken ct)
    {
        var actor = Actor;
        if (actor == 0 || id <= 0) return Error<AdminShortStayCollectionItem>("Forbidden", 403);
        if (action == "approve" && (input is null || !Reference.IsMatch(input)) ||
            action is "reject" or "suspend" && input is not null && !ReasonCodes.Contains(input))
            return Error<AdminShortStayCollectionItem>("Invalid review reference or reason code", 400);
        var policy = action is "review" or "approve" ? ShortStayCollectionPolicy.Available(configuration) : null;
        if ((action is "review" or "approve") && policy is null)
            return Error<AdminShortStayCollectionItem>("Fee policy unavailable", 503);
        try
        {
            if (!await ActiveAdmin(actor, ct)) return Error<AdminShortStayCollectionItem>("Forbidden", 403);
            var initial = await db.ShortStayCollectionApplications.AsNoTracking().SingleOrDefaultAsync(a => a.Id == id, ct);
            if (initial is null) return Error<AdminShortStayCollectionItem>("Application unavailable", 404);
            if (initial.ApplicantUserId == actor) return Error<AdminShortStayCollectionItem>("Forbidden", 403);
            ShortStayIdentitySession? provider = null;
            var requireIdentity = RequireIdentity;
            if (action == "approve")
            {
                if (requireIdentity && !IdentityEnabled) return Error<AdminShortStayCollectionItem>("Identity unavailable", 503);
                if (ShortStayCollectionPolicy.Available(configuration) != policy) return Error<AdminShortStayCollectionItem>("Fee policy unavailable", 503);
                if (initial.Status != ShortStayCollectionApplicationStatus.UnderReview ||
                    requireIdentity && (initial.IdentityVerifiedAt is null || string.IsNullOrWhiteSpace(initial.IdentityVerificationSessionId)))
                    return Error<AdminShortStayCollectionItem>("Application not review-ready", 409);
                if (requireIdentity)
                {
                    // Network I/O must never hold SQL locks. Bind response to the saved session after acquiring locks.
                    provider = await identityGateway!.GetAsync(initial.IdentityVerificationSessionId!, ct);
                    if (provider.SessionId != initial.IdentityVerificationSessionId || provider.Status != "verified")
                        return Error<AdminShortStayCollectionItem>("Identity not verified", 409);
                }
            }
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var app = await db.ShortStayCollectionApplications.Include(a => a.Properties).SingleOrDefaultAsync(a => a.Id == id, ct);
            if (app is null) return Error<AdminShortStayCollectionItem>("Application unavailable", 404);
            await LockScope(app, actor, ct);
            // Re-read after locks; EF tracking may otherwise return a stale entity.
            db.Entry(app).State = EntityState.Detached;
            app = await db.ShortStayCollectionApplications.Include(a => a.Properties).SingleAsync(a => a.Id == id, ct);
            if (!await ActiveAdmin(actor, ct) || app.ApplicantUserId == actor) return Error<AdminShortStayCollectionItem>("Forbidden", 403);
            if ((action is "review" or "approve") && ShortStayCollectionPolicy.Available(configuration) != policy)
                return Error<AdminShortStayCollectionItem>("Fee policy unavailable", 503);
            if (action == "approve" && (RequireIdentity != requireIdentity || app.RowVersion != initial.RowVersion ||
                requireIdentity && (app.IdentityVerificationSessionId != provider!.SessionId || app.IdentityVerifiedAt is null)))
                return Error<AdminShortStayCollectionItem>("Application changed", 409);
            var now = DateTimeOffset.UtcNow;
            if (action is "review" or "approve" && !await ScopeValid(app, ct))
            {
                if (app.Status is ShortStayCollectionApplicationStatus.Submitted or ShortStayCollectionApplicationStatus.IdentityPending or
                    ShortStayCollectionApplicationStatus.IdentityVerified or ShortStayCollectionApplicationStatus.UnderReview)
                {
                    app.Status = ShortStayCollectionApplicationStatus.Suspended;
                    app.SuspendedAt = now; app.SuspendedByUserId = actor; app.IdentityVerifiedAt = null;
                    app.UpdatedAt = now; app.RowVersion++;
                    await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
                }
                return Error<AdminShortStayCollectionItem>("Application scope changed", 409);
            }
            switch (action)
            {
                case "review" when app.Status == ShortStayCollectionApplicationStatus.IdentityVerified ||
                    !RequireIdentity && app.Status == ShortStayCollectionApplicationStatus.Submitted:
                    app.Status = ShortStayCollectionApplicationStatus.UnderReview; break;
                case "approve" when app.Status == ShortStayCollectionApplicationStatus.UnderReview:
                    if (!await PayeeValid(app, ct)) return Error<AdminShortStayCollectionItem>("Payee not eligible", 409);
                    app.Status = ShortStayCollectionApplicationStatus.PayoutApproved;
                    app.ApprovedAt = now; app.ApprovedByUserId = actor; app.ApprovalCaseReference = input;
                    app.PropertyAuthorityConfirmedAt = now; break;
                case "suspend" when app.Status is ShortStayCollectionApplicationStatus.Submitted or ShortStayCollectionApplicationStatus.IdentityPending or
                    ShortStayCollectionApplicationStatus.IdentityVerified or ShortStayCollectionApplicationStatus.UnderReview or ShortStayCollectionApplicationStatus.PayoutApproved:
                    app.Status = ShortStayCollectionApplicationStatus.Suspended;
                    app.SuspendedAt = now; app.SuspendedByUserId = actor; app.IdentityVerifiedAt = null; break;
                case "reject" when app.Status is ShortStayCollectionApplicationStatus.Submitted or ShortStayCollectionApplicationStatus.IdentityPending or
                    ShortStayCollectionApplicationStatus.IdentityVerified or ShortStayCollectionApplicationStatus.UnderReview or ShortStayCollectionApplicationStatus.Suspended:
                    app.Status = ShortStayCollectionApplicationStatus.Rejected;
                    app.IdentityVerifiedAt = null; break;
                default: return Error<AdminShortStayCollectionItem>("Invalid review transition", 409);
            }
            app.UpdatedAt = now; app.RowVersion++;
            await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
            return ServiceResponse<AdminShortStayCollectionItem>.CreateSuccess(Map(app));
        }
        catch (OperationCanceledException) { throw; }
        catch (DbUpdateConcurrencyException) { return Error<AdminShortStayCollectionItem>("Application changed", 409); }
        catch (DbUpdateException) { return Error<AdminShortStayCollectionItem>("Application conflict", 409); }
        catch (Exception ex) { logger.LogWarning("Collection review unavailable: {Type}", ex.GetType().Name); return Error<AdminShortStayCollectionItem>("Unavailable", 503); }
    }
}
