using brownstone_hub_api.Dtos.LeaseTemplate;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Repositories.LeaseTemplates
{
    public interface ILeaseTemplateRepository
    {
        Task<LeaseTemplate?> GetDefaultTemplateAsync();
        Task<LeaseTemplate?> GetTemplateByIdAsync(long id, long? organizationId = null);
        Task<List<LeaseTemplate>> GetTemplatesByOrganizationAsync(long organizationId);
        Task<LeaseTemplate> CreateTemplateAsync(LeaseTemplate template);
        Task<LeaseTemplate> UpdateTemplateAsync(LeaseTemplate template);
        Task<bool> DeleteTemplateAsync(long id, long? organizationId);
        Task<bool> SetDefaultForLandlordAsync(long id, long organizationId);
    }
}
