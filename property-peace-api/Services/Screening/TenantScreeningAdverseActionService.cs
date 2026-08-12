using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using brownstone_hub_api.Data;
using brownstone_hub_api.Domain.Screening;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace brownstone_hub_api.Services.Screening;

public sealed class TenantScreeningAdverseActionService : ITenantScreeningAdverseActionService
{
    private readonly DataContext _db;
    private readonly IAdverseActionPolicyResolver _policy;
    private readonly IScreeningNoticeDelivery _delivery;
    private readonly TimeProvider _clock;
    private readonly IScreeningPropertyAuthority _propertyAuthority;
    private readonly ScreeningHostedWorkerOptions _retry;
    private readonly IScreeningIncidentRecorder _incidentRecorder;
    public TenantScreeningAdverseActionService(DataContext db, IAdverseActionPolicyResolver policy,
        IScreeningNoticeDelivery delivery, TimeProvider clock, IScreeningPropertyAuthority? propertyAuthority = null,
        IOptions<ScreeningHostedWorkerOptions>? retryOptions = null,
        IScreeningIncidentRecorder? incidentRecorder = null)
    {
        _db = db ?? throw new ArgumentNullException(nameof(db));
        _policy = policy ?? throw new ArgumentNullException(nameof(policy));
        _delivery = delivery ?? throw new ArgumentNullException(nameof(delivery));
        _clock = clock ?? throw new ArgumentNullException(nameof(clock));
        _propertyAuthority = propertyAuthority ?? new ScreeningPropertyAuthority(db);
        _retry = retryOptions?.Value ?? new ScreeningHostedWorkerOptions();
        _incidentRecorder = incidentRecorder ?? new ScreeningIncidentRecorder(db, clock);
    }

