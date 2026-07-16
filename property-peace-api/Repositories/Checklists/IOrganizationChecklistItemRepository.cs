using brownstone_hub_api.Dtos.Checklist;

namespace brownstone_hub_api.Repositories.Checklists
{
    public interface IOrganizationChecklistItemRepository
    {
        Task<LoadOrganizationChecklistItemDto> AddOrganizationChecklistItem(AddOrganizationChecklistItemDto item, long organizationId);
        Task<LoadOrganizationChecklistItemDto?> GetOrganizationChecklistItemById(long id);
        Task<List<LoadOrganizationChecklistItemDto>> GetOrganizationChecklistItemsByOrganizationId(long organizationId);
        Task<LoadOrganizationChecklistItemDto> UpdateOrganizationChecklistItem(UpdateOrganizationChecklistItemDto item);
        Task<bool> DeleteOrganizationChecklistItem(long id);
        Task SeedDefaultChecklistItems(long organizationId);
    }
}

