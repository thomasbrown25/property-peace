using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.ApplicationInvite;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.ApplicationInvites
{
    public class ApplicationInviteRepository(DataContext context, IMapper mapper, ILogger<ApplicationInviteRepository> logger) : IApplicationInviteRepository
    {
        private readonly DataContext _context = context;
        private readonly IMapper _mapper = mapper;
        private readonly ILogger<ApplicationInviteRepository> _logger = logger;

        public async Task<LoadApplicationInviteDto> CreateInvite(AddApplicationInviteDto invite, long createdBy, string inviteToken, DateTime expiresAt, long? organizationId = null, long? applicationId = null)
        {
            try
            {
                var applicationInvite = new ApplicationInvite
                {
                    PropertyId = invite.PropertyId,
                    UnitId = invite.UnitId,
                    OrganizationId = organizationId, // Set organization ID from property
                    Email = invite.Email,
                    ApplicantName = invite.ApplicantName,
                    InviteToken = inviteToken,
                    ExpiresAt = expiresAt,
                    CreatedBy = createdBy,
                    IsUsed = false,
                    ApplicationId = applicationId, // Link to application if provided
                    CreatedAt = DateTime.Now
                };

                await _context.ApplicationInvites.AddAsync(applicationInvite);
                await _context.SaveChangesAsync();

                var loadedInvite = await _context.ApplicationInvites
                    .Include(ai => ai.Property)
                    .Include(ai => ai.Unit)
                    .Include(ai => ai.Application)
                    .FirstOrDefaultAsync(ai => ai.Id == applicationInvite.Id);

                return _mapper.Map<LoadApplicationInviteDto>(loadedInvite);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating application invite");
                throw;
            }
        }

        public async Task<LoadApplicationInviteDto?> GetInviteByToken(string token)
        {
            try
            {
                var invite = await _context.ApplicationInvites
                    .Include(ai => ai.Property)
                    .Include(ai => ai.Unit)
                    .Include(ai => ai.Application)
                    .FirstOrDefaultAsync(ai => ai.InviteToken == token);

                return invite == null ? null : _mapper.Map<LoadApplicationInviteDto>(invite);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting invite by token");
                throw;
            }
        }

        public async Task<LoadApplicationInviteDto?> GetInviteById(long id)
        {
            try
            {
                var invite = await _context.ApplicationInvites
                    .Include(ai => ai.Property)
                    .Include(ai => ai.Unit)
                    .Include(ai => ai.Application)
                    .FirstOrDefaultAsync(ai => ai.Id == id);

                return invite == null ? null : _mapper.Map<LoadApplicationInviteDto>(invite);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting invite by id");
                throw;
            }
        }

        public async Task<LoadApplicationInviteDto?> GetInviteByApplicationId(long applicationId)
        {
            try
            {
                var invite = await _context.ApplicationInvites
                    .Include(ai => ai.Property)
                    .Include(ai => ai.Unit)
                    .Include(ai => ai.Application)
                    .FirstOrDefaultAsync(ai => ai.ApplicationId == applicationId);

                return invite == null ? null : _mapper.Map<LoadApplicationInviteDto>(invite);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting invite by application id");
                throw;
            }
        }

        public async Task<List<LoadApplicationInviteDto>> GetInvitesByPropertyId(long propertyId, long? organizationId = null)
        {
            try
            {
                var query = _context.ApplicationInvites
                    .Include(ai => ai.Property)
                    .Include(ai => ai.Unit)
                    .Include(ai => ai.Application)
                    .Where(ai => ai.PropertyId == propertyId);

                // Filter by organization if provided
                if (organizationId.HasValue)
                {
                    query = query.Where(ai => ai.OrganizationId == organizationId.Value);
                }

                var invites = await query
                    .OrderByDescending(ai => ai.CreatedAt)
                    .ToListAsync();

                return _mapper.Map<List<LoadApplicationInviteDto>>(invites);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting invites by property id");
                throw;
            }
        }

        public async Task<List<LoadApplicationInviteDto>> GetInvitesByLandlordId(long landlordId, long? organizationId = null)
        {
            try
            {
                var query = _context.ApplicationInvites
                    .Include(ai => ai.Property)
                    .Include(ai => ai.Unit)
                    .Include(ai => ai.Application)
                    .Where(ai => ai.CreatedBy == landlordId);

                // Filter by organization if provided
                if (organizationId.HasValue)
                {
                    query = query.Where(ai => ai.OrganizationId == organizationId.Value);
                }

                var invites = await query
                    .OrderByDescending(ai => ai.CreatedAt)
                    .ToListAsync();

                return _mapper.Map<List<LoadApplicationInviteDto>>(invites);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting invites by landlord id");
                throw;
            }
        }

        public async Task<bool> MarkInviteAsUsed(string token, long applicationId)
        {
            try
            {
                var invite = await _context.ApplicationInvites
                    .FirstOrDefaultAsync(ai => ai.InviteToken == token);

                if (invite == null)
                    return false;

                invite.IsUsed = true;
                invite.UsedAt = DateTime.Now;
                invite.ApplicationId = applicationId;
                await _context.SaveChangesAsync();

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error marking invite as used");
                throw;
            }
        }

        public async Task<bool> LinkInviteToApplication(long inviteId, long applicationId)
        {
            try
            {
                var invite = await _context.ApplicationInvites.FindAsync(inviteId);
                if (invite == null)
                    return false;

                invite.ApplicationId = applicationId;
                await _context.SaveChangesAsync();

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error linking invite to application");
                throw;
            }
        }

        public async Task<bool> DeleteInvite(long id)
        {
            try
            {
                var invite = await _context.ApplicationInvites.FindAsync(id);
                if (invite == null)
                    return false;

                _context.ApplicationInvites.Remove(invite);
                await _context.SaveChangesAsync();

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting invite");
                throw;
            }
        }

        public async Task<int> DeleteInvitesByPropertyId(long propertyId)
        {
            try
            {
                var invites = await _context.ApplicationInvites
                    .Where(ai => ai.PropertyId == propertyId)
                    .ToListAsync();
                
                _context.ApplicationInvites.RemoveRange(invites);
                await _context.SaveChangesAsync();
                
                return invites.Count;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting application invites for property {PropertyId}", propertyId);
                throw;
            }
        }

        public async Task<int> DeleteInvitesByApplicationIds(List<long> applicationIds)
        {
            try
            {
                var invites = await _context.ApplicationInvites
                    .Where(ai => ai.ApplicationId.HasValue && applicationIds.Contains(ai.ApplicationId.Value))
                    .ToListAsync();
                
                _context.ApplicationInvites.RemoveRange(invites);
                await _context.SaveChangesAsync();
                
                return invites.Count;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting application invites for application IDs: {ApplicationIds}", string.Join(", ", applicationIds));
                throw;
            }
        }
    }
}

