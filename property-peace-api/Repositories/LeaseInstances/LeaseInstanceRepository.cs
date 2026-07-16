using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.LeaseInstances
{
    public class LeaseInstanceRepository : ILeaseInstanceRepository
    {
        private readonly DataContext _context;
        private readonly ILogger<LeaseInstanceRepository> _logger;

        public LeaseInstanceRepository(DataContext context, ILogger<LeaseInstanceRepository> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<LeaseInstance?> GetLeaseInstanceByIdAsync(long id, long? organizationId = null)
        {
            try
            {
                var query = _context.LeaseInstances
                    .Include(i => i.Lease)
                        .ThenInclude(l => l.Unit)
                            .ThenInclude(u => u.Property)
                    .Include(i => i.Lease)
                        .ThenInclude(l => l.Unit)
                            .ThenInclude(u => u.IncludedUtility)
                    .Include(i => i.Lease)
                        .ThenInclude(l => l.TenantLeases)
                            .ThenInclude(tl => tl.Tenant)
                    .Include(i => i.LeaseTemplate)
                    .Include(i => i.Variables)
                    .Include(i => i.Documents)
                    .Include(i => i.PolicySection)
                    .Where(i => i.Id == id);

                if (organizationId.HasValue)
                {
                    query = query.Where(i => i.Lease.OrganizationId == organizationId.Value);
                }

                return await query.FirstOrDefaultAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving lease instance {InstanceId}", id);
                throw;
            }
        }

        public async Task<LeaseInstance> CreateLeaseInstanceAsync(LeaseInstance instance)
        {
            try
            {
                instance.GeneratedAt = DateTime.Now;
                await _context.LeaseInstances.AddAsync(instance);
                await _context.SaveChangesAsync();
                return instance;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating lease instance");
                throw;
            }
        }

        public async Task<LeaseInstance> UpdateLeaseInstanceAsync(LeaseInstance instance)
        {
            try
            {
                _context.LeaseInstances.Update(instance);
                await _context.SaveChangesAsync();
                return instance;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating lease instance {InstanceId}", instance.Id);
                throw;
            }
        }

        public async Task<List<LeaseInstance>> GetLeaseInstancesByLeaseIdAsync(long leaseId)
        {
            try
            {
                return await _context.LeaseInstances
                    .Include(i => i.LeaseTemplate)
                    .Include(i => i.Variables)
                    .Include(i => i.Documents)
                    .Where(i => i.LeaseId == leaseId)
                    .OrderByDescending(i => i.GeneratedAt)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving lease instances for lease {LeaseId}", leaseId);
                throw;
            }
        }

        public async Task AddVariablesToInstanceAsync(long instanceId, IEnumerable<LeaseVariable> variables)
        {
            try
            {
                foreach (var v in variables)
                {
                    v.LeaseInstanceId = instanceId;
                    await _context.LeaseVariables.AddAsync(v);
                }
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding variables to lease instance {InstanceId}", instanceId);
                throw;
            }
        }
    }
}
