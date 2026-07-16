using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.LandlordInvite;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using LandlordInviteModel = brownstone_hub_api.Models.LandlordInvite;

namespace brownstone_hub_api.Repositories.LandlordInvites
{
    public class LandlordInviteRepository(DataContext context, IMapper mapper, ILogger<LandlordInviteRepository> logger) : ILandlordInviteRepository
    {
        private readonly DataContext _context = context;
        private readonly IMapper _mapper = mapper;
        private readonly ILogger<LandlordInviteRepository> _logger = logger;

        public async Task<LoadLandlordInviteDto> CreateInvite(AddLandlordInviteDto invite, long createdBy, string inviteToken, DateTime expiresAt)
        {
            try
            {
                var landlordInvite = new LandlordInviteModel
                {
                    Email = invite.Email,
                    FirstName = invite.FirstName,
                    LastName = invite.LastName,
                    InviteToken = inviteToken,
                    ExpiresAt = expiresAt,
                    CreatedBy = createdBy,
                    IsUsed = false,
                    CreatedAt = DateTime.Now
                };

                await _context.LandlordInvites.AddAsync(landlordInvite);
                await _context.SaveChangesAsync();

                var loadedInvite = await _context.LandlordInvites
                    .Include(li => li.CreatedByUser)
                    .FirstOrDefaultAsync(li => li.Id == landlordInvite.Id);

                return _mapper.Map<LoadLandlordInviteDto>(loadedInvite);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating landlord invite");
                throw;
            }
        }

        public async Task<LoadLandlordInviteDto?> GetInviteByToken(string token)
        {
            try
            {
                var invite = await _context.LandlordInvites
                    .Include(li => li.CreatedByUser)
                    .FirstOrDefaultAsync(li => li.InviteToken == token);

                return invite == null ? null : _mapper.Map<LoadLandlordInviteDto>(invite);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting invite by token");
                throw;
            }
        }

        public async Task<LoadLandlordInviteDto?> GetInviteById(long id)
        {
            try
            {
                var invite = await _context.LandlordInvites
                    .Include(li => li.CreatedByUser)
                    .FirstOrDefaultAsync(li => li.Id == id);

                return invite == null ? null : _mapper.Map<LoadLandlordInviteDto>(invite);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting invite by id");
                throw;
            }
        }

        public async Task<bool> MarkInviteAsUsed(string token)
        {
            try
            {
                var invite = await _context.LandlordInvites
                    .FirstOrDefaultAsync(li => li.InviteToken == token);

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

        public async Task<List<LoadLandlordInviteDto>> GetInvitesByCreatedBy(long createdBy)
        {
            try
            {
                var invites = await _context.LandlordInvites
                    .Include(li => li.CreatedByUser)
                    .Where(li => li.CreatedBy == createdBy)
                    .OrderByDescending(li => li.CreatedAt)
                    .ToListAsync();

                return _mapper.Map<List<LoadLandlordInviteDto>>(invites);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting invites by created by");
                throw;
            }
        }
    }
}
