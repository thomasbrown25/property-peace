using brownstone_hub_api.Data;
using brownstone_hub_api.Domain.Screening;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.Screening;

/// <summary>
/// Internal-only support capability administration. Deliberately no HTTP controller is registered.
/// Platform-support identity is supplied by a trusted server adapter; the default adapter denies every request.
/// </summary>
public sealed class ScreeningSupportElevationService : IScreeningSupportElevationService
{
    public static readonly TimeSpan MaximumLifetime = TimeSpan.FromMinutes(30);
    private readonly DataContext _db;
    private readonly TimeProvider _clock;
    private readonly IScreeningSupportAuthorization _supportAuthorization;

    public ScreeningSupportElevationService(DataContext db, TimeProvider clock, IScreeningSupportAuthorization supportAuthorization)
        => (_db, _clock, _supportAuthorization) = (db, clock, supportAuthorization);

    public async Task<ScreeningSupportElevationResult> IssueAsync(IssueScreeningSupportElevationCommand command,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command);
        ValidateIds(command.OrganizationId, command.ApprovedByUserId, command.SubjectUserId);
        if (command.ApprovedByUserId == command.SubjectUserId) throw new ScreeningAuthorizationException();
        ScreeningContractValidation.ValidateBoundedText(command.CaseReference, 200, nameof(command.CaseReference), false);
        ScreeningContractValidation.ValidateBoundedText(command.Reason, 500, nameof(command.Reason), false);
        if (!Enum.IsDefined(command.Purpose) || command.Purpose != ScreeningReportAccessPurpose.SupportInvestigation)
            throw new ArgumentOutOfRangeException(nameof(command.Purpose));
        if (command.Lifetime <= TimeSpan.Zero || command.Lifetime > MaximumLifetime)
            throw new ArgumentOutOfRangeException(nameof(command.Lifetime));
        if (command.MaximumAccessCount is < 1 or > 10) throw new ArgumentOutOfRangeException(nameof(command.MaximumAccessCount));

        var approver = await _db.OrganizationMembers.AsNoTracking().AnyAsync(x => x.OrganizationId == command.OrganizationId &&
            x.UserId == command.ApprovedByUserId && x.IsActive && (x.Role == "Owner" || x.Role == "Admin"), cancellationToken);
        if (!approver || !await _supportAuthorization.IsPlatformSupportActorAsync(command.SubjectUserId, cancellationToken))
            throw new ScreeningAuthorizationException();

        var now = _clock.GetUtcNow();
        var elevation = new ScreeningSupportElevation
        {
            OrganizationId = command.OrganizationId, SubjectUserId = command.SubjectUserId,
            ApprovedByUserId = command.ApprovedByUserId, CaseReference = command.CaseReference.Trim(),
            Reason = command.Reason.Trim(), Purpose = command.Purpose, IssuedAt = now,
            ExpiresAt = now.Add(command.Lifetime), MaximumAccessCount = command.MaximumAccessCount
        };
        _db.ScreeningSupportElevations.Add(elevation);
        await _db.SaveChangesAsync(cancellationToken);
        return ToResult(elevation);
    }

    public async Task RevokeAsync(long organizationId, long actorUserId, long elevationId,
        CancellationToken cancellationToken = default)
    {
        ValidateIds(organizationId, actorUserId, elevationId);
        var approver = await _db.OrganizationMembers.AsNoTracking().AnyAsync(x => x.OrganizationId == organizationId &&
            x.UserId == actorUserId && x.IsActive && (x.Role == "Owner" || x.Role == "Admin"), cancellationToken);
        if (!approver) throw new ScreeningAuthorizationException();
        var elevation = await _db.ScreeningSupportElevations.SingleOrDefaultAsync(x => x.Id == elevationId && x.OrganizationId == organizationId, cancellationToken)
            ?? throw new ScreeningResourceNotFoundException("support elevation");
        elevation.Revoke(actorUserId, _clock.GetUtcNow());
        await _db.SaveChangesAsync(cancellationToken);
    }

    private static ScreeningSupportElevationResult ToResult(ScreeningSupportElevation x) =>
        new(x.Id, x.Purpose, x.IssuedAt, x.ExpiresAt, x.MaximumAccessCount, x.AccessCount, x.RevokedAt.HasValue);
    private static void ValidateIds(params long[] ids) { if (ids.Any(x => x <= 0)) throw new ArgumentOutOfRangeException(nameof(ids)); }
}

internal sealed class DenyAllScreeningSupportAuthorization : IScreeningSupportAuthorization
{
    public Task<bool> IsPlatformSupportActorAsync(long userId, CancellationToken cancellationToken = default) => Task.FromResult(false);
}
