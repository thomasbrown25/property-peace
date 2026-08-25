using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.RentPaymentAccess;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.RentPaymentAccess;

public sealed class RentPaymentAccessService(
    DataContext db,
    TimeProvider clock,
    IRentPaymentAccessNotificationService? notificationService = null,
    ILogger<RentPaymentAccessService>? logger = null) : IRentPaymentAccessService
{
    public async Task<RentPaymentAccessDto> GetForOrganizationAsync(
        int organizationId,
        CancellationToken cancellationToken)
    {
        var request = await db.RentPaymentAccessRequests
            .AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.OrganizationId == organizationId, cancellationToken);

        return request is null
            ? new RentPaymentAccessDto(null, organizationId, "NotRequested", null, null, null)
            : MapOrganization(request);
    }

    public async Task<RentPaymentAccessDto> RequestAsync(
        int organizationId,
        int actorUserId,
        CancellationToken cancellationToken)
    {
        var request = await db.RentPaymentAccessRequests
            .SingleOrDefaultAsync(candidate => candidate.OrganizationId == organizationId, cancellationToken);

        if (request is not null)
        {
            if (request.Status is RentPaymentAccessStatus.Pending or RentPaymentAccessStatus.Approved)
                return MapOrganization(request);
            if (request.Status == RentPaymentAccessStatus.Suspended)
                throw new RentPaymentAccessInvalidTransitionException();

            var resubmitted = await ResubmitRejectedAsync(request, actorUserId, cancellationToken);
            await NotifyReviewersAsync(resubmitted, cancellationToken);
            return MapOrganization(resubmitted);
        }

        var now = UtcNow();
        request = new RentPaymentAccessRequest
        {
            OrganizationId = organizationId,
            Status = RentPaymentAccessStatus.Pending,
            RequestedByUserId = actorUserId,
            RequestedAtUtc = now,
            StatusChangedAtUtc = now
        };
        db.RentPaymentAccessRequests.Add(request);
        AddAudit(request, null, RentPaymentAccessStatus.Pending, actorUserId, now);

        await using var transaction = db.Database.IsRelational()
            ? await db.Database.BeginTransactionAsync(cancellationToken)
            : null;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            if (transaction is not null) await transaction.CommitAsync(cancellationToken);
            await NotifyReviewersAsync(request, cancellationToken);
            return MapOrganization(request);
        }
        catch (DbUpdateException exception) when (IsUniqueViolation(exception))
        {
            if (transaction is not null) await transaction.RollbackAsync(CancellationToken.None);
            db.ChangeTracker.Clear();

            var winner = await db.RentPaymentAccessRequests
                .AsNoTracking()
                .SingleOrDefaultAsync(candidate => candidate.OrganizationId == organizationId, cancellationToken);
            if (winner is null) throw;
            if (winner.Status is RentPaymentAccessStatus.Pending or RentPaymentAccessStatus.Approved)
                return MapOrganization(winner);
            throw new RentPaymentAccessInvalidTransitionException();
        }
    }

    public async Task<IReadOnlyList<RentPaymentAccessListItemDto>> ListForAdminAsync(
        string? status,
        CancellationToken cancellationToken)
    {
        RentPaymentAccessStatus? parsedStatus = null;
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<RentPaymentAccessStatus>(status.Trim(), true, out var parsed) ||
                !Enum.IsDefined(parsed))
                throw new RentPaymentAccessValidationException("The rent-payment access status is invalid.");
            parsedStatus = parsed;
        }

        var query = db.RentPaymentAccessRequests.AsNoTracking();
        if (parsedStatus.HasValue)
            query = query.Where(candidate => candidate.Status == parsedStatus.Value);

        var requests = await query
            .OrderByDescending(candidate => candidate.RequestedAtUtc)
            .ToListAsync(cancellationToken);
        if (requests.Count == 0) return [];

        var organizationIds = requests.Select(candidate => (long)candidate.OrganizationId).Distinct().ToArray();
        var userIds = requests.Select(candidate => (long)candidate.RequestedByUserId).Distinct().ToArray();
        var organizations = await db.Organizations.AsNoTracking()
            .Where(candidate => organizationIds.Contains(candidate.Id))
            .ToDictionaryAsync(candidate => candidate.Id, candidate => candidate.Name, cancellationToken);
        var users = await db.Users.AsNoTracking()
            .Where(candidate => userIds.Contains(candidate.Id))
            .ToDictionaryAsync(candidate => candidate.Id, cancellationToken);

        return requests.Select(request => new RentPaymentAccessListItemDto(
                request.PublicId,
                request.OrganizationId,
                organizations.GetValueOrDefault(request.OrganizationId, string.Empty),
                request.Status.ToString(),
                users.TryGetValue(request.RequestedByUserId, out var user) ? DisplayName(user) : string.Empty,
                request.RequestedAtUtc,
                request.ReviewedAtUtc,
                Clone(request.RowVersion)))
            .ToArray();
    }

    public async Task<RentPaymentAccessAdminDetailDto?> GetForAdminAsync(
        Guid publicId,
        CancellationToken cancellationToken)
    {
        var request = await db.RentPaymentAccessRequests
            .AsNoTracking()
            .Include(candidate => candidate.AuditEvents)
            .SingleOrDefaultAsync(candidate => candidate.PublicId == publicId, cancellationToken);
        return request is null ? null : await MapAdminAsync(request, cancellationToken);
    }

    public Task<RentPaymentAccessAdminDetailDto> ApproveAsync(
        Guid publicId,
        int actorUserId,
        ReviewRentPaymentAccessRequestDto review,
        CancellationToken cancellationToken) =>
        TransitionAsync(publicId, actorUserId, review, RentPaymentAccessStatus.Approved,
            [RentPaymentAccessStatus.Pending], reasonRequired: false, cancellationToken);

    public Task<RentPaymentAccessAdminDetailDto> RejectAsync(
        Guid publicId,
        int actorUserId,
        ReviewRentPaymentAccessRequestDto review,
        CancellationToken cancellationToken) =>
        TransitionAsync(publicId, actorUserId, review, RentPaymentAccessStatus.Rejected,
            [RentPaymentAccessStatus.Pending], reasonRequired: true, cancellationToken);

    public Task<RentPaymentAccessAdminDetailDto> SuspendAsync(
        Guid publicId,
        int actorUserId,
        ReviewRentPaymentAccessRequestDto review,
        CancellationToken cancellationToken) =>
        TransitionAsync(publicId, actorUserId, review, RentPaymentAccessStatus.Suspended,
            [RentPaymentAccessStatus.Pending, RentPaymentAccessStatus.Approved], reasonRequired: true, cancellationToken);

    private async Task<RentPaymentAccessRequest> ResubmitRejectedAsync(
        RentPaymentAccessRequest request,
        int actorUserId,
        CancellationToken cancellationToken)
    {
        var now = UtcNow();
        request.Status = RentPaymentAccessStatus.Pending;
        request.RequestedByUserId = actorUserId;
        request.RequestedAtUtc = now;
        request.ReviewedByUserId = null;
        request.ReviewedAtUtc = null;
        request.DecisionReason = null;
        request.InternalNotes = null;
        request.StatusChangedAtUtc = now;
        AddAudit(request, RentPaymentAccessStatus.Rejected, RentPaymentAccessStatus.Pending, actorUserId, now);

        await SaveMutationAsync(cancellationToken);
        return request;
    }

    private async Task NotifyReviewersAsync(
        RentPaymentAccessRequest request,
        CancellationToken cancellationToken)
    {
        if (notificationService is null) return;

        try
        {
            var detail = await MapAdminAsync(request, cancellationToken);
            var result = await notificationService.NotifyReviewersAsync(detail, cancellationToken);
            if (result.Failed > 0)
            {
                logger?.LogWarning(
                    "Rent-payment access notification delivery for request {PublicId}, organization {OrganizationId}: {Attempted} attempted, {Accepted} accepted, {Failed} failed",
                    request.PublicId,
                    request.OrganizationId,
                    result.Attempted,
                    result.Accepted,
                    result.Failed);
            }
            else
            {
                logger?.LogInformation(
                    "Rent-payment access notification delivery for request {PublicId}, organization {OrganizationId}: {Attempted} attempted, {Accepted} accepted, {Failed} failed",
                    request.PublicId,
                    request.OrganizationId,
                    result.Attempted,
                    result.Accepted,
                    result.Failed);
            }
        }
        catch (Exception exception)
        {
            logger?.LogWarning(exception,
                "Rent-payment access notification delivery failed for request {PublicId}, organization {OrganizationId}",
                request.PublicId,
                request.OrganizationId);
        }
    }

    private async Task<RentPaymentAccessAdminDetailDto> TransitionAsync(
        Guid publicId,
        int actorUserId,
        ReviewRentPaymentAccessRequestDto review,
        RentPaymentAccessStatus nextStatus,
        RentPaymentAccessStatus[] allowedPriorStatuses,
        bool reasonRequired,
        CancellationToken cancellationToken)
    {
        if (review is null)
            throw new RentPaymentAccessValidationException("Review details are required.");

        var request = await db.RentPaymentAccessRequests
            .SingleOrDefaultAsync(candidate => candidate.PublicId == publicId, cancellationToken)
            ?? throw new RentPaymentAccessNotFoundException();

        if (!request.RowVersion.AsSpan().SequenceEqual(review.RowVersion ?? []))
            throw new RentPaymentAccessConcurrencyException();
        if (!allowedPriorStatuses.Contains(request.Status))
            throw new RentPaymentAccessInvalidTransitionException();

        var reason = Normalize(review.DecisionReason);
        var internalNotes = Normalize(review.InternalNotes);
        if (reasonRequired && reason is null)
            throw new RentPaymentAccessValidationException("A user-safe decision reason is required.");
        if (reason?.Length > 1000)
            throw new RentPaymentAccessValidationException("The decision reason is too long.");
        if (internalNotes?.Length > 2000)
            throw new RentPaymentAccessValidationException("Internal notes are too long.");

        var priorStatus = request.Status;
        var now = UtcNow();
        request.Status = nextStatus;
        request.ReviewedByUserId = actorUserId;
        request.ReviewedAtUtc = now;
        request.DecisionReason = reason;
        request.InternalNotes = internalNotes;
        request.StatusChangedAtUtc = now;
        AddAudit(request, priorStatus, nextStatus, actorUserId, now);

        await SaveMutationAsync(cancellationToken);
        return await MapAdminAsync(request, cancellationToken);
    }

    private async Task SaveMutationAsync(CancellationToken cancellationToken)
    {
        await using var transaction = db.Database.IsRelational()
            ? await db.Database.BeginTransactionAsync(cancellationToken)
            : null;
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            if (transaction is not null) await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException exception)
        {
            if (transaction is not null) await transaction.RollbackAsync(CancellationToken.None);
            db.ChangeTracker.Clear();
            throw new RentPaymentAccessConcurrencyException() { Source = exception.Source };
        }
    }

    private async Task<RentPaymentAccessAdminDetailDto> MapAdminAsync(
        RentPaymentAccessRequest request,
        CancellationToken cancellationToken)
    {
        var organizationName = await db.Organizations.AsNoTracking()
            .Where(candidate => candidate.Id == request.OrganizationId)
            .Select(candidate => candidate.Name)
            .SingleOrDefaultAsync(cancellationToken) ?? string.Empty;
        var requester = await db.Users.AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.Id == request.RequestedByUserId, cancellationToken);

        if (!db.Entry(request).Collection(candidate => candidate.AuditEvents).IsLoaded)
        {
            request.AuditEvents = await db.RentPaymentAccessAuditEvents.AsNoTracking()
                .Where(candidate => candidate.RentPaymentAccessRequestId == request.Id)
                .ToListAsync(cancellationToken);
        }

        return new RentPaymentAccessAdminDetailDto(
            request.PublicId,
            request.OrganizationId,
            organizationName,
            request.Status.ToString(),
            request.RequestedByUserId,
            requester is null ? string.Empty : DisplayName(requester),
            request.RequestedAtUtc,
            request.ReviewedByUserId,
            request.ReviewedAtUtc,
            request.DecisionReason,
            request.InternalNotes,
            Clone(request.RowVersion),
            request.AuditEvents
                .OrderBy(audit => audit.OccurredAtUtc)
                .ThenBy(audit => audit.Id)
                .Select(audit => new RentPaymentAccessAuditEventDto(
                    audit.PriorStatus?.ToString(),
                    audit.NextStatus.ToString(),
                    audit.ActorUserId,
                    audit.OccurredAtUtc,
                    audit.SafeMetadataJson))
                .ToArray());
    }

    private void AddAudit(
        RentPaymentAccessRequest request,
        RentPaymentAccessStatus? priorStatus,
        RentPaymentAccessStatus nextStatus,
        int actorUserId,
        DateTime occurredAtUtc)
    {
        db.RentPaymentAccessAuditEvents.Add(new RentPaymentAccessAuditEvent
        {
            RentPaymentAccessRequest = request,
            OrganizationId = request.OrganizationId,
            PriorStatus = priorStatus,
            NextStatus = nextStatus,
            ActorUserId = actorUserId,
            OccurredAtUtc = occurredAtUtc,
            SafeMetadataJson = null
        });
    }

    private DateTime UtcNow() => clock.GetUtcNow().UtcDateTime;

    private static RentPaymentAccessDto MapOrganization(RentPaymentAccessRequest request) => new(
        request.PublicId,
        request.OrganizationId,
        request.Status.ToString(),
        request.RequestedAtUtc,
        request.ReviewedAtUtc,
        request.DecisionReason);

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string DisplayName(User user)
    {
        var name = $"{user.FirstName} {user.LastName}".Trim();
        return name.Length > 0 ? name : user.Email;
    }

    private static byte[] Clone(byte[] value) => value.Length == 0 ? [] : [.. value];

    private static bool IsUniqueViolation(DbUpdateException exception)
    {
        var providerException = exception.InnerException ?? exception.GetBaseException();
        var type = providerException.GetType();
        if (type.FullName == "Microsoft.Data.SqlClient.SqlException")
        {
            var number = type.GetProperty("Number")?.GetValue(providerException) as int?;
            return number is 2601 or 2627;
        }

        if (type.FullName == "Microsoft.Data.Sqlite.SqliteException")
        {
            var extendedCode = type.GetProperty("SqliteExtendedErrorCode")?.GetValue(providerException) as int?;
            return extendedCode is 1555 or 2067;
        }

        return false;
    }
}
