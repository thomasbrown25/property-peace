using brownstone_hub_api.Dtos.LeaseTransitionChecklist;

namespace brownstone_hub_api.Services.LeaseTransitionChecklistService
{
    public interface ILeaseTransitionChecklistService
    {
        Task<ServiceResponse<List<LoadLeaseTransitionChecklistDto>>> List(long? propertyId, long? unitId, long? leaseId);
        Task<ServiceResponse<LoadLeaseTransitionChecklistDto>> Create(CreateLeaseTransitionChecklistDto dto);
        Task<ServiceResponse<LoadLeaseTransitionChecklistDto>> Get(long id);
        Task<ServiceResponse<LoadLeaseTransitionChecklistDto>> UpdateItem(long id, string key, UpdateLeaseTransitionChecklistItemDto dto);
        Task<ServiceResponse<LoadLeaseTransitionChecklistDto>> LinkConditionReport(long id, LinkConditionReportDto dto);
        Task<ServiceResponse<LoadLeaseTransitionChecklistDto>> DetachConditionReport(long id);
    }
}