    public async Task<ScreeningAdverseActionResult> CreateAndDeliverAsync(CreateScreeningAdverseActionCommand command, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command); Ids(command.OrganizationId, command.ActorUserId, command.ScreeningOrderId, command.DecisionRevisionId);
        if (!Enum.IsDefined(command.ActionType) || !Enum.IsDefined(command.Channel)) throw new ArgumentOutOfRangeException(nameof(command));
        await _propertyAuthority.EnsureOrganizationCapabilityAsync(command.OrganizationId, command.ActorUserId,
            cancellationToken);
        var order = await _db.TenantScreeningOrders.SingleOrDefaultAsync(x => x.Id == command.ScreeningOrderId && x.OrganizationId == command.OrganizationId, cancellationToken)
            ?? throw new ScreeningResourceNotFoundException("screening order");
        await PropertyAuthority.EnsurePropertyAuthorityAsync(command.OrganizationId, command.ActorUserId,
            order.PropertyId, cancellationToken);
        var decision = await _db.ScreeningRentalDecisionRevisions.SingleOrDefaultAsync(x => x.Id == command.DecisionRevisionId &&
            x.OrganizationId == command.OrganizationId && x.TenantScreeningOrderId == order.Id && x.RentalApplicationId == order.RentalApplicationId, cancellationToken)
            ?? throw new ScreeningProviderCorrelationException();
        if (decision.Decision is not (ScreeningRentalDecision.Denied or ScreeningRentalDecision.Conditional))
            throw new InvalidOperationException("Only an existing human denied or conditional decision is eligible for adverse action.");
        if (decision.IsFrozenByDispute || decision.DisputeStatus == ScreeningDecisionDisputeStatus.Frozen ||
            await HasOpenDisputeAsync(order.Id, cancellationToken))
            throw new InvalidOperationException("A dispute freezes adverse-action creation.");
        if (!decision.ReliedUponScreeningReportRevisionId.HasValue)
            throw new InvalidOperationException("Adverse action requires a relied-upon screening report.");
        var report = await _db.ScreeningReportRevisions.SingleOrDefaultAsync(x => x.Id == decision.ReliedUponScreeningReportRevisionId &&
            x.TenantScreeningOrderId == order.Id && x.OrganizationId == order.OrganizationId, cancellationToken)
            ?? throw new ScreeningProviderCorrelationException();
        var latestReport = await _db.ScreeningReportRevisions.Where(x => x.TenantScreeningOrderId == order.Id &&
                x.OrganizationId == order.OrganizationId && x.DeletedAt == null)
            .OrderByDescending(x => x.Revision).FirstOrDefaultAsync(cancellationToken);
        if (latestReport is null || latestReport.Id != report.Id || report.DeletedAt.HasValue ||
            report.Status is not (ScreeningReportStatus.Complete or ScreeningReportStatus.Corrected))
            throw new InvalidOperationException("Adverse action requires the relied-upon current nondeleted complete or corrected latest report.");
        var existing = await _db.ScreeningAdverseActions.SingleOrDefaultAsync(x => x.OrganizationId == command.OrganizationId &&
            x.OriginalScreeningRentalDecisionRevisionId == decision.Id && x.ActionType == command.ActionType, cancellationToken);
        if (existing is not null)
            return await DeliverAsync(existing, existing.ImmutableNoticeContent, command.Channel, cancellationToken);
        var snapshot = await ResolveAsync(order, command.ActionType, cancellationToken);
        var content = Compose(snapshot, decision.ReasonCodesJson);
        var hash = Hash(content);
        var statutory = $"{snapshot.CraDidNotDecideStatement}\n{snapshot.DisputeRightsStatement}\n{snapshot.FreeReportRightsStatement}";
        var now = _clock.GetUtcNow();
        var adverse = new ScreeningAdverseAction
        {
            TenantScreeningOrderId = order.Id, OrganizationId = order.OrganizationId, RentalApplicationId = order.RentalApplicationId,
            DecisionActorUserId = decision.DecisionActorUserId, OriginalScreeningRentalDecisionRevisionId = decision.Id,
            OriginalScreeningReportRevisionId = report.Id, ActionType = command.ActionType, ReasonCodesJson = decision.ReasonCodesJson,
            RentalCriteriaVersion = decision.CriteriaVersion, CraContactName = snapshot.CraName, CraContactAddress = snapshot.CraAddress,
            CraContactPhone = snapshot.CraPhone, NoticeVersion = snapshot.NoticeVersion, ImmutableNoticeContent = content, NoticeContentSha256Hash = hash,
            StatutoryDisclosureVersion = snapshot.StatutoryDisclosureVersion, StatutoryDisclosureSha256Hash = Hash(statutory),
            StateLocalDisclosureVersion = snapshot.StateLocalDisclosureVersion, StateLocalDisclosureSha256Hash = Hash(snapshot.StateLocalDisclosure),
            JurisdictionCode = snapshot.JurisdictionCode, CreatedAt = now
        };
        _db.ScreeningAdverseActions.Add(adverse);
        await _db.SaveChangesAsync(cancellationToken); // immutable evidence exists before external delivery
        return await DeliverAsync(adverse, content, command.Channel, cancellationToken);
    }

    public async Task<ScreeningAdverseActionResult> RetryDeliveryAsync(RetryScreeningAdverseActionDeliveryCommand command, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command); Ids(command.OrganizationId, command.ActorUserId, command.AdverseActionId);
        var adverse = await LoadStaffNoticeAsync(command.OrganizationId, command.ActorUserId,
            command.AdverseActionId, cancellationToken);
        if (Hash(adverse.ImmutableNoticeContent) != adverse.NoticeContentSha256Hash)
            throw new InvalidOperationException("The immutable notice evidence failed integrity verification; retry was refused.");
        return await DeliverAsync(adverse, adverse.ImmutableNoticeContent, command.Channel, cancellationToken);
    }

    /// <summary>Worker-only recovery rooted in immutable notice/order scope, never a historical employee account.</summary>
    internal async Task<ScreeningAdverseActionResult> RetryDeliveryFromSystemIntentAsync(long organizationId,
        long adverseActionId, ScreeningAdverseActionDeliveryChannel channel, Guid leaseId,
        CancellationToken cancellationToken = default)
    {
        if (organizationId <= 0 || adverseActionId <= 0) throw new ArgumentOutOfRangeException(nameof(adverseActionId));
        var adverse = await _db.ScreeningAdverseActions.SingleOrDefaultAsync(x =>
            x.Id == adverseActionId && x.OrganizationId == organizationId, cancellationToken)
            ?? throw new ScreeningResourceNotFoundException("adverse action");
        var durableOrder = await _db.TenantScreeningOrders.AsNoTracking().AnyAsync(x =>
            x.Id == adverse.TenantScreeningOrderId && x.OrganizationId == organizationId &&
            x.RentalApplicationId == adverse.RentalApplicationId, cancellationToken);
        if (!durableOrder) throw new ScreeningProviderCorrelationException();
        var latest = await _db.ScreeningAdverseActionDeliveryAttempts
            .Where(x => x.ScreeningAdverseActionId == adverse.Id && x.Channel == channel)
            .OrderByDescending(x => x.AttemptNumber).FirstOrDefaultAsync(cancellationToken)
            ?? throw new ScreeningResourceNotFoundException("adverse-action delivery attempt");
        if (latest.ProcessingLeaseId != leaseId || latest.ProcessingLeaseUntil <= _clock.GetUtcNow())
            throw new InvalidOperationException("The adverse-action recovery lease is not owned by this worker.");
        if (latest.AttemptNumber >= _retry.AdverseActionMaximumAttempts)
        {
            await ScheduleFailureAsync(adverse, latest, "MaximumDeliveryAttemptsExceeded", cancellationToken);
            return new(adverse.Id, adverse.ActionType, latest.Status, latest.AttemptNumber, adverse.CreatedAt);
        }
        latest.ReleaseRecoveryLease();
        if (Hash(adverse.ImmutableNoticeContent) != adverse.NoticeContentSha256Hash)
            throw new InvalidOperationException("The immutable notice evidence failed integrity verification; retry was refused.");
        return await DeliverAsync(adverse, adverse.ImmutableNoticeContent, channel, cancellationToken);
    }

    public Task<ScreeningReconsiderationResult> RequestReconsiderationAsync(ScreeningReconsiderationCommand command, CancellationToken cancellationToken = default) =>
        AppendReconsiderationAsync(command.OrganizationId, command.ActorUserId, command.AdverseActionId, command.Reason,
            ScreeningReconsiderationStatus.Requested, null, cancellationToken);

    public Task<ScreeningReconsiderationResult> ResolveReconsiderationAsync(ResolveScreeningReconsiderationCommand command, CancellationToken cancellationToken = default) =>
        AppendReconsiderationAsync(command.OrganizationId, command.ActorUserId, command.AdverseActionId, command.Reason,
            ScreeningReconsiderationStatus.Resolved, command.NewDecisionRevisionId, cancellationToken);

    public async Task<ApplicantAdverseActionNoticeSummary> GetApplicantNoticeAsync(string rawToken, CancellationToken cancellationToken = default)
    {
        var order = await ResolveApplicantOrderAsync(rawToken, cancellationToken);
        var adverse = await _db.ScreeningAdverseActions.AsNoTracking().Where(x => x.TenantScreeningOrderId == order.Id)
            .OrderByDescending(x => x.CreatedAt).FirstOrDefaultAsync(cancellationToken)
            ?? throw new ScreeningResourceNotFoundException("adverse-action notice");
        var attempt = await _db.ScreeningAdverseActionDeliveryAttempts.AsNoTracking().Where(x => x.ScreeningAdverseActionId == adverse.Id)
            .OrderByDescending(x => x.AttemptNumber).FirstOrDefaultAsync(cancellationToken);
        var reconsideration = await _db.ScreeningReconsiderationEvents.AsNoTracking().Where(x => x.ScreeningAdverseActionId == adverse.Id)
            .OrderByDescending(x => x.Revision).Select(x => (ScreeningReconsiderationStatus?)x.ToStatus).FirstOrDefaultAsync(cancellationToken)
            ?? ScreeningReconsiderationStatus.NotRequested;
        if (!CryptographicOperations.FixedTimeEquals(
                Convert.FromHexString(Hash(adverse.ImmutableNoticeContent)),
                Convert.FromHexString(adverse.NoticeContentSha256Hash)))
            throw new InvalidOperationException("The immutable notice evidence failed integrity verification.");
        var immutable = ParseImmutableNotice(adverse.ImmutableNoticeContent);
        var statutory = $"{immutable.CraDidNotDecideStatement}\n{immutable.DisputeRightsStatement}\n{immutable.FreeCopyRightsStatement}";
        if (!CryptographicOperations.FixedTimeEquals(Convert.FromHexString(Hash(statutory)),
                Convert.FromHexString(adverse.StatutoryDisclosureSha256Hash)) ||
            !CryptographicOperations.FixedTimeEquals(Convert.FromHexString(Hash(immutable.JurisdictionDisclosure)),
                Convert.FromHexString(adverse.StateLocalDisclosureSha256Hash)))
            throw new InvalidOperationException("The immutable disclosure evidence failed integrity verification.");
        return new(adverse.ActionType, adverse.CreatedAt, JsonSerializer.Deserialize<string[]>(adverse.ReasonCodesJson) ?? [],
            attempt?.Status ?? ScreeningDeliveryAttemptStatus.Requested, attempt?.DeliveredAt, reconsideration, "/support/screening",
            adverse.NoticeVersion, adverse.NoticeContentSha256Hash, adverse.ImmutableNoticeContent,
            adverse.CraContactName, adverse.CraContactAddress, adverse.CraContactPhone,
            immutable.CraDidNotDecideStatement, immutable.DisputeRightsStatement, immutable.FreeCopyRightsStatement,
            adverse.JurisdictionCode, adverse.StateLocalDisclosureVersion, immutable.JurisdictionDisclosure);
    }

    public async Task<ScreeningReconsiderationResult> RequestApplicantReconsiderationAsync(string rawToken, string reason,
        CancellationToken cancellationToken = default)
    {
        Text(reason, 1000);
        var order = await ResolveApplicantOrderAsync(rawToken, cancellationToken);
        var adverse = await _db.ScreeningAdverseActions.Where(x => x.TenantScreeningOrderId == order.Id)
            .OrderByDescending(x => x.CreatedAt).FirstOrDefaultAsync(cancellationToken)
            ?? throw new ScreeningResourceNotFoundException("adverse-action notice");
        // The immutable notice's decision actor is used only as the existing required persistence actor;
        // the public result never exposes it. The event remains append-only and applicant-scoped by token.
        return await AppendReconsiderationAsync(order.OrganizationId, adverse.DecisionActorUserId, adverse.Id, reason,
            ScreeningReconsiderationStatus.Requested, null, cancellationToken, authorizeStaff: false);
    }

    private async Task<ScreeningAdverseActionResult> DeliverAsync(ScreeningAdverseAction adverse, string content,
        ScreeningAdverseActionDeliveryChannel channel, CancellationToken ct)
    {
        var terminal = await _db.ScreeningAdverseActionDeliveryAttempts.Where(x =>
                x.ScreeningAdverseActionId == adverse.Id && x.Channel == channel &&
                (x.Status == ScreeningDeliveryAttemptStatus.Delivered ||
                 x.Status == ScreeningDeliveryAttemptStatus.DeadLettered))
            .OrderByDescending(x => x.AttemptNumber).FirstOrDefaultAsync(ct);
        if (terminal is not null)
            return new(adverse.Id, adverse.ActionType, terminal.Status, terminal.AttemptNumber, adverse.CreatedAt);

        // Each actual provider send appends a fresh evidence row. The logical-send key remains
        // stable so replay after an ambiguous provider response cannot create duplicate delivery.
        var attemptNumber = checked((await _db.ScreeningAdverseActionDeliveryAttempts
            .Where(x => x.ScreeningAdverseActionId == adverse.Id)
            .MaxAsync(x => (int?)x.AttemptNumber, ct) ?? 0) + 1);
        var attempt = new ScreeningAdverseActionDeliveryAttempt
        {
            ScreeningAdverseActionId = adverse.Id, OrganizationId = adverse.OrganizationId, AttemptNumber = attemptNumber,
            Channel = channel, NoticeContentSha256Hash = adverse.NoticeContentSha256Hash,
            ProviderIdempotencyKey = Hash($"property-peace-adverse-delivery-v1\n{adverse.OrganizationId}\n{adverse.Id}\n{channel}")
        };
        _db.ScreeningAdverseActionDeliveryAttempts.Add(attempt);
        attempt.MarkRequested(_clock.GetUtcNow());
        await _db.SaveChangesAsync(ct); // durable intent must precede the external side effect
        ScreeningNoticeDeliveryOutcome outcome;
        try
        {
            outcome = await _delivery.DeliverAsync(new ScreeningNoticeDeliveryRequest(adverse.Id, adverse.OrganizationId,
                adverse.TenantScreeningOrderId, adverse.RentalApplicationId, attempt.AttemptNumber, channel, content,
                adverse.NoticeContentSha256Hash, attempt.ProviderIdempotencyKey), ct);
        }
        catch (Exception) when (!ct.IsCancellationRequested)
        {
            await ScheduleFailureAsync(adverse, attempt, "DeliveryProviderException", CancellationToken.None);
            throw;
        }
        if (!Enum.IsDefined(outcome.Status) || outcome.Status == ScreeningDeliveryAttemptStatus.Requested ||
            outcome.Status == ScreeningDeliveryAttemptStatus.Delivered != outcome.DeliveredAt.HasValue)
        {
            await ScheduleFailureAsync(adverse, attempt, "InvalidDeliveryEvidence", CancellationToken.None);
            throw new InvalidOperationException("Delivery returned inconsistent status evidence.");
        }
        if (outcome.DeliveryReference is not null && (Uri.IsWellFormedUriString(outcome.DeliveryReference, UriKind.Absolute) || outcome.DeliveryReference.Length > 200))
        {
            await ScheduleFailureAsync(adverse, attempt, "InvalidDeliveryEvidence", CancellationToken.None);
            throw new InvalidOperationException("Delivery returned prohibited reference evidence.");
        }
        if (outcome.Status == ScreeningDeliveryAttemptStatus.Delivered)
            attempt.MarkDelivered(outcome.DeliveryReference, outcome.DeliveredAt!.Value);
        else
        {
            await ScheduleFailureAsync(adverse, attempt, SafeFailureCode(outcome.FailureCode), ct);
            return new(adverse.Id, adverse.ActionType, attempt.Status, attempt.AttemptNumber, adverse.CreatedAt);
        }
        await _db.SaveChangesAsync(ct);
        return new(adverse.Id, adverse.ActionType, attempt.Status, attempt.AttemptNumber, adverse.CreatedAt);
    }

    private async Task ScheduleFailureAsync(ScreeningAdverseAction adverse,
        ScreeningAdverseActionDeliveryAttempt attempt, string failureCode, CancellationToken cancellationToken)
    {
        var now = _clock.GetUtcNow();
        var deadLettered = attempt.ScheduleFailure(failureCode, now,
            now.Add(_retry.RetryDelay(attempt.AttemptNumber)), _retry.AdverseActionMaximumAttempts);
        if (deadLettered)
        {
            await _incidentRecorder.RecordAsync(new ScreeningIncidentRecord(adverse.OrganizationId,
                adverse.TenantScreeningOrderId, null, null, ScreeningIncidentType.AdverseActionDeliveryDeadLetter,
                ScreeningIncidentSeverity.High, "adverse-action-delivery-recovery",
                $"adverse-action-delivery:{adverse.OrganizationId}:{adverse.Id}:{attempt.Channel}",
                failureCode, null, null), cancellationToken);
        }
        else await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task<ScreeningReconsiderationResult> AppendReconsiderationAsync(long org, long actor, long adverseId,
        string reason, ScreeningReconsiderationStatus target, long? newDecisionId, CancellationToken ct, bool authorizeStaff = true)
    {
        Ids(org, actor, adverseId); Text(reason, 1000);
        var adverse = authorizeStaff
            ? await LoadStaffNoticeAsync(org, actor, adverseId, ct)
            : await _db.ScreeningAdverseActions.SingleOrDefaultAsync(x => x.Id == adverseId && x.OrganizationId == org, ct)
              ?? throw new ScreeningResourceNotFoundException("adverse action");
        var prior = await _db.ScreeningReconsiderationEvents.Where(x => x.ScreeningAdverseActionId == adverse.Id)
            .OrderByDescending(x => x.Revision).FirstOrDefaultAsync(ct);
        var from = prior?.ToStatus ?? ScreeningReconsiderationStatus.NotRequested;
        if (target == ScreeningReconsiderationStatus.Requested && from != ScreeningReconsiderationStatus.NotRequested ||
            target == ScreeningReconsiderationStatus.Resolved && from is not (ScreeningReconsiderationStatus.Requested or ScreeningReconsiderationStatus.UnderReview))
            throw new InvalidOperationException("Illegal reconsideration status transition.");
        if (newDecisionId.HasValue && !await _db.ScreeningRentalDecisionRevisions.AnyAsync(x => x.Id == newDecisionId &&
            x.OrganizationId == org && x.TenantScreeningOrderId == adverse.TenantScreeningOrderId && x.RentalApplicationId == adverse.RentalApplicationId, ct))
            throw new ScreeningProviderCorrelationException();
        var now = _clock.GetUtcNow();
        var evt = new ScreeningReconsiderationEvent { ScreeningAdverseActionId = adverse.Id, TenantScreeningOrderId = adverse.TenantScreeningOrderId,
            OrganizationId = org, Revision = checked((prior?.Revision ?? 0) + 1), FromStatus = from, ToStatus = target,
            OccurredAt = now, RecordedAt = now, ActorUserId = actor,
            ReasonSha256Hash = Hash($"reconsideration-v1\n{org}\n{adverse.Id}\n{reason}"), NewScreeningRentalDecisionRevisionId = newDecisionId };
        _db.ScreeningReconsiderationEvents.Add(evt); await _db.SaveChangesAsync(ct);
        return new(adverse.Id, evt.Revision, evt.ToStatus, evt.OccurredAt, evt.NewScreeningRentalDecisionRevisionId,
            target == ScreeningReconsiderationStatus.Requested ? "Reconsideration request received." : "Reconsideration resolved.");
    }

    private async Task<TenantScreeningOrder> ResolveApplicantOrderAsync(string rawToken, CancellationToken ct)
    {
        Text(rawToken, 500);
        var hash = Hash($"property-peace-applicant-invitation-v1\n{rawToken}");
        var order = await _db.TenantScreeningOrders.SingleOrDefaultAsync(x => x.ApplicantAccessTokenHash == hash, ct)
            ?? throw new ScreeningInvalidInvitationException();
        if (order.ApplicantAccessExpiresAt is null || order.ApplicantAccessExpiresAt <= _clock.GetUtcNow())
            throw new ScreeningAccessExpiredException();
        return order;
    }

    private async Task<AdverseActionPolicySnapshot> ResolveAsync(TenantScreeningOrder order, ScreeningAdverseActionType type, CancellationToken ct)
    {
        var policy = await _policy.ResolveAsync(new(order.OrganizationId, order.Id, order.RentalApplicationId, order.JurisdictionCode, type), ct)
            ?? throw new ScreeningPolicyViolationException("adverse-action policy is missing");
        if (!string.Equals(policy.JurisdictionCode, order.JurisdictionCode, StringComparison.Ordinal)) throw new ScreeningPolicyViolationException("jurisdiction differs");
        if (policy.FreeReportRightsStatement.Contains('{') || policy.FreeReportRightsStatement.Contains('}'))
            throw new ScreeningPolicyViolationException("free-report period placeholder is unresolved");
        return policy;
    }
    private static string Compose(AdverseActionPolicySnapshot p, string reasonsJson)
    {
        var reasons = JsonSerializer.Deserialize<string[]>(reasonsJson) ?? [];
        if (reasons.Length == 0) throw new InvalidOperationException("Adverse action requires the human decision reasons.");
        return $"Notice version: {p.NoticeVersion}\nCRA: {p.CraName}\nAddress: {p.CraAddress}\nPhone: {p.CraPhone}\n{p.CraDidNotDecideStatement}\n{p.DisputeRightsStatement}\n{p.FreeReportRightsStatement}\nDecision reasons: {string.Join(", ", reasons)}\nState/local disclosure ({p.StateLocalDisclosureVersion}): {p.StateLocalDisclosure}";
    }
    private static ParsedImmutableNotice ParseImmutableNotice(string content)
    {
        var lines = content.Split('\n');
        if (lines.Length < 9 || !lines[0].StartsWith("Notice version: ", StringComparison.Ordinal) ||
            !lines[1].StartsWith("CRA: ", StringComparison.Ordinal) || !lines[2].StartsWith("Address: ", StringComparison.Ordinal) ||
            !lines[3].StartsWith("Phone: ", StringComparison.Ordinal) ||
            !lines[^1].StartsWith("State/local disclosure (", StringComparison.Ordinal))
            throw new InvalidOperationException("The immutable notice evidence has an unsupported format.");
        var separator = lines[^1].IndexOf(": ", StringComparison.Ordinal);
        if (separator < 0) throw new InvalidOperationException("The immutable notice evidence has an unsupported format.");
        return new(lines[4], lines[5], lines[6], lines[^1][(separator + 2)..]);
    }
    private sealed record ParsedImmutableNotice(string CraDidNotDecideStatement, string DisputeRightsStatement,
        string FreeCopyRightsStatement, string JurisdictionDisclosure);
    private Task<bool> HasOpenDisputeAsync(long orderId, CancellationToken ct) => _db.ScreeningDisputes.AnyAsync(x => x.TenantScreeningOrderId == orderId && x.Status != ScreeningDisputeStatus.Resolved && x.Status != ScreeningDisputeStatus.Rejected, ct);
    private IScreeningPropertyAuthority PropertyAuthority =>
        _propertyAuthority ?? new ScreeningPropertyAuthority(_db);

    private async Task<ScreeningAdverseAction> LoadStaffNoticeAsync(long org, long actor, long adverseId,
        CancellationToken ct)
    {
        // Establish actor capability first, then resolve only within the claimed organization. The
        // property assignment check is performed from the durable order, never from caller input.
        await PropertyAuthority.EnsureOrganizationCapabilityAsync(org, actor, ct);
        var resolved = await _db.ScreeningAdverseActions.AsNoTracking()
            .Where(x => x.Id == adverseId && x.OrganizationId == org)
            .Join(_db.TenantScreeningOrders.AsNoTracking(), x => x.TenantScreeningOrderId, x => x.Id,
                (notice, order) => new { Notice = notice, order.PropertyId, OrderOrganizationId = order.OrganizationId })
            .SingleOrDefaultAsync(ct);
        if (resolved is null || resolved.OrderOrganizationId != org)
            throw new ScreeningResourceNotFoundException("adverse action");
        await PropertyAuthority.EnsurePropertyAuthorityAsync(org, actor, resolved.PropertyId, ct);
        return await _db.ScreeningAdverseActions.SingleAsync(x => x.Id == adverseId && x.OrganizationId == org, ct);
    }
    private static void Ids(params long[] ids) { if (ids.Any(x => x <= 0)) throw new ArgumentOutOfRangeException(nameof(ids)); }
    private static void Text(string value, int max) => ScreeningContractValidation.ValidateBoundedText(value, max, nameof(value), false);
    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
    private static string SafeFailureCode(string? value) => value is { Length: > 0 and <= 100 } &&
        value.All(c => char.IsAsciiLetterOrDigit(c) || c is '.' or '_' or '-') ? value : "ProviderDeliveryFailed";
}

