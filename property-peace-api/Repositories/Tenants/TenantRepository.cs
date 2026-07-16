

using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Tenant;
using brownstone_hub_api.Models;
using brownstone_hub_api.Utils;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.Tenants
{
    public class TenantRepository(DataContext context, IMapper mapper) : ITenantRepository
    {
        private readonly DataContext _context = context;
        private readonly IMapper _mapper = mapper;

        public async Task<LoadTenantDto> AddTenant(AddTenantDto tenant)
        {
            var newTenant = _mapper.Map<Tenant>(tenant);

            // Explicitly ensure OrganizationId is set (in case AutoMapper didn't map it)
            if (tenant.OrganizationId.HasValue)
            {
                newTenant.OrganizationId = tenant.OrganizationId.Value;
            }

            // Explicitly ensure UserId is set (or null if not provided)
            if (!tenant.UserId.HasValue)
            {
                newTenant.UserId = null;
            }
            else
            {
                newTenant.UserId = tenant.UserId.Value;
            }

            // Imported/new tenants (no unit or lease) stay org-only: no UnitId, no TenantLease until the user assigns them.
            if (!tenant.UnitId.HasValue)
            {
                newTenant.UnitId = null;
            }
            else
            {
                newTenant.UnitId = tenant.UnitId.Value;
            }

            await _context.Tenants.AddAsync(newTenant);
            await _context.SaveChangesAsync();

            // Create TenantLease only when explicitly provided (e.g. adding tenant to a lease). Do not link imported/new tenants to any lease.
            if (tenant.LeaseId.HasValue)
            {
                var tenantLease = new TenantLease
                {
                    TenantId = newTenant.Id,
                    LeaseId = tenant.LeaseId.Value,
                    CreatedAt = DateTime.Now
                };
                await _context.TenantLeases.AddAsync(tenantLease);
                await _context.SaveChangesAsync();
            }

            return _mapper.Map<LoadTenantDto>(newTenant);
        }

        public async Task<LoadTenantDto> UpdateTenant(long id, AddTenantDto tenant)
        {
            // Use FirstOrDefaultAsync instead of FindAsync to ensure we get a fresh entity from the database
            // This is important when updating relationships like LeaseId
            var existingTenant = await _context.Tenants.FirstOrDefaultAsync(t => t.Id == id);
            if (existingTenant == null)
            {
                return null;
            }

            // Preserve UserId before map - many update payloads (e.g. link tenant to unit) omit UserId,
            // and AutoMapper would overwrite with null, disconnecting the tenant from their account
            var existingUserId = existingTenant.UserId;

            _mapper.Map(tenant, existingTenant);

            // Explicitly ensure OrganizationId is set (in case AutoMapper didn't map it)
            if (tenant.OrganizationId.HasValue)
            {
                existingTenant.OrganizationId = tenant.OrganizationId.Value;
            }

            // UserId: only update when DTO provides a value; never overwrite with null when omitted
            if (tenant.UserId.HasValue)
            {
                existingTenant.UserId = tenant.UserId.Value;
            }
            else if (existingUserId.HasValue)
            {
                existingTenant.UserId = existingUserId;
            }

            // Manage TenantLease relationships if LeaseId is provided in DTO
            if (tenant.LeaseId.HasValue)
            {
                // Check if TenantLease already exists
                var existingTenantLease = await _context.TenantLeases
                    .FirstOrDefaultAsync(tl => tl.TenantId == id && tl.LeaseId == tenant.LeaseId.Value);
                
                if (existingTenantLease == null)
                {
                    // Create new TenantLease relationship
                    var tenantLease = new TenantLease
                    {
                        TenantId = id,
                        LeaseId = tenant.LeaseId.Value,
                        CreatedAt = DateTime.Now
                    };
                    await _context.TenantLeases.AddAsync(tenantLease);
                }
            }

            // Explicitly ensure UnitId is set (in case AutoMapper didn't map it)
            if (tenant.UnitId.HasValue)
            {
                existingTenant.UnitId = tenant.UnitId.Value;
                _context.Entry(existingTenant).Property(t => t.UnitId).IsModified = true;
            }
            else if (tenant.UnitId == null)
            {
                // If UnitId is explicitly null in DTO, set it to null
                existingTenant.UnitId = null;
                _context.Entry(existingTenant).Property(t => t.UnitId).IsModified = true;
            }

            _context.Tenants.Update(existingTenant);
            await _context.SaveChangesAsync();

            return _mapper.Map<LoadTenantDto>(existingTenant);
        }

        public async Task<List<LoadTenantDto>> GetTenantsByLeaseId(long leaseId)
        {
            var lease = await _context.Leases.AsNoTracking().FirstOrDefaultAsync(l => l.Id == leaseId);
            if (lease == null) return new List<LoadTenantDto>();

            // Only return tenants that are assigned to this lease's unit. Org-only tenants (UnitId null) must not appear on any lease.
            var tenantLeases = await _context.TenantLeases
                .Where(tl => tl.LeaseId == leaseId)
                .Include(tl => tl.Tenant)
                    .ThenInclude(t => t.User)
                .ToListAsync();

            var tenants = tenantLeases
                .Where(tl => tl.Tenant != null && tl.Tenant.UnitId == lease.UnitId && !tl.Tenant.IsDeleted)
                .Select(tl => tl.Tenant!)
                .ToList();
            return _mapper.Map<List<LoadTenantDto>>(tenants);
        }

        public async Task<LoadTenantDto> GetTenantById(long id)
        {
            var tenant = await _context.Tenants
                .Include(t => t.User)
                    .ThenInclude(u => u.UserRoles)
                        .ThenInclude(ur => ur.Role)
                .Include(t => t.TenantLeases)
                    .ThenInclude(tl => tl.Lease)
                .Include(t => t.Unit)
                    .ThenInclude(u => u.Property)
                .FirstOrDefaultAsync(t => t.Id == id);

            return _mapper.Map<LoadTenantDto>(tenant);
        }

        public async Task<List<LoadTenantDto>> GetAllTenantsByLandlord(long landlordId)
        {
            var tenants = await _context.Tenants
                .Include(t => t.Unit)
                    .ThenInclude(u => u.Property)
                .Include(t => t.TenantLeases)
                    .ThenInclude(tl => tl.Lease)
                .Where(t => !t.IsDeleted && t.Unit.Property.LandlordId == landlordId)
                .ToListAsync();

            return _mapper.Map<List<LoadTenantDto>>(tenants);
        }

        public async Task<List<LoadTenantDto>> GetAllTenantsByOrganizationId(long organizationId)
        {
            var tenants = await _context.Tenants
                .Include(t => t.Unit)
                    .ThenInclude(u => u!.Property)
                .Include(t => t.TenantLeases)
                    .ThenInclude(tl => tl.Lease)
                .Include(t => t.User)
                .Where(t => t.OrganizationId == organizationId && !t.IsDeleted)
                .ToListAsync();

            return _mapper.Map<List<LoadTenantDto>>(tenants);
        }

        public async Task<LoadTenantDto> DeleteTenant(long id)
        {
            var tenant = await _context.Tenants
                .Include(t => t.User)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (tenant == null) return null;

            // Set ConvertedToTenantId to null in RentalApplications (don't delete applications)
            var applications = await _context.RentalApplications
                .Where(ra => ra.ConvertedToTenantId == id)
                .ToListAsync();
            
            foreach (var app in applications)
            {
                app.ConvertedToTenantId = null;
            }

            // Set TenantId to null in Checklists (don't delete checklists)
            var checklists = await _context.Checklists
                .Where(c => c.TenantId == id)
                .ToListAsync();
            
            foreach (var checklist in checklists)
            {
                checklist.TenantId = null;
            }

            // TenantInvites are preserved because the tenant row remains available for tenant account/history access.
            // TenantDocuments are kept (user requirement)
            // Conversations are kept (user requirement)

            // Soft-delete the tenant from the landlord portfolio while preserving the tenant account,
            // tenant details, lease links, documents, conversations, and historical data.
            tenant.IsDeleted = true;
            tenant.DeletedAt = DateTime.Now;
            await _context.SaveChangesAsync();

            return _mapper.Map<LoadTenantDto>(tenant);
        }

        public async Task<int> DeleteTenantsByPropertyId(long propertyId)
        {
            try
            {
                // Get all active tenants associated with units in this property
                var tenants = await _context.Tenants
                    .Include(t => t.Unit)
                        .ThenInclude(u => u.Property)
                    .Where(t => !t.IsDeleted && t.Unit != null && t.Unit.PropertyId == propertyId)
                    .ToListAsync();

                if (!tenants.Any())
                {
                    return 0;
                }

                var tenantIds = tenants.Select(t => t.Id).ToList();

                // Set ConvertedToTenantId to null in RentalApplications
                var applications = await _context.RentalApplications
                    .Where(ra => tenantIds.Contains(ra.ConvertedToTenantId ?? 0))
                    .ToListAsync();
                
                foreach (var app in applications)
                {
                    app.ConvertedToTenantId = null;
                }

                // Set TenantId to null in Checklists
                var checklists = await _context.Checklists
                    .Where(c => tenantIds.Contains(c.TenantId ?? 0))
                    .ToListAsync();
                
                foreach (var checklist in checklists)
                {
                    checklist.TenantId = null;
                }

                // Soft-delete all tenants so their accounts and tenant-side historical data remain available.
                var now = DateTime.Now;
                foreach (var tenant in tenants)
                {
                    tenant.IsDeleted = true;
                    tenant.DeletedAt = now;
                }
                await _context.SaveChangesAsync();

                return tenants.Count;
            }
            catch (Exception ex)
            {
                throw new Exception($"Error deleting tenants for property {propertyId}", ex);
            }
        }

        public async Task<bool> TenantEmailExists(string email)
        {
            if (string.IsNullOrWhiteSpace(email))
                return false;

            return await _context.Tenants
                .AnyAsync(t => t.Email != null && t.Email.ToLower().Equals(email.ToLower()));
        }

        public async Task<LoadTenantDto?> GetTenantByEmail(string email)
        {
            if (string.IsNullOrWhiteSpace(email))
                return null;

            var tenant = await _context.Tenants
                .Include(t => t.User)
                .Include(t => t.Unit)
                    .ThenInclude(u => u.Property)
                .Include(t => t.TenantLeases)
                    .ThenInclude(tl => tl.Lease)
                .FirstOrDefaultAsync(t => t.Email != null && t.Email.ToLower().Equals(email.ToLower()) && !t.IsDeleted);

            return tenant == null ? null : _mapper.Map<LoadTenantDto>(tenant);
        }

        public async Task<List<long>> GetLeasesByTenantUserId(long userId)
        {
            var leaseIds = await _context.TenantLeases
                .Where(tl => tl.Tenant.UserId == userId)
                .Select(tl => tl.LeaseId)
                .Distinct()
                .ToListAsync();

            return leaseIds;
        }

    }
}