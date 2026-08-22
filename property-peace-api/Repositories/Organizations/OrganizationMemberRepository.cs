using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.Organizations
{
    public class OrganizationMemberRepository : IOrganizationMemberRepository
    {
        private readonly DataContext _context;
        private readonly ILogger<OrganizationMemberRepository> _logger;

        public OrganizationMemberRepository(DataContext context, ILogger<OrganizationMemberRepository> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<OrganizationMember?> GetMemberAsync(long organizationId, long userId)
        {
            return await _context.OrganizationMembers
                .Include(m => m.Organization)
                .Include(m => m.User)
                .FirstOrDefaultAsync(m => m.OrganizationId == organizationId && m.UserId == userId && m.IsActive);
        }
        
        public async Task<OrganizationMember?> GetMemberByMemberIdAsync(long organizationId, long memberId)
        {
            return await _context.OrganizationMembers
                .Include(m => m.Organization)
                .Include(m => m.User)
                .FirstOrDefaultAsync(m => m.Id == memberId && m.OrganizationId == organizationId);
        }

        public async Task<OrganizationMember?> GetMemberByIdAsync(long memberId)
        {
            return await _context.OrganizationMembers
                .Include(m => m.Organization)
                .Include(m => m.User)
                .FirstOrDefaultAsync(m => m.Id == memberId && m.IsActive);
        }

        public async Task<List<OrganizationMember>> GetMembersByOrganizationIdAsync(long organizationId)
        {
            // Include both active members with accounts and pending members (with null UserId)
            return await _context.OrganizationMembers
                .Include(m => m.User)
                .Include(m => m.InvitedByUser)
                .Where(m => m.OrganizationId == organizationId && m.IsActive)
                .OrderBy(m => m.JoinedAt)
                .ToListAsync();
        }
        
        public async Task<OrganizationMember?> GetPendingMemberByEmailAsync(long organizationId, string email)
        {
            return await _context.OrganizationMembers
                .Include(m => m.Organization)
                .FirstOrDefaultAsync(m => m.OrganizationId == organizationId 
                    && m.Email != null 
                    && m.Email.ToLower() == email.ToLower() 
                    && m.UserId == null);
        }

        public async Task<List<OrganizationMember>> GetMembersByUserIdAsync(long userId)
        {
            return await _context.OrganizationMembers
                .Include(m => m.Organization)
                .Where(m => m.UserId == userId && m.IsActive)
                .ToListAsync();
        }

        public async Task<OrganizationMember> AddMemberAsync(OrganizationMember member)
        {
            member.JoinedAt = DateTime.Now;
            await _context.OrganizationMembers.AddAsync(member);
            await _context.SaveChangesAsync();
            return member;
        }

        public async Task<OrganizationMember> UpdateMemberAsync(OrganizationMember member)
        {
            _context.OrganizationMembers.Update(member);
            await _context.SaveChangesAsync();
            return member;
        }

        public async Task<bool> RemoveMemberAsync(long organizationId, long userId)
        {
            var member = await GetMemberAsync(organizationId, userId);
            if (member == null)
                return false;

            return (await RemoveMemberAndRepairCurrentOrganizationAsync(organizationId, member.Id)).Removed;
        }
        
        public async Task<bool> RemoveMemberByIdAsync(long organizationId, long memberId)
        {
            var member = await GetMemberByMemberIdAsync(organizationId, memberId);
            if (member == null)
                return false;

            return (await RemoveMemberAndRepairCurrentOrganizationAsync(organizationId, member.Id)).Removed;
        }

        public async Task<OrganizationMemberRemovalResult> RemoveMemberAndRepairCurrentOrganizationAsync(
            long organizationId,
            long memberId)
        {
            await using var transaction = _context.Database.IsRelational()
                ? await _context.Database.BeginTransactionAsync()
                : null;

            var member = await _context.OrganizationMembers
                .FirstOrDefaultAsync(m => m.OrganizationId == organizationId && m.Id == memberId);
            if (member == null)
            {
                return new OrganizationMemberRemovalResult(false, null, null);
            }

            var removedUserId = member.UserId;
            long? currentOrganizationId = null;

            if (removedUserId.HasValue)
            {
                var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == removedUserId.Value);
                currentOrganizationId = user?.CurrentOrganizationId;

                if (user?.CurrentOrganizationId == organizationId)
                {
                    currentOrganizationId = await _context.OrganizationMembers
                        .Where(m =>
                            m.Id != memberId &&
                            m.UserId == removedUserId.Value &&
                            m.OrganizationId != organizationId &&
                            m.IsActive &&
                            m.Organization.IsActive &&
                            !m.Organization.IsDeleted)
                        .OrderByDescending(m => m.Role == "Owner")
                        .ThenBy(m => m.JoinedAt)
                        .ThenBy(m => m.Id)
                        .Select(m => (long?)m.OrganizationId)
                        .FirstOrDefaultAsync();
                    user.CurrentOrganizationId = currentOrganizationId;
                }
            }

            _context.OrganizationMembers.Remove(member);
            await _context.SaveChangesAsync();

            if (transaction != null)
            {
                await transaction.CommitAsync();
            }

            return new OrganizationMemberRemovalResult(true, removedUserId, currentOrganizationId);
        }

        public async Task<bool> IsUserMemberOfOrganizationAsync(long userId, long organizationId)
        {
            return await _context.OrganizationMembers
                .AnyAsync(m => m.UserId == userId && m.OrganizationId == organizationId && m.IsActive);
        }

        public async Task<bool> UserHasRoleAsync(long userId, long organizationId, string role)
        {
            return await _context.OrganizationMembers
                .AnyAsync(m => m.UserId == userId 
                    && m.OrganizationId == organizationId 
                    && m.Role == role 
                    && m.IsActive);
        }

        public async Task<bool> UserHasPermissionAsync(long userId, long organizationId, string permission)
        {
            var member = await GetMemberAsync(organizationId, userId);
            if (member == null)
                return false;

            return permission switch
            {
                "CanManageProperties" => member.CanManageProperties,
                "CanManageTenants" => member.CanManageTenants,
                "CanManageLeases" => member.CanManageLeases,
                "CanManageMaintenance" => member.CanManageMaintenance,
                "CanManageBilling" => member.CanManageBilling,
                "CanManageMembers" => member.CanManageMembers,
                _ => false
            };
        }
    }
}

