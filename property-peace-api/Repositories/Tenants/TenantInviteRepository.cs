using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Tenant;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.Tenants
{
    public class TenantInviteRepository(DataContext context, IMapper mapper, ILogger<TenantInviteRepository> logger) : ITenantInviteRepository
    {
        private readonly DataContext _context = context;
        private readonly IMapper _mapper = mapper;
        private readonly ILogger<TenantInviteRepository> _logger = logger;

        public async Task<LoadTenantInviteDto> CreateInvite(AddTenantInviteDto invite, long createdBy, string inviteToken, DateTime expiresAt)
        {
            try
            {
                var tenantInvite = new TenantInvite
                {
                    TenantId = invite.TenantId,
                    Email = invite.Email,
                    InviteToken = inviteToken,
                    ExpiresAt = expiresAt,
                    CreatedBy = createdBy,
                    IsUsed = false,
                    CreatedAt = DateTime.Now
                };

                await _context.TenantInvites.AddAsync(tenantInvite);
                await _context.SaveChangesAsync();

                var loadedInvite = await _context.TenantInvites
                    .Include(ti => ti.Tenant)
                        .ThenInclude(t => t.Unit)
                            .ThenInclude(u => u.Property)
                    .Include(ti => ti.Tenant)
                        .ThenInclude(t => t.TenantLeases)
                            .ThenInclude(tl => tl.Lease)
                    .Include(ti => ti.CreatedByUser)
                    .FirstOrDefaultAsync(ti => ti.Id == tenantInvite.Id);

                return _mapper.Map<LoadTenantInviteDto>(loadedInvite);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating tenant invite");
                throw;
            }
        }

        public async Task<LoadTenantInviteDto?> GetInviteByToken(string token)
        {
            try
            {
                var invite = await _context.TenantInvites
                    .Include(ti => ti.Tenant)
                        .ThenInclude(t => t.Unit)
                            .ThenInclude(u => u.Property)
                    .Include(ti => ti.Tenant)
                        .ThenInclude(t => t.TenantLeases)
                            .ThenInclude(tl => tl.Lease)
                    .Include(ti => ti.CreatedByUser)
                    .FirstOrDefaultAsync(ti => ti.InviteToken == token);

                return invite == null ? null : _mapper.Map<LoadTenantInviteDto>(invite);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting invite by token");
                throw;
            }
        }

        public async Task<LoadTenantInviteDto?> GetInviteById(long id)
        {
            try
            {
                var invite = await _context.TenantInvites
                    .Include(ti => ti.Tenant)
                        .ThenInclude(t => t.TenantLeases)
                            .ThenInclude(tl => tl.Lease)
                    .FirstOrDefaultAsync(ti => ti.Id == id);

                return invite == null ? null : _mapper.Map<LoadTenantInviteDto>(invite);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting invite by id");
                throw;
            }
        }

        public async Task<List<LoadTenantInviteDto>> GetInvitesByTenantId(long tenantId)
        {
            try
            {
                var invites = await _context.TenantInvites
                    .Include(ti => ti.Tenant)
                        .ThenInclude(t => t.TenantLeases)
                            .ThenInclude(tl => tl.Lease)
                    .Where(ti => ti.TenantId == tenantId)
                    .OrderByDescending(ti => ti.CreatedAt)
                    .ToListAsync();

                return _mapper.Map<List<LoadTenantInviteDto>>(invites);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting invites by tenant id");
                throw;
            }
        }

        public async Task<List<LoadTenantInviteDto>> GetInvitesByLandlordId(long landlordId)
        {
            try
            {
                var invites = await _context.TenantInvites
                    .Include(ti => ti.Tenant)
                        .ThenInclude(t => t.TenantLeases)
                            .ThenInclude(tl => tl.Lease)
                    .Where(ti => ti.CreatedBy == landlordId)
                    .OrderByDescending(ti => ti.CreatedAt)
                    .ToListAsync();

                return _mapper.Map<List<LoadTenantInviteDto>>(invites);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting invites by landlord id");
                throw;
            }
        }

        public async Task<LoadTenantInviteDto?> GetPendingInviteByEmail(string email)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(email))
                    return null;

                var invite = await _context.TenantInvites
                    .Include(ti => ti.Tenant)
                        .ThenInclude(t => t.TenantLeases)
                            .ThenInclude(tl => tl.Lease)
                    .Include(ti => ti.Tenant)
                        .ThenInclude(t => t.Unit)
                            .ThenInclude(u => u.Property)
                    .Where(ti => ti.Email != null && ti.Email.Trim().ToLower() == email.Trim().ToLower()
                        && !ti.IsUsed
                        && ti.ExpiresAt > DateTime.Now)
                    .OrderByDescending(ti => ti.CreatedAt)
                    .FirstOrDefaultAsync();

                return invite == null ? null : _mapper.Map<LoadTenantInviteDto>(invite);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting pending invite by email");
                throw;
            }
        }

        public async Task<bool> MarkInviteAsUsed(string token)
        {
            try
            {
                var invite = await _context.TenantInvites
                    .FirstOrDefaultAsync(ti => ti.InviteToken == token);

                if (invite == null)
                    return false;

                invite.IsUsed = true;
                invite.UsedAt = DateTime.Now;
                await _context.SaveChangesAsync();

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error marking invite as used");
                throw;
            }
        }

        public async Task<bool> DeleteInvite(long id)
        {
            try
            {
                var invite = await _context.TenantInvites.FindAsync(id);
                if (invite == null)
                    return false;

                _context.TenantInvites.Remove(invite);
                await _context.SaveChangesAsync();

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting invite");
                throw;
            }
        }
    }
}

