using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using brownstone_hub_api.Config;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.LeasingPipeline;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.FeatureReadiness;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace brownstone_hub_api.Services.LeasingPipeline;

public interface ILeasingPipelineService
{
    Task<LeasingPipelineDto> GetForPropertyAsync(long organizationId, long actorUserId, long propertyId, long? unitId, CancellationToken ct);
    Task<LeasingPipelineDto> GetForListingAsync(long organizationId, long actorUserId, long listingId, CancellationToken ct);
    Task<LeasingPipelineDto> GetForApplicationAsync(long organizationId, long actorUserId, long applicationId, CancellationToken ct);
    Task<LeasingPipelineDto> TransitionShowingAsync(long organizationId, long actorUserId, long propertyId, long unitId,
        string revision, string idempotencyKey, string correlationTrace, ShowingTransitionRequest request, CancellationToken ct);
}

public sealed class PipelineForbiddenException : Exception;
public sealed class PipelineNotFoundException : Exception;
public sealed class PipelineConflictException(string message) : Exception(message);
public sealed class PipelineValidationException(string message) : Exception(message);

public sealed class LeasingPipelineService : ILeasingPipelineService
{
    private readonly DataContext db;
    private readonly IFeatureReadinessService readiness;
    private readonly Func<CancellationToken, Task>? beforeFinalInsert;

    private static readonly HashSet<string> AllowedReasonCodes = new(StringComparer.Ordinal)
    {
        "landlordCancelled", "applicantCancelled", "noShow", "showingCompleted", "schedulingConflict"
    };

    // The optional seam is inert in production. It lets deterministic provider-independent tests mutate
    // authoritative state at the exact pre-insert boundary; it is not evidence of relational locking.
    public LeasingPipelineService(DataContext db, IFeatureReadinessService readiness,
        Func<CancellationToken, Task>? beforeFinalInsert = null)
    {
        this.db = db;
        this.readiness = readiness;
        this.beforeFinalInsert = beforeFinalInsert;
    }

    public async Task<LeasingPipelineDto> GetForPropertyAsync(long organizationId, long actorUserId, long propertyId,
        long? unitId, CancellationToken ct)
    {
        await AuthorizeAsync(organizationId, actorUserId, ct);
        return await GetForPropertyAlreadyAuthorizedAsync(organizationId, actorUserId, propertyId, unitId, ct);
    }

    public async Task<LeasingPipelineDto> GetForListingAsync(long organizationId, long actorUserId, long listingId,
        CancellationToken ct)
    {
        await AuthorizeAsync(organizationId, actorUserId, ct);
        var scope = await db.Listings.AsNoTracking()
            .Where(x => x.Id == listingId && x.OrganizationId == organizationId &&
                        x.Property.OrganizationId == organizationId && !x.Property.IsDeleted)
            .Select(x => new { x.PropertyId, x.UnitId }).SingleOrDefaultAsync(ct);
        if (scope is null) throw new PipelineNotFoundException();
        return await GetForPropertyAlreadyAuthorizedAsync(organizationId, actorUserId, scope.PropertyId, scope.UnitId, ct);
    }

    public async Task<LeasingPipelineDto> GetForApplicationAsync(long organizationId, long actorUserId,
        long applicationId, CancellationToken ct)
    {
        await AuthorizeAsync(organizationId, actorUserId, ct);
        var scope = await db.RentalApplications.AsNoTracking()
            .Where(x => x.Id == applicationId && x.OrganizationId == organizationId &&
                        x.Property.OrganizationId == organizationId && !x.Property.IsDeleted)
            .Select(x => new { x.PropertyId, x.UnitId }).SingleOrDefaultAsync(ct);
        if (scope is null) throw new PipelineNotFoundException();
        return await GetForPropertyAlreadyAuthorizedAsync(organizationId, actorUserId, scope.PropertyId, scope.UnitId, ct);
    }