public sealed class TenantScreeningRetentionService : ITenantScreeningRetentionService
{
    private static readonly TimeSpan ClaimLease = TimeSpan.FromMinutes(5);
    private const int MaximumReportsPerRun = 100;
    private readonly DataContext _db; private readonly IScreeningProviderGateway _gateway; private readonly TimeProvider _clock;
    public TenantScreeningRetentionService(DataContext db, IScreeningProviderGateway gateway, TimeProvider clock) =>
        (_db, _gateway, _clock) = (db ?? throw new ArgumentNullException(nameof(db)),
            gateway ?? throw new ArgumentNullException(nameof(gateway)), clock ?? throw new ArgumentNullException(nameof(clock)));

    public async Task<int> DeleteDueReportsAsync(long organizationId, CancellationToken cancellationToken = default)
    {
        if (organizationId <= 0) throw new ArgumentOutOfRangeException(nameof(organizationId));
        var deleted = 0;
        for (var i = 0; i < MaximumReportsPerRun; i++)
        {
            var claim = await ClaimNextDueReportAsync(organizationId, cancellationToken);
            if (claim is null) break;
            if (await ExecuteClaimAsync(claim, cancellationToken)) deleted++;
        }
        return deleted;
    }

    public async Task<ScreeningReportDeletionClaim?> ClaimNextDueReportAsync(long organizationId,
        CancellationToken cancellationToken = default)
    {
        if (organizationId <= 0) throw new ArgumentOutOfRangeException(nameof(organizationId));
        var now = _clock.GetUtcNow();
        var report = await _db.ScreeningReportRevisions
            .Where(x => x.OrganizationId == organizationId && x.DeletedAt == null && x.RetentionExpiresAt <= now &&
                !x.IsUnderLegalHold && x.PendingDisputeOperationId == null &&
                (x.DeletionClaimToken == null || x.DeletionClaimExpiresAt <= now) &&
                !_db.ScreeningDisputes.Any(d => (d.OriginalScreeningReportRevisionId == x.Id || d.CorrectedScreeningReportRevisionId == x.Id) &&
                    d.Status != ScreeningDisputeStatus.Resolved && d.Status != ScreeningDisputeStatus.Rejected))
            .OrderBy(x => x.RetentionExpiresAt).ThenBy(x => x.Id).FirstOrDefaultAsync(cancellationToken);
        if (report is null) return null;

        var reclaimed = report.DeletionClaimToken.HasValue;
        var token = Guid.NewGuid();
        report.DeletionClaimToken = token;
        report.DeletionClaimedAt = now;
        report.DeletionClaimExpiresAt = now.Add(ClaimLease);
        report.DeleteRequestedAt ??= now;
        await AppendEventAsync(report, reclaimed ? ScreeningReportDeletionEventType.ReclaimedAfterLeaseExpiry :
            ScreeningReportDeletionEventType.Claimed, null, now, cancellationToken);
        try { await _db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException) { _db.ChangeTracker.Clear(); return null; }
        catch (DbUpdateException) { _db.ChangeTracker.Clear(); return null; }
        return new ScreeningReportDeletionClaim(organizationId, report.Id, token, report.DeletionClaimExpiresAt.Value,
            report.TenantScreeningOrderId);
    }

