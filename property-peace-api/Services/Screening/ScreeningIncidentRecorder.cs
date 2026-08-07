using System.Security.Cryptography;
using System.Text;
using brownstone_hub_api.Data;
using brownstone_hub_api.Domain.Screening;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.Screening;

public sealed class ScreeningIncidentRecorder : IScreeningIncidentRecorder
{
    private readonly DataContext _db; private readonly TimeProvider _clock;
    public ScreeningIncidentRecorder(DataContext db, TimeProvider clock) => (_db, _clock) = (db ?? throw new ArgumentNullException(nameof(db)), clock ?? throw new ArgumentNullException(nameof(clock)));

    public async Task<ScreeningIncident> RecordAsync(ScreeningIncidentRecord record, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(record);
        if (record.OrganizationId <= 0 || record.ScreeningOrderId <= 0) throw new ArgumentOutOfRangeException(nameof(record));
        if (!Enum.IsDefined(record.IncidentType) || !Enum.IsDefined(record.Severity)) throw new ArgumentOutOfRangeException(nameof(record));
        Optional(record.ProviderKey, 100); Optional(record.ProviderEventId, 200); Required(record.DetectionSource, 100);
        Required(record.AffectedResource, 1000); Optional(record.FailureEvidenceReference, 200);
        Optional(record.RemediationEvidenceReference, 200); Optional(record.NotificationEvidenceReference, 200);
        var now = _clock.GetUtcNow();
        var incident = new ScreeningIncident
        {
            TenantScreeningOrderId = record.ScreeningOrderId, OrganizationId = record.OrganizationId, ProviderKey = record.ProviderKey,
            ProviderEventId = record.ProviderEventId, IncidentType = record.IncidentType, Severity = record.Severity,
            Status = ScreeningIncidentStatus.Detected, DetectedAt = now,
            AffectedResourceSha256Hash = Hash($"screening-incident-resource-v1\n{record.OrganizationId}\n{record.AffectedResource}"),
            DetectionSource = record.DetectionSource, FailureEvidenceReference = record.FailureEvidenceReference,
            RemediationEvidenceReference = record.RemediationEvidenceReference, NotificationEvidenceReference = record.NotificationEvidenceReference
        };
        _db.ScreeningIncidents.Add(incident);
        _db.ScreeningIncidentEvents.Add(new ScreeningIncidentEvent { Incident = incident, Revision = 1,
            Status = ScreeningIncidentStatus.Detected, OccurredAt = now });
        // A relational provider wraps this aggregate insert in the implicit SaveChanges transaction.
        // Keeping both rows in one unit also removes the crash window between two successful commits.
        await _db.SaveChangesAsync(cancellationToken); return incident;
    }

    public async Task<ScreeningIncidentEvent> ChangeStatusAsync(long incidentId, ScreeningIncidentStatus status, long? actorUserId,
        string? evidenceReference, CancellationToken cancellationToken = default)
    {
        if (incidentId <= 0 || actorUserId <= 0) throw new ArgumentOutOfRangeException(nameof(incidentId));
        if (!Enum.IsDefined(status) || status == ScreeningIncidentStatus.Detected) throw new ArgumentOutOfRangeException(nameof(status));
        Optional(evidenceReference, 200);
        var incident = await _db.ScreeningIncidents.SingleOrDefaultAsync(x => x.Id == incidentId, cancellationToken)
            ?? throw new ScreeningResourceNotFoundException("screening incident");
        if (status <= incident.Status || status == ScreeningIncidentStatus.Resolved && incident.Status != ScreeningIncidentStatus.Contained)
            throw new InvalidOperationException("Incident status changes must be monotonic.");
        var now = _clock.GetUtcNow(); incident.Status = status; incident.ActorUserId = actorUserId;
        if (status == ScreeningIncidentStatus.Contained) { incident.ContainedAt = now; incident.RemediationEvidenceReference = evidenceReference; }
        if (status == ScreeningIncidentStatus.Resolved) { incident.ResolvedAt = now; incident.NotificationEvidenceReference = evidenceReference; }
        var revision = checked((await _db.ScreeningIncidentEvents.Where(x => x.ScreeningIncidentId == incident.Id).MaxAsync(x => (long?)x.Revision, cancellationToken) ?? 0) + 1);
        var evt = new ScreeningIncidentEvent { ScreeningIncidentId = incident.Id, Revision = revision, Status = status,
            OccurredAt = now, ActorUserId = actorUserId, EvidenceReference = evidenceReference };
        _db.ScreeningIncidentEvents.Add(evt);
        try { await _db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException exception)
        {
            throw new ScreeningIncidentConflictException(exception);
        }
        catch (DbUpdateException exception)
        {
            // The unique (incident, revision) index is the final arbiter when concurrent writers both
            // observed the same maximum revision. Relational SaveChanges rolls back the status update too.
            throw new ScreeningIncidentConflictException(exception);
        }
        return evt;
    }
    private static void Required(string value, int max) => ScreeningContractValidation.ValidateBoundedText(value, max, nameof(value), false);
    private static void Optional(string? value, int max) { if (value is not null) ScreeningContractValidation.ValidateBoundedText(value, max, nameof(value), false); }
    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
}

public sealed class ScreeningIncidentConflictException(Exception innerException)
    : Exception("The screening incident changed concurrently. Reload it and retry the status change.", innerException);
