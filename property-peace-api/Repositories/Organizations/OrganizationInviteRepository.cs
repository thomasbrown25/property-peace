using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.Organizations
{
    public class OrganizationInviteRepository : IOrganizationInviteRepository
    {
        private readonly DataContext _context;
        private readonly ILogger<OrganizationInviteRepository> _logger;

        public OrganizationInviteRepository(DataContext context, ILogger<OrganizationInviteRepository> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<OrganizationInvite?> GetInviteByIdAsync(long inviteId)
        {
            return await _context.OrganizationInvites
                .Include(i => i.Organization)
                .Include(i => i.InvitedByUser)
                .Include(i => i.AcceptedByUser)
                .FirstOrDefaultAsync(i => i.Id == inviteId);
        }

        public async Task<OrganizationInvite?> GetInviteByTokenAsync(string token)
        {
            return await _context.OrganizationInvites
                .Include(i => i.Organization)
                .Include(i => i.InvitedByUser)
                .FirstOrDefaultAsync(i => i.Token == token && !i.IsAccepted);
        }

        public async Task<List<OrganizationInvite>> GetInvitesByOrganizationIdAsync(long organizationId)
        {
            return await _context.OrganizationInvites
                .Include(i => i.InvitedByUser)
                .Include(i => i.AcceptedByUser)
                .Where(i => i.OrganizationId == organizationId)
                .OrderByDescending(i => i.CreatedAt)
                .ToListAsync();
        }

        public async Task<List<OrganizationInvite>> GetPendingInvitesByEmailAsync(string email)
        {
            return await _context.OrganizationInvites
                .Include(i => i.Organization)
                .Include(i => i.InvitedByUser)
                .Where(i => i.Email.ToLower() == email.ToLower() && !i.IsAccepted && i.ExpiresAt > DateTime.Now)
                .ToListAsync();
        }

        public async Task<OrganizationInvite> CreateInviteAsync(OrganizationInvite invite)
        {
            invite.CreatedAt = DateTime.Now;
            await _context.OrganizationInvites.AddAsync(invite);
            await _context.SaveChangesAsync();
            return invite;
        }

        public async Task<OrganizationInvite> UpdateInviteAsync(OrganizationInvite invite)
        {
            _context.OrganizationInvites.Update(invite);
            await _context.SaveChangesAsync();
            return invite;
        }

        public async Task<bool> DeleteInviteAsync(long inviteId)
        {
            var invite = await GetInviteByIdAsync(inviteId);
            if (invite == null)
                return false;

            _context.OrganizationInvites.Remove(invite);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> InviteExistsAsync(string email, long organizationId)
        {
            return await _context.OrganizationInvites
                .AnyAsync(i => i.Email.ToLower() == email.ToLower() 
                    && i.OrganizationId == organizationId 
                    && !i.IsAccepted 
                    && i.ExpiresAt > DateTime.Now);
        }

        public async Task<List<OrganizationInvite>> GetExpiredInvitesAsync()
        {
            return await _context.OrganizationInvites
                .Where(i => !i.IsAccepted && i.ExpiresAt < DateTime.Now)
                .ToListAsync();
        }
    }
}

