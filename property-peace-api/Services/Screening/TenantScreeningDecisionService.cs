using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using brownstone_hub_api.Data;
using brownstone_hub_api.Domain.Screening;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.Timelines;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Options;

namespace brownstone_hub_api.Services.Screening;

public sealed class TenantScreeningDecisionService : ITenantScreeningDecisionService
{
    // Provider-neutral persisted report facts are constrained to this explicit schema. Adding a
    // key or widening a value domain requires a new schema version and a deliberate code review.
    private const string NormalizedReportFactsSchemaVersion = "screening-report-facts-v1";
    private static readonly IReadOnlyDictionary<string, Func<string, bool>> NormalizedReportFactsV1 =
        new Dictionary<string, Func<string, bool>>(StringComparer.Ordinal)
        {
            ["riskBand"] = value => value is "low" or "medium" or "high" or "unknown",
            ["score"] = value => int.TryParse(value, System.Globalization.NumberStyles.None,
                System.Globalization.CultureInfo.InvariantCulture, out var score) && score is >= 0 and <= 999
        };

    private readonly DataContext _db;
    private readonly IScreeningProviderGateway _gateway;
    private readonly TimeProvider _clock;
    private readonly IScreeningSupportAuthorization _supportAuthorization;
    private readonly IScreeningPropertyAuthority _propertyAuthority;
    private readonly ScreeningHostedWorkerOptions _retry;
    private readonly IScreeningIncidentRecorder _incidentRecorder;
    private readonly IWorkflowTimelineIntegration? _workflowTimeline;
    public TenantScreeningDecisionService(DataContext db, IScreeningProviderGateway gateway, TimeProvider clock,
        IScreeningSupportAuthorization? supportAuthorization = null,
        IScreeningPropertyAuthority? propertyAuthority = null,
        IOptions<ScreeningHostedWorkerOptions>? retryOptions = null,
        IScreeningIncidentRecorder? incidentRecorder = null,
        IWorkflowTimelineIntegration? workflowTimeline = null)
    {
        _db = db ?? throw new ArgumentNullException(nameof(db));
        _gateway = gateway ?? throw new ArgumentNullException(nameof(gateway));
        _clock = clock ?? throw new ArgumentNullException(nameof(clock));
        _supportAuthorization = supportAuthorization ?? new DenyAllScreeningSupportAuthorization();
        _propertyAuthority = propertyAuthority ?? new ScreeningPropertyAuthority(db);
        _retry = retryOptions?.Value ?? new ScreeningHostedWorkerOptions();
        _incidentRecorder = incidentRecorder ?? new ScreeningIncidentRecorder(db, clock);
        _workflowTimeline = workflowTimeline;
    }

    public async Task<ScreeningReportRevision> RecordReportRevisionAsync(RecordScreeningReportRevisionCommand command, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command);
        Text(command.ProviderKey, 100); Text(command.ProviderOrderId, 200); Text(command.ProviderReportReference, 200); Text(command.ReportVersion, 100);
        if (!Enum.IsDefined(command.Status)) throw new ArgumentOutOfRangeException(nameof(command.Status));
        if (command.Status == ScreeningReportStatus.Corrected != command.SupersedesScreeningReportRevisionId.HasValue)
            throw new ArgumentException("Corrected reports must identify the revision they supersede, and other reports may not.");
        if (command.RetentionPeriod < TimeSpan.FromDays(1) || command.RetentionPeriod > TimeSpan.FromDays(3650))
            throw new ArgumentOutOfRangeException(nameof(command.RetentionPeriod));
        if (!Enum.IsDefined(command.RetentionSignal)) throw new ArgumentOutOfRangeException(nameof(command.RetentionSignal));
        var now = _clock.GetUtcNow();
        ScreeningContractValidation.ValidateCallbackTime(command.RetrievedAt, now, nameof(command.RetrievedAt));
        ScreeningContractValidation.ValidateCallbackTime(command.ProviderOccurredAt, command.RetrievedAt, nameof(command.ProviderOccurredAt));
        var facts = NormalizeReportFacts(command.NormalizedFacts, nameof(command.NormalizedFacts));
        var json = JsonSerializer.Serialize(facts);
        if (json.Length > 4000) throw new ArgumentException("Normalized facts exceed the bounded evidence size.", nameof(command.NormalizedFacts));

