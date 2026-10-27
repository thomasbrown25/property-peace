using System.Data;
using System.Security.Claims;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.ShortStay;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.ShortStay;

public sealed class ShortStayCollectionService(DataContext db, IHttpContextAccessor context,
    IConfiguration configuration, ILogger<ShortStayCollectionService> logger,
    IStripeShortStayIdentityGateway? identityGateway = null)
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
            m.IsActive && m.CanManageProperties && m.Organization.IsActive && !m.Organization.IsDeleted &&
            (m.Role == "Owner" || m.Role == "Manager"), ct);

    // Lock the organization first, then the applicant membership (same order in both mutations).
    // HOLDLOCK also protects the absent membership key range; never authorize using the preflight
    // result alone. SQLite tests exercise the transactional recheck, not SQL Server lock semantics.
    private async Task<bool> CanManageForMutation((long Org, long User) scope, CancellationToken ct)
    {
        if (db.Database.IsSqlServer())
        {
            await db.Database.SqlQueryRaw<long>(
                "SELECT Id AS Value FROM [organization].[Organizations] WITH (UPDLOCK, HOLDLOCK) WHERE Id = {0}", scope.Org)
                .ToListAsync(ct);
            await db.Database.SqlQueryRaw<long>(
                "SELECT Id AS Value FROM [organization].[OrganizationMembers] WITH (UPDLOCK, HOLDLOCK) WHERE OrganizationId = {0} AND UserId = {1} ORDER BY Id", scope.Org, scope.User)
                .ToListAsync(ct);
        }
        return await CanManage(scope, ct);
    }

    private static ShortStayCollectionStatusDto Map(ShortStayCollectionApplication app) => new(
        app.Id, app.Status, app.Properties.Select(x => x.PropertyId).Order().ToArray(), app.RowVersion,
        app.AuthorityAttestedAt.HasValue, app.FeePolicyConsentVersion, app.SubmittedAt,
        app.Status == ShortStayCollectionApplicationStatus.Draft ? ["submit"] : ["await_review"]);

    private async Task<string?> Account(long userId, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().Where(x => x.Id == userId && !x.IsDeleted && !x.IsSuspended)
            .Select(x => new { x.StripeAccountId }).SingleOrDefaultAsync(ct);
        var account = user?.StripeAccountId;
        if (string.IsNullOrWhiteSpace(account) || account != account.Trim()) return null;
        // The account must be uniquely and explicitly assigned to this applicant, never a legacy
        // null-UserId review, nor a review tied to another person or another account.
        var reviews = await db.StripeConnectedPayeeReviews.AsNoTracking()
            .Where(x => x.StripeAccountId == account || x.UserId == userId)
            .Select(x => new { x.StripeAccountId, x.UserId }).Take(2).ToListAsync(ct);
        return reviews.Count == 1 && reviews[0].UserId == userId && reviews[0].StripeAccountId == account ? account : null;
    }

    private async Task<bool> ValidProperties(long[] ids, long org, CancellationToken ct) =>
        await db.Properties.AsNoTracking().CountAsync(p => ids.Contains(p.Id) && p.OrganizationId == org &&
            !p.IsDeleted && p.Units.Any(u => u.RentalMode == ERentalMode.ShortTerm &&
                (u.OrganizationId == null || u.OrganizationId == org)), ct) == ids.Length;


    public async Task<ServiceResponse<ShortStayCollectionRequirementsDto>> GetRequirements(CancellationToken ct = default)
    {
        if (Scope() is not { } scope) return Error<ShortStayCollectionRequirementsDto>("Forbidden", 403);
        try
        {
            if (!await CanManage(scope, ct)) return Error<ShortStayCollectionRequirementsDto>("Forbidden", 403);
            var policy = ShortStayCollectionPolicy.Available(configuration);
            var identityEnabled = string.Equals(configuration["Stripe:IdentityEnabled"], "true", StringComparison.OrdinalIgnoreCase);
            if (policy is null)
                return ServiceResponse<ShortStayCollectionRequirementsDto>.CreateSuccess(
                    new(false, null, null, identityEnabled, "fee_policy_unavailable"));
            return ServiceResponse<ShortStayCollectionRequirementsDto>.CreateSuccess(
                new(true, policy.Value.Version, policy.Value.Url, identityEnabled, null));
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex) { logger.LogError(ex, "Short-stay collection requirements unavailable"); return Error<ShortStayCollectionRequirementsDto>("Unavailable", 503); }
    }

    public async Task<ServiceResponse<ShortStayCollectionStatusDto[]>> Get(CancellationToken ct = default)
    {
        if (Scope() is not { } scope) return Error<ShortStayCollectionStatusDto[]>("Forbidden", 403);
        try
        {
            if (!await CanManage(scope, ct)) return Error<ShortStayCollectionStatusDto[]>("Forbidden", 403);
            var apps = await db.ShortStayCollectionApplications.AsNoTracking().Include(x => x.Properties)
                .Where(x => x.OrganizationId == scope.Org && x.ApplicantUserId == scope.User)
                .OrderByDescending(x => x.Id).ToListAsync(ct);
            return ServiceResponse<ShortStayCollectionStatusDto[]>.CreateSuccess(apps.Select(Map).ToArray());
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex) { logger.LogError(ex, "Short-stay collection read unavailable"); return Error<ShortStayCollectionStatusDto[]>("Unavailable", 503); }
    }

    public async Task<ServiceResponse<ShortStayCollectionStatusDto>> Put(SaveShortStayCollectionDraftDto? request, CancellationToken ct = default)
    {
        if (Scope() is not { } scope) return Error<ShortStayCollectionStatusDto>("Forbidden", 403);
        var policy = ShortStayCollectionPolicy.Available(configuration);
        if (policy is null) return Error<ShortStayCollectionStatusDto>("Fee policy unavailable", 503);
        var ids = request?.PropertyIds;
        if (ids is null || ids.Length is < 1 or > 50 || ids.Any(x => x <= 0) || ids.Distinct().Count() != ids.Length ||
            request!.AuthorityAttested != true || request.FeePolicyConsentVersion != policy.Value.Version)
            return Error<ShortStayCollectionStatusDto>("Invalid application draft", 400);
        try
        {
            if (!await CanManage(scope, ct)) return Error<ShortStayCollectionStatusDto>("Forbidden", 403);
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            if (!await CanManageForMutation(scope, ct)) return Error<ShortStayCollectionStatusDto>("Forbidden", 403);
            if (ShortStayCollectionPolicy.Available(configuration) != policy) return Error<ShortStayCollectionStatusDto>("Fee policy unavailable", 503);
            var account = await Account(scope.User, ct);
            if (account is null) return Error<ShortStayCollectionStatusDto>("Connect account unavailable", 409);
            if (!await ValidProperties(ids, scope.Org, ct)) return Error<ShortStayCollectionStatusDto>("Invalid property scope", 409);
            var apps = await db.ShortStayCollectionApplications.Include(x => x.Properties)
                .Where(x => x.OrganizationId == scope.Org && x.ApplicantUserId == scope.User && x.Status != ShortStayCollectionApplicationStatus.Rejected)
                .Take(2).ToListAsync(ct);
            if (apps.Count > 1 || apps.Count == 1 && apps[0].Status != ShortStayCollectionApplicationStatus.Draft)
                return Error<ShortStayCollectionStatusDto>("Application already submitted", 409);
            var now = DateTimeOffset.UtcNow;
            var app = apps.SingleOrDefault();
            var created = app is null;
            if (app is null)
            {
                app = new ShortStayCollectionApplication { OrganizationId = scope.Org, ApplicantUserId = scope.User, CreatedAt = now };
                db.ShortStayCollectionApplications.Add(app);
            }
            else
            {
                // Never silently reassign a pending draft to a different Connect account.
                if (app.StripeAccountId != account) return Error<ShortStayCollectionStatusDto>("Connect account changed", 409);
                app.RowVersion++;
                foreach (var old in app.Properties.Where(p => !ids.Contains(p.PropertyId)).ToArray())
                {
                    app.Properties.Remove(old);
                    db.Remove(old);
                }
            }
            app.StripeAccountId = account;
            foreach (var id in ids.Where(id => !app.Properties.Any(p => p.PropertyId == id)))
                app.Properties.Add(new ShortStayCollectionApplicationProperty { PropertyId = id });
            app.AuthorityAttestedAt = now;
            app.FeePolicyConsentVersion = policy.Value.Version;
            app.UpdatedAt = now;
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return ServiceResponse<ShortStayCollectionStatusDto>.CreateSuccess(Map(app), statusCode: created ? 201 : 200);
        }
        catch (OperationCanceledException) { throw; }
        catch (DbUpdateConcurrencyException) { return Error<ShortStayCollectionStatusDto>("Application changed", 409); }
        catch (DbUpdateException) { return Error<ShortStayCollectionStatusDto>("Application conflict", 409); }
        catch (Exception ex) { logger.LogError(ex, "Short-stay collection draft unavailable"); return Error<ShortStayCollectionStatusDto>("Unavailable", 503); }
    }

    public async Task<ServiceResponse<ShortStayCollectionStatusDto>> Submit(CancellationToken ct = default)
    {
        if (Scope() is not { } scope) return Error<ShortStayCollectionStatusDto>("Forbidden", 403);
        var policy = ShortStayCollectionPolicy.Available(configuration);
        if (policy is null) return Error<ShortStayCollectionStatusDto>("Fee policy unavailable", 503);
        try
        {
            if (!await CanManage(scope, ct)) return Error<ShortStayCollectionStatusDto>("Forbidden", 403);
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            if (!await CanManageForMutation(scope, ct)) return Error<ShortStayCollectionStatusDto>("Forbidden", 403);
            if (ShortStayCollectionPolicy.Available(configuration) != policy) return Error<ShortStayCollectionStatusDto>("Fee policy unavailable", 503);
            var apps = await db.ShortStayCollectionApplications.Include(x => x.Properties)
                .Where(x => x.OrganizationId == scope.Org && x.ApplicantUserId == scope.User && x.Status != ShortStayCollectionApplicationStatus.Rejected)
                .Take(2).ToListAsync(ct);
            if (apps.Count != 1 || apps[0].Status != ShortStayCollectionApplicationStatus.Draft)
                return Error<ShortStayCollectionStatusDto>("No submit-ready draft", 409);
            var app = apps[0];
            var ids = app.Properties.Select(x => x.PropertyId).ToArray();
            if (ids.Length is < 1 or > 50 || ids.Distinct().Count() != ids.Length ||
                app.AuthorityAttestedAt is null || app.FeePolicyConsentVersion != policy.Value.Version ||
                app.StripeAccountId != await Account(scope.User, ct) ||
                !await ValidProperties(ids, scope.Org, ct))
                return Error<ShortStayCollectionStatusDto>("Draft requires review", 409);
            app.Status = ShortStayCollectionApplicationStatus.Submitted;
            app.SubmittedAt = DateTimeOffset.UtcNow;
            app.UpdatedAt = app.SubmittedAt.Value;
            app.RowVersion++;
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return ServiceResponse<ShortStayCollectionStatusDto>.CreateSuccess(Map(app));
        }
        catch (OperationCanceledException) { throw; }
        catch (DbUpdateConcurrencyException) { return Error<ShortStayCollectionStatusDto>("Application changed", 409); }
        catch (DbUpdateException) { return Error<ShortStayCollectionStatusDto>("Application conflict", 409); }
        catch (Exception ex) { logger.LogError(ex, "Short-stay collection submit unavailable"); return Error<ShortStayCollectionStatusDto>("Unavailable", 503); }
    }

    private bool IdentityEnabled => string.Equals(configuration["Stripe:IdentityEnabled"], "true", StringComparison.OrdinalIgnoreCase)
        && identityGateway is not null;

    private async Task<bool> ExactScope(ShortStayCollectionApplication app, (long Org, long User) scope, CancellationToken ct)
    {
        var policy = ShortStayCollectionPolicy.Available(configuration);
        var ids = app.Properties.Select(x => x.PropertyId).ToArray();
        return app.OrganizationId == scope.Org && app.ApplicantUserId == scope.User &&
            ids.Length is >= 1 and <= 50 && ids.Distinct().Count() == ids.Length &&
            policy is not null && app.FeePolicyConsentVersion == policy.Value.Version && app.AuthorityAttestedAt is not null &&
            app.SubmittedAt is not null && app.StripeAccountId == await Account(scope.User, ct) &&
            await ValidProperties(ids, scope.Org, ct);
    }

    public Task<ServiceResponse<ShortStayIdentityRedirectDto>> IdentitySession(long id, CancellationToken ct = default) =>
        Identity(id, false, ct);

    public Task<ServiceResponse<ShortStayIdentityRedirectDto>> IdentityRefresh(long id, CancellationToken ct = default) =>
        Identity(id, true, ct);

    private async Task<ServiceResponse<ShortStayIdentityRedirectDto>> Identity(long id, bool refresh, CancellationToken ct)
    {
        if (Scope() is not { } scope || id <= 0) return Error<ShortStayIdentityRedirectDto>("Forbidden", 403);
        var policy = ShortStayCollectionPolicy.Available(configuration);
        if (policy is null) return Error<ShortStayIdentityRedirectDto>("Fee policy unavailable", 503);
        if (!IdentityEnabled) return Error<ShortStayIdentityRedirectDto>("Identity unavailable", 503);
        try
        {
            if (!await CanManage(scope, ct))
            {
                // A revoked membership or inactive organization invalidates an existing binding.
                await using var revokedTx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
                if (!await CanManageForMutation(scope, ct))
                {
                    var revoked = await db.ShortStayCollectionApplications.SingleOrDefaultAsync(x => x.Id == id &&
                        x.OrganizationId == scope.Org && x.ApplicantUserId == scope.User, ct);
                    if (revoked?.IdentityVerificationSessionId is not null &&
                        revoked.Status is ShortStayCollectionApplicationStatus.IdentityPending or ShortStayCollectionApplicationStatus.IdentityVerified)
                    {
                        revoked.Status = ShortStayCollectionApplicationStatus.Suspended;
                        revoked.IdentityVerifiedAt = null;
                        revoked.SuspendedAt = DateTimeOffset.UtcNow;
                        revoked.UpdatedAt = revoked.SuspendedAt.Value;
                        revoked.RowVersion++;
                        await db.SaveChangesAsync(ct);
                        await revokedTx.CommitAsync(ct);
                    }
                }
                return Error<ShortStayIdentityRedirectDto>("Forbidden", 403);
            }
            var initial = await db.ShortStayCollectionApplications.AsNoTracking().Include(x => x.Properties)
                .SingleOrDefaultAsync(x => x.Id == id && x.OrganizationId == scope.Org && x.ApplicantUserId == scope.User, ct);
            if (initial is null) return Error<ShortStayIdentityRedirectDto>("Application unavailable", 404);
            if (initial.Status is not (ShortStayCollectionApplicationStatus.Submitted or ShortStayCollectionApplicationStatus.IdentityPending) ||
                refresh && initial.IdentityVerificationSessionId is null)
                return Error<ShortStayIdentityRedirectDto>("Identity session unavailable", 409);

            // Stripe network calls stay outside the transaction. The stable application/version key
            // deduplicates concurrent creations and retries when persisting the binding fails.
            if (ShortStayCollectionPolicy.Available(configuration) != policy) return Error<ShortStayIdentityRedirectDto>("Fee policy unavailable", 503);
            ShortStayIdentitySession provider;
            if (initial.IdentityVerificationSessionId is { } sessionId)
                provider = await identityGateway!.GetAsync(sessionId, ct);
            else
            {
                if (refresh || !await ExactScope(initial, scope, ct))
                    return Error<ShortStayIdentityRedirectDto>("Application scope changed", 409);
                provider = await identityGateway!.CreateAsync(id.ToString(), scope.User.ToString(),
                    checked((int)initial.RowVersion), ct);
            }
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            if (!await CanManageForMutation(scope, ct)) return Error<ShortStayIdentityRedirectDto>("Forbidden", 403);
            if (ShortStayCollectionPolicy.Available(configuration) != policy) return Error<ShortStayIdentityRedirectDto>("Fee policy unavailable", 503);
            var app = await db.ShortStayCollectionApplications.Include(x => x.Properties)
                .SingleOrDefaultAsync(x => x.Id == id && x.OrganizationId == scope.Org && x.ApplicantUserId == scope.User, ct);
            if (app is null) return Error<ShortStayIdentityRedirectDto>("Application unavailable", 404);
            if (!await ExactScope(app, scope, ct))
            {
                if (app.IdentityVerificationSessionId is not null && app.Status is ShortStayCollectionApplicationStatus.IdentityPending or ShortStayCollectionApplicationStatus.IdentityVerified)
                {
                    app.Status = ShortStayCollectionApplicationStatus.Suspended;
                    app.IdentityVerifiedAt = null;
                    app.SuspendedAt = DateTimeOffset.UtcNow;
                    app.UpdatedAt = app.SuspendedAt.Value;
                    app.RowVersion++;
                    await db.SaveChangesAsync(ct);
                    await tx.CommitAsync(ct);
                }
                return Error<ShortStayIdentityRedirectDto>("Application scope changed", 409);
            }
            if (app.Status is not (ShortStayCollectionApplicationStatus.Submitted or ShortStayCollectionApplicationStatus.IdentityPending) ||
                refresh && app.IdentityVerificationSessionId is null)
                return Error<ShortStayIdentityRedirectDto>("Identity session unavailable", 409);
            if (app.IdentityVerificationSessionId is not null && app.IdentityVerificationSessionId != provider.SessionId ||
                app.IdentityVerificationSessionId is null && (initial.IdentityVerificationSessionId is not null || app.RowVersion != initial.RowVersion) ||
                string.IsNullOrWhiteSpace(provider.SessionId))
                return Error<ShortStayIdentityRedirectDto>("Application changed", 409);

            var now = DateTimeOffset.UtcNow;
            if (provider.Status is "canceled" or "expired")
            {
                app.Status = ShortStayCollectionApplicationStatus.Submitted;
                app.IdentityVerificationSessionId = null;
                app.IdentityVerifiedAt = null;
            }
            else if (provider.Status == "verified")
            {
                // The authoritative provider response can already be verified on creation.
                // Bind its session only after the transactional scope and version rechecks above.
                app.IdentityVerificationSessionId ??= provider.SessionId;
                app.Status = ShortStayCollectionApplicationStatus.IdentityVerified;
                app.IdentityVerifiedAt ??= now;
            }
            else if (provider.Status is "requires_input" or "processing")
            {
                app.IdentityVerificationSessionId ??= provider.SessionId;
                app.Status = ShortStayCollectionApplicationStatus.IdentityPending;
            }
            else return Error<ShortStayIdentityRedirectDto>("Identity session unavailable", 503);
            app.UpdatedAt = now;
            app.RowVersion++;
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return provider.Status == "requires_input" && !string.IsNullOrWhiteSpace(provider.HostedUrl) && !refresh
                ? ServiceResponse<ShortStayIdentityRedirectDto>.CreateSuccess(new(provider.HostedUrl))
                : ServiceResponse<ShortStayIdentityRedirectDto>.CreateSuccess(null!);
        }
        catch (OperationCanceledException) { throw; }
        catch (DbUpdateConcurrencyException) { return Error<ShortStayIdentityRedirectDto>("Application changed", 409); }
        catch (DbUpdateException) { return Error<ShortStayIdentityRedirectDto>("Application conflict", 409); }
        catch (Exception ex) { logger.LogWarning("Short-stay identity unavailable: {Type}", ex.GetType().Name); return Error<ShortStayIdentityRedirectDto>("Identity unavailable", 503); }
    }
}