    public async Task<bool> ExecuteClaimAsync(ScreeningReportDeletionClaim claim, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(claim);
        _db.ChangeTracker.Clear();
        var report = await _db.ScreeningReportRevisions.SingleOrDefaultAsync(x => x.Id == claim.ReportRevisionId &&
            x.OrganizationId == claim.OrganizationId, cancellationToken);
        if (report is null || report.DeletedAt.HasValue || report.DeletionClaimToken != claim.ClaimToken ||
            report.IsUnderLegalHold || report.PendingDisputeOperationId.HasValue ||
            await HasOpenDisputeAsync(report.Id, cancellationToken)) return false;
        if (report.DeletionClaimExpiresAt <= _clock.GetUtcNow()) return false;

        var order = await _db.TenantScreeningOrders.SingleAsync(x => x.Id == report.TenantScreeningOrderId &&
            x.OrganizationId == claim.OrganizationId, cancellationToken);
        if (order.ProviderOrderId is null) throw new ScreeningProviderCorrelationException();
        var request = new ScreeningReportDeletionRequest(claim.OrganizationId, order.RentalApplicationId, order.Id,
            report.Id, order.ProviderOrderId, report.ProviderReportReference);

        var recoveringAmbiguousCall = report.DeletionProviderCallStartedAt.HasValue;
        if (recoveringAmbiguousCall)
        {
            ScreeningReportDeletionSnapshot snapshot;
            try { snapshot = await _gateway.IntrospectReportDeletionAsync(request, cancellationToken); }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
            catch { snapshot = new ScreeningReportDeletionSnapshot(ScreeningReportDeletionStatus.Unknown, "introspection-failed"); }

            // Re-read preservation fences after introspection and before either replay or finalization.
            _db.ChangeTracker.Clear();
            report = await _db.ScreeningReportRevisions.SingleAsync(x => x.Id == claim.ReportRevisionId, cancellationToken);
            if (report.DeletionClaimToken != claim.ClaimToken || report.IsUnderLegalHold ||
                report.PendingDisputeOperationId.HasValue || await HasOpenDisputeAsync(report.Id, cancellationToken))
            {
                await RecordManualOutcomeAsync(report, "PreservationFencePending", cancellationToken);
                return false;
            }
            if (snapshot.Status is ScreeningReportDeletionStatus.Deleted or ScreeningReportDeletionStatus.NotFound)
                return await FinalizeDeletionAsync(report, ScreeningReportDeletionEventType.ProviderDeletionReconciled,
                    "ProviderStatusReconciled", cancellationToken);
            // Present and Unknown are safe to replay because the provider contract is idempotent on the stable key.
        }
        else
        {
            var now = _clock.GetUtcNow();
            report.DeletionProviderCallStartedAt = now;
            await AppendEventAsync(report, ScreeningReportDeletionEventType.ProviderCallStarted, null, now, cancellationToken);
            try { await _db.SaveChangesAsync(cancellationToken); }
            catch (DbUpdateConcurrencyException) { _db.ChangeTracker.Clear(); return false; }
        }

        // Final preservation read immediately before the idempotent external operation.
        _db.ChangeTracker.Clear();
        report = await _db.ScreeningReportRevisions.SingleAsync(x => x.Id == claim.ReportRevisionId, cancellationToken);
        if (report.DeletionClaimToken != claim.ClaimToken || report.IsUnderLegalHold ||
            report.PendingDisputeOperationId.HasValue || await HasOpenDisputeAsync(report.Id, cancellationToken))
            return false;

        ScreeningProviderOperationResult result;
        try { result = await _gateway.DeleteReportAsync(request, cancellationToken); }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch
        {
            _db.ChangeTracker.Clear();
            report = await _db.ScreeningReportRevisions.SingleAsync(x => x.Id == claim.ReportRevisionId, CancellationToken.None);
            await AppendEventAsync(report, ScreeningReportDeletionEventType.ProviderOutcomeAmbiguous,
                "ProviderOutcomeUnknown", _clock.GetUtcNow(), CancellationToken.None);
            await AddIncidentAsync(report, ScreeningIncidentType.ProviderDeletionFailure, ScreeningIncidentSeverity.High,
                "provider-deletion-ambiguous", "ManualReconciliationRequired", CancellationToken.None);
            await _db.SaveChangesAsync(CancellationToken.None);
            return false;
        }
        if (result.Status is not ("deleted" or "not_found" or "already_deleted"))
        {
            await RecordManualOutcomeAsync(report, "ProviderDidNotConfirm", cancellationToken);
            return false;
        }

        _db.ChangeTracker.Clear();
        report = await _db.ScreeningReportRevisions.SingleAsync(x => x.Id == claim.ReportRevisionId, cancellationToken);
        return await FinalizeDeletionAsync(report, ScreeningReportDeletionEventType.ProviderDeletionConfirmed,
            "ProviderConfirmed", cancellationToken);
    }

