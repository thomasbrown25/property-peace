using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.StaffMember;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.StaffMembers
{
    public class StaffMemberInviteRepository(DataContext context, IMapper mapper, ILogger<StaffMemberInviteRepository> logger) : IStaffMemberInviteRepository
    {
        private readonly DataContext _context = context;
        private readonly IMapper _mapper = mapper;
        private readonly ILogger<StaffMemberInviteRepository> _logger = logger;

        public async Task<LoadStaffMemberInviteDto> CreateInvite(AddStaffMemberInviteDto invite, long createdBy, string inviteToken, DateTime expiresAt)
        {
            try
            {
                var staffMemberInvite = new StaffMemberInvite
                {
                    StaffMemberId = invite.StaffMemberId,
                    Email = invite.Email,
                    InviteToken = inviteToken,
                    ExpiresAt = expiresAt,
                    CreatedBy = createdBy,
                    IsUsed = false,
                    CreatedAt = DateTime.Now
                };

                await _context.StaffMemberInvites.AddAsync(staffMemberInvite);
                await _context.SaveChangesAsync();

                var loadedInvite = await _context.StaffMemberInvites
                    .Include(si => si.StaffMember)
                        .ThenInclude(sm => sm.Organization)
                    .Include(si => si.CreatedByUser)
                    .FirstOrDefaultAsync(si => si.Id == staffMemberInvite.Id);

                return _mapper.Map<LoadStaffMemberInviteDto>(loadedInvite);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating staff member invite");
                throw;
            }
        }

        public async Task<LoadStaffMemberInviteDto?> GetInviteByToken(string token)
        {
            try
            {
                var invite = await _context.StaffMemberInvites
                    .Include(si => si.StaffMember)
                        .ThenInclude(sm => sm.Organization)
                    .Include(si => si.CreatedByUser)
                    .FirstOrDefaultAsync(si => si.InviteToken == token);

                return invite == null ? null : _mapper.Map<LoadStaffMemberInviteDto>(invite);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting invite by token");
                throw;
            }
        }

        public async Task<LoadStaffMemberInviteDto?> GetInviteById(long id)
        {
            try
            {
                var invite = await _context.StaffMemberInvites
                    .Include(si => si.StaffMember)
                    .FirstOrDefaultAsync(si => si.Id == id);

                return invite == null ? null : _mapper.Map<LoadStaffMemberInviteDto>(invite);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting invite by id");
                throw;
            }
        }

        public async Task<List<LoadStaffMemberInviteDto>> GetInvitesByStaffMemberId(long staffMemberId)
        {
            try
            {
                var invites = await _context.StaffMemberInvites
                    .Include(si => si.StaffMember)
                    .Where(si => si.StaffMemberId == staffMemberId)
                    .OrderByDescending(si => si.CreatedAt)
                    .ToListAsync();

                return _mapper.Map<List<LoadStaffMemberInviteDto>>(invites);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting invites by staff member id");
                throw;
            }
        }

        public async Task<List<LoadStaffMemberInviteDto>> GetInvitesByLandlordId(long landlordId)
        {
            try
            {
                var invites = await _context.StaffMemberInvites
                    .Include(si => si.StaffMember)
                    .Where(si => si.CreatedBy == landlordId)
                    .OrderByDescending(si => si.CreatedAt)
                    .ToListAsync();

                return _mapper.Map<List<LoadStaffMemberInviteDto>>(invites);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting invites by landlord id");
                throw;
            }
        }

        public async Task<bool> MarkInviteAsUsed(string token)
        {
            try
            {
                var invite = await _context.StaffMemberInvites
                    .FirstOrDefaultAsync(si => si.InviteToken == token);

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
                var invite = await _context.StaffMemberInvites.FindAsync(id);
                if (invite == null)
                    return false;

                _context.StaffMemberInvites.Remove(invite);
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
