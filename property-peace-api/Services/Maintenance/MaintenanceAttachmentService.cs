using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using System.Data;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Maintenance;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.Maintenance;

public interface IMaintenanceAttachmentStorage
{
    Task PutAsync(string blobName, Stream content, string contentType, CancellationToken cancellationToken = default);
    Task<Stream> OpenReadAsync(string blobName, CancellationToken cancellationToken = default);
    Task DeleteAsync(string blobName, CancellationToken cancellationToken = default);
    Task<bool> ExistsAsync(string blobName, CancellationToken cancellationToken = default);
    Task<int> ScavengeStagingAsync(DateTimeOffset olderThanUtc, IReadOnlySet<string> retainedBlobNames,
        CancellationToken cancellationToken = default);
}

public sealed class AzureMaintenanceAttachmentStorage(BlobServiceClient blobs) : IMaintenanceAttachmentStorage
{
    private const string Container = "maintenance-evidence";
    public async Task PutAsync(string blobName, Stream content, string contentType, CancellationToken cancellationToken = default)
    {
        var container = blobs.GetBlobContainerClient(Container);
        await container.CreateIfNotExistsAsync(PublicAccessType.None, cancellationToken: cancellationToken);
        await container.GetBlobClient(blobName).UploadAsync(content, new BlobUploadOptions { HttpHeaders = new BlobHttpHeaders { ContentType = contentType } }, cancellationToken);
    }
    public async Task<Stream> OpenReadAsync(string blobName, CancellationToken cancellationToken = default) =>
        (await blobs.GetBlobContainerClient(Container).GetBlobClient(blobName).DownloadStreamingAsync(cancellationToken: cancellationToken)).Value.Content;
    public async Task DeleteAsync(string blobName, CancellationToken cancellationToken = default) =>
        _ = await blobs.GetBlobContainerClient(Container).GetBlobClient(blobName).DeleteIfExistsAsync(cancellationToken: cancellationToken);
    public async Task<bool> ExistsAsync(string blobName, CancellationToken cancellationToken = default) =>
        (await blobs.GetBlobContainerClient(Container).GetBlobClient(blobName).ExistsAsync(cancellationToken)).Value;
    public async Task<int> ScavengeStagingAsync(DateTimeOffset olderThanUtc, IReadOnlySet<string> retainedBlobNames,
        CancellationToken cancellationToken = default)
    {
        var container = blobs.GetBlobContainerClient(Container);
        var deleted = 0;
        await foreach (var item in container.GetBlobsAsync(prefix: "staging/", cancellationToken: cancellationToken))
        {
            if (item.Properties.LastModified >= olderThanUtc || retainedBlobNames.Contains(item.Name)) continue;
            if ((await container.GetBlobClient(item.Name).DeleteIfExistsAsync(cancellationToken: cancellationToken)).Value) deleted++;
        }
        return deleted;
    }
}

public interface IMaintenanceAttachmentService
{
    Task<MaintenanceApiResult<IReadOnlyList<MaintenanceAttachmentDto>>> ListAsync(long requestId, CancellationToken cancellationToken = default);
    Task<MaintenanceApiResult<MaintenanceAttachmentDto>> UploadAsync(long requestId, MaintenanceAttachmentPurpose purpose, IFormFile file, CancellationToken cancellationToken = default);
    Task<MaintenanceApiResult<MaintenanceAttachmentDownload>> DownloadAsync(long requestId, long attachmentId, CancellationToken cancellationToken = default);
    Task<MaintenanceApiResult<bool>> DeleteAsync(long requestId, long attachmentId, CancellationToken cancellationToken = default);
    Task<int> ProcessPendingLifecycleAsync(int take = 50, CancellationToken cancellationToken = default);
}

public sealed record MaintenanceAttachmentDownload(Stream Content, string ContentType, string FileName);

