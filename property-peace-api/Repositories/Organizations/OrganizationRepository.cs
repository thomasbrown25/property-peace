using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.Organizations
{
    public class OrganizationRepository : IOrganizationRepository
    {
        private readonly DataContext _context;
        private readonly ILogger<OrganizationRepository> _logger;

        public OrganizationRepository(DataContext context, ILogger<OrganizationRepository> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<Organization?> GetOrganizationByIdAsync(long organizationId)
        {
            return await _context.Organizations
                .Include(o => o.Owner)
                .Include(o => o.Subscription)
                .FirstOrDefaultAsync(o => o.Id == organizationId && !o.IsDeleted);
        }

        public async Task<Organization?> GetOrganizationByIdWithMembersAsync(long organizationId)
        {
            return await _context.Organizations
                .Include(o => o.Owner)
                .Include(o => o.Subscription)
                .Include(o => o.Members)
                    .ThenInclude(m => m.User)
                .FirstOrDefaultAsync(o => o.Id == organizationId && !o.IsDeleted);
        }

        public async Task<List<Organization>> GetOrganizationsByUserIdAsync(long userId)
        {
            return await _context.Organizations
                .Include(o => o.Owner)
                .Include(o => o.Subscription)
                .Include(o => o.Members)
                .Where(o => o.IsActive && !o.IsDeleted &&
                    o.Members.Any(m => m.OrganizationId == o.Id && m.UserId == userId && m.IsActive))
                .ToListAsync();
        }

        public async Task<Organization> CreateOrganizationAsync(Organization organization)
        {
            organization.CreatedAt = DateTime.Now;
            organization.UpdatedAt = DateTime.Now;
            await _context.Organizations.AddAsync(organization);
            await _context.SaveChangesAsync();
            return organization;
        }

        public async Task<Organization> UpdateOrganizationAsync(Organization organization)
        {
            organization.UpdatedAt = DateTime.Now;
            _context.Organizations.Update(organization);
            await _context.SaveChangesAsync();
            return organization;
        }

        public async Task<bool> DeleteOrganizationAsync(long organizationId)
        {
            var organization = await _context.Organizations
                .FirstOrDefaultAsync(o => o.Id == organizationId && !o.IsDeleted);

            if (organization == null)
                return false;

            organization.IsDeleted = true;
            organization.DeletedAt = DateTime.Now;
            organization.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<Organization?> GetOrganizationBySubscriptionIdAsync(long subscriptionId)
        {
            return await _context.Organizations
                .Include(o => o.Owner)
                .Include(o => o.Subscription)
                .FirstOrDefaultAsync(o => o.SubscriptionId == subscriptionId && !o.IsDeleted);
        }

        public async Task<bool> OrganizationExistsAsync(long organizationId)
        {
            return await _context.Organizations
                .AnyAsync(o => o.Id == organizationId && !o.IsDeleted);
        }

        public async Task<Organization?> GetCurrentUserOrganizationAsync(long userId)
        {
            return await _context.Users
                .Where(u => u.Id == userId && !u.IsDeleted && u.CurrentOrganizationId.HasValue)
                .SelectMany(u => _context.Organizations
                    .Where(o => o.Id == u.CurrentOrganizationId!.Value && o.IsActive && !o.IsDeleted &&
                        _context.OrganizationMembers.Any(m =>
                            m.OrganizationId == o.Id && m.UserId == userId && m.IsActive)))
                .Include(o => o.Owner)
                .Include(o => o.Subscription)
                .SingleOrDefaultAsync();
        }

        public async Task<bool> OrganizationNameExistsAsync(string organizationName, long? excludeOrganizationId = null)
        {
            try
            {
                var query = _context.Organizations
                    .Where(o => !o.IsDeleted && 
                                o.Name.Trim().ToLower() == organizationName.Trim().ToLower());

                if (excludeOrganizationId.HasValue)
                {
                    query = query.Where(o => o.Id != excludeOrganizationId.Value);
                }

                return await query.AnyAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking if organization name exists");
                throw;
            }
        }

        public async Task<bool> OrganizationNameExistsForOwnerAsync(string organizationName, long ownerId, long? excludeOrganizationId = null)
        {
            try
            {
                var query = _context.Organizations
                    .Where(o => !o.IsDeleted && 
                                o.OwnerId == ownerId &&
                                o.Name.Trim().ToLower() == organizationName.Trim().ToLower());

                if (excludeOrganizationId.HasValue)
                {
                    query = query.Where(o => o.Id != excludeOrganizationId.Value);
                }

                return await query.AnyAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking if organization name exists for owner");
                throw;
            }
        }
    }
}