    private async Task<bool> FinalizeDeletionAsync(ScreeningReportRevision report, ScreeningReportDeletionEventType eventType,
        string reasonCode, CancellationToken cancellationToken)
    {
        // Provider truth may race a preservation fence. Never silently finalize such a conflict.
        if (report.IsUnderLegalHold || report.PendingDisputeOperationId.HasValue ||
            await HasOpenDisputeAsync(report.Id, cancellationToken))
        {
            await RecordManualOutcomeAsync(report, "PreservationFenceRaced", cancellationToken);
            return false;
        }
        report.DeletedAt = _clock.GetUtcNow();
        report.NormalizedFactsJson = "{}";
        report.DeletionClaimToken = null;
        report.DeletionClaimExpiresAt = null;
        await AppendEventAsync(report, eventType, reasonCode, _clock.GetUtcNow(), cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }

    private async Task RecordManualOutcomeAsync(ScreeningReportRevision report, string reasonCode,
        CancellationToken cancellationToken)
    {
        await AppendEventAsync(report, ScreeningReportDeletionEventType.ManualOutcomeRequired, reasonCode,
            _clock.GetUtcNow(), cancellationToken);
        await AddIncidentAsync(report, ScreeningIncidentType.ProviderDeletionFailure, ScreeningIncidentSeverity.Critical,
            "provider-deletion-reconciliation", "ManualOutcomeRequired", cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task PlaceLegalHoldAsync(long organizationId, long reportRevisionId, string reasonCode,
        CancellationToken cancellationToken = default)
    {
        if (organizationId <= 0 || reportRevisionId <= 0) throw new ArgumentOutOfRangeException(nameof(reportRevisionId));
        ValidateReasonCode(reasonCode);
        _db.ChangeTracker.Clear();
        var report = await _db.ScreeningReportRevisions.SingleOrDefaultAsync(x => x.Id == reportRevisionId &&
            x.OrganizationId == organizationId, cancellationToken) ?? throw new ScreeningResourceNotFoundException("screening report");
        if (report.DeletedAt.HasValue) throw new ScreeningDeletionSafetyConflictException();
        var now = _clock.GetUtcNow();
        report.IsUnderLegalHold = true;
        report.LegalHoldPlacedAt = now;
        report.LegalHoldReleasedAt = null;
        report.LegalHoldReasonCode = reasonCode;
        var inFlight = report.DeletionProviderCallStartedAt.HasValue;
        report.DeletionClaimToken = null;
        report.DeletionClaimExpiresAt = null;
        await AppendEventAsync(report, inFlight ? ScreeningReportDeletionEventType.HoldRacedWithProviderDeletion :
            ScreeningReportDeletionEventType.RevokedForLegalHold, inFlight ? "DeletionAlreadyInFlight" : "LegalHold", now, cancellationToken);
        if (inFlight)
            await AddIncidentAsync(report, ScreeningIncidentType.ProviderDeletionHoldConflict, ScreeningIncidentSeverity.Critical,
                "legal-hold-deletion-race", "LegalHoldRacedWithProviderDeletion", cancellationToken);
        try { await _db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException) { throw new ScreeningDeletionSafetyConflictException(); }
        if (inFlight) throw new ScreeningDeletionSafetyConflictException();
    }

    internal static async Task RevokeForDisputeAsync(DataContext db, ScreeningReportRevision report,
        DateTimeOffset now, CancellationToken cancellationToken)
    {
        if (!report.DeletionClaimToken.HasValue && !report.DeletionProviderCallStartedAt.HasValue) return;
        var inFlight = report.DeletionProviderCallStartedAt.HasValue;
        report.DeletionClaimToken = null;
        report.DeletionClaimExpiresAt = null;
        await AppendEventAsync(db, report, inFlight ? ScreeningReportDeletionEventType.DisputeRacedWithProviderDeletion :
            ScreeningReportDeletionEventType.RevokedForDispute, inFlight ? "DeletionAlreadyInFlight" : "Dispute", now, cancellationToken);
        if (inFlight)
            await AddIncidentAsync(db, report, ScreeningIncidentType.ProviderDeletionDisputeConflict, ScreeningIncidentSeverity.Critical,
                "dispute-deletion-race", "DisputeRacedWithProviderDeletion", now, cancellationToken);
        // For an unexecuted claim the caller commits this revocation, its durable dispute fence,
        // and the outbox intent in one SaveChanges call. Committing the revocation here would
        // leave a window in which retention could reclaim the report before the fence exists.
        if (!inFlight) return;

        // Once provider deletion has started there is no safe dispute provider call to make, but
        // the incident and immutable deletion-race evidence must survive the conflict response.
        try { await db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException) { throw new ScreeningDeletionSafetyConflictException(); }
        throw new ScreeningDeletionSafetyConflictException();
    }

    private Task<bool> HasOpenDisputeAsync(long reportId, CancellationToken cancellationToken) =>
        _db.ScreeningDisputes.AnyAsync(x => (x.OriginalScreeningReportRevisionId == reportId ||
            x.CorrectedScreeningReportRevisionId == reportId) && x.Status != ScreeningDisputeStatus.Resolved &&
            x.Status != ScreeningDisputeStatus.Rejected, cancellationToken);

    private Task AppendEventAsync(ScreeningReportRevision report, ScreeningReportDeletionEventType type,
        string? reasonCode, DateTimeOffset now, CancellationToken cancellationToken) =>
        AppendEventAsync(_db, report, type, reasonCode, now, cancellationToken);

    private static async Task AppendEventAsync(DataContext db, ScreeningReportRevision report,
        ScreeningReportDeletionEventType type, string? reasonCode, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var revision = checked((await db.ScreeningReportDeletionEvents.Where(x => x.ScreeningReportRevisionId == report.Id)
            .MaxAsync(x => (long?)x.Revision, cancellationToken) ?? 0) + 1);
        db.ScreeningReportDeletionEvents.Add(new ScreeningReportDeletionEvent { ScreeningReportRevisionId = report.Id,
            TenantScreeningOrderId = report.TenantScreeningOrderId, OrganizationId = report.OrganizationId,
            Revision = revision, EventType = type, OccurredAt = now, ReasonCode = reasonCode });
    }

    private Task AddIncidentAsync(ScreeningReportRevision report, ScreeningIncidentType type,
        ScreeningIncidentSeverity severity, string source, string evidence, CancellationToken cancellationToken) =>
        AddIncidentAsync(_db, report, type, severity, source, evidence, _clock.GetUtcNow(), cancellationToken);

    private static Task AddIncidentAsync(DataContext db, ScreeningReportRevision report, ScreeningIncidentType type,
        ScreeningIncidentSeverity severity, string source, string evidence, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(
            $"screening-retention-incident-v1\n{report.OrganizationId}\n{report.Id}"))).ToLowerInvariant();
        var incident = new ScreeningIncident { TenantScreeningOrderId = report.TenantScreeningOrderId,
            OrganizationId = report.OrganizationId, ProviderKey = report.ProviderKey, IncidentType = type,
            Severity = severity, Status = ScreeningIncidentStatus.Detected, DetectedAt = now,
            AffectedResourceSha256Hash = hash, DetectionSource = source, FailureEvidenceReference = evidence };
        db.ScreeningIncidents.Add(incident);
        db.ScreeningIncidentEvents.Add(new ScreeningIncidentEvent { Incident = incident, Revision = 1,
            Status = ScreeningIncidentStatus.Detected, OccurredAt = now, EvidenceReference = evidence });
        return Task.CompletedTask;
    }

    private static void ValidateReasonCode(string reasonCode)
    {
        ScreeningContractValidation.ValidateBoundedText(reasonCode, 100, nameof(reasonCode), false);
        if (!reasonCode.All(c => char.IsAsciiLetterOrDigit(c) || c is '.' or '_' or '-'))
            throw new ArgumentException("Legal-hold reason must be a bounded classification code.", nameof(reasonCode));
    }
}
