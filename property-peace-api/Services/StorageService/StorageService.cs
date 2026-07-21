using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Storage;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.StorageService
{
    public class StorageService : IStorageService
    {
        private const long DefaultOrgLimitBytes = 10L * 1024L * 1024L * 1024L;
        private readonly DataContext _context;

        public StorageService(DataContext context)
        {
            _context = context;
        }

        public async Task<StorageObject> TrackAsync(TrackStorageObjectRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.BlobName))
                throw new ArgumentException("BlobName is required", nameof(request));
            if (request.SizeBytes < 0)
                throw new ArgumentException("SizeBytes cannot be negative", nameof(request));

            var existing = await _context.StorageObjects
                .FirstOrDefaultAsync(x => x.BlobContainer == request.BlobContainer && x.BlobName == request.BlobName);

            if (existing == null)
            {
                existing = new StorageObject { CreatedAt = DateTime.UtcNow };
                _context.StorageObjects.Add(existing);
            }

            existing.OrganizationId = request.OrganizationId;
            existing.UploadedByUserId = request.UploadedByUserId;
            existing.OwnerUserId = request.OwnerUserId;
            existing.Category = string.IsNullOrWhiteSpace(request.Category) ? "Other" : request.Category.Trim();
            existing.EntityType = request.EntityType;
            existing.EntityId = request.EntityId;
            existing.FileName = request.FileName;
            existing.BlobContainer = request.BlobContainer;
            existing.BlobName = request.BlobName;
            existing.BlobUrl = request.BlobUrl;
            existing.ContentType = request.ContentType;
            existing.SizeBytes = request.SizeBytes;
            existing.Source = string.IsNullOrWhiteSpace(request.Source) ? "Upload" : request.Source.Trim();
            existing.MetadataJson = request.MetadataJson;
            existing.UpdatedAt = DateTime.UtcNow;
            existing.IsDeleted = false;
            existing.DeletedAt = null;

            await _context.SaveChangesAsync();
            return existing;
        }

        public async Task<StorageSummaryDto> GetSummaryAsync()
        {
            var baseQuery = _context.StorageObjects.AsNoTracking();
            var activeQuery = baseQuery.Where(x => !x.IsDeleted);

            var categories = await activeQuery
                .GroupBy(x => x.Category)
                .Select(g => new StorageCategoryUsageDto
                {
                    Category = g.Key,
                    UsedBytes = g.Sum(x => x.SizeBytes),
                    FileCount = g.Count()
                })
                .OrderByDescending(x => x.UsedBytes)
                .ToListAsync();

            return new StorageSummaryDto
            {
                TotalBytes = await baseQuery.SumAsync(x => (long?)x.SizeBytes) ?? 0,
                ActiveBytes = await activeQuery.SumAsync(x => (long?)x.SizeBytes) ?? 0,
                DeletedBytes = await baseQuery.Where(x => x.IsDeleted).SumAsync(x => (long?)x.SizeBytes) ?? 0,
                TotalFiles = await baseQuery.CountAsync(),
                ActiveFiles = await activeQuery.CountAsync(),
                OrganizationCount = await activeQuery.Where(x => x.OrganizationId.HasValue).Select(x => x.OrganizationId).Distinct().CountAsync(),
                UserCount = await activeQuery.Where(x => x.UploadedByUserId.HasValue || x.OwnerUserId.HasValue)
                    .Select(x => x.OwnerUserId ?? x.UploadedByUserId).Distinct().CountAsync(),
                DefaultOrgLimitBytes = DefaultOrgLimitBytes,
                Categories = categories,
                TopOrganizations = (await GetOrganizationsAsync()).Take(10).ToList(),
                TopUsers = (await GetUsersAsync()).Take(10).ToList(),
                RecentObjects = await GetRecentObjectsAsync(12)
            };
        }

        public async Task<List<StorageOrganizationUsageDto>> GetOrganizationsAsync()
        {
            var rows = await _context.StorageObjects.AsNoTracking()
                .Where(x => !x.IsDeleted)
                .GroupBy(x => x.OrganizationId)
                .Select(g => new
                {
                    OrganizationId = g.Key,
                    UsedBytes = g.Sum(x => x.SizeBytes),
                    FileCount = g.Count(),
                    LastUploadAt = g.Max(x => (DateTime?)x.CreatedAt)
                })
                .OrderByDescending(x => x.UsedBytes)
                .ToListAsync();

            var orgIds = rows.Where(x => x.OrganizationId.HasValue).Select(x => x.OrganizationId!.Value).ToList();
            var orgNames = await _context.Organizations.AsNoTracking()
                .Where(o => orgIds.Contains(o.Id))
                .ToDictionaryAsync(o => o.Id, o => o.Name);

            return rows.Select(x => new StorageOrganizationUsageDto
            {
                OrganizationId = x.OrganizationId,
                OrganizationName = x.OrganizationId.HasValue && orgNames.TryGetValue(x.OrganizationId.Value, out var name) ? name : "Unassigned",
                UsedBytes = x.UsedBytes,
                FileCount = x.FileCount,
                LimitBytes = DefaultOrgLimitBytes,
                PercentUsed = Percent(x.UsedBytes, DefaultOrgLimitBytes),
                LastUploadAt = x.LastUploadAt
            }).ToList();
        }

        public async Task<List<StorageUserUsageDto>> GetUsersAsync()
        {
            var rows = await _context.StorageObjects.AsNoTracking()
                .Where(x => !x.IsDeleted)
                .GroupBy(x => x.OwnerUserId ?? x.UploadedByUserId)
                .Select(g => new
                {
                    UserId = g.Key,
                    UsedBytes = g.Sum(x => x.SizeBytes),
                    FileCount = g.Count(),
                    LastUploadAt = g.Max(x => (DateTime?)x.CreatedAt)
                })
                .OrderByDescending(x => x.UsedBytes)
                .ToListAsync();

            var userIds = rows.Where(x => x.UserId.HasValue).Select(x => x.UserId!.Value).ToList();
            var users = await _context.Users.AsNoTracking()
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new { u.Id, u.FirstName, u.LastName, u.Email })
                .ToDictionaryAsync(u => u.Id);

            return rows.Select(x =>
            {
                users.TryGetValue(x.UserId ?? 0, out var user);
                return new StorageUserUsageDto
                {
                    UserId = x.UserId,
                    UserName = user == null ? "Unassigned" : $"{user.FirstName} {user.LastName}".Trim(),
                    Email = user?.Email,
                    UsedBytes = x.UsedBytes,
                    FileCount = x.FileCount,
                    LastUploadAt = x.LastUploadAt
                };
            }).ToList();
        }

        public async Task<StorageUserUsageDto?> GetUserAsync(long userId)
        {
            var user = await _context.Users.AsNoTracking()
                .Where(u => u.Id == userId)
                .Select(u => new { u.Id, u.FirstName, u.LastName, u.Email })
                .FirstOrDefaultAsync();

            if (user == null) return null;

            var orgRows = await _context.StorageObjects.AsNoTracking()
                .Where(x => !x.IsDeleted && (x.OwnerUserId == userId || x.UploadedByUserId == userId))
                .GroupBy(x => x.OrganizationId)
                .Select(g => new
                {
                    OrganizationId = g.Key,
                    UsedBytes = g.Sum(x => x.SizeBytes),
                    FileCount = g.Count(),
                    LastUploadAt = g.Max(x => (DateTime?)x.CreatedAt)
                })
                .OrderByDescending(x => x.UsedBytes)
                .ToListAsync();

            var orgIds = orgRows.Where(x => x.OrganizationId.HasValue).Select(x => x.OrganizationId!.Value).ToList();
            var orgNames = await _context.Organizations.AsNoTracking()
                .Where(o => orgIds.Contains(o.Id))
                .ToDictionaryAsync(o => o.Id, o => o.Name);

            var orgs = orgRows.Select(x => new StorageOrganizationUsageDto
            {
                OrganizationId = x.OrganizationId,
                OrganizationName = x.OrganizationId.HasValue && orgNames.TryGetValue(x.OrganizationId.Value, out var name) ? name : "Unassigned",
                UsedBytes = x.UsedBytes,
                FileCount = x.FileCount,
                LimitBytes = DefaultOrgLimitBytes,
                PercentUsed = Percent(x.UsedBytes, DefaultOrgLimitBytes),
                LastUploadAt = x.LastUploadAt
            }).ToList();

            return new StorageUserUsageDto
            {
                UserId = user.Id,
                UserName = $"{user.FirstName} {user.LastName}".Trim(),
                Email = user.Email,
                UsedBytes = orgs.Sum(x => x.UsedBytes),
                FileCount = orgs.Sum(x => x.FileCount),
                LastUploadAt = orgs.Max(x => x.LastUploadAt),
                Organizations = orgs
            };
        }

        public async Task<StorageOrganizationUsageDto?> GetOrganizationAsync(long organizationId)
        {
            var org = await _context.Organizations.AsNoTracking().FirstOrDefaultAsync(o => o.Id == organizationId);
            if (org == null) return null;

            var objects = _context.StorageObjects.AsNoTracking().Where(x => !x.IsDeleted && x.OrganizationId == organizationId);
            var usedBytes = await objects.SumAsync(x => (long?)x.SizeBytes) ?? 0;
            var fileCount = await objects.CountAsync();

            return new StorageOrganizationUsageDto
            {
                OrganizationId = org.Id,
                OrganizationName = org.Name,
                UsedBytes = usedBytes,
                FileCount = fileCount,
                LimitBytes = DefaultOrgLimitBytes,
                PercentUsed = Percent(usedBytes, DefaultOrgLimitBytes),
                LastUploadAt = await objects.MaxAsync(x => (DateTime?)x.CreatedAt)
            };
        }

        private async Task<List<StorageRecentObjectDto>> GetRecentObjectsAsync(int limit)
        {
            var recent = await _context.StorageObjects.AsNoTracking()
                .Where(x => !x.IsDeleted)
                .OrderByDescending(x => x.CreatedAt)
                .Take(limit)
                .Select(x => new StorageRecentObjectDto
                {
                    Id = x.Id,
                    FileName = x.FileName,
                    Category = x.Category,
                    SizeBytes = x.SizeBytes,
                    OrganizationName = x.Organization != null ? x.Organization.Name : null,
                    UploadedByUserName = x.UploadedByUser != null ? (x.UploadedByUser.FirstName + " " + x.UploadedByUser.LastName).Trim() : null,
                    UploadedByEmail = x.UploadedByUser != null ? x.UploadedByUser.Email : null,
                    EntityType = x.EntityType,
                    EntityId = x.EntityId,
                    CreatedAt = x.CreatedAt
                })
                .ToListAsync();

            return recent;
        }

        private static decimal Percent(long usedBytes, long limitBytes)
        {
            if (limitBytes <= 0) return 0;
            return Math.Round((decimal)usedBytes / limitBytes * 100m, 2);
        }
    }
}
