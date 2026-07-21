using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.TenantDocument;
using brownstone_hub_api.Enums;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.TenantDocuments
{
    public class TenantDocumentRepository(DataContext context, IMapper mapper, ILogger<TenantDocumentRepository> logger) : ITenantDocumentRepository
    {
        private readonly DataContext _context = context;
        private readonly IMapper _mapper = mapper;
        private readonly ILogger<TenantDocumentRepository> _logger = logger;

        private IQueryable<Models.TenantDocument> TenantDocumentQuery()
        {
            return _context.TenantDocuments
                .Include(d => d.Tenant)
                .Include(d => d.Lease)
                    .ThenInclude(l => l.Unit)
                        .ThenInclude(u => u.Property)
                .Include(d => d.Lease)
                    .ThenInclude(l => l.TenantLeases)
                        .ThenInclude(tl => tl.Tenant);
        }

        public async Task<LoadTenantDocumentDto> AddTenantDocument(AddTenantDocumentDto document, long? organizationId = null)
        {
            var entity = _mapper.Map<Models.TenantDocument>(document);
            entity.RefId = document.TenantId ?? document.LeaseId ?? 0; // Set RefId for IImageEntity
            
            // Set organizationId if provided, otherwise from tenant's or lease's property
            if (organizationId.HasValue)
            {
                entity.OrganizationId = organizationId.Value;
            }
            else if (document.TenantId.HasValue)
            {
                var tenant = await _context.Tenants
                    .Include(t => t.TenantLeases)
                        .ThenInclude(tl => tl.Lease)
                            .ThenInclude(l => l.Unit)
                                .ThenInclude(u => u.Property)
                    .FirstOrDefaultAsync(t => t.Id == document.TenantId);
                var firstLease = tenant?.TenantLeases?.FirstOrDefault()?.Lease;
                if (firstLease?.Unit?.Property?.OrganizationId != null)
                    entity.OrganizationId = firstLease.Unit.Property.OrganizationId;
            }
            else if (document.LeaseId.HasValue)
            {
                var lease = await _context.Leases
                    .Include(l => l.Unit)
                        .ThenInclude(u => u.Property)
                    .FirstOrDefaultAsync(l => l.Id == document.LeaseId);
                if (lease?.Unit?.Property?.OrganizationId != null)
                    entity.OrganizationId = lease.Unit.Property.OrganizationId;
            }

            await _context.TenantDocuments.AddAsync(entity);
            await _context.SaveChangesAsync();

            if (entity.TenantId.HasValue)
                await _context.Entry(entity).Reference(e => e.Tenant).LoadAsync();
            if (entity.LeaseId.HasValue)
                await _context.Entry(entity).Reference(e => e.Lease).LoadAsync();

            return MapToDto(entity);
        }

        public async Task<bool> CanAccessTenant(long tenantId, long? organizationId, long? userId, bool isTenantUser)
        {
            if (isTenantUser)
            {
                return userId.HasValue && await _context.Tenants
                    .AnyAsync(t => t.Id == tenantId && t.UserId == userId.Value && !t.IsDeleted);
            }

            return organizationId.HasValue && await _context.Tenants
                .AnyAsync(t => t.Id == tenantId && t.OrganizationId == organizationId.Value && !t.IsDeleted);
        }

        public async Task<bool> CanAccessLease(long leaseId, long? organizationId, long? userId, bool isTenantUser)
        {
            if (isTenantUser)
            {
                return userId.HasValue && await _context.Leases
                    .AnyAsync(l => l.Id == leaseId && l.TenantLeases.Any(tl => tl.Tenant.UserId == userId.Value && !tl.Tenant.IsDeleted));
            }

            return organizationId.HasValue && await _context.Leases
                .AnyAsync(l => l.Id == leaseId && (l.OrganizationId == organizationId.Value || l.Unit.Property.OrganizationId == organizationId.Value));
        }

        public async Task<LoadTenantDocumentDto?> GetTenantDocumentById(long id, long? organizationId, long? userId, bool isTenantUser)
        {
            var document = await TenantDocumentQuery()
                .FirstOrDefaultAsync(d => d.Id == id && !d.IsDeleted
                    && (isTenantUser
                        ? userId.HasValue && !d.IsPrivate && (
                            (d.Tenant != null && d.Tenant.UserId == userId.Value)
                            || (d.Lease != null && d.Lease.TenantLeases.Any(tl => tl.Tenant.UserId == userId.Value && !tl.Tenant.IsDeleted)))
                        : organizationId.HasValue && (
                            d.OrganizationId == organizationId.Value
                            || (d.Tenant != null && d.Tenant.OrganizationId == organizationId.Value)
                            || (d.Lease != null && (d.Lease.OrganizationId == organizationId.Value || d.Lease.Unit.Property.OrganizationId == organizationId.Value)))));

            return document == null ? null : MapToDto(document);
        }

        public async Task<List<LoadTenantDocumentDto>> GetTenantDocumentsByTenantId(long tenantId, long? organizationId, long? userId, bool isTenantUser)
        {
            // Tenant sees: their own docs + lease-level docs for their leases, only when IsPrivate == false
            if (!await CanAccessTenant(tenantId, organizationId, userId, isTenantUser))
            {
                return [];
            }

            var tenantLeaseIds = await _context.TenantLeases
                .Where(tl => tl.TenantId == tenantId)
                .Select(tl => tl.LeaseId)
                .ToListAsync();

            var documents = await TenantDocumentQuery()
                .Where(d => !d.IsDeleted && !d.IsPrivate &&
                    (d.TenantId == tenantId || (d.TenantId == null && d.LeaseId.HasValue && tenantLeaseIds.Contains(d.LeaseId.Value))))
                .OrderByDescending(d => d.CreatedAt)
                .ToListAsync();

            return documents.Select(MapToDto).ToList();
        }

        public async Task<List<LoadTenantDocumentDto>> GetTenantDocumentsByLandlordId(long landlordId)
        {
            var documents = await _context.TenantDocuments
                .Include(d => d.Tenant)
                .Include(d => d.Lease)
                    .ThenInclude(l => l.Unit)
                        .ThenInclude(u => u.Property)
                .Where(d => d.Lease != null && d.Lease.Unit.Property.LandlordId == landlordId && !d.IsDeleted)
                .OrderByDescending(d => d.CreatedAt)
                .ToListAsync();

            return documents.Select(MapToDto).ToList();
        }

        public async Task<LoadTenantDocumentDto?> GetLeaseAgreementByLeaseId(long leaseId, long? organizationId, long? userId, bool isTenantUser)
        {
            var document = await TenantDocumentQuery()
                .Where(d => d.LeaseId == leaseId
                    && d.DocumentType == ETenantDocumentType.LeaseAgreement
                    && !d.IsDeleted
                    && (isTenantUser
                        ? userId.HasValue && !d.IsPrivate && (
                            (d.Tenant != null && d.Tenant.UserId == userId.Value)
                            || (d.Lease != null && d.Lease.TenantLeases.Any(tl => tl.Tenant.UserId == userId.Value && !tl.Tenant.IsDeleted)))
                        : organizationId.HasValue && (
                            d.OrganizationId == organizationId.Value
                            || (d.Tenant != null && d.Tenant.OrganizationId == organizationId.Value)
                            || (d.Lease != null && (d.Lease.OrganizationId == organizationId.Value || d.Lease.Unit.Property.OrganizationId == organizationId.Value)))))
                .OrderByDescending(d => d.CreatedAt) // Get the most recent one
                .FirstOrDefaultAsync();

            return document == null ? null : MapToDto(document);
        }

        public async Task<List<LoadTenantDocumentDto>> GetTenantDocumentsByLeaseId(long leaseId, long? organizationId)
        {
            if (!organizationId.HasValue)
            {
                return [];
            }

            var documents = await TenantDocumentQuery()
                .Where(d => d.LeaseId == leaseId && !d.IsDeleted && (
                    d.OrganizationId == organizationId.Value
                    || (d.Tenant != null && d.Tenant.OrganizationId == organizationId.Value)
                    || (d.Lease != null && (d.Lease.OrganizationId == organizationId.Value || d.Lease.Unit.Property.OrganizationId == organizationId.Value))))
                .OrderByDescending(d => d.CreatedAt)
                .ToListAsync();

            return documents.Select(MapToDto).ToList();
        }

        public async Task<List<LoadTenantDocumentDto>> GetExpiringDocuments(long landlordId, int daysAhead = 30)
        {
            var cutoffDate = DateTime.Now.AddDays(daysAhead);

            var documents = await _context.TenantDocuments
                .Include(d => d.Tenant)
                .Include(d => d.Lease)
                    .ThenInclude(l => l.Unit)
                        .ThenInclude(u => u.Property)
                .Where(d => d.Lease != null && d.Lease.Unit.Property.LandlordId == landlordId
                    && !d.IsDeleted
                    && d.ExpirationDate.HasValue
                    && d.ExpirationDate.Value >= DateTime.Now
                    && d.ExpirationDate.Value <= cutoffDate)
                .OrderBy(d => d.ExpirationDate)
                .ToListAsync();

            return documents.Select(MapToDto).ToList();
        }

        public async Task<List<LoadTenantDocumentDto>> GetTenantDocumentsByOrganizationId(long organizationId)
        {
            var documents = await _context.TenantDocuments
                .Include(d => d.Tenant)
                .Include(d => d.Lease)
                    .ThenInclude(l => l.Unit)
                        .ThenInclude(u => u.Property)
                .Where(d => d.OrganizationId == organizationId && !d.IsDeleted)
                .OrderByDescending(d => d.CreatedAt)
                .ToListAsync();

            return documents.Select(MapToDto).ToList();
        }

        public async Task<List<LoadTenantDocumentDto>> GetExpiringDocumentsByOrganizationId(long organizationId, int daysAhead = 30)
        {
            var cutoffDate = DateTime.Now.AddDays(daysAhead);

            var documents = await _context.TenantDocuments
                .Include(d => d.Tenant)
                .Include(d => d.Lease)
                    .ThenInclude(l => l.Unit)
                        .ThenInclude(u => u.Property)
                .Where(d => d.OrganizationId == organizationId
                    && !d.IsDeleted
                    && d.ExpirationDate.HasValue
                    && d.ExpirationDate.Value >= DateTime.Now
                    && d.ExpirationDate.Value <= cutoffDate)
                .OrderBy(d => d.ExpirationDate)
                .ToListAsync();

            return documents.Select(MapToDto).ToList();
        }

        public async Task<LoadTenantDocumentDto> UpdateTenantDocument(UpdateTenantDocumentDto document, long? organizationId, long? userId, bool isTenantUser)
        {
            var entity = await TenantDocumentQuery()
                .FirstOrDefaultAsync(d => d.Id == document.Id && !d.IsDeleted
                    && (isTenantUser
                        ? userId.HasValue && !d.IsPrivate && (
                            (d.Tenant != null && d.Tenant.UserId == userId.Value)
                            || (d.Lease != null && d.Lease.TenantLeases.Any(tl => tl.Tenant.UserId == userId.Value && !tl.Tenant.IsDeleted)))
                        : organizationId.HasValue && (
                            d.OrganizationId == organizationId.Value
                            || (d.Tenant != null && d.Tenant.OrganizationId == organizationId.Value)
                            || (d.Lease != null && (d.Lease.OrganizationId == organizationId.Value || d.Lease.Unit.Property.OrganizationId == organizationId.Value)))))
                ?? throw new KeyNotFoundException($"Tenant document with ID {document.Id} not found.");

            // Update only provided fields
            if (document.Description != null)
                entity.Description = document.Description;
            if (document.DocumentType.HasValue)
                entity.DocumentType = document.DocumentType.Value;
            if (document.ExpirationDate.HasValue)
                entity.ExpirationDate = document.ExpirationDate;
            if (document.IsDeleted.HasValue)
                entity.IsDeleted = document.IsDeleted.Value;
            if (document.IsRequired.HasValue)
                entity.IsRequired = document.IsRequired.Value;
            if (document.LeaseId.HasValue)
            {
                var canMoveToLease = await CanAccessLease(document.LeaseId.Value, organizationId, userId, isTenantUser);
                if (!canMoveToLease)
                    throw new KeyNotFoundException($"Lease with ID {document.LeaseId.Value} not found.");
                entity.LeaseId = document.LeaseId;
            }
            if (!isTenantUser && document.IsPrivate.HasValue)
                entity.IsPrivate = document.IsPrivate.Value;

            entity.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            return MapToDto(entity);
        }

        public async Task<bool> DeleteTenantDocument(long id, long? organizationId, long? userId, bool isTenantUser)
        {
            var document = await TenantDocumentQuery()
                .FirstOrDefaultAsync(d => d.Id == id && !d.IsDeleted
                    && (isTenantUser
                        ? userId.HasValue && !d.IsPrivate && (
                            (d.Tenant != null && d.Tenant.UserId == userId.Value)
                            || (d.Lease != null && d.Lease.TenantLeases.Any(tl => tl.Tenant.UserId == userId.Value && !tl.Tenant.IsDeleted)))
                        : organizationId.HasValue && (
                            d.OrganizationId == organizationId.Value
                            || (d.Tenant != null && d.Tenant.OrganizationId == organizationId.Value)
                            || (d.Lease != null && (d.Lease.OrganizationId == organizationId.Value || d.Lease.Unit.Property.OrganizationId == organizationId.Value)))));
            if (document == null)
                return false;

            // Soft delete
            document.IsDeleted = true;
            document.DeletedAt = DateTime.UtcNow;
            document.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();

            return true;
        }

        public async Task<int> DeleteTenantDocumentsByTenantIds(List<long> tenantIds)
        {
            try
            {
                var documents = await _context.TenantDocuments
                    .Where(td => td.TenantId.HasValue && tenantIds.Contains(td.TenantId.Value) && !td.IsDeleted)
                    .ToListAsync();

                foreach (var doc in documents)
                {
                    doc.IsDeleted = true;
                    doc.DeletedAt = DateTime.UtcNow;
                    doc.UpdatedAt = DateTime.Now;
                }

                await _context.SaveChangesAsync();
                return documents.Count;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting tenant documents for tenant IDs: {TenantIds}", string.Join(", ", tenantIds));
                throw;
            }
        }

        private LoadTenantDocumentDto MapToDto(Models.TenantDocument document)
        {
            var dto = _mapper.Map<LoadTenantDocumentDto>(document);

            dto.IsExpired = document.ExpirationDate.HasValue && document.ExpirationDate.Value < DateTime.Now;
            dto.IsExpiringSoon = document.ExpirationDate.HasValue &&
                document.ExpirationDate.Value >= DateTime.Now &&
                document.ExpirationDate.Value <= DateTime.Now.AddDays(30);
            dto.TenantName = document.Tenant != null
                ? $"{document.Tenant.Firstname} {document.Tenant.Lastname}"
                : "—";
            dto.DocumentTypeName = GetDocumentTypeName(document.DocumentType);

            if (document.Lease != null)
                dto.LeaseInfo = $"{document.Lease.Unit.Property.Name} - {document.Lease.Unit.Name}";

            return dto;
        }

        private static string GetDocumentTypeName(ETenantDocumentType type)
        {
            return type switch
            {
                ETenantDocumentType.GovernmentId => "Government ID",
                ETenantDocumentType.SocialSecurityCard => "Social Security Card",
                ETenantDocumentType.LeaseAgreement => "Lease Agreement",
                ETenantDocumentType.LeaseAddendum => "Lease Addendum",
                ETenantDocumentType.LeaseRenewal => "Lease Renewal",
                ETenantDocumentType.RenterInsurance => "Renter Insurance",
                ETenantDocumentType.LiabilityInsurance => "Liability Insurance",
                ETenantDocumentType.RentalApplication => "Rental Application",
                ETenantDocumentType.CreditReport => "Credit Report",
                ETenantDocumentType.BackgroundCheck => "Background Check",
                ETenantDocumentType.IncomeVerification => "Income Verification",
                ETenantDocumentType.EmploymentVerification => "Employment Verification",
                ETenantDocumentType.MoveInChecklist => "Move-In Checklist",
                ETenantDocumentType.MoveOutChecklist => "Move-Out Checklist",
                ETenantDocumentType.MoveInPhotos => "Move-In Photos",
                ETenantDocumentType.MoveOutPhotos => "Move-Out Photos",
                ETenantDocumentType.BankStatement => "Bank Statement",
                ETenantDocumentType.TaxReturn => "Tax Return",
                ETenantDocumentType.W2 => "W2",
                ETenantDocumentType.PayStub => "Pay Stub",
                ETenantDocumentType.PetAgreement => "Pet Agreement",
                ETenantDocumentType.ParkingAgreement => "Parking Agreement",
                ETenantDocumentType.Other => "Other",
                _ => type.ToString()
            };
        }
    }
}

