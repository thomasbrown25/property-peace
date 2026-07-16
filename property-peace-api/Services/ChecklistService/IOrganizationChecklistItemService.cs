using brownstone_hub_api.Dtos.Checklist;

namespace brownstone_hub_api.Services.ChecklistService
{
    public interface IOrganizationChecklistItemService
    {
        Task<ServiceResponse<LoadOrganizationChecklistItemDto>> AddOrganizationChecklistItem(AddOrganizationChecklistItemDto item);
        Task<ServiceResponse<LoadOrganizationChecklistItemDto>> GetOrganizationChecklistItemById(long id);
        Task<ServiceResponse<List<LoadOrganizationChecklistItemDto>>> GetOrganizationChecklistItems();
        Task<ServiceResponse<LoadOrganizationChecklistItemDto>> UpdateOrganizationChecklistItem(UpdateOrganizationChecklistItemDto item);
        Task<ServiceResponse<bool>> DeleteOrganizationChecklistItem(long id);
        Task<ServiceResponse<bool>> SeedDefaultChecklistItems();
    }
}

