using brownstone_hub_api.Dtos.Checklist;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Repositories.Checklists
{
    public interface IChecklistRepository
    {
        Task<LoadChecklistDto> AddChecklist(AddChecklistDto checklist, long landlordId, long? organizationId = null);
        Task<LoadChecklistDto?> GetChecklistById(long id);
        Task<List<LoadChecklistDto>> GetChecklistsByLandlordId(long landlordId);
        Task<List<LoadChecklistDto>> GetChecklistsByPropertyId(long propertyId);
        Task<List<LoadChecklistDto>> GetChecklistsByUnitId(long unitId);
        Task<List<LoadChecklistDto>> GetChecklistsByLeaseId(long leaseId);
        Task<List<LoadChecklistDto>> GetChecklistsByType(long landlordId, ETenantDocumentType checklistType);
        Task<List<LoadChecklistDto>> GetChecklistsByOrganizationId(long organizationId);
        Task<List<LoadChecklistDto>> GetChecklistsByTypeAndOrganizationId(long organizationId, ETenantDocumentType checklistType);
        Task<LoadChecklistDto> UpdateChecklist(UpdateChecklistDto checklist);
        Task<LoadChecklistDto> UpdateChecklistItemPhoto(long checklistId, long itemId, string blobName, string blobUrl);
        Task<LoadChecklistDto> DeleteChecklistItemPhoto(long checklistId, long itemId, string blobName);
        Task<bool> DeleteChecklist(long id);
        Task<int> DeleteChecklistsByPropertyId(long propertyId);
    }
}

