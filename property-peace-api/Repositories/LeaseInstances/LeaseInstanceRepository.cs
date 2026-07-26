using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;

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

        public async Task<LeaseInstance?> GetLeaseInstanceByIdAsync(long id, long organizationId)
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

                query = query.Where(i => i.Lease.OrganizationId == organizationId);

                return await query.FirstOrDefaultAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving lease instance {InstanceId}", id);
                throw;
            }
        }

        public async Task<LeaseInstance?> GetFinalizedLeaseInstanceByLeaseIdAsync(long leaseId, long organizationId)
        {
            var instances = await GetLeaseInstancesByLeaseIdAsync(leaseId, organizationId);
            return instances
                .Where(i => i.IsFinalized)
                .OrderBy(i => i.FinalizedAt ?? i.GeneratedAt)
                .ThenBy(i => i.Id)
                .FirstOrDefault();
        }

        public async Task<LeaseInstance?> GetLatestDraftLeaseInstanceByLeaseIdAsync(long leaseId, long organizationId)
        {
            return (await GetLeaseInstancesByLeaseIdAsync(leaseId, organizationId))
                .Where(i => !i.IsFinalized)
                .OrderByDescending(i => i.GeneratedAt)
                .ThenByDescending(i => i.Id)
                .FirstOrDefault();
        }

        public async Task<LeaseInstance> CreateLeaseInstanceAsync(LeaseInstance instance, long organizationId)
        {
            try
            {
                if (!await _context.Leases.AnyAsync(l => l.Id == instance.LeaseId && l.OrganizationId == organizationId))
                    throw new InvalidOperationException("Lease does not exist in the specified organization.");

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

        public async Task<LeaseInstance> UpdateLeaseInstanceAsync(LeaseInstance instance, long organizationId)
        {
            try
            {
                if (!await _context.LeaseInstances.AnyAsync(i => i.Id == instance.Id && i.Lease.OrganizationId == organizationId))
                    throw new InvalidOperationException("Lease instance does not exist in the specified organization.");

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

        public async Task<List<LeaseInstance>> GetLeaseInstancesByLeaseIdAsync(long leaseId, long organizationId)
        {
            try
            {
                return await _context.LeaseInstances
                    .Include(i => i.LeaseTemplate)
                    .Include(i => i.Variables)
                    .Include(i => i.Documents)
                    .Where(i => i.LeaseId == leaseId && i.Lease.OrganizationId == organizationId)
                    .OrderByDescending(i => i.GeneratedAt)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving lease instances for lease {LeaseId}", leaseId);
                throw;
            }
        }

        public async Task AddVariablesToInstanceAsync(long instanceId, IEnumerable<LeaseVariable> variables, long organizationId)
        {
            try
            {
                if (!await _context.LeaseInstances.AnyAsync(i => i.Id == instanceId && i.Lease.OrganizationId == organizationId))
                    throw new InvalidOperationException("Lease instance does not exist in the specified organization.");

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

        public async Task ReplaceStateDisclosureSnapshotAsync(long instanceId, IEnumerable<LeaseVariable> variables, long organizationId)
        {
            if (!await _context.LeaseInstances.AnyAsync(i => i.Id == instanceId && i.Lease.OrganizationId == organizationId))
                throw new InvalidOperationException("Lease instance does not exist in the specified organization.");

            var existing = await _context.LeaseVariables
                .Where(v => v.LeaseInstanceId == instanceId &&
                    (v.VariableKey.StartsWith("State.RequiredDisclosure") ||
                     v.VariableKey == "State.Name" ||
                     v.VariableKey == "State.Note"))
                .ToListAsync();
            _context.LeaseVariables.RemoveRange(existing);
            foreach (var variable in variables)
            {
                variable.LeaseInstanceId = instanceId;
                await _context.LeaseVariables.AddAsync(variable);
            }
            await _context.SaveChangesAsync();
        }

        public async Task<LeaseDocument> UpsertLeaseDocumentAsync(LeaseDocument document, long organizationId)
        {
            if (!await _context.LeaseInstances.AnyAsync(i => i.Id == document.LeaseInstanceId && i.Lease.OrganizationId == organizationId))
                throw new InvalidOperationException("Lease instance does not exist in the specified organization.");

            var type = document.DocumentType.ToUpperInvariant();
            var existing = await _context.LeaseDocuments
                .SingleOrDefaultAsync(d => d.LeaseInstanceId == document.LeaseInstanceId && d.DocumentType == type &&
                    d.LeaseInstance.Lease.OrganizationId == organizationId);
            if (existing == null)
            {
                document.DocumentType = type;
                _context.LeaseDocuments.Add(document);
                existing = document;
            }
            else
            {
                CopyDocumentPublication(document, existing);
            }

            try
            {
                await _context.SaveChangesAsync();
                return existing;
            }
            catch (DbUpdateException ex) when (IsUniqueIndexConflict(ex) && existing == document)
            {
                // Another publisher inserted the unique instance/type row after our lookup. Remove only
                // the failed insert, reload the organization-scoped winner, and apply this publication.
                _context.Entry(document).State = EntityState.Detached;
                var winner = await _context.LeaseDocuments.SingleAsync(d =>
                    d.LeaseInstanceId == document.LeaseInstanceId && d.DocumentType == type &&
                    d.LeaseInstance.Lease.OrganizationId == organizationId);
                CopyDocumentPublication(document, winner);
                await _context.SaveChangesAsync();
                return winner;
            }
        }

        private static void CopyDocumentPublication(LeaseDocument source, LeaseDocument target)
        {
            target.BlobName = source.BlobName;
            target.BlobUrl = source.BlobUrl;
            target.FileHash = source.FileHash;
            target.GeneratedAt = source.GeneratedAt;
            target.GeneratedBy = source.GeneratedBy;
        }

        private static bool IsUniqueIndexConflict(DbUpdateException exception)
        {
            for (Exception? current = exception; current != null; current = current.InnerException)
                if (current is SqlException sql && (sql.Number == 2601 || sql.Number == 2627))
                    return true;
            return false;
        }

        public async Task<LeaseInstance> MarkFinalizedAsync(long instanceId, long organizationId)
        {
            var instance = await GetLeaseInstanceByIdAsync(instanceId, organizationId)
                ?? throw new InvalidOperationException("Lease instance does not exist in the specified organization.");
            if (instance.IsFinalized)
                return instance;

            instance.IsDraft = false;
            instance.IsFinalized = true;
            instance.FinalizedAt = DateTime.UtcNow;
            try
            {
                await _context.SaveChangesAsync();
                return instance;
            }
            catch (DbUpdateException)
            {
                _context.ChangeTracker.Clear();
                var canonical = await GetFinalizedLeaseInstanceByLeaseIdAsync(instance.LeaseId, organizationId);
                if (canonical != null)
                    return canonical;
                throw;
            }
        }
    }
}
