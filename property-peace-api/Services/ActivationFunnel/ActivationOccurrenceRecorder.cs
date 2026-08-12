using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.ActivationFunnel;

public sealed class ActivationOccurrenceRecorder(DataContext db, TimeProvider timeProvider) : IActivationOccurrenceRecorder
{
    public async Task<bool> RecordAsync(ActivationOccurrenceRequest request, CancellationToken cancellationToken = default)
    {
        Validate(request);
        if (await ClassifyExistingAsync(request, cancellationToken) is ExistingOccurrence.SubjectOrExactSource) return false;

        var occurrence = new ActivationMilestoneOccurrence
        {
            OrganizationId = request.OrganizationId,
            Milestone = request.Milestone,
            SubjectId = request.SubjectId,
            OccurredAtUtc = request.OccurredAtUtc.UtcDateTime,
            RecordedAtUtc = timeProvider.GetUtcNow().UtcDateTime,
            IsTimestampEstimated = request.IsTimestampEstimated,
            ActorUserId = request.ActorUserId,
            SourceEventType = request.SourceEventType,
            SourceEventId = request.SourceEventId
        };
        db.ActivationMilestoneOccurrences.Add(occurrence);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (DbUpdateException)
        {
            db.Entry(occurrence).State = EntityState.Detached;
            // Only classify the failure as an idempotent replay when a durable identity now exists.
            if (await ClassifyExistingAsync(request, cancellationToken) is ExistingOccurrence.SubjectOrExactSource) return false;
            throw;
        }
    }

    private async Task<ExistingOccurrence> ClassifyExistingAsync(ActivationOccurrenceRequest request,
        CancellationToken cancellationToken)
    {
        if (request.SourceEventType is not null)
        {
            var source = await db.ActivationMilestoneOccurrences.AsNoTracking().SingleOrDefaultAsync(x =>
                x.OrganizationId == request.OrganizationId && x.SourceEventType == request.SourceEventType &&
                x.SourceEventId == request.SourceEventId, cancellationToken);
            if (source is not null)
            {
                if (source.Milestone == request.Milestone && source.SubjectId == request.SubjectId)
                    return ExistingOccurrence.SubjectOrExactSource;
                throw new InvalidOperationException("The source event is already bound to a different activation occurrence.");
            }
        }

        if (await db.ActivationMilestoneOccurrences.AsNoTracking().AnyAsync(x =>
                x.OrganizationId == request.OrganizationId && x.Milestone == request.Milestone &&
                x.SubjectId == request.SubjectId, cancellationToken))
            return ExistingOccurrence.SubjectOrExactSource;

        return ExistingOccurrence.None;
    }

    private enum ExistingOccurrence { None, SubjectOrExactSource }

    private static void Validate(ActivationOccurrenceRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (request.OrganizationId <= 0) throw new ArgumentOutOfRangeException(nameof(request.OrganizationId));
        if (request.ActorUserId is <= 0) throw new ArgumentOutOfRangeException(nameof(request.ActorUserId));
        if (!ActivationMilestones.IsKnown(request.Milestone)) throw new ArgumentOutOfRangeException(nameof(request.Milestone));
        if (string.IsNullOrWhiteSpace(request.SubjectId) || request.SubjectId.Length > 200)
            throw new ArgumentException("A bounded subject identifier is required.", nameof(request.SubjectId));
        if (request.OccurredAtUtc.Offset != TimeSpan.Zero)
            throw new ArgumentException("Occurrence timestamps must be UTC.", nameof(request.OccurredAtUtc));
        if ((request.SourceEventType is null) != (request.SourceEventId is null))
            throw new ArgumentException("Source event type and id must either both be supplied or both be absent.");
        if (request.SourceEventType is not null &&
            (string.IsNullOrWhiteSpace(request.SourceEventType) || string.IsNullOrWhiteSpace(request.SourceEventId)))
            throw new ArgumentException("Source event type and id must contain non-whitespace values when supplied.");
        if (request.SourceEventType?.Length > 100 || request.SourceEventId?.Length > 200)
            throw new ArgumentException("Source event identifiers exceed their bounded lengths.");
    }
}
