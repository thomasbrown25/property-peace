using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.LeaseTemplates
{
    public class LeaseTemplateRepository : ILeaseTemplateRepository
    {
        private readonly DataContext _context;
        private readonly ILogger<LeaseTemplateRepository> _logger;

        public LeaseTemplateRepository(DataContext context, ILogger<LeaseTemplateRepository> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<LeaseTemplate?> GetDefaultTemplateAsync()
        {
            try
            {
                return await _context.LeaseTemplates
                    .Include(t => t.Sections)
                    .Include(t => t.Policies)
                    .Where(t => t.IsDefault && !t.IsDeleted)
                    .FirstOrDefaultAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving default lease template");
                throw;
            }
        }

        public async Task<LeaseTemplate?> GetTemplateByIdAsync(long id, long? organizationId = null)
        {
            try
            {
                var query = _context.LeaseTemplates
                    .Include(t => t.Sections)
                    .Include(t => t.Policies)
                    .Where(t => t.Id == id && !t.IsDeleted);

                if (organizationId.HasValue)
                {
                    query = query.Where(t => t.OrganizationId == organizationId.Value);
                }

                return await query.FirstOrDefaultAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving lease template {TemplateId}", id);
                throw;
            }
        }

        public async Task<List<LeaseTemplate>> GetTemplatesByOrganizationAsync(long organizationId)
        {
            try
            {
                return await _context.LeaseTemplates
                    .Include(t => t.Sections)
                    .Include(t => t.Policies)
                    .Where(t => t.OrganizationId == organizationId && !t.IsDeleted)
                    .OrderByDescending(t => t.IsDefaultForLandlord)
                    .ThenBy(t => t.Name)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving templates for organization {OrganizationId}", organizationId);
                throw;
            }
        }

        public async Task<LeaseTemplate> CreateTemplateAsync(LeaseTemplate template)
        {
            try
            {
                template.CreatedAt = DateTime.Now;
                await _context.LeaseTemplates.AddAsync(template);
                await _context.SaveChangesAsync();
                return template;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating lease template");
                throw;
            }
        }

        public async Task<LeaseTemplate> UpdateTemplateAsync(LeaseTemplate template)
        {
            try
            {
                template.UpdatedAt = DateTime.Now;
                _context.LeaseTemplates.Update(template);
                await _context.SaveChangesAsync();
                return template;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating lease template {TemplateId}", template.Id);
                throw;
            }
        }

        public async Task<bool> DeleteTemplateAsync(long id, long? organizationId)
        {
            try
            {
                var template = await _context.LeaseTemplates
                    .FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);

                if (template == null)
                    return false;

                // Don't allow deleting system default templates
                if (template.IsDefault)
                    return false;

                // Verify organization ownership
                if (organizationId.HasValue && template.OrganizationId != organizationId.Value)
                    return false;

                template.IsDeleted = true;
                template.DeletedAt = DateTime.Now;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting lease template {TemplateId}", id);
                throw;
            }
        }

        public async Task<bool> SetDefaultForLandlordAsync(long id, long organizationId)
        {
            try
            {
                var template = await _context.LeaseTemplates
                    .FirstOrDefaultAsync(t => t.Id == id && 
                                             t.OrganizationId == organizationId && 
                                             !t.IsDeleted);

                if (template == null)
                    return false;

                // Clear other defaults for this organization
                var otherDefaults = await _context.LeaseTemplates
                    .Where(t => t.OrganizationId == organizationId && 
                               t.IsDefaultForLandlord && 
                               t.Id != id && 
                               !t.IsDeleted)
                    .ToListAsync();

                foreach (var other in otherDefaults)
                {
                    other.IsDefaultForLandlord = false;
                }

                template.IsDefaultForLandlord = true;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error setting default template for organization {OrganizationId}", organizationId);
                throw;
            }
        }
    }
}