    public async Task<LeasingPipelineDto> TransitionShowingAsync(long organizationId, long actorUserId, long propertyId,
        long unitId, string revision, string idempotencyKey, string correlationTrace, ShowingTransitionRequest request,
        CancellationToken ct)
    {
        await AuthorizeAsync(organizationId, actorUserId, ct);
        ValidateCommand(revision, idempotencyKey, request);

        var idempotencyKeyHash = Hash(idempotencyKey);
        var requestHash = Hash(JsonSerializer.Serialize(
            new TransitionRequestCanonical(organizationId, propertyId, unitId, request.EventType,
                request.ScheduledAtUtc?.ToUniversalTime(), request.Reason), LeasingPipelineJson.Options));

        IDbContextTransaction? transaction = null;
        try
        {
            // SQL Server SERIALIZABLE gives the narrow indexed predicates below key/range protection for
            // the complete projection/revision/insert decision. InMemory deliberately skips transactions.
            if (db.Database.IsRelational())
                transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);

            var current = await GetForPropertyAlreadyAuthorizedAsync(
                organizationId, actorUserId, propertyId, unitId, ct);

            var prior = await FindReplayAsync(organizationId, idempotencyKeyHash, ct);
            if (prior is not null)
            {
                EnsureSameReplay(prior, propertyId, unitId, requestHash);
                var replay = ReplayResult(prior);
                if (transaction is not null) await transaction.CommitAsync(ct);
                return replay;
            }

            var normalizedRevision = NormalizeRevision(revision);
            if (!string.Equals(normalizedRevision, current.Revision, StringComparison.Ordinal))
                throw new PipelineConflictException("The pipeline revision is stale.");
            ValidateTransition(current, request);

            if (await RevisionAlreadyTransitionedAsync(organizationId, propertyId, unitId, current.Revision, ct))
                throw new PipelineConflictException("The pipeline revision was already transitioned.");

            if (beforeFinalInsert is not null) await beforeFinalInsert(ct);

            // Recompute at the final write boundary. This catches provider-independent same-context changes;
            // relational concurrent writers are additionally excluded by the SERIALIZABLE transaction.
            var finalCurrent = await GetForPropertyAlreadyAuthorizedAsync(
                organizationId, actorUserId, propertyId, unitId, ct);
            if (!string.Equals(normalizedRevision, finalCurrent.Revision, StringComparison.Ordinal))
                throw new PipelineConflictException("The pipeline revision is stale.");
            ValidateTransition(finalCurrent, request);
            if (await RevisionAlreadyTransitionedAsync(organizationId, propertyId, unitId, finalCurrent.Revision, ct))
                throw new PipelineConflictException("The pipeline revision was already transitioned.");

            var audit = new UnitLifecycleEvent
            {
                OrganizationId = organizationId,
                PropertyId = propertyId,
                UnitId = unitId,
                ActorUserId = actorUserId,
                PreviousStage = finalCurrent.CurrentStage,
                ResultingStage = finalCurrent.CurrentStage,
                EventType = request.EventType,
                ScheduledAtUtc = request.ScheduledAtUtc?.ToUniversalTime(),
                Reason = request.Reason,
                RequestHash = requestHash,
                CorrelationTrace = string.IsNullOrWhiteSpace(correlationTrace)
                    ? "unavailable"
                    : correlationTrace[..Math.Min(200, correlationTrace.Length)],
                IdempotencyKeyHash = idempotencyKeyHash,
                PreviousRevision = finalCurrent.Revision,
                OccurredAtUtc = DateTime.UtcNow
            };

            // Project the complete replay-safe response before tracking the insert. The proposed event drives
            // stage and revision, but its database identity is intentionally absent from this response. A later
            // GET includes the persisted event metadata without changing the canonical transition revision.
            var projected = await ProjectAsync(organizationId, actorUserId, propertyId, unitId,
                await IsSingleUnitPropertyAsync(organizationId, propertyId, ct), ct, EventFact.From(audit));
            audit.ResultingStage = projected.CurrentStage;
            audit.ResultSnapshotJson = JsonSerializer.Serialize(projected, LeasingPipelineJson.Options);
            if (audit.ResultSnapshotJson.Length > 4000)
                throw new PipelineConflictException("The safe transition result exceeds its storage bound.");
            db.UnitLifecycleEvents.Add(audit);
            await db.SaveChangesAsync(ct);
            if (transaction is not null) await transaction.CommitAsync(ct);
            return projected;
        }
        catch (DbUpdateException ex) when (IsDuplicateUniqueKey(ex))
        {
            if (transaction is not null) await transaction.RollbackAsync(CancellationToken.None);
            foreach (var entry in ex.Entries) entry.State = EntityState.Detached;
            var raced = await FindReplayAsync(organizationId, idempotencyKeyHash, ct);
            if (raced is not null && raced.PropertyId == propertyId && raced.UnitId == unitId &&
                string.Equals(raced.RequestHash, requestHash, StringComparison.Ordinal))
                return ReplayResult(raced);
            throw new PipelineConflictException("Concurrent lifecycle transition conflict.");
        }
        catch
        {
            if (transaction is not null) await transaction.RollbackAsync(CancellationToken.None);
            throw;
        }
        finally
        {
            if (transaction is not null) await transaction.DisposeAsync();
        }
    }

    private async Task<LeasingPipelineDto> GetForPropertyAlreadyAuthorizedAsync(long organizationId, long actorUserId,
        long propertyId, long? unitId, CancellationToken ct)
    {
        var propertyExists = await db.Properties.AsNoTracking().AnyAsync(x => x.Id == propertyId &&
            x.OrganizationId == organizationId && !x.IsDeleted, ct);
        if (!propertyExists) throw new PipelineNotFoundException();

        var unitIds = await db.Units.AsNoTracking()
            .Where(x => x.PropertyId == propertyId && x.OrganizationId == organizationId)
            .OrderBy(x => x.Id).Select(x => x.Id).ToListAsync(ct);
        if (unitId is null)
        {
            if (unitIds.Count != 1)
                throw new PipelineValidationException("A unit must be selected for a multi-unit property.");
            unitId = unitIds[0];
        }
        else if (!unitIds.Contains(unitId.Value))
        {
            throw new PipelineNotFoundException();
        }

        return await ProjectAsync(organizationId, actorUserId, propertyId, unitId.Value, unitIds.Count == 1, ct);
    }

    private async Task<LeasingPipelineDto> ProjectAsync(long org, long actor, long propertyId, long unitId,
        bool allowLegacy, CancellationToken ct, EventFact? proposedEvent = null)
    {
        var now = DateTime.UtcNow;
        var today = now.Date;

        var listing = await db.Listings.AsNoTracking()
            .Where(x => x.OrganizationId == org && x.PropertyId == propertyId &&
                        (x.UnitId == unitId || (allowLegacy && x.UnitId == null)) &&
                        x.Status == EListingStatus.Active && (x.ExpiresAt == null || x.ExpiresAt > now))
            .OrderByDescending(x => x.UpdatedAt ?? x.CreatedAt).ThenByDescending(x => x.Id)
            .Select(x => new ListingFact(x.Id, x.Status, x.CreatedAt, x.UpdatedAt, x.ExpiresAt, x.DateAvailable))
            .FirstOrDefaultAsync(ct);

        // Keep the latest invite, including terminal state, so identity/status/expiry/use are authoritative
        // revision inputs. Tokens, email, and applicant PII never leave SQL.
        var invite = await db.ApplicationInvites.AsNoTracking()
            .Where(x => x.OrganizationId == org && x.PropertyId == propertyId &&
                        (x.UnitId == unitId || (allowLegacy && x.UnitId == null)))
            .OrderByDescending(x => x.CreatedAt).ThenByDescending(x => x.Id)
            .Select(x => new InviteFact(x.Id, x.IsUsed, x.CreatedAt, x.UsedAt, x.ExpiresAt, x.ApplicationId))
            .FirstOrDefaultAsync(ct);

        // Projection is intentionally narrow: no applicant name, contact, SSN, report, notes, or navigation.
        var application = await ApplicationCandidates(org, propertyId, unitId, allowLegacy, today)
            .FirstOrDefaultAsync(ct);

        var terminalApp = await db.RentalApplications.AsNoTracking().AnyAsync(x =>
            x.OrganizationId == org && x.PropertyId == propertyId &&
            (x.UnitId == unitId || (allowLegacy && x.UnitId == null)) &&
            (x.Status == EApplicationStatus.Rejected || x.Status == EApplicationStatus.Withdrawn), ct);

        // Milestone 2 CRM rows are authoritative lifecycle evidence. The projection, rather than a forged
        // UnitLifecycleEvent revision, follows inquiry/showing mutations atomically committed by LeadService.
        var hasLead = await db.Leads.AsNoTracking().AnyAsync(x => x.OrganizationId == org &&
            x.PropertyId == propertyId && (x.UnitId == unitId || (allowLegacy && x.UnitId == null)) &&
            x.Status != LeadStatus.Lost, ct);
        var hasScheduledShowing = await db.Showings.AsNoTracking().AnyAsync(x => x.OrganizationId == org &&
            x.PropertyId == propertyId && (x.UnitId == unitId || (allowLegacy && x.UnitId == null)) &&
            x.Status == ShowingStatus.Confirmed && x.StartsAtUtc > now, ct);

        // EndDate is date-semantic in lifecycle decisions. Both inactive and stale-active leases ending before
        // today are historical, including leases referenced by applications from a prior conversion cycle.
        var lease = await db.Leases.AsNoTracking()
            .Where(x => x.OrganizationId == org && x.UnitId == unitId && !x.IsDeleted &&
                        (x.EndDate == null || x.EndDate >= today))
            .OrderByDescending(x => x.IsActive && x.StartDate <= now ? 5
                : x.LeaseAgreement != null && x.LeaseAgreement.SignatureStatus == ESignatureStatus.Completed &&
                  x.LeaseAgreement.SignatureCompletedAt != null && x.IsActive && x.StartDate > now ? 4
                : x.LeaseAgreement != null &&
                  (x.LeaseAgreement.SignatureStatus == ESignatureStatus.Sent ||
                   x.LeaseAgreement.SignatureStatus == ESignatureStatus.InProgress ||
                   x.LeaseAgreement.SignatureStatus == ESignatureStatus.PartiallySigned) &&
                  (x.LeaseAgreement.SignatureExpiresAt == null || x.LeaseAgreement.SignatureExpiresAt > now) ? 3
                : x.LeaseAgreement != null &&
                  (x.LeaseAgreement.SignatureStatus == ESignatureStatus.Declined ||
                   x.LeaseAgreement.SignatureStatus == ESignatureStatus.Expired ||
                   x.LeaseAgreement.SignatureStatus == ESignatureStatus.Cancelled) ? 1 : 2)
            .ThenByDescending(x => x.LeaseAgreement != null
                ? x.LeaseAgreement.SignatureCompletedAt ?? x.LeaseAgreement.SignatureSentAt ?? x.UpdatedAt ?? x.StartDate
                : x.UpdatedAt ?? x.StartDate)
            .ThenByDescending(x => x.Id)
            .Select(x => new LeaseFact(x.Id, x.IsActive, x.StartDate, x.EndDate, x.UpdatedAt,
                x.LeaseAgreement == null ? null : x.LeaseAgreement.Id,
                x.LeaseAgreement == null ? null : x.LeaseAgreement.SignatureStatus,
                x.LeaseAgreement == null ? null : x.LeaseAgreement.SignatureSentAt,
                x.LeaseAgreement == null ? null : x.LeaseAgreement.SignatureCompletedAt,
                x.LeaseAgreement == null ? null : x.LeaseAgreement.SignatureExpiresAt,
                x.LeaseAgreement != null && x.LeaseAgreement.DocuSignEnvelopeId != null &&
                    x.LeaseAgreement.DocuSignEnvelopeId != "",
                x.LeaseAgreement == null ? null : x.LeaseAgreement.LandlordSignedAt,
                x.LeaseAgreement != null && x.LeaseAgreement.SignedDocumentBlobName != null &&
                    x.LeaseAgreement.SignedDocumentBlobName != ""))
            .FirstOrDefaultAsync(ct);

        var documentFact = lease is null
            ? null
            : await (from instance in db.LeaseInstances.AsNoTracking()
                     from document in instance.Documents
                     where instance.LeaseId == lease.Id && instance.IsFinalized
                     orderby document.GeneratedAt descending, document.Id descending
                     select new DocumentFact(instance.LeaseTemplate.Name, document.DocumentType, document.GeneratedAt))
                .FirstOrDefaultAsync(ct);
        var signerFact = lease is null
            ? null
            : await db.TenantLeases.AsNoTracking()
                .Where(x => x.LeaseId == lease.Id)
                .GroupBy(_ => 1)
                .Select(group => new SignerFact(group.Count(), group.Count(x => x.TenantSignedAt != null)))
                .FirstOrDefaultAsync(ct) ?? new SignerFact(0, 0);

        var persistedEvent = await db.UnitLifecycleEvents.AsNoTracking()
            .Where(x => x.OrganizationId == org && x.PropertyId == propertyId && x.UnitId == unitId)
            .OrderByDescending(x => x.OccurredAtUtc).ThenByDescending(x => x.Id)
            .Select(x => new EventFact(x.Id, x.EventType, x.ScheduledAtUtc, x.OccurredAtUtc, x.RequestHash,
                x.Reason, x.PreviousRevision, x.PreviousStage, x.ResultingStage))
            .FirstOrDefaultAsync(ct);
        var latestEvent = proposedEvent ?? persistedEvent;

        var unitOccupied = await db.Units.AsNoTracking()
            .Where(x => x.Id == unitId && x.OrganizationId == org && x.PropertyId == propertyId)
            .Select(x => x.IsOccupied).SingleAsync(ct);

        var activeLeaseStarted = lease is { IsActive: true } && lease.StartDate <= now;
        var signature = lease?.SignatureStatus;
        var futureLease = lease is { IsActive: true } && lease.StartDate > now;
        var facts = new LeasingPipelineFacts
        {
            IsOccupied = unitOccupied || activeLeaseStarted,
            HasActiveListing = listing is not null,
            HasLead = hasLead || invite is { IsUsed: false } && invite.ExpiresAt > now,
            HasScheduledShowing = hasScheduledShowing ||
                (latestEvent?.EventType is UnitLifecycleEventType.ShowingScheduled or UnitLifecycleEventType.ShowingRescheduled) &&
                latestEvent.ScheduledAtUtc > now,
            HasSubmittedApplication = application?.Status is EApplicationStatus.Draft or EApplicationStatus.Submitted,
            HasScreeningInProgress = application?.Status is EApplicationStatus.UnderReview or EApplicationStatus.OnHold,
            HasApprovedApplication = application?.Status == EApplicationStatus.Approved,
            HasLeaseDraft = lease is not null,
            HasSignaturePending = signature is ESignatureStatus.Sent or ESignatureStatus.InProgress or
                ESignatureStatus.PartiallySigned && (lease!.SignatureExpiresAt == null || lease.SignatureExpiresAt > now),
            HasCompletedSignatures = signature == ESignatureStatus.Completed && lease?.SignatureCompletedAt is not null,
            HasFutureActiveLease = futureLease,
            HasRejectedOrWithdrawnApplication = terminalApp,
            HasDeclinedOrExpiredSignature = signature is ESignatureStatus.Declined or ESignatureStatus.Expired or
                ESignatureStatus.Cancelled,
            ScreeningReady = (await readiness.GetAsync(actor, org, FeatureKeys.TenantScreening)).CanInvoke,
            ESignatureReady = (await readiness.GetAsync(actor, org, FeatureKeys.ESignature)).CanInvoke
        };

        var projection = LeasingPipelineProjector.Project(facts);
        // The proposed row has no stable database identity yet. Keep it out of public references/records;
        // persisted events continue to appear on normal GETs. This never exposes a fabricated ID of zero.
        var outputEvent = proposedEvent is null ? latestEvent : null;
        var refs = new LifecycleReferencesDto(listing?.Id, application?.Id, lease?.Id, invite?.Id, outputEvent?.Id);
        var records = RelevantRecords(listing, application, lease, invite, outputEvent, now);
        var leaseDocument = documentFact is null
            ? null
            : new LeaseDocumentSummaryDto(SafeDocumentName(documentFact.Name), SafeDocumentType(documentFact.Type),
                lease is { HasSignedDocument: true } && lease.SignatureCompletedAt is DateTime completedAt
                    ? completedAt
                    : documentFact.GeneratedAt,
                lease is { HasSignedDocument: true });
        var eSignature = lease is not { HasDocuSignEnvelope: true }
            ? null
            : new ESignatureSummaryDto("docusign",
                lease.SignatureStatus is null ? "notSent" : Wire(lease.SignatureStatus.Value),
                (signerFact?.SignedTenantCount ?? 0) + (lease.LandlordSignedAt is null ? 0 : 1),
                (signerFact?.TenantCount ?? 0) + 1,
                lease.SignatureSentAt, lease.SignatureCompletedAt, lease.SignatureExpiresAt);
        var action = projection.Action is null
            ? null
            : projection.Action with { Data = ActionData(projection.Action.Code, propertyId, unitId, refs) };

        // System.Text.Json writes named record properties and these ordered collections deterministically,
        // with invariant ISO timestamps and configured enum wire values. Every safe returned/decision field
        // (except EvaluatedAt and Revision itself) participates in this canonical revision envelope. Event
        // identity and its duplicate public record are excluded; stable event facts remain authoritative.
        var canonicalRefs = refs with { EventId = null };
        var canonicalRecords = records.Where(x => x.Type != "event").ToArray();
        var canonicalEvent = latestEvent is null ? null : EventRevisionFact.From(latestEvent, projection.Stage);
        var canonical = new RevisionCanonical(propertyId, unitId, projection.Stage, projection.Stages,
            projection.Blocker, action, canonicalRefs, canonicalRecords, leaseDocument, eSignature, facts, listing, invite,
            application, lease, canonicalEvent, unitOccupied, terminalApp);
        var revision = Hash(JsonSerializer.Serialize(canonical, LeasingPipelineJson.Options));
        return new LeasingPipelineDto(propertyId, unitId, projection.Stage, projection.Stages, projection.Blocker,
            action, refs, records, leaseDocument, eSignature, revision, now);
    }

    private static IReadOnlyList<LifecycleRecordDto> RelevantRecords(ListingFact? listing,
        ApplicationFact? application, LeaseFact? lease, InviteFact? invite, EventFact? lifecycleEvent, DateTime now)
    {
        var records = new List<LifecycleRecordDto>(6);
        if (listing is not null)
            records.Add(new("listing", listing.Id, Wire(listing.Status), listing.CreatedAt, listing.UpdatedAt,
                null, null, null, null, listing.ExpiresAt, null, listing.DateAvailable));
        if (invite is not null)
            records.Add(new("invite", invite.Id, invite.IsUsed ? "used" : invite.ExpiresAt <= now ? "expired" : "active",
                invite.CreatedAt, null, null, null, null, invite.UsedAt, invite.ExpiresAt, null, null));
        if (application is not null)
            records.Add(new("application", application.Id, Wire(application.Status), application.CreatedAt,
                application.UpdatedAt, application.SubmittedAt, null, null,
                application.ReviewedAt, null, null,
                application.DesiredMoveInDate));
        if (lease is not null)
        {
            records.Add(new("lease", lease.Id, lease.IsActive ? "active" : "inactive", null, lease.UpdatedAt,
                null, null, null, null, lease.EndDate, null, lease.StartDate));
            if (lease.AgreementId is long agreementId)
                records.Add(new("signature", agreementId,
                    lease.SignatureStatus is null ? "notSent" : Wire(lease.SignatureStatus.Value), null, null,
                    null, null, lease.SignatureSentAt, lease.SignatureCompletedAt, lease.SignatureExpiresAt, null, null));
        }
        if (lifecycleEvent is not null)
            records.Add(new("event", lifecycleEvent.Id, Wire(lifecycleEvent.EventType), null, null, null,
                lifecycleEvent.ScheduledAtUtc, null,
                lifecycleEvent.EventType == UnitLifecycleEventType.ShowingCompleted ? lifecycleEvent.OccurredAtUtc : null,
                null, lifecycleEvent.OccurredAtUtc, null));
        return records;
    }

    private IQueryable<ApplicationFact> ApplicationCandidates(long org, long propertyId, long unitId, bool allowLegacy,
        DateTime today) =>
        db.RentalApplications.AsNoTracking()
            .Where(x => x.OrganizationId == org && x.PropertyId == propertyId &&
                        (x.UnitId == unitId || (allowLegacy && x.UnitId == null)) &&
                        (x.Status == EApplicationStatus.Draft && db.Leads.Any(lead =>
                            lead.OrganizationId == org && lead.RentalApplicationId == x.Id) ||
                         x.Status == EApplicationStatus.Submitted || x.Status == EApplicationStatus.UnderReview ||
                         x.Status == EApplicationStatus.OnHold || x.Status == EApplicationStatus.Approved) &&
                        (x.ConvertedToLeaseId == null || !db.Leases.Any(lease =>
                            lease.Id == x.ConvertedToLeaseId && lease.EndDate != null && lease.EndDate < today)))
            .OrderByDescending(x => x.Status == EApplicationStatus.Approved ? 3
                : x.Status == EApplicationStatus.UnderReview || x.Status == EApplicationStatus.OnHold ? 2 : 1)
            .ThenByDescending(x => x.Status == EApplicationStatus.Approved ||
                                   x.Status == EApplicationStatus.UnderReview || x.Status == EApplicationStatus.OnHold
                ? x.ReviewedAt ?? x.UpdatedAt ?? x.SubmittedAt ?? x.CreatedAt
                : x.SubmittedAt ?? x.UpdatedAt ?? x.CreatedAt)
            .ThenByDescending(x => x.Id)
            .Select(x => new ApplicationFact(x.Id, x.Status, x.CreatedAt, x.UpdatedAt, x.SubmittedAt,
                x.ReviewedAt, x.DesiredMoveInDate, x.ConvertedToLeaseId));

    private async Task AuthorizeAsync(long organizationId, long actorUserId, CancellationToken ct)
    {
        if (organizationId <= 0) throw new PipelineForbiddenException();
        var allowed = await db.OrganizationMembers.AsNoTracking().AnyAsync(x => x.OrganizationId == organizationId &&
            x.UserId == actorUserId && x.IsActive && (x.Role == "Owner" || x.Role == "Manager"), ct);
        if (!allowed) throw new PipelineForbiddenException();
    }

    private async Task<bool> IsSingleUnitPropertyAsync(long organizationId, long propertyId, CancellationToken ct) =>
        await db.Units.AsNoTracking().CountAsync(x => x.OrganizationId == organizationId && x.PropertyId == propertyId, ct) == 1;

    private Task<bool> RevisionAlreadyTransitionedAsync(long organizationId, long propertyId, long unitId,
        string revision, CancellationToken ct) => db.UnitLifecycleEvents.AsNoTracking().AnyAsync(x =>
        x.OrganizationId == organizationId && x.PropertyId == propertyId && x.UnitId == unitId &&
        x.PreviousRevision == revision, ct);

    private Task<UnitLifecycleEvent?> FindReplayAsync(long organizationId, string keyHash, CancellationToken ct) =>
        db.UnitLifecycleEvents.AsNoTracking().SingleOrDefaultAsync(x =>
            x.OrganizationId == organizationId && x.IdempotencyKeyHash == keyHash, ct);

    private static void EnsureSameReplay(UnitLifecycleEvent prior, long propertyId, long unitId, string requestHash)
    {
        if (prior.PropertyId != propertyId || prior.UnitId != unitId ||
            !FixedTimeHashEquals(prior.RequestHash, requestHash))
            throw new PipelineConflictException("The idempotency key was already used with a different payload.");
    }

    private static LeasingPipelineDto ReplayResult(UnitLifecycleEvent audit)
    {
        LeasingPipelineDto? snapshot;
        try
        {
            snapshot = JsonSerializer.Deserialize<LeasingPipelineDto>(audit.ResultSnapshotJson, LeasingPipelineJson.Options);
        }
        catch (JsonException)
        {
            throw new PipelineConflictException("The stored idempotency result is invalid.");
        }
        catch (NotSupportedException)
        {
            throw new PipelineConflictException("The stored idempotency result is invalid.");
        }

        if (snapshot is null || snapshot.References is null || snapshot.RelevantRecords is null || snapshot.Stages is null ||
            snapshot.PropertyId != audit.PropertyId || snapshot.UnitId != audit.UnitId ||
            snapshot.Revision is null || snapshot.Revision.Length != 64 ||
            snapshot.References.EventId is not null ||
            snapshot.RelevantRecords.Any(x => x is null) || snapshot.Stages.Count != 11 ||
            snapshot.RelevantRecords.Any(x => x.Type == "event") ||
            snapshot.CurrentStage != audit.ResultingStage)
            throw new PipelineConflictException("The stored idempotency result is invalid.");

        return snapshot;
    }

    private static bool IsDuplicateUniqueKey(DbUpdateException exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
            if (current is SqlException { Number: 2601 or 2627 }) return true;
        return false;
    }

    private static void ValidateCommand(string revision, string idempotencyKey, ShowingTransitionRequest request)
    {
        if (string.IsNullOrWhiteSpace(revision) || string.IsNullOrWhiteSpace(idempotencyKey))
            throw new PipelineValidationException("If-Match and Idempotency-Key are required.");
        if (!Enum.IsDefined(typeof(UnitLifecycleEventType), request.EventType))
            throw new PipelineValidationException("EventType must be a supported showing transition.");
        if (idempotencyKey.Length > 200 || (request.Reason?.Length ?? 0) > 50)
            throw new PipelineValidationException("Transition metadata is too long.");
        if (request.Reason is not null && !AllowedReasonCodes.Contains(request.Reason))
            throw new PipelineValidationException("Reason must be an approved machine reason code.");
    }

    private static void ValidateTransition(LeasingPipelineDto current, ShowingTransitionRequest request)
    {
        var active = current.CurrentStage == LeasingLifecycleStage.ShowingScheduled;
        if (request.EventType == UnitLifecycleEventType.ShowingScheduled &&
            current.CurrentStage > LeasingLifecycleStage.ShowingScheduled)
            throw new PipelineConflictException("Showing evidence cannot move a unit backward or fabricate a later state.");
        if (request.EventType is UnitLifecycleEventType.ShowingRescheduled or UnitLifecycleEventType.ShowingCancelled or
            UnitLifecycleEventType.ShowingCompleted && !active)
            throw new PipelineConflictException("There is no active showing for this transition.");
        if (request.EventType is UnitLifecycleEventType.ShowingScheduled or UnitLifecycleEventType.ShowingRescheduled &&
            (request.ScheduledAtUtc is null || request.ScheduledAtUtc <= DateTime.UtcNow))
            throw new PipelineValidationException("A future UTC showing time is required.");
        if (request.EventType is UnitLifecycleEventType.ShowingCancelled or UnitLifecycleEventType.ShowingCompleted &&
            string.IsNullOrWhiteSpace(request.Reason))
            throw new PipelineValidationException("A reason is required.");
    }

    private static IReadOnlyDictionary<string, long> ActionData(string code, long propertyId, long unitId,
        LifecycleReferencesDto refs)
    {
        var data = new Dictionary<string, long> { ["propertyId"] = propertyId, ["unitId"] = unitId };
        if (code.Contains("Listing", StringComparison.OrdinalIgnoreCase) && refs.ListingId is long listingId)
            data["listingId"] = listingId;
        if ((code.Contains("Application", StringComparison.OrdinalIgnoreCase) ||
             code.Contains("Screening", StringComparison.OrdinalIgnoreCase)) && refs.ApplicationId is long applicationId)
            data["applicationId"] = applicationId;
        if ((code.Contains("Lease", StringComparison.OrdinalIgnoreCase) ||
             code.Contains("Signature", StringComparison.OrdinalIgnoreCase) || code == "prepareMoveIn") &&
            refs.LeaseId is long leaseId)
            data["leaseId"] = leaseId;
        return data;
    }

    private static string SafeDocumentName(string? value)
    {
        var normalized = string.Concat((value ?? string.Empty).Where(character => !char.IsControl(character))).Trim();
        if (normalized.Length == 0) return "Lease Agreement";
        return normalized.Length <= 120 ? normalized : normalized[..120];
    }

    private static string SafeDocumentType(string? value) => value?.Trim().ToLowerInvariant() switch
    {
        "pdf" => "pdf",
        "docx" => "docx",
        _ => "document"
    };

    private static string Wire<T>(T value) where T : struct, Enum
    {
        var text = value.ToString();
        return char.ToLowerInvariant(text[0]) + text[1..];
    }

    private static string NormalizeRevision(string value) => value.Trim().Trim('"');
    private static string Hash(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();

    private static bool FixedTimeHashEquals(string left, string right)
    {
        if (left.Length != right.Length) return false;
        return CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(left), Encoding.ASCII.GetBytes(right));
    }

    private sealed record ListingFact(long Id, EListingStatus Status, DateTime CreatedAt, DateTime? UpdatedAt,
        DateTime? ExpiresAt, DateTime? DateAvailable);
    private sealed record InviteFact(long Id, bool IsUsed, DateTime CreatedAt, DateTime? UsedAt,
        DateTime ExpiresAt, long? ApplicationId);
    private sealed record ApplicationFact(long Id, EApplicationStatus Status,
        DateTime CreatedAt, DateTime? UpdatedAt, DateTime? SubmittedAt,
        DateTime? ReviewedAt, DateTime? DesiredMoveInDate,
        long? ConvertedToLeaseId);
    private sealed record LeaseFact(long Id, bool IsActive, DateTime? StartDate, DateTime? EndDate,
        DateTime? UpdatedAt, long? AgreementId, ESignatureStatus? SignatureStatus, DateTime? SignatureSentAt,
        DateTime? SignatureCompletedAt, DateTime? SignatureExpiresAt, bool HasDocuSignEnvelope,
        DateTime? LandlordSignedAt, bool HasSignedDocument);
    private sealed record DocumentFact(string? Name, string? Type, DateTime GeneratedAt);
    private sealed record SignerFact(int TenantCount, int SignedTenantCount);
    private sealed record EventFact(long Id, UnitLifecycleEventType EventType, DateTime? ScheduledAtUtc,
        DateTime OccurredAtUtc, string RequestHash, string? Reason, string PreviousRevision,
        LeasingLifecycleStage PreviousStage, LeasingLifecycleStage ResultingStage)
    {
        public static EventFact From(UnitLifecycleEvent value) => new(value.Id, value.EventType, value.ScheduledAtUtc,
            value.OccurredAtUtc, value.RequestHash, value.Reason, value.PreviousRevision, value.PreviousStage,
            value.ResultingStage);
    }

    private sealed record EventRevisionFact(UnitLifecycleEventType EventType, DateTime? ScheduledAtUtc,
        DateTime OccurredAtUtc, string RequestHash, string? Reason, string PreviousRevision,
        LeasingLifecycleStage PreviousStage, LeasingLifecycleStage ResultingStage)
    {
        public static EventRevisionFact From(EventFact value, LeasingLifecycleStage resultingStage) => new(
            value.EventType, value.ScheduledAtUtc, value.OccurredAtUtc, value.RequestHash, value.Reason,
            value.PreviousRevision, value.PreviousStage, resultingStage);
    }

    private sealed record TransitionRequestCanonical(long OrganizationId, long PropertyId, long UnitId,
        UnitLifecycleEventType EventType, DateTime? ScheduledAtUtc, string? Reason);
    private sealed record RevisionCanonical(long PropertyId, long UnitId, LeasingLifecycleStage CurrentStage,
        IReadOnlyList<LifecycleStageDescriptorDto> Stages, LifecycleBlockerDto? Blocker,
        LifecycleActionDto? PrimaryAction, LifecycleReferencesDto References,
        IReadOnlyList<LifecycleRecordDto> RelevantRecords, LeaseDocumentSummaryDto? LeaseDocument,
        ESignatureSummaryDto? ESignature, LeasingPipelineFacts DecisionFacts,
        ListingFact? Listing, InviteFact? Invite, ApplicationFact? Application, LeaseFact? Lease,
        EventRevisionFact? Event, bool UnitOccupied, bool HasTerminalApplication);
}
