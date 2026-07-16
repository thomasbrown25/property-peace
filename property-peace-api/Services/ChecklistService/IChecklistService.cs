using brownstone_hub_api.Dtos.Checklist;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Services.ChecklistService
{
    public interface IChecklistService
    {
        Task<ServiceResponse<LoadChecklistDto>> AddChecklist(AddChecklistDto checklist);
        Task<ServiceResponse<LoadChecklistDto>> GetChecklistById(long id);
        Task<ServiceResponse<List<LoadChecklistDto>>> GetChecklistsByLandlordId(long landlordId);
        Task<ServiceResponse<List<LoadChecklistDto>>> GetChecklistsByPropertyId(long propertyId);
        Task<ServiceResponse<List<LoadChecklistDto>>> GetChecklistsByUnitId(long unitId);
        Task<ServiceResponse<List<LoadChecklistDto>>> GetChecklistsByLeaseId(long leaseId);
        Task<ServiceResponse<List<LoadChecklistDto>>> GetChecklistsByType(ETenantDocumentType checklistType);
        Task<ServiceResponse<LoadChecklistDto>> UpdateChecklist(UpdateChecklistDto checklist);
        Task<ServiceResponse<bool>> DeleteChecklist(long id);
        Task<ServiceResponse<LoadChecklistDto>> UploadChecklistImages(long checklistId, List<IFormFile> files, bool isBeforeMoveIn);
        Task<ServiceResponse<LoadChecklistDto>> UploadChecklistItemImage(long checklistId, long itemId, IFormFile file);
        Task<ServiceResponse<LoadChecklistDto>> DeleteChecklistItemImage(long checklistId, long itemId, string blobName);
        Task<ServiceResponse<LoadChecklistDto>> DeleteChecklistImage(long checklistId, string blobName, bool isBeforeMoveIn);
        Task<ServiceResponse<bool>> CreateDefaultChecklistsForProperty(long propertyId, long landlordId, long organizationId);
        Task<ServiceResponse<bool>> CreateDefaultChecklistsForUnit(long unitId, long propertyId, long landlordId, long organizationId, string? unitName = null);
    }
}

