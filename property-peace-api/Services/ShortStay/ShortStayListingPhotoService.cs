using System.Data;
using System.Security.Claims;
using brownstone_hub_api.Data;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using SkiaSharp;

namespace brownstone_hub_api.Services.ShortStay;

public sealed record ShortStayPhotoDto(long Id, int DisplayOrder, bool IsCoverPhoto, string Url);

public sealed class ShortStayListingPhotoService(DataContext db, IHttpContextAccessor context,
    IShortStayPhotoStorage storage, ILogger<ShortStayListingPhotoService> logger)
{
    private const int MaxPhotos = 20, MaxBatch = 5, MaxBytes = 5 * 1024 * 1024;
    private static ServiceResponse<T> Error<T>(string message, int status) =>
        ServiceResponse<T>.CreateError(message, statusCode: status, suppressDetailedErrors: true);
    private (long Org, long User)? Scope()
    {
        var http = context.HttpContext;
        if (http?.User.Identity?.IsAuthenticated != true ||
            http.Items.TryGetValue("OrganizationId", out var org) != true || org is not long organizationId || organizationId <= 0 ||
            http.Items.TryGetValue("UserId", out var user) != true || user is not long userId || userId <= 0 ||
            !long.TryParse(http.User.FindFirstValue(ClaimTypes.NameIdentifier), out var subject) || subject != userId) return null;
        return (organizationId, userId);
    }
    private async Task<(long ListingId, int Status)> Authorized(long unitId, (long Org, long User) scope, CancellationToken ct)
    {
        if (!await db.OrganizationMembers.AsNoTracking().AnyAsync(m => m.OrganizationId == scope.Org && m.UserId == scope.User && m.IsActive &&
            m.Organization.IsActive && !m.Organization.IsDeleted &&
            (m.Role == "Owner" || m.Role == "Manager" && m.CanManageProperties), ct)) return (0, 403);
        var unit = await db.Units.AsNoTracking().Where(u => u.Id == unitId && u.Property.OrganizationId == scope.Org &&
            !u.Property.IsDeleted && (u.OrganizationId == null || u.OrganizationId == scope.Org))
            .Select(u => new { u.RentalMode }).SingleOrDefaultAsync(ct);
        if (unit is null) return (0, 404);
        if (unit.RentalMode != ERentalMode.ShortTerm) return (0, 409);
        var listingId = await db.ShortStayListings.AsNoTracking().Where(l => l.UnitId == unitId)
            .Select(l => l.Id).SingleOrDefaultAsync(ct);
        return listingId == 0 ? (0, 404) : (listingId, 200);
    }
    private static async Task<(byte[] Bytes, string Type, string Extension)?> Validate(IFormFile file, CancellationToken ct)
    {
        if (file.Length is <= 0 or > MaxBytes || file.ContentType is not ("image/png" or "image/jpeg")) return null;
        await using var input = file.OpenReadStream();
        using var buffer = new MemoryStream();
        var chunk = new byte[81920];
        int read;
        while ((read = await input.ReadAsync(chunk, ct)) > 0)
        {
            if (buffer.Length + read > MaxBytes) return null;
            buffer.Write(chunk, 0, read);
        }
        var bytes = buffer.ToArray();
        if (bytes.Length != file.Length) return null;
        bool png = file.ContentType == "image/png";
        if (png && (bytes.Length < 8 || !bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }))) return null;
        if (!png && (bytes.Length < 4 || bytes[0] != 0xff || bytes[1] != 0xd8 || bytes[^2] != 0xff || bytes[^1] != 0xd9)) return null;
        try
        {
            using var data = SKData.CreateCopy(bytes);
            using var codec = SKCodec.Create(data);
            if (codec is null || codec.EncodedFormat != (png ? SKEncodedImageFormat.Png : SKEncodedImageFormat.Jpeg) ||
                codec.Info.Width is <= 0 or > 6000 || codec.Info.Height is <= 0 or > 6000 ||
                (long)codec.Info.Width * codec.Info.Height > 20_000_000) return null;
            using var bitmap = SKBitmap.Decode(data);
            if (bitmap is null || bitmap.Width != codec.Info.Width || bitmap.Height != codec.Info.Height) return null;
            // Re-encode so embedded metadata/polyglot payloads are not served back to clients.
            using var image = SKImage.FromBitmap(bitmap);
            using var clean = image.Encode(png ? SKEncodedImageFormat.Png : SKEncodedImageFormat.Jpeg, 85);
            if (clean is null || clean.Size > MaxBytes) return null;
            return (clean.ToArray(), file.ContentType, png ? "png" : "jpg");
        }
        catch (Exception) { return null; }
    }
    public async Task<ServiceResponse<IReadOnlyList<ShortStayPhotoDto>>> List(long unitId, CancellationToken ct = default)
    {
        if (Scope() is not { } scope) return Error<IReadOnlyList<ShortStayPhotoDto>>("Forbidden", 403);
        if (unitId <= 0) return Error<IReadOnlyList<ShortStayPhotoDto>>("Invalid unit", 400);
        try
        {
            var (listingId, status) = await Authorized(unitId, scope, ct);
            if (status != 200) return Error<IReadOnlyList<ShortStayPhotoDto>>("Photos unavailable", status);
            var rows = await db.ShortStayListingPhotos.AsNoTracking().Where(p => p.ShortStayListingId == listingId)
                .OrderBy(p => p.DisplayOrder).ThenBy(p => p.Id).ToListAsync(ct);
            var result = new List<ShortStayPhotoDto>();
            foreach (var row in rows)
                result.Add(new(row.Id, row.DisplayOrder, row.IsCoverPhoto, await storage.ReadUrl(row.BlobName, ct)));
            return ServiceResponse<IReadOnlyList<ShortStayPhotoDto>>.CreateSuccess(result);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { logger.LogError("Short-stay photo list unavailable"); return Error<IReadOnlyList<ShortStayPhotoDto>>("Photos unavailable", 503); }
    }
    public async Task<ServiceResponse<IReadOnlyList<long>>> Upload(long unitId, IReadOnlyList<IFormFile>? files, CancellationToken ct = default)
    {
        if (Scope() is not { } scope) return Error<IReadOnlyList<long>>("Forbidden", 403);
        if (unitId <= 0) return Error<IReadOnlyList<long>>("Invalid unit", 400);
        try
        {
            var (_, status) = await Authorized(unitId, scope, ct);
            if (status != 200) return Error<IReadOnlyList<long>>("Photos unavailable", status);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { logger.LogError("Short-stay photo authorization unavailable"); return Error<IReadOnlyList<long>>("Photos unavailable", 503); }
        if (files is null || files.Count is < 1 or > MaxBatch || files.Any(f => f is null || f.Length is <= 0 or > MaxBytes) ||
            files.Sum(f => f.Length) > 20L * 1024 * 1024) return Error<IReadOnlyList<long>>("Invalid photos", 400);
        var validated = new List<(byte[] Bytes, string Type, string Extension)>();
        try
        {
            // Validate every file before opening the DB transaction or writing a blob.
            foreach (var file in files)
            {
                var item = await Validate(file, ct);
                if (item is null) return Error<IReadOnlyList<long>>("Invalid image", 400);
                validated.Add(item.Value);
            }
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return Error<IReadOnlyList<long>>("Invalid image", 400); }
        var attempted = new List<string>();
        var committed = false;
        try
        {
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            if (db.Database.IsSqlServer()) await db.Database.SqlQueryRaw<long>(
                "SELECT Id AS Value FROM [property].[Units] WITH (UPDLOCK, HOLDLOCK) WHERE Id = {0}", unitId).SingleOrDefaultAsync(ct);
            var (listingId, status) = await Authorized(unitId, scope, ct);
            if (status != 200) return Error<IReadOnlyList<long>>("Photos unavailable", status);
            var photos = await db.ShortStayListingPhotos.Where(p => p.ShortStayListingId == listingId).ToListAsync(ct);
            if (photos.Count + validated.Count > MaxPhotos) return Error<IReadOnlyList<long>>("Photo limit reached", 409);
            var order = photos.Count == 0 ? 0 : photos.Max(p => p.DisplayOrder) + 1;
            foreach (var (bytes, type, extension) in validated)
            {
                var key = $"org/{scope.Org}/units/{unitId}/listings/{listingId}/{Guid.NewGuid():N}.{extension}";
                attempted.Add(key); // also compensate a partial upload that threw
                await storage.Write(key, bytes, type, ct);
                db.ShortStayListingPhotos.Add(new ShortStayListingPhoto { ShortStayListingId = listingId, BlobName = key,
                    DisplayOrder = order++, IsCoverPhoto = photos.Count == 0 && attempted.Count == 1 });
            }
            await db.SaveChangesAsync(ct);
            var ids = db.ChangeTracker.Entries<ShortStayListingPhoto>().Where(e => attempted.Contains(e.Entity.BlobName))
                .Select(e => e.Entity.Id).ToArray();
            await tx.CommitAsync(ct);
            committed = true;
            return ServiceResponse<IReadOnlyList<long>>.CreateSuccess(ids, statusCode: 201);
        }
        catch (Exception)
        {
            logger.LogError("Short-stay photo upload failed");
            foreach (var entry in db.ChangeTracker.Entries<ShortStayListingPhoto>().Where(e => attempted.Contains(e.Entity.BlobName)))
                entry.State = EntityState.Detached;
            // A commit may have succeeded despite an ambiguous transport error. Never remove
            // objects still referenced by persisted rows; if DB is unavailable leave private orphans.
            var referenced = committed;
            if (attempted.Count > 0 && !referenced)
            {
                try { referenced = await db.ShortStayListingPhotos.AsNoTracking()
                    .AnyAsync(p => attempted.Contains(p.BlobName), CancellationToken.None); }
                catch (Exception) { referenced = true; logger.LogError("Photo upload reconciliation unavailable"); }
            }
            if (!referenced) foreach (var key in attempted)
            {
                try { await storage.Delete(key, CancellationToken.None); }
                catch (Exception) { logger.LogError("Short-stay photo upload cleanup failed"); }
            }
            if (ct.IsCancellationRequested) throw new OperationCanceledException(ct);
            return Error<IReadOnlyList<long>>("Photo upload unavailable", 503);
        }
    }
    public async Task<ServiceResponse<bool>> Delete(long unitId, long photoId, CancellationToken ct = default) =>
        await Modify(unitId, photoId, true, ct);
    public async Task<ServiceResponse<bool>> SetCover(long unitId, long photoId, CancellationToken ct = default) =>
        await Modify(unitId, photoId, false, ct);
    private async Task<ServiceResponse<bool>> Modify(long unitId, long photoId, bool delete, CancellationToken ct)
    {
        if (Scope() is not { } scope) return Error<bool>("Forbidden", 403);
        if (unitId <= 0 || photoId <= 0) return Error<bool>("Invalid photo", 400);
        try
        {
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            if (db.Database.IsSqlServer()) await db.Database.SqlQueryRaw<long>(
                "SELECT Id AS Value FROM [property].[Units] WITH (UPDLOCK, HOLDLOCK) WHERE Id = {0}", unitId).SingleOrDefaultAsync(ct);
            var (listingId, status) = await Authorized(unitId, scope, ct);
            if (status != 200) return Error<bool>("Photos unavailable", status);
            var photos = await db.ShortStayListingPhotos.Where(p => p.ShortStayListingId == listingId).ToListAsync(ct);
            var target = photos.SingleOrDefault(p => p.Id == photoId);
            if (target is null) return Error<bool>("Photo not found", 404);
            if (delete)
            {
                db.ShortStayListingPhotos.Remove(target);
                // Commit database first: failed blob deletion leaves an inaccessible private orphan, not a dangling URL.
                await db.SaveChangesAsync(ct);
                if (target.IsCoverPhoto)
                {
                    var next = photos.Where(p => p.Id != photoId).MinBy(p => p.DisplayOrder);
                    if (next is not null) { next.IsCoverPhoto = true; await db.SaveChangesAsync(ct); }
                }
                await tx.CommitAsync(ct);
                try { await storage.Delete(target.BlobName, ct); }
                catch (Exception)
                {
                    // TODO: Add durable private-orphan reconciliation (persist cleanup work or sweep
                    // unreferenced blobs); a log alone does not guarantee eventual blob removal.
                    // Log only stable internal IDs, never the blob name, URL/SAS, or exception details.
                    logger.LogError("Private photo orphan cleanup failed for listing {ListingId}, photo {PhotoId}", listingId, photoId);
                    // The row deletion is already committed; cleanup failure must not imply it can be retried.
                }
            }
            else
            {
                if (!target.IsCoverPhoto)
                {
                    // Filtered unique cover index requires the old row to be cleared first.
                    foreach (var old in photos.Where(p => p.IsCoverPhoto)) old.IsCoverPhoto = false;
                    await db.SaveChangesAsync(ct);
                    target.IsCoverPhoto = true;
                    await db.SaveChangesAsync(ct);
                }
                await tx.CommitAsync(ct);
            }
            return ServiceResponse<bool>.CreateSuccess(true);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { logger.LogError("Short-stay photo update failed"); return Error<bool>("Photos unavailable", 503); }
    }
}