public sealed class MaintenanceAttachmentService(DataContext db, IMaintenanceActorAccessor actors,
    IMaintenanceAttachmentStorage storage, TimeProvider clock,
    IMaintenanceTransactionSideEffects sideEffects) : IMaintenanceAttachmentService
{
    private static readonly Dictionary<string, (MaintenanceAttachmentMediaType Media, long Max, string[] Extensions)> Allowed = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = (MaintenanceAttachmentMediaType.Photo, 10 * 1024 * 1024, [".jpg", ".jpeg"]),
        ["image/png"] = (MaintenanceAttachmentMediaType.Photo, 10 * 1024 * 1024, [".png"]),
        ["image/webp"] = (MaintenanceAttachmentMediaType.Photo, 10 * 1024 * 1024, [".webp"]),
        ["video/mp4"] = (MaintenanceAttachmentMediaType.Video, 100 * 1024 * 1024, [".mp4"]),
        ["video/quicktime"] = (MaintenanceAttachmentMediaType.Video, 100 * 1024 * 1024, [".mov"])
    };

    public async Task<MaintenanceApiResult<IReadOnlyList<MaintenanceAttachmentDto>>> ListAsync(long requestId, CancellationToken cancellationToken = default)
    {
        var access = await AccessAsync(requestId, cancellationToken);
        if (access.Actor is null) return Unauthorized<IReadOnlyList<MaintenanceAttachmentDto>>();
        if (access.Request is null) return NotFound<IReadOnlyList<MaintenanceAttachmentDto>>();
        var items = await db.MaintenanceAttachments.AsNoTracking().Where(x => x.MaintenanceRequestId == requestId &&
                x.LifecycleState == MaintenanceAttachmentLifecycleState.Active)
            .OrderBy(x => x.CreatedAtUtc).ThenBy(x => x.Id).Select(x => Map(x)).ToListAsync(cancellationToken);
        return MaintenanceApiResult<IReadOnlyList<MaintenanceAttachmentDto>>.Success(items);
    }

    public async Task<MaintenanceApiResult<MaintenanceAttachmentDto>> UploadAsync(long requestId, MaintenanceAttachmentPurpose purpose, IFormFile file, CancellationToken cancellationToken = default)
    {
        var access = await AccessAsync(requestId, cancellationToken);
        if (access.Actor is null) return Unauthorized<MaintenanceAttachmentDto>();
        if (access.Request is null) return NotFound<MaintenanceAttachmentDto>();
        if (!Enum.IsDefined(purpose) || file is null || file.Length <= 0 || !Allowed.TryGetValue(file.ContentType ?? "", out var rule))
            return BadRequest<MaintenanceAttachmentDto>("Only JPEG, PNG, WebP, MP4, and QuickTime evidence is supported.");
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!rule.Extensions.Contains(extension, StringComparer.OrdinalIgnoreCase))
            return BadRequest<MaintenanceAttachmentDto>("File extension does not match its media type.");
        if (file.Length > rule.Max) return BadRequest<MaintenanceAttachmentDto>($"{rule.Media} evidence exceeds the size limit.");
        if (purpose == MaintenanceAttachmentPurpose.Intake && !access.Actor.IsTenant ||
            purpose == MaintenanceAttachmentPurpose.Reopen && !access.Actor.IsTenant ||
            purpose == MaintenanceAttachmentPurpose.Completion && !(access.IsManager || access.Request.AssignedToUserId == access.Actor.UserId))
            return NotFound<MaintenanceAttachmentDto>();
        if (purpose == MaintenanceAttachmentPurpose.Intake && access.Request.Status != EMaintenanceStatus.Reported ||
            purpose == MaintenanceAttachmentPurpose.Completion && access.Request.Status != EMaintenanceStatus.InProgress ||
            purpose == MaintenanceAttachmentPurpose.Reopen && (access.Request.ResolutionCycle <= 1 || access.Request.Status != EMaintenanceStatus.Assigned))
            return Conflict<MaintenanceAttachmentDto>("maintenance.attachment_purpose_frozen", "Evidence for this workflow stage is frozen.");
        var cycle = access.Request.ResolutionCycle <= 0 ? 1 : access.Request.ResolutionCycle;
        var safeName = Path.GetFileName(file.FileName);
        var blobName = $"{access.Request.OrganizationId}/{requestId}/{purpose.ToString().ToLowerInvariant()}/{cycle}/{Guid.NewGuid():N}{extension}";
        var stagingBlobName = $"staging/{Guid.NewGuid():N}{extension}";
        await using var stream = file.OpenReadStream();
        if (!await HasExpectedSignatureAsync(stream, file.ContentType, cancellationToken))
            return BadRequest<MaintenanceAttachmentDto>("The file content does not match the declared media type.");
        stream.Position = 0;
        await storage.PutAsync(stagingBlobName, stream, file.ContentType, cancellationToken);
        if (sideEffects.IsActive)
            sideEffects.OnRollback(ct => storage.DeleteAsync(stagingBlobName, ct));

        var attachment = new MaintenanceAttachment
        {
            MaintenanceRequestId = requestId, Purpose = purpose, ResolutionCycle = cycle, MediaType = rule.Media,
            FileName = safeName, ContentType = file.ContentType, SizeBytes = file.Length, BlobName = blobName,
            StagingBlobName = stagingBlobName,
            UploadedByUserId = access.Actor.UserId, CreatedAtUtc = clock.GetUtcNow(),
            LifecycleState = MaintenanceAttachmentLifecycleState.PendingUpload
        };

        var existingTransaction = db.Database.CurrentTransaction;
        await using var ownedTransaction = db.Database.IsRelational() && existingTransaction is null
            ? await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken)
            : null;
        try
        {
            if (db.Database.IsSqlServer())
                await db.Database.ExecuteSqlInterpolatedAsync($"SELECT 1 FROM [maintenance].[MaintenanceRequests] WITH (UPDLOCK, HOLDLOCK) WHERE [Id] = {requestId}", cancellationToken);
            var count = await db.MaintenanceAttachments.CountAsync(x => x.MaintenanceRequestId == requestId && x.Purpose == purpose &&
                x.ResolutionCycle == cycle && x.LifecycleState != MaintenanceAttachmentLifecycleState.PendingDeletion, cancellationToken);
            if (count >= 10)
            {
                if (ownedTransaction is not null) await ownedTransaction.RollbackAsync(cancellationToken);
                await storage.DeleteAsync(stagingBlobName, CancellationToken.None);
                return Conflict<MaintenanceAttachmentDto>("maintenance.attachment_limit", "A maximum of 10 attachments is allowed per purpose and resolution cycle.");
            }
            db.MaintenanceAttachments.Add(attachment);
            await db.SaveChangesAsync(cancellationToken);
            if (ownedTransaction is not null) await ownedTransaction.CommitAsync(cancellationToken);
        }
        catch
        {
            if (!sideEffects.IsActive) await storage.DeleteAsync(stagingBlobName, CancellationToken.None);
            throw;
        }

        if (sideEffects.IsActive)
            sideEffects.AfterCommit(ct => ProcessAttachmentAsync(attachment.Id, ct));
        else
            await ProcessAttachmentAsync(attachment.Id, cancellationToken);
        return MaintenanceApiResult<MaintenanceAttachmentDto>.Success(Map(attachment));
    }

    public async Task<MaintenanceApiResult<MaintenanceAttachmentDownload>> DownloadAsync(long requestId, long attachmentId, CancellationToken cancellationToken = default)
    {
        var access = await AccessAsync(requestId, cancellationToken);
        if (access.Actor is null) return Unauthorized<MaintenanceAttachmentDownload>();
        if (access.Request is null) return NotFound<MaintenanceAttachmentDownload>();
        var attachment = await db.MaintenanceAttachments.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == attachmentId && x.MaintenanceRequestId == requestId &&
                x.LifecycleState == MaintenanceAttachmentLifecycleState.Active, cancellationToken);
        if (attachment is null) return NotFound<MaintenanceAttachmentDownload>();
        var content = await storage.OpenReadAsync(attachment.BlobName, cancellationToken);
        return MaintenanceApiResult<MaintenanceAttachmentDownload>.Success(new(content, attachment.ContentType, attachment.FileName));
    }

    public async Task<MaintenanceApiResult<bool>> DeleteAsync(long requestId, long attachmentId, CancellationToken cancellationToken = default)
    {
        var access = await AccessAsync(requestId, cancellationToken);
        if (access.Actor is null) return Unauthorized<bool>();
        if (access.Request is null) return NotFound<bool>();
        var attachment = await db.MaintenanceAttachments.SingleOrDefaultAsync(x => x.Id == attachmentId && x.MaintenanceRequestId == requestId, cancellationToken);
        if (attachment is null || !access.IsManager && attachment.UploadedByUserId != access.Actor.UserId) return NotFound<bool>();
        if (attachment.Purpose == MaintenanceAttachmentPurpose.Intake && access.Request.Status != EMaintenanceStatus.Reported ||
            attachment.Purpose == MaintenanceAttachmentPurpose.Completion && access.Request.Status != EMaintenanceStatus.InProgress ||
            attachment.Purpose == MaintenanceAttachmentPurpose.Reopen &&
                (attachment.ResolutionCycle != access.Request.ResolutionCycle || access.Request.Status != EMaintenanceStatus.Assigned))
            return Conflict<bool>("maintenance.attachment_immutable", "Evidence is immutable after its workflow stage closes.");
        if (attachment.Purpose == MaintenanceAttachmentPurpose.Completion)
        {
            var references = await db.MaintenanceCompletions.AsNoTracking()
                .Where(x => x.MaintenanceRequestId == requestId && x.CompletionEvidenceReference != null)
                .Select(x => x.CompletionEvidenceReference!)
                .ToListAsync(cancellationToken);
            if (references.Any(reference => ReferencedAttachmentIds(reference).Contains(attachmentId)))
                return Conflict<bool>("maintenance.attachment_immutable", "Completion evidence cannot be deleted after it is submitted.");
        }
        if (attachment.LifecycleState != MaintenanceAttachmentLifecycleState.PendingDeletion)
        {
            attachment.LifecycleState = MaintenanceAttachmentLifecycleState.PendingDeletion;
            attachment.LifecycleLeaseId = null;
            attachment.LifecycleLeaseUntilUtc = null;
            AddAudit(access.Request, access.Actor.UserId, attachment, "attachment.deleted", "Maintenance attachment deleted");
            await db.SaveChangesAsync(cancellationToken);
        }
        if (sideEffects.IsActive)
            sideEffects.AfterCommit(ct => ProcessAttachmentAsync(attachment.Id, ct));
        else
            await ProcessAttachmentAsync(attachment.Id, cancellationToken);
        return MaintenanceApiResult<bool>.Success(true);
    }

    public async Task<int> ProcessPendingLifecycleAsync(int take = 50, CancellationToken cancellationToken = default)
    {
        var now = clock.GetUtcNow();
        var pendingIds = await db.MaintenanceAttachments.AsNoTracking()
            .Where(x => x.LifecycleState != MaintenanceAttachmentLifecycleState.Active &&
                (x.LifecycleLeaseUntilUtc == null || x.LifecycleLeaseUntilUtc < now))
            .OrderBy(x => x.Id).Select(x => x.Id).Take(Math.Clamp(take, 1, 200)).ToListAsync(cancellationToken);
        var completed = 0;
        foreach (var attachmentId in pendingIds)
            if (await ProcessAttachmentAsync(attachmentId, cancellationToken)) completed++;

        var retained = (await db.MaintenanceAttachments.AsNoTracking().Where(x => x.StagingBlobName != null)
            .Select(x => x.StagingBlobName!).ToListAsync(cancellationToken)).ToHashSet(StringComparer.Ordinal);
        await storage.ScavengeStagingAsync(now.AddHours(-24), retained, cancellationToken);
        return completed;
    }

    private async Task<bool> ProcessAttachmentAsync(long attachmentId, CancellationToken cancellationToken)
    {
        var leaseId = Guid.NewGuid();
        var now = clock.GetUtcNow();
        if (db.Database.IsRelational())
        {
            var claimed = await db.MaintenanceAttachments.Where(x => x.Id == attachmentId &&
                    x.LifecycleState != MaintenanceAttachmentLifecycleState.Active &&
                    (x.LifecycleLeaseUntilUtc == null || x.LifecycleLeaseUntilUtc < now))
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(x => x.LifecycleLeaseId, leaseId)
                    .SetProperty(x => x.LifecycleLeaseUntilUtc, now.AddMinutes(5)), cancellationToken);
            if (claimed != 1) return false;
            db.ChangeTracker.Clear();
        }
        else
        {
            var claim = await db.MaintenanceAttachments.SingleOrDefaultAsync(x => x.Id == attachmentId, cancellationToken);
            if (claim is null || claim.LifecycleState == MaintenanceAttachmentLifecycleState.Active ||
                claim.LifecycleLeaseUntilUtc >= now) return false;
            claim.LifecycleLeaseId = leaseId;
            claim.LifecycleLeaseUntilUtc = now.AddMinutes(5);
            await db.SaveChangesAsync(cancellationToken);
        }

        try
        {
            var attachment = await db.MaintenanceAttachments.SingleOrDefaultAsync(x => x.Id == attachmentId &&
                x.LifecycleLeaseId == leaseId, cancellationToken);
            if (attachment is null) return false;
            if (attachment.LifecycleState == MaintenanceAttachmentLifecycleState.PendingUpload)
            {
                if (attachment.StagingBlobName is not null && await storage.ExistsAsync(attachment.StagingBlobName, cancellationToken))
                {
                    await using var staged = await storage.OpenReadAsync(attachment.StagingBlobName, cancellationToken);
                    await storage.PutAsync(attachment.BlobName, staged, attachment.ContentType, cancellationToken);
                    await storage.DeleteAsync(attachment.StagingBlobName, cancellationToken);
                }
                else if (!await storage.ExistsAsync(attachment.BlobName, cancellationToken))
                {
                    throw new InvalidOperationException("Neither the staged nor final attachment blob exists.");
                }

                attachment.StagingBlobName = null;
                attachment.LifecycleState = MaintenanceAttachmentLifecycleState.Active;
                attachment.LifecycleLeaseId = null;
                attachment.LifecycleLeaseUntilUtc = null;
                if (!await db.MaintenanceActivityEvents.AnyAsync(x => x.SubjectType == "attachment" && x.SubjectId == attachment.Id &&
                        x.EventType == "attachment.uploaded", cancellationToken))
                {
                    var request = await db.MaintenanceRequests.SingleAsync(x => x.Id == attachment.MaintenanceRequestId, cancellationToken);
                    AddAudit(request, attachment.UploadedByUserId, attachment, "attachment.uploaded", "Maintenance attachment uploaded");
                }
                await db.SaveChangesAsync(cancellationToken);
            }
            else
            {
                if (attachment.StagingBlobName is not null)
                    await storage.DeleteAsync(attachment.StagingBlobName, cancellationToken);
                await storage.DeleteAsync(attachment.BlobName, cancellationToken);
                db.MaintenanceAttachments.Remove(attachment);
                await db.SaveChangesAsync(cancellationToken);
            }
            return true;
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            db.ChangeTracker.Clear();
            var leased = await db.MaintenanceAttachments.SingleOrDefaultAsync(x => x.Id == attachmentId && x.LifecycleLeaseId == leaseId,
                CancellationToken.None);
            if (leased is not null)
            {
                leased.LifecycleLeaseId = null;
                leased.LifecycleLeaseUntilUtc = null;
                await db.SaveChangesAsync(CancellationToken.None);
            }
            return false;
        }
    }

    private async Task<(MaintenanceActor? Actor, MaintenanceRequest? Request, bool IsManager)> AccessAsync(long id, CancellationToken ct)
    {
        var actor = await actors.GetCurrentAsync(ct);
        if (actor is null) return (null, null, false);
        var request = await db.MaintenanceRequests.Include(x => x.Property).SingleOrDefaultAsync(x => x.Id == id &&
            (x.Property.LandlordId == actor.UserId ||
             x.OrganizationId != null && db.OrganizationMembers.Any(m => m.OrganizationId == x.OrganizationId && m.UserId == actor.UserId && m.IsActive && m.CanManageMaintenance) ||
             x.AssignedToType == EAssignedToType.Vendor && x.VendorId != null && x.OrganizationId != null &&
                 db.Vendors.Any(v => v.Id == x.VendorId && v.PortalUserId == actor.UserId && v.OrganizationId == x.OrganizationId && v.IsActive && !v.IsDeleted) ||
             x.AssignedToType == EAssignedToType.OrganizationMember && x.AssignedToUserId == actor.UserId && x.OrganizationId != null &&
                 db.OrganizationMembers.Any(m => m.OrganizationId == x.OrganizationId && m.UserId == actor.UserId && m.IsActive) ||
             x.SubmittedByUserId == actor.UserId ||
             x.SubmittedByUserId == null && x.SubmittedByTenantId != null &&
                 db.Tenants.Any(tenant => tenant.Id == x.SubmittedByTenantId && tenant.UserId == actor.UserId) ||
             x.SubmittedByUserId == null && x.SubmittedByTenantId == null &&
                 db.Conversations.Any(conversation => conversation.TenantId != null &&
                     (conversation.Id == x.ConversationId || conversation.MaintenanceRequestId == x.Id) &&
                     db.Tenants.Any(tenant => tenant.Id == conversation.TenantId && tenant.UserId == actor.UserId))), ct);
        var manager = request is not null && (request.Property.LandlordId == actor.UserId || request.OrganizationId != null && await db.OrganizationMembers.AnyAsync(m => m.OrganizationId == request.OrganizationId && m.UserId == actor.UserId && m.IsActive && m.CanManageMaintenance, ct));
        return (actor, request, manager);
    }

    private static MaintenanceAttachmentDto Map(MaintenanceAttachment x) => new(x.Id, x.MaintenanceRequestId, x.Purpose, x.ResolutionCycle, x.MediaType, x.FileName, x.ContentType, x.SizeBytes, x.UploadedByUserId, x.CreatedAtUtc);
    private void AddAudit(MaintenanceRequest request, long actorUserId, MaintenanceAttachment attachment, string eventType, string summary)
    {
        var activity = new MaintenanceActivityEvent
        {
            MaintenanceRequestId = request.Id, ActorUserId = actorUserId, EventType = eventType,
            SubjectType = "attachment", SubjectId = attachment.Id, Summary = summary,
            Visibility = MaintenanceActivityVisibility.Participants,
            MetadataJson = System.Text.Json.JsonSerializer.Serialize(new
            {
                purpose = attachment.Purpose.ToString(), attachment.ResolutionCycle, attachment.ContentType,
                attachment.SizeBytes
            }),
            OccurredAtUtc = clock.GetUtcNow()
        };
        db.MaintenanceActivityEvents.Add(activity);
        db.MaintenanceTimelineOutboxes.Add(new MaintenanceTimelineOutbox
        {
            MaintenanceActivityEvent = activity, AvailableAtUtc = clock.GetUtcNow()
        });
    }
    private static HashSet<long> ReferencedAttachmentIds(string reference)
    {
        if (!reference.StartsWith("attachments:", StringComparison.Ordinal)) return [];
        return reference["attachments:".Length..].Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(value => long.TryParse(value, out var id) ? id : 0).Where(id => id > 0).ToHashSet();
    }
    private static async Task<bool> HasExpectedSignatureAsync(Stream stream, string contentType, CancellationToken ct)
    {
        if (!stream.CanSeek) return false;
        var header = new byte[16];
        var read = await stream.ReadAsync(header.AsMemory(0, header.Length), ct);
        stream.Position = 0;
        return contentType.ToLowerInvariant() switch
        {
            "image/jpeg" => read >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF,
            "image/png" => read >= 8 && header[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }),
            "image/webp" => read >= 12 && System.Text.Encoding.ASCII.GetString(header, 0, 4) == "RIFF" && System.Text.Encoding.ASCII.GetString(header, 8, 4) == "WEBP",
            "video/mp4" or "video/quicktime" => read >= 12 && System.Text.Encoding.ASCII.GetString(header, 4, 4) == "ftyp",
            _ => false
        };
    }
    private static MaintenanceApiResult<T> Unauthorized<T>() => MaintenanceApiResult<T>.Error(MaintenanceApiResultCode.Unauthorized, "Authentication is required.");
    private static MaintenanceApiResult<T> NotFound<T>() => MaintenanceApiResult<T>.Error(MaintenanceApiResultCode.NotFound, "Maintenance request not found.");
    private static MaintenanceApiResult<T> BadRequest<T>(string message) => MaintenanceApiResult<T>.Error(MaintenanceApiResultCode.BadRequest, message);
    private static MaintenanceApiResult<T> Conflict<T>(string code, string message) => MaintenanceApiResult<T>.Error(MaintenanceApiResultCode.Conflict, message, code);
}
