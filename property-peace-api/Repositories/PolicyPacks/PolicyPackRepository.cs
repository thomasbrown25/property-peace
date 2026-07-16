using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.PolicyPacks
{
    public class PolicyPackRepository : IPolicyPackRepository
    {
        private readonly DataContext _context;
        private readonly ILogger<PolicyPackRepository> _logger;

        public PolicyPackRepository(DataContext context, ILogger<PolicyPackRepository> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<PolicyPack?> GetDefaultPolicyPackAsync()
        {
            try
            {
                return await _context.PolicyPacks
                    .Include(p => p.Items.OrderBy(i => i.Order))
                    .Where(p => p.IsDefault)
                    .FirstOrDefaultAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving default policy pack");
                throw;
            }
        }

        public async Task<PolicyPack?> GetPolicyPackByIdAsync(long id, long? organizationId = null)
        {
            try
            {
                var query = _context.PolicyPacks
                    .Include(p => p.Items.OrderBy(i => i.Order))
                    .Where(p => p.Id == id);

                if (organizationId.HasValue)
                {
                    query = query.Where(p => p.OrganizationId == organizationId.Value || p.IsDefault);
                }

                return await query.FirstOrDefaultAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving policy pack {PolicyPackId}", id);
                throw;
            }
        }

        public async Task<List<PolicyPack>> GetPolicyPacksByOrganizationAsync(long organizationId)
        {
            try
            {
                return await _context.PolicyPacks
                    .Include(p => p.Items.OrderBy(i => i.Order))
                    .Where(p => (p.OrganizationId == organizationId || p.IsDefault))
                    .OrderByDescending(p => p.IsDefault)
                    .ThenBy(p => p.Name)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving policy packs for organization {OrganizationId}", organizationId);
                throw;
            }
        }

        public async Task<PolicyPack> CreatePolicyPackAsync(PolicyPack pack)
        {
            try
            {
                pack.CreatedAt = DateTime.Now;
                await _context.PolicyPacks.AddAsync(pack);
                await _context.SaveChangesAsync();
                return pack;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating policy pack");
                throw;
            }
        }

        public async Task<PolicyPack> UpdatePolicyPackAsync(PolicyPack pack)
        {
            try
            {
                pack.UpdatedAt = DateTime.Now;
                _context.PolicyPacks.Update(pack);
                await _context.SaveChangesAsync();
                return pack;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating policy pack {PolicyPackId}", pack.Id);
                throw;
            }
        }

        public async Task<bool> DeletePolicyPackAsync(long id, long? organizationId)
        {
            try
            {
                var pack = await _context.PolicyPacks
                    .FirstOrDefaultAsync(p => p.Id == id);

                if (pack == null)
                    return false;

                // Don't allow deleting system default packs
                if (pack.IsDefault)
                    return false;

                // Verify organization ownership
                if (organizationId.HasValue && pack.OrganizationId != organizationId.Value)
                    return false;

                _context.PolicyPacks.Remove(pack);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting policy pack {PolicyPackId}", id);
                throw;
            }
        }
    }
}