        var order = await _db.TenantScreeningOrders.SingleOrDefaultAsync(x => x.ProviderKey == command.ProviderKey && x.ProviderOrderId == command.ProviderOrderId, cancellationToken)
            ?? throw new ScreeningProviderCorrelationException();
        var duplicate = await _db.ScreeningReportRevisions.SingleOrDefaultAsync(x => x.ProviderKey == command.ProviderKey && x.ProviderReportReference == command.ProviderReportReference, cancellationToken);
        if (duplicate is not null)
        {
            if (duplicate.TenantScreeningOrderId != order.Id || duplicate.ReportVersion != command.ReportVersion ||
                duplicate.NormalizedFactsSha256Hash != HashRaw(json) || duplicate.ProviderOccurredAt != command.ProviderOccurredAt ||
                duplicate.ReceivedAt != command.RetrievedAt || duplicate.RetentionSignal != command.RetentionSignal)
                throw new ScreeningProviderCorrelationException();
            return duplicate;
        }
        ScreeningReportRevision? superseded = null;
        if (command.SupersedesScreeningReportRevisionId.HasValue)
        {
            superseded = await _db.ScreeningReportRevisions.SingleOrDefaultAsync(x => x.Id == command.SupersedesScreeningReportRevisionId && x.TenantScreeningOrderId == order.Id, cancellationToken)
                ?? throw new ScreeningProviderCorrelationException();
            if (superseded.Status == ScreeningReportStatus.Superseded) throw new InvalidOperationException("A report revision may be superseded only once.");
        }
        var revision = new ScreeningReportRevision
        {
            TenantScreeningOrderId = order.Id, OrganizationId = order.OrganizationId,
            Revision = await NextReportRevision(order.Id, cancellationToken), ProviderKey = command.ProviderKey,
            ProviderReportReference = command.ProviderReportReference, ReceivedAt = command.RetrievedAt, ProviderOccurredAt = command.ProviderOccurredAt,
            CorrectedAt = command.Status == ScreeningReportStatus.Corrected ? command.ProviderOccurredAt : null, Status = command.Status,
            ReportVersion = command.ReportVersion, NormalizedFactsJson = json, NormalizedFactsSha256Hash = HashRaw(json),
            SupersedesScreeningReportRevisionId = superseded?.Id, RetentionExpiresAt = command.RetrievedAt.Add(command.RetentionPeriod),
            RetentionSignal = command.RetentionSignal
        };
        await InTransactionAsync(async () =>
        {
            // The superseded revision remains byte-for-byte historical evidence; correction is expressed
            // only by the new revision's immutable SupersedesScreeningReportRevisionId linkage.
            _db.ScreeningReportRevisions.Add(revision);
            if (order.Status == ScreeningStatus.Processing && command.Status is ScreeningReportStatus.Complete or ScreeningReportStatus.Corrected)
                ApplyTransition(order, ScreeningStatus.Complete, command.ProviderOccurredAt, ScreeningTransitionSource.ProviderWebhook, "ReportReceived", null);
            await _db.SaveChangesAsync(cancellationToken);
        }, cancellationToken);
        if (_workflowTimeline is not null)
            await _workflowTimeline.RecordScreeningTransitionAsync(order.OrganizationId, order.RentalApplicationId,
                order.Id, null, order.Status.ToString().ToLowerInvariant(),
                $"Screening report {command.Status}", $"screening:{order.Id}:report:{revision.Revision}", cancellationToken);
        return revision;
    }

    public async Task<ScreeningReportAccessResult> RequestReportAccessAsync(long organizationId, long actorUserId, long orderId,
        ScreeningReportAccessPurpose purpose, long? elevationId = null, CancellationToken cancellationToken = default)
    {
        ValidateIds(organizationId, actorUserId, orderId);
        if (!Enum.IsDefined(purpose)) throw new ArgumentOutOfRangeException(nameof(purpose));
        var order = await _db.TenantScreeningOrders.SingleOrDefaultAsync(x => x.Id == orderId && x.OrganizationId == organizationId, cancellationToken);
        var directMember = false;
        try
        {
            await _propertyAuthority.EnsureOrganizationCapabilityAsync(organizationId, actorUserId, cancellationToken);
            if (order is not null)
            {
                await _propertyAuthority.EnsurePropertyAuthorityAsync(organizationId, actorUserId, order.PropertyId, cancellationToken);
                directMember = true;
            }
        }
        catch (ScreeningAuthorizationException) { }
        ScreeningSupportElevation? elevation = null;
        var now = _clock.GetUtcNow();
        if (purpose == ScreeningReportAccessPurpose.SupportInvestigation || !directMember || elevationId.HasValue)
        {
            if (!elevationId.HasValue || !await _supportAuthorization.IsPlatformSupportActorAsync(actorUserId, cancellationToken))
                throw new ScreeningAuthorizationException();
            elevation = await _db.ScreeningSupportElevations.SingleOrDefaultAsync(x => x.Id == elevationId.Value, cancellationToken);
            if (elevation is null || elevation.OrganizationId != organizationId || elevation.SubjectUserId != actorUserId ||
                elevation.Purpose != purpose || !elevation.IsActive(now))
                throw new ScreeningAuthorizationException();
        }

        if (order is null)
        {
            // Only a capable organization actor (or a valid support elevation) may distinguish a
            // missing resource from one outside their scope.
            if (!directMember && elevation is null) throw new ScreeningAuthorizationException();
            throw new ScreeningResourceNotFoundException("screening order");
        }
        if (!directMember && elevation is null) throw new ScreeningAuthorizationException();
        return await RequestReportAccessCoreAsync(order, actorUserId, purpose, elevation, cancellationToken);
    }

    public async Task<ScreeningReportAccessResult> RequestApplicantReportAccessAsync(string rawToken,
        ScreeningReportAccessPurpose purpose, CancellationToken cancellationToken = default)
    {
        Text(rawToken, 500);
        if (purpose != ScreeningReportAccessPurpose.DisputeReview)
            throw new ScreeningReportAccessDeniedException();
        var tokenHash = HashScoped("property-peace-applicant-invitation-v1", rawToken);
        var order = await _db.TenantScreeningOrders.SingleOrDefaultAsync(
            x => x.ApplicantAccessTokenHash == tokenHash, cancellationToken)
            ?? throw new ScreeningInvalidInvitationException();
        var now = _clock.GetUtcNow();
        if (order.ApplicantAccessExpiresAt is null || order.ApplicantAccessExpiresAt <= now)
            throw new ScreeningAccessExpiredException();
        return await RequestReportAccessCoreAsync(order, null, purpose, null, cancellationToken);
    }

    private async Task<ScreeningReportAccessResult> RequestReportAccessCoreAsync(TenantScreeningOrder order,
        long? actorUserId, ScreeningReportAccessPurpose purpose, ScreeningSupportElevation? elevation,
        CancellationToken cancellationToken)
    {
        var now = _clock.GetUtcNow();
        if (order.Status is not (ScreeningStatus.Complete or ScreeningStatus.Disputed) || order.ProviderOrderId is null)
            throw new ScreeningInvalidStateException();
        var report = await _db.ScreeningReportRevisions.Where(x => x.TenantScreeningOrderId == order.Id)
            .OrderByDescending(x => x.Revision).FirstOrDefaultAsync(cancellationToken)
            ?? throw new ScreeningResourceNotFoundException("screening report");

        var sequence = checked((await _db.ScreeningReportAccessAudits.Where(x => x.TenantScreeningOrderId == order.Id)
            .MaxAsync(x => (long?)x.AttemptSequence, cancellationToken) ?? 0) + 1);
        var attempt = new ScreeningReportAccessAudit
        {
            TenantScreeningOrderId = order.Id, OrganizationId = order.OrganizationId, ActorUserId = actorUserId,
            ScreeningReportRevisionId = report.Id, AttemptSequence = sequence, Purpose = purpose,
            RequestedAt = now, ScreeningSupportElevationId = elevation?.Id
        };

        var hasOpenDispute = await _db.ScreeningDisputes.AnyAsync(x => x.TenantScreeningOrderId == order.Id &&
            x.Status != ScreeningDisputeStatus.Resolved && x.Status != ScreeningDisputeStatus.Rejected, cancellationToken);
        var denied = report.DeletedAt.HasValue || (hasOpenDispute && purpose != ScreeningReportAccessPurpose.DisputeReview);
        if (denied) attempt.MarkDenied(report.DeletedAt.HasValue ? "ReportDeleted" : "PurposeNotAllowedDuringDispute", now);
        else elevation?.Consume();

        _db.ScreeningReportAccessAudits.Add(attempt);
        try { await _db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException) { throw new ScreeningAuthorizationException(); }
        if (denied) throw new ScreeningReportAccessDeniedException();

        ScreeningReportAccessResult grant;
        try
        {
            // This provider boundary is reachable only after the Requested attempt (and elevation consumption) committed.
            grant = await _gateway.GetReportAccessAsync(new ScreeningReportAccessRequest(order.OrganizationId,
                order.RentalApplicationId, order.Id, order.ProviderOrderId, purpose.ToString(), AccessKey(attempt)), cancellationToken);
            if (grant.ExpiresAt <= now || grant.ExpiresAt > now.AddMinutes(15))
                throw new InvalidOperationException("Invalid provider grant lifetime.");
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            await PreserveFailureAsync(attempt.Id, "ProviderAccessFailed");
            throw new ScreeningReportAccessException(exception);
        }

        try
        {
            attempt.MarkGranted(grant.GrantReference, grant.ExpiresAt, _clock.GetUtcNow());
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            await PreserveFailureAsync(attempt.Id, "GrantPersistenceFailed");
            throw new ScreeningReportAccessException(exception);
        }
        return grant;
    }

    private async Task PreserveFailureAsync(long attemptId, string code)
    {
        // Prefer the request context: the Requested row was already committed before provider access,
        // so a normal provider failure can be finalized without opening a second unit of work.
        var tracked = _db.ScreeningReportAccessAudits.Local.FirstOrDefault(x => x.Id == attemptId);
        if (tracked is not null && tracked.Status == ScreeningReportAccessAttemptStatus.Requested)
        {
            try
            {
                tracked.MarkFailed(code, _clock.GetUtcNow());
                await _db.SaveChangesAsync(CancellationToken.None);
                return;
            }
            catch
            {
                _db.Entry(tracked).State = EntityState.Detached;
            }
        }

        try
        {
            // A clean context is the recovery path after a poisoned final SaveChanges. URI values
            // never enter this context; the committed Requested row remains a recovery marker if
            // even this bounded finalization fails.
            var options = _db.GetService<DbContextOptions<DataContext>>();
            await using var recovery = new DataContext(options);
            var durable = await recovery.ScreeningReportAccessAudits.SingleOrDefaultAsync(x => x.Id == attemptId);
            if (durable is null || durable.Status != ScreeningReportAccessAttemptStatus.Requested) return;
            durable.MarkFailed(code, _clock.GetUtcNow());
            await recovery.SaveChangesAsync(CancellationToken.None);
        }
        catch
        {
            // The already committed Requested row is itself the durable recovery marker.
        }
    }

    public async Task<int> RecoverStaleReportAccessAttemptsAsync(int batchSize, TimeSpan staleAge,
        CancellationToken cancellationToken = default)
    {
        if (batchSize is < 1 or > 500) throw new ArgumentOutOfRangeException(nameof(batchSize));
        if (staleAge < TimeSpan.FromMinutes(1) || staleAge > TimeSpan.FromDays(1))
            throw new ArgumentOutOfRangeException(nameof(staleAge));
        var cutoff = _clock.GetUtcNow() - staleAge;
        var ids = await _db.ScreeningReportAccessAudits.AsNoTracking()
            .Where(x => x.Status == ScreeningReportAccessAttemptStatus.Requested && x.RequestedAt <= cutoff)
            .OrderBy(x => x.RequestedAt).ThenBy(x => x.Id).Select(x => x.Id).Take(batchSize)
            .ToListAsync(cancellationToken);
        var recovered = 0;
        foreach (var id in ids)
        {
            cancellationToken.ThrowIfCancellationRequested();
            _db.ChangeTracker.Clear();
            var attempt = await _db.ScreeningReportAccessAudits.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
            if (attempt is null || attempt.Status != ScreeningReportAccessAttemptStatus.Requested) continue;
            var order = await _db.TenantScreeningOrders.AsNoTracking().SingleOrDefaultAsync(x =>
                x.Id == attempt.TenantScreeningOrderId && x.OrganizationId == attempt.OrganizationId, cancellationToken);
            if (order?.ProviderOrderId is null) continue;
            var request = new ScreeningReportAccessRecoveryRequest(order.OrganizationId, order.RentalApplicationId,
                order.Id, order.ProviderOrderId, AccessKey(attempt));
            ScreeningReportAccessGrantSnapshot snapshot;
            try { snapshot = await _gateway.IntrospectReportAccessAsync(request, cancellationToken); }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
            catch { continue; }

            var code = "RecoveredNoActiveGrant";
            if (snapshot.Status == ScreeningReportAccessGrantStatus.Active)
            {
                ScreeningProviderOperationResult revoked;
                try { revoked = await _gateway.RevokeReportAccessAsync(request, cancellationToken); }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
                catch { continue; }
                if (revoked.Status is not ("revoked" or "already_revoked" or "not_found")) continue;
                code = "RecoveredGrantRevoked";
            }
            else if (snapshot.Status is not (ScreeningReportAccessGrantStatus.NotFound or
                     ScreeningReportAccessGrantStatus.Expired or ScreeningReportAccessGrantStatus.Revoked)) continue;

            attempt.MarkFailed(code, _clock.GetUtcNow());
            try { await _db.SaveChangesAsync(cancellationToken); recovered++; }
            catch (DbUpdateConcurrencyException) { _db.ChangeTracker.Clear(); }
        }
        return recovered;
    }

    public async Task<ScreeningRentalDecisionRevision> RecordHumanDecisionAsync(RecordHumanScreeningDecisionCommand command, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command); ValidateIds(command.OrganizationId, command.ActorUserId, command.ScreeningOrderId);
        if (!Enum.IsDefined(command.Decision)) throw new ArgumentOutOfRangeException(nameof(command.Decision));
        Text(command.CriteriaVersion, 100);
        var reasons = NormalizeCodes(command.ReasonCodes, 20, 100, nameof(command.ReasonCodes));
        await _propertyAuthority.EnsureOrganizationCapabilityAsync(command.OrganizationId, command.ActorUserId,
            cancellationToken);
        var order = await _db.TenantScreeningOrders.SingleOrDefaultAsync(x => x.Id == command.ScreeningOrderId && x.OrganizationId == command.OrganizationId, cancellationToken)
            ?? throw new ScreeningResourceNotFoundException("screening order");
        await _propertyAuthority.EnsurePropertyAuthorityAsync(command.OrganizationId, command.ActorUserId, order.PropertyId, cancellationToken);
        if (order.Status != ScreeningStatus.Complete) throw new InvalidOperationException("Human decisions require a complete, undisputed order.");
        if (!string.Equals(order.RentalCriteriaVersion, command.CriteriaVersion, StringComparison.Ordinal)) throw new ScreeningPolicyViolationException("rental criteria version differs");
        if (await _db.ScreeningDisputes.AnyAsync(x => x.TenantScreeningOrderId == order.Id && x.Status != ScreeningDisputeStatus.Resolved && x.Status != ScreeningDisputeStatus.Rejected, cancellationToken))
            throw new InvalidOperationException("Open disputes freeze new rental decisions.");
        if (command.Decision is ScreeningRentalDecision.Denied or ScreeningRentalDecision.Conditional)
        {
            if (!command.ReliedUponScreeningReportRevisionId.HasValue)
                throw new ScreeningProviderCorrelationException();
            var report = await _db.ScreeningReportRevisions
                .Where(x => x.TenantScreeningOrderId == order.Id)
                .OrderByDescending(x => x.Revision)
                .FirstOrDefaultAsync(cancellationToken);
            if (report is null || report.Id != command.ReliedUponScreeningReportRevisionId.Value ||
                report.OrganizationId != order.OrganizationId || report.DeletedAt.HasValue ||
                report.Status is not (ScreeningReportStatus.Complete or ScreeningReportStatus.Corrected) ||
                await _db.ScreeningReportRevisions.AnyAsync(x =>
                    x.TenantScreeningOrderId == order.Id && x.SupersedesScreeningReportRevisionId == report.Id,
                    cancellationToken))
                throw new ScreeningProviderCorrelationException();
        }
        else if (command.ReliedUponScreeningReportRevisionId.HasValue &&
                 !await _db.ScreeningReportRevisions.AnyAsync(x =>
                     x.Id == command.ReliedUponScreeningReportRevisionId && x.TenantScreeningOrderId == order.Id,
                     cancellationToken))
            throw new ScreeningProviderCorrelationException();
        var prior = await _db.ScreeningRentalDecisionRevisions.Where(x => x.TenantScreeningOrderId == order.Id).OrderByDescending(x => x.Revision).FirstOrDefaultAsync(cancellationToken);
        var decision = new ScreeningRentalDecisionRevision
        {
            TenantScreeningOrderId = order.Id, OrganizationId = order.OrganizationId, RentalApplicationId = order.RentalApplicationId,
            Revision = checked((prior?.Revision ?? 0) + 1), DecisionActorUserId = command.ActorUserId, Decision = command.Decision,
            CriteriaVersion = order.RentalCriteriaVersion, CriteriaSnapshotSha256Hash = HashScoped($"screening-criteria-v1\n{order.OrganizationId}\n{order.Id}", order.RentalCriteriaStatement),
            ReliedUponScreeningReportRevisionId = command.ReliedUponScreeningReportRevisionId, ReasonCodesJson = JsonSerializer.Serialize(reasons),
            CreatedAt = _clock.GetUtcNow(), SupersedesScreeningRentalDecisionRevisionId = prior?.Id,
            IsFrozenByDispute = false, DisputeStatus = ScreeningDecisionDisputeStatus.None
        };
        _db.ScreeningRentalDecisionRevisions.Add(decision); await _db.SaveChangesAsync(cancellationToken);
        if (_workflowTimeline is not null)
            await _workflowTimeline.RecordScreeningTransitionAsync(order.OrganizationId, order.RentalApplicationId,
                order.Id, command.ActorUserId, $"decision-{command.Decision.ToString().ToLowerInvariant()}",
                $"Screening decision recorded: {command.Decision}", $"screening:{order.Id}:decision:{decision.Revision}", cancellationToken);
        return decision;
    }

    public async Task<ScreeningDispute> OpenDisputeAsync(ScreeningDisputeOpenCommand command, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command);
        var issues = NormalizeCodes(command.IssueCodes, 20, 100, nameof(command.IssueCodes));
        Text(command.Narrative, 4000);
        TenantScreeningOrder order;
        ScreeningDisputeActorType actorType;
        if (command.ApplicantToken is not null)
        {
            Text(command.ApplicantToken, 500);
            var tokenHash = HashScoped("property-peace-applicant-invitation-v1", command.ApplicantToken);
            order = await _db.TenantScreeningOrders.SingleOrDefaultAsync(x => x.ApplicantAccessTokenHash == tokenHash, cancellationToken)
                ?? throw new ScreeningInvalidInvitationException();
            if (order.ApplicantAccessTokenExpiresAt <= _clock.GetUtcNow()) throw new ScreeningInvitationExpiredException();
            actorType = ScreeningDisputeActorType.Applicant;
        }
        else
        {
            if (!command.OrganizationId.HasValue || !command.ActorUserId.HasValue || !command.ScreeningOrderId.HasValue) throw new ArgumentException("Staff dispute context is incomplete.");
            await _propertyAuthority.EnsureOrganizationCapabilityAsync(command.OrganizationId.Value,
                command.ActorUserId.Value, cancellationToken);
            order = await _db.TenantScreeningOrders.SingleOrDefaultAsync(x => x.Id == command.ScreeningOrderId && x.OrganizationId == command.OrganizationId, cancellationToken)
                ?? throw new ScreeningResourceNotFoundException("screening order");
            await _propertyAuthority.EnsurePropertyAuthorityAsync(command.OrganizationId.Value, command.ActorUserId.Value,
                order.PropertyId, cancellationToken);
            actorType = ScreeningDisputeActorType.OrganizationUser;
        }
        var report = await _db.ScreeningReportRevisions.SingleOrDefaultAsync(x => x.Id == command.ReportRevisionId && x.TenantScreeningOrderId == order.Id, cancellationToken)
            ?? throw new ScreeningProviderCorrelationException();
        var existing = await _db.ScreeningDisputes.SingleOrDefaultAsync(x => x.TenantScreeningOrderId == order.Id && x.OriginalScreeningReportRevisionId == report.Id && x.Status != ScreeningDisputeStatus.Resolved && x.Status != ScreeningDisputeStatus.Rejected, cancellationToken);
        if (existing is not null) return existing;
        if (order.Status != ScreeningStatus.Complete || order.ProviderOrderId is null) throw new InvalidOperationException("Only complete reports may be disputed.");

        var intent = await _db.ScreeningDisputeIntents.SingleOrDefaultAsync(x =>
            x.TenantScreeningOrderId == order.Id && x.ScreeningReportRevisionId == report.Id, cancellationToken);
        if (intent is null)
        {
            var now = _clock.GetUtcNow();
            var operationId = DeterministicGuid($"screening-dispute-v1\n{order.ProviderKey}\n{order.Id}\n{report.Id}");
            // Revoke an observed deletion lease and then commit the report fence and outbox together.
            // Both the deletion claim and pending-dispute marker are concurrency tokens, so a claim or
            // provider-start update racing this save makes one side fail before either external call.
            await TenantScreeningRetentionService.RevokeForDisputeAsync(_db, report, now, cancellationToken);
            report.PendingDisputeOperationId = operationId;
            intent = new ScreeningDisputeIntent
            {
                OperationId = operationId, TenantScreeningOrderId = order.Id, OrganizationId = order.OrganizationId,
                RentalApplicationId = order.RentalApplicationId, ScreeningReportRevisionId = report.Id,
                ProviderKey = order.ProviderKey, ProviderOrderId = order.ProviderOrderId,
                ProviderReportReference = report.ProviderReportReference, ActorType = actorType,
                ActorUserId = command.ActorUserId, IssueCodesJson = JsonSerializer.Serialize(issues),
                NotesSha256Hash = HashScoped($"screening-dispute-notes-v1\n{order.OrganizationId}\n{order.Id}", command.Narrative),
                RetentionExpiresAt = report.RetentionExpiresAt, CreatedAt = now
            };
            _db.ScreeningDisputeIntents.Add(intent);
            try
            {
                await _db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                _db.ChangeTracker.Clear();
                throw new ScreeningDeletionSafetyConflictException();
            }
            catch (DbUpdateException)
            {
                _db.Entry(intent).State = EntityState.Detached;
                intent = await _db.ScreeningDisputeIntents.SingleOrDefaultAsync(x =>
                    x.TenantScreeningOrderId == order.Id && x.ScreeningReportRevisionId == report.Id, cancellationToken);
                if (intent is null) throw;
            }
        }

        return await ExecuteDisputeIntentAsync(intent.Id, TimeSpan.FromMinutes(2), cancellationToken)
            ?? throw new InvalidOperationException("The dispute intent is already being processed.");
    }

    public async Task<int> ProcessPendingDisputeIntentsAsync(int batchSize, TimeSpan leaseDuration,
        CancellationToken cancellationToken = default)
    {
        if (batchSize is < 1 or > 500) throw new ArgumentOutOfRangeException(nameof(batchSize));
        if (leaseDuration < TimeSpan.FromSeconds(1) || leaseDuration > TimeSpan.FromHours(1))
            throw new ArgumentOutOfRangeException(nameof(leaseDuration));
        var now = _clock.GetUtcNow();
        var ids = await _db.ScreeningDisputeIntents.AsNoTracking()
            .Where(x => (x.Status == ScreeningDisputeIntentStatus.Pending &&
                         (x.NextAttemptAt == null || x.NextAttemptAt <= now)) ||
                        x.Status == ScreeningDisputeIntentStatus.ProviderAccepted ||
                        (x.Status == ScreeningDisputeIntentStatus.Processing &&
                         x.ProcessingLeaseUntil.HasValue && x.ProcessingLeaseUntil <= now))
            .OrderBy(x => x.CreatedAt).ThenBy(x => x.Id).Select(x => x.Id).Take(batchSize)
            .ToListAsync(cancellationToken);
        var processed = 0;
        foreach (var id in ids)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try { if (await ExecuteDisputeIntentAsync(id, leaseDuration, cancellationToken) is not null) processed++; }
            catch (OperationCanceledException) { throw; }
            catch { /* Bounded failure state is durable and remains protected for retry. */ }
        }
        return processed;
    }

    private async Task<ScreeningDispute?> ExecuteDisputeIntentAsync(long intentId, TimeSpan leaseDuration,
        CancellationToken cancellationToken)
    {
        var intent = await _db.ScreeningDisputeIntents.SingleOrDefaultAsync(x => x.Id == intentId, cancellationToken);
        if (intent is null) return null;
        if (intent.Status == ScreeningDisputeIntentStatus.Completed)
            return await _db.ScreeningDisputes.SingleOrDefaultAsync(x => x.LocalDisputeId == intent.OperationId, cancellationToken);
        if (intent.Status == ScreeningDisputeIntentStatus.ProviderAccepted)
            return await FinalizeDisputeIntentAsync(intent, cancellationToken);

        var now = _clock.GetUtcNow();
        if (intent.FinalizeExpiredLeaseAtBound(now, _retry.DisputeMaximumAttempts))
        {
            await RecordRetryIncidentAsync(intent.OrganizationId, intent.TenantScreeningOrderId,
                intent.ProviderKey, ScreeningIncidentType.DisputeRecoveryDeadLetter, "dispute-recovery", cancellationToken);
            return null;
        }
        if (!intent.TryClaim(Guid.NewGuid(), now, now.Add(leaseDuration), _retry.DisputeMaximumAttempts)) return null;
        try { await _db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException) { _db.Entry(intent).State = EntityState.Detached; return null; }

        try
        {
            var issues = JsonSerializer.Deserialize<string[]>(intent.IssueCodesJson) ?? [];
            var provider = await _gateway.OpenDisputeAsync(new ScreeningProviderDisputeRequest(intent.OperationId,
                intent.OrganizationId, intent.RentalApplicationId, intent.TenantScreeningOrderId,
                intent.ProviderOrderId, intent.ProviderReportReference, issues), cancellationToken);
            if (!string.Equals(provider.Status, "accepted", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(provider.Status, "submitted", StringComparison.OrdinalIgnoreCase))
            {
                var failureNow = _clock.GetUtcNow();
                var deadLettered = intent.ScheduleRetryOrDeadLetter("ProviderRejected", failureNow,
                    failureNow.Add(_retry.RetryDelay(intent.Attempts)), _retry.DisputeMaximumAttempts);
                if (deadLettered) await RecordRetryIncidentAsync(intent.OrganizationId, intent.TenantScreeningOrderId,
                    intent.ProviderKey, ScreeningIncidentType.DisputeRecoveryDeadLetter, "dispute-recovery", cancellationToken);
                else await _db.SaveChangesAsync(cancellationToken);
                throw new InvalidOperationException("Provider did not accept the dispute.");
            }
            intent.MarkProviderAccepted(provider.ProviderReference, _clock.GetUtcNow());
            // Separate acceptance commit makes interruption before immutable evidence recoverable.
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception exception)
        {
            if (intent.Status == ScreeningDisputeIntentStatus.Processing)
            {
                var failureNow = _clock.GetUtcNow();
                var deadLettered = intent.ScheduleRetryOrDeadLetter("ProviderOutcomeUnknown", failureNow,
                    failureNow.Add(_retry.RetryDelay(intent.Attempts)), _retry.DisputeMaximumAttempts);
                try
                {
                    if (deadLettered) await RecordRetryIncidentAsync(intent.OrganizationId, intent.TenantScreeningOrderId,
                        intent.ProviderKey, ScreeningIncidentType.DisputeRecoveryDeadLetter, "dispute-recovery", CancellationToken.None);
                    else await _db.SaveChangesAsync(CancellationToken.None);
                }
                catch { }
            }
            System.Runtime.ExceptionServices.ExceptionDispatchInfo.Capture(exception).Throw();
            throw;
        }

        return await FinalizeDisputeIntentAsync(intent, cancellationToken);
    }

    private async Task<ScreeningDispute> FinalizeDisputeIntentAsync(ScreeningDisputeIntent intent,
        CancellationToken cancellationToken)
    {
        var existing = await _db.ScreeningDisputes.SingleOrDefaultAsync(x => x.LocalDisputeId == intent.OperationId,
            cancellationToken);
        if (existing is not null)
        {
            if (intent.Status == ScreeningDisputeIntentStatus.ProviderAccepted) intent.MarkCompleted(_clock.GetUtcNow());
            var fenced = await _db.ScreeningReportRevisions.SingleAsync(x => x.Id == intent.ScreeningReportRevisionId, cancellationToken);
            if (fenced.PendingDisputeOperationId == intent.OperationId) fenced.PendingDisputeOperationId = null;
            await _db.SaveChangesAsync(cancellationToken);
            return existing;
        }
        if (intent.Status != ScreeningDisputeIntentStatus.ProviderAccepted || intent.ProviderReference is null)
            throw new InvalidOperationException("Provider acceptance is required before dispute evidence finalization.");

        var now = _clock.GetUtcNow();
        var order = await ReloadOrderAsync(intent.TenantScreeningOrderId, cancellationToken);
        var report = await _db.ScreeningReportRevisions.SingleAsync(x => x.Id == intent.ScreeningReportRevisionId, cancellationToken);
        if (report.PendingDisputeOperationId != intent.OperationId || report.DeletedAt.HasValue)
            throw new ScreeningDeletionSafetyConflictException();
        var dispute = new ScreeningDispute
        {
            LocalDisputeId = intent.OperationId, TenantScreeningOrderId = order.Id, OrganizationId = order.OrganizationId,
            ProviderKey = intent.ProviderKey, ProviderDisputeReference = intent.ProviderReference,
            Status = ScreeningDisputeStatus.Submitted, OpenedAt = intent.CreatedAt,
            OriginalScreeningReportRevisionId = report.Id, OpenedByActorType = intent.ActorType,
            OpenedByUserId = intent.ActorUserId, IssueCodesJson = intent.IssueCodesJson,
            NotesSha256Hash = intent.NotesSha256Hash, RetentionExpiresAt = intent.RetentionExpiresAt
        };
        await InTransactionAsync(async () =>
        {
            _db.ScreeningDisputes.Add(dispute);
            await _db.SaveChangesAsync(cancellationToken);
            _db.ScreeningDisputeEvents.Add(new ScreeningDisputeEvent
            {
                ScreeningDisputeId = dispute.Id, TenantScreeningOrderId = order.Id,
                OrganizationId = order.OrganizationId, Revision = 1, Status = dispute.Status,
                OccurredAt = intent.ProviderAcceptedAt ?? now, RecordedAt = now,
                ProviderEventType = "opened", ProviderEventReference = intent.ProviderReference,
                ActorType = intent.ActorType, ActorUserId = intent.ActorUserId
            });
            foreach (var d in await _db.ScreeningRentalDecisionRevisions.Where(x => x.TenantScreeningOrderId == order.Id).ToListAsync(cancellationToken))
            { d.IsFrozenByDispute = true; d.DisputeStatus = ScreeningDecisionDisputeStatus.Frozen; }
            if (order.Status != ScreeningStatus.Disputed)
                ApplyTransition(order, ScreeningStatus.Disputed, now, ScreeningTransitionSource.User, "DisputeAccepted", intent.ActorUserId);
            report.PendingDisputeOperationId = null;
            intent.MarkCompleted(now);
            await _db.SaveChangesAsync(cancellationToken);
        }, cancellationToken);
        return dispute;
    }

    public async Task<ScreeningDisputeEvent> RecordDisputeUpdateAsync(ScreeningDisputeUpdateCommand command, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command); Text(command.ProviderKey, 100); Text(command.ProviderEventReference, 200); Text(command.ProviderEventType, 100);
        if (!Enum.IsDefined(command.Status) || !Enum.IsDefined(command.OrderStatus)) throw new ArgumentOutOfRangeException(nameof(command));
        var dispute = await _db.ScreeningDisputes.SingleOrDefaultAsync(x => x.Id == command.DisputeId && x.ProviderKey == command.ProviderKey, cancellationToken)
            ?? throw new ScreeningProviderCorrelationException();
        var duplicate = await _db.ScreeningDisputeEvents.SingleOrDefaultAsync(x => x.ScreeningDisputeId == dispute.Id && x.ProviderEventReference == command.ProviderEventReference, cancellationToken);
        if (duplicate is not null) return duplicate;
        var order = await _db.TenantScreeningOrders.SingleAsync(x => x.Id == dispute.TenantScreeningOrderId, cancellationToken);
        if (command.CorrectedReportRevisionId.HasValue && !await _db.ScreeningReportRevisions.AnyAsync(x => x.Id == command.CorrectedReportRevisionId && x.TenantScreeningOrderId == order.Id && x.SupersedesScreeningReportRevisionId == dispute.OriginalScreeningReportRevisionId, cancellationToken))
            throw new ScreeningProviderCorrelationException();
        if (!ScreeningTransitionPolicy.CanTransition(order.Status, command.OrderStatus)) throw new InvalidOperationException("Illegal dispute order transition.");
        if (command.OrderStatus is not (ScreeningStatus.Disputed or ScreeningStatus.Processing or ScreeningStatus.Complete or ScreeningStatus.ActionRequired)) throw new InvalidOperationException("Invalid dispute lifecycle target.");
        var now = _clock.GetUtcNow();
        var next = checked((await _db.ScreeningDisputeEvents.Where(x => x.ScreeningDisputeId == dispute.Id).MaxAsync(x => (long?)x.Revision, cancellationToken) ?? 0) + 1);
        var evt = new ScreeningDisputeEvent { ScreeningDisputeId = dispute.Id, TenantScreeningOrderId = order.Id,
            OrganizationId = order.OrganizationId, Revision = next, Status = command.Status, OccurredAt = command.OccurredAt,
            RecordedAt = now, ProviderEventType = command.ProviderEventType, ProviderEventReference = command.ProviderEventReference,
            ActorType = ScreeningDisputeActorType.Provider };
        await InTransactionAsync(async () =>
        {
            dispute.Status = command.Status; dispute.CorrectedScreeningReportRevisionId = command.CorrectedReportRevisionId;
            if (command.Status is ScreeningDisputeStatus.Resolved or ScreeningDisputeStatus.Rejected) dispute.ResolvedAt = now;
            _db.ScreeningDisputeEvents.Add(evt);
            if (command.OrderStatus != order.Status) ApplyTransition(order, command.OrderStatus, command.OccurredAt, ScreeningTransitionSource.ProviderWebhook, "DisputeUpdate", null);
            if (dispute.ResolvedAt.HasValue)
                foreach (var d in await _db.ScreeningRentalDecisionRevisions.Where(x => x.TenantScreeningOrderId == order.Id).ToListAsync(cancellationToken))
                { d.IsFrozenByDispute = false; d.DisputeStatus = ScreeningDecisionDisputeStatus.Released; }
            await _db.SaveChangesAsync(cancellationToken);
        }, cancellationToken);
        return evt;
    }

    public async Task CancelOrExpireAsync(ScreeningOrderCancellationCommand command, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command);
        ValidateIds(command.OrganizationId, command.ActorUserId, command.ScreeningOrderId);
        Text(command.ReasonCode, 100);
        await _propertyAuthority.EnsureOrganizationCapabilityAsync(command.OrganizationId, command.ActorUserId,
            cancellationToken);
        var order = await _db.TenantScreeningOrders.SingleOrDefaultAsync(x =>
                x.Id == command.ScreeningOrderId && x.OrganizationId == command.OrganizationId, cancellationToken)
            ?? throw new ScreeningResourceNotFoundException("screening order");
        await _propertyAuthority.EnsurePropertyAuthorityAsync(command.OrganizationId, command.ActorUserId,
            order.PropertyId, cancellationToken);
        var existing = await _db.ScreeningCancellationIntents.SingleOrDefaultAsync(x =>
            x.TenantScreeningOrderId == order.Id, cancellationToken);
        if (order.Status == ScreeningStatus.Expired && existing is null) return;
        if (existing is null)
        {
            if (order.Status is ScreeningStatus.Complete or ScreeningStatus.Disputed or ScreeningStatus.Failed ||
                !ScreeningTransitionPolicy.CanTransition(order.Status, ScreeningStatus.Expired))
                throw new InvalidOperationException("Only unconsented or unfinished screening orders may expire.");

            var now = _clock.GetUtcNow();
            existing = new ScreeningCancellationIntent
            {
                OperationId = DeterministicGuid($"screening-cancellation-v1\n{order.OrganizationId}\n{order.Id}"),
                TenantScreeningOrderId = order.Id,
                OrganizationId = order.OrganizationId,
                RentalApplicationId = order.RentalApplicationId,
                ActorUserId = command.ActorUserId,
                ExpectedOrderRevision = order.CurrentRevision,
                ProviderKey = order.ProviderKey,
                ProviderOrderId = order.ProviderOrderId,
                ReasonCode = command.ReasonCode,
                CreatedAt = now
            };
            _db.ScreeningCancellationIntents.Add(existing);
            try
            {
                // The intent is the commit point and must precede every provider side effect.
                await _db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException)
            {
                _db.Entry(existing).State = EntityState.Detached;
                existing = await _db.ScreeningCancellationIntents.SingleOrDefaultAsync(x =>
                    x.TenantScreeningOrderId == order.Id, cancellationToken);
                if (existing is null) throw;
            }
        }

        await ExecuteCancellationIntentAsync(existing.Id, TimeSpan.FromMinutes(2), cancellationToken);
    }

    public async Task<int> ProcessPendingCancellationIntentsAsync(int batchSize, TimeSpan leaseDuration,
        CancellationToken cancellationToken = default)
    {
        if (batchSize is < 1 or > 500) throw new ArgumentOutOfRangeException(nameof(batchSize));
        if (leaseDuration < TimeSpan.FromSeconds(1) || leaseDuration > TimeSpan.FromHours(1))
            throw new ArgumentOutOfRangeException(nameof(leaseDuration));
        var now = _clock.GetUtcNow();
        var ids = await _db.ScreeningCancellationIntents.AsNoTracking()
            .Where(x => (x.Status == ScreeningCancellationIntentStatus.Pending &&
                         (x.NextAttemptAt == null || x.NextAttemptAt <= now)) ||
                        x.Status == ScreeningCancellationIntentStatus.ProviderAccepted ||
                        (x.Status == ScreeningCancellationIntentStatus.Processing &&
                         x.ProcessingLeaseUntil.HasValue && x.ProcessingLeaseUntil <= now))
            .OrderBy(x => x.CreatedAt).ThenBy(x => x.Id).Select(x => x.Id).Take(batchSize)
            .ToListAsync(cancellationToken);
        var processed = 0;
        foreach (var id in ids)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                if (await ExecuteCancellationIntentAsync(id, leaseDuration, cancellationToken)) processed++;
            }
            catch (OperationCanceledException) { throw; }
            catch
            {
                // The bounded failure classification is already durable. A later cycle retries it.
            }
        }
        return processed;
    }

    private async Task<bool> ExecuteCancellationIntentAsync(long intentId, TimeSpan leaseDuration,
        CancellationToken cancellationToken)
    {
        var intent = await _db.ScreeningCancellationIntents.SingleOrDefaultAsync(x => x.Id == intentId, cancellationToken);
        if (intent is null || intent.Status is ScreeningCancellationIntentStatus.Completed or
            ScreeningCancellationIntentStatus.SupersededByCompletion or ScreeningCancellationIntentStatus.RejectedByOrderState)
            return false;
        if (intent.Status == ScreeningCancellationIntentStatus.ProviderAccepted)
        {
            await FinalizeCancellationIntentAsync(intent, cancellationToken);
            return true;
        }

        var now = _clock.GetUtcNow();
        if (intent.FinalizeExpiredLeaseAtBound(now, _retry.CancellationMaximumAttempts))
        {
            await RecordRetryIncidentAsync(intent.OrganizationId, intent.TenantScreeningOrderId,
                intent.ProviderKey, ScreeningIncidentType.CancellationRecoveryDeadLetter, "cancellation-recovery", cancellationToken);
            return false;
        }
        if (!intent.TryClaim(Guid.NewGuid(), now, now.Add(leaseDuration), _retry.CancellationMaximumAttempts)) return false;
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            _db.Entry(intent).State = EntityState.Detached;
            return false;
        }

        var currentOrder = await ReloadOrderAsync(intent.TenantScreeningOrderId, cancellationToken);
        if (currentOrder.Status == ScreeningStatus.Complete)
        {
            intent.MarkCompletionWon(_clock.GetUtcNow());
            await _db.SaveChangesAsync(cancellationToken);
            return true;
        }

        try
        {
            ScreeningProviderOperationResult result;
            if (intent.ProviderOrderId is null)
                result = new ScreeningProviderOperationResult("provider-cancellation-not-required", "accepted");
            else
                result = await _gateway.CancelOrExpireAsync(new ScreeningCancellationRequest(intent.OrganizationId,
                    intent.RentalApplicationId, intent.TenantScreeningOrderId, intent.ProviderOrderId,
                    intent.ReasonCode), cancellationToken);
            if (!string.Equals(result.Status, "accepted", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(result.Status, "cancelled", StringComparison.OrdinalIgnoreCase))
            {
                var failureNow = _clock.GetUtcNow();
                var manualReview = intent.ReleaseForRetry("ProviderRejected", failureNow,
                    failureNow.Add(_retry.RetryDelay(intent.Attempts)), _retry.CancellationMaximumAttempts);
                if (manualReview) await RecordRetryIncidentAsync(intent.OrganizationId, intent.TenantScreeningOrderId,
                    intent.ProviderKey, ScreeningIncidentType.CancellationRecoveryDeadLetter, "cancellation-recovery", cancellationToken);
                else await _db.SaveChangesAsync(cancellationToken);
                throw new InvalidOperationException("Provider did not accept cancellation.");
            }

            intent.MarkProviderAccepted(result.ProviderReference, _clock.GetUtcNow());
            // This separate commit makes interruption after acceptance recoverable without depending
            // on the request context. A retry finalizes directly from ProviderAccepted.
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception exception)
        {
            if (intent.Status == ScreeningCancellationIntentStatus.Processing)
            {
                var failureNow = _clock.GetUtcNow();
                var manualReview = intent.ReleaseForRetry("ProviderOutcomeUnknown", failureNow,
                    failureNow.Add(_retry.RetryDelay(intent.Attempts)), _retry.CancellationMaximumAttempts);
                try
                {
                    if (manualReview) await RecordRetryIncidentAsync(intent.OrganizationId, intent.TenantScreeningOrderId,
                        intent.ProviderKey, ScreeningIncidentType.CancellationRecoveryDeadLetter, "cancellation-recovery", CancellationToken.None);
                    else await _db.SaveChangesAsync(CancellationToken.None);
                }
                catch { }
            }
            System.Runtime.ExceptionServices.ExceptionDispatchInfo.Capture(exception).Throw();
            throw;
        }

        await FinalizeCancellationIntentAsync(intent, cancellationToken);
        return true;
    }

    private async Task FinalizeCancellationIntentAsync(ScreeningCancellationIntent intent, CancellationToken cancellationToken)
    {
        for (var attempt = 0; attempt < 3; attempt++)
        {
            var order = await ReloadOrderAsync(intent.TenantScreeningOrderId, cancellationToken);
            var now = _clock.GetUtcNow();
            if (order.Status == ScreeningStatus.Complete)
                intent.MarkCompletionWon(now);
            else if (order.Status == ScreeningStatus.Expired)
                intent.MarkCompleted(now);
            else if (!ScreeningTransitionPolicy.CanTransition(order.Status, ScreeningStatus.Expired))
                intent.MarkRejectedByOrderState(now);
            else
            {
                ApplyTransition(order, ScreeningStatus.Expired, now, ScreeningTransitionSource.User,
                    intent.ReasonCode, intent.ActorUserId);
                intent.MarkCompleted(now);
            }

            try
            {
                await _db.SaveChangesAsync(cancellationToken);
                return;
            }
            catch (DbUpdateConcurrencyException) when (attempt < 2)
            {
                foreach (var entry in _db.ChangeTracker.Entries<ScreeningTransitionEvent>()
                             .Where(x => x.State == EntityState.Added && x.Entity.TenantScreeningOrderId == intent.TenantScreeningOrderId))
                    entry.State = EntityState.Detached;
                await _db.Entry(intent).ReloadAsync(cancellationToken);
            }
        }
    }

    private async Task<TenantScreeningOrder> ReloadOrderAsync(long orderId, CancellationToken cancellationToken)
    {
        var tracked = _db.TenantScreeningOrders.Local.FirstOrDefault(x => x.Id == orderId);
        if (tracked is not null) await _db.Entry(tracked).ReloadAsync(cancellationToken);
        return tracked ?? await _db.TenantScreeningOrders.SingleAsync(x => x.Id == orderId, cancellationToken);
    }


    private void ApplyTransition(TenantScreeningOrder order, ScreeningStatus target, DateTimeOffset at, ScreeningTransitionSource source, string reason, long? actor)
    {
        if (!ScreeningTransitionPolicy.CanTransition(order.Status, target) || order.Status == target) throw new InvalidOperationException("Illegal screening status transition.");
        var from = order.Status; order.ApplyTransition(target, checked(order.CurrentRevision + 1), at);
        _db.ScreeningTransitionEvents.Add(new ScreeningTransitionEvent { TenantScreeningOrderId = order.Id, OrganizationId = order.OrganizationId,
            FromStatus = from, ToStatus = target, Revision = order.CurrentRevision, OccurredAt = at, RecordedAt = _clock.GetUtcNow(),
            Source = source, ReasonCode = reason, ProviderKey = order.ProviderKey, ActorUserId = actor });
    }
    private async Task RecordRetryIncidentAsync(long organizationId, long orderId, string providerKey,
        ScreeningIncidentType incidentType, string detectionSource, CancellationToken cancellationToken)
    {
        await _incidentRecorder.RecordAsync(new ScreeningIncidentRecord(organizationId, orderId, providerKey, null,
            incidentType, ScreeningIncidentSeverity.High, detectionSource,
            $"{detectionSource}:{organizationId}:{orderId}", null, null, null), cancellationToken);
    }

    private async Task<long> NextReportRevision(long id, CancellationToken ct) => checked((await _db.ScreeningReportRevisions.Where(x => x.TenantScreeningOrderId == id).MaxAsync(x => (long?)x.Revision, ct) ?? 0) + 1);
    private async Task InTransactionAsync(Func<Task> action, CancellationToken ct)
    {
        IDbContextTransaction? tx = null; if (_db.Database.IsRelational()) tx = await _db.Database.BeginTransactionAsync(ct);
        try { await action(); if (tx is not null) await tx.CommitAsync(ct); }
        catch { if (tx is not null) await tx.RollbackAsync(CancellationToken.None); throw; }
        finally { if (tx is not null) await tx.DisposeAsync(); }
    }
    private static string[] NormalizeCodes(IReadOnlyList<string> values, int maxCount, int maxLength, string name)
    { ArgumentNullException.ThrowIfNull(values); if (values.Count is 0 || values.Count > 20 || values.Count > maxCount) throw new ArgumentException("A bounded nonempty code list is required.", name); foreach (var x in values) Text(x, maxLength); return values.Distinct(StringComparer.Ordinal).OrderBy(x => x, StringComparer.Ordinal).ToArray(); }
    internal static SortedDictionary<string, string> NormalizeReportFacts(IReadOnlyDictionary<string, string> values, string name)
    {
        ArgumentNullException.ThrowIfNull(values);
        if (values.Count > NormalizedReportFactsV1.Count)
            throw new ArgumentException($"Normalized facts do not conform to {NormalizedReportFactsSchemaVersion}.", name);
        var result = new SortedDictionary<string, string>(StringComparer.Ordinal);
        foreach (var fact in values)
        {
            Text(fact.Key, 100);
            Text(fact.Value, 200);
            var value = fact.Value.Trim();
            if (!NormalizedReportFactsV1.TryGetValue(fact.Key, out var accepts) || !accepts(value))
                throw new ArgumentException($"Normalized facts do not conform to {NormalizedReportFactsSchemaVersion}.", name);
            result.Add(fact.Key, value);
        }
        return result;
    }
    private static void Text(string? value, int max) => ScreeningContractValidation.ValidateBoundedText(value, max, nameof(value), false);
    private static void ValidateIds(params long[] ids) { if (ids.Any(x => x <= 0)) throw new ArgumentOutOfRangeException(nameof(ids)); }
    private static string HashRaw(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
    private static string HashScoped(string scope, string value) => HashRaw($"{scope}\n{value}");
    private static string AccessKey(ScreeningReportAccessAudit attempt) => HashRaw(
        $"screening-report-access-v1\n{attempt.OrganizationId}\n{attempt.TenantScreeningOrderId}\n{attempt.ScreeningReportRevisionId}\n{attempt.AttemptSequence}\n{attempt.Purpose}");
    private static Guid DeterministicGuid(string value) { var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value)); return new Guid(bytes.AsSpan(0, 16)); }
}
