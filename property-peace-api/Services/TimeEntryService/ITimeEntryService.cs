using brownstone_hub_api.Dtos.TimeEntry;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Services.TimeEntryService
{
    public interface ITimeEntryService
    {
        Task<ServiceResponse<LoadTimeEntryDto>> StartTimer(StartTimerDto dto);
        Task<ServiceResponse<LoadTimeEntryDto>> StopTimer(long timeEntryId, StopTimerDto dto);
        Task<ServiceResponse<LoadTimeEntryDto>> CreateTimeEntry(AddTimeEntryDto dto);
        Task<ServiceResponse<LoadTimeEntryDto>> UpdateTimeEntry(long id, UpdateTimeEntryDto dto);
        Task<ServiceResponse<bool>> DeleteTimeEntry(long id);
        Task<ServiceResponse<LoadTimeEntryDto>> GetTimeEntryById(long id);
        Task<ServiceResponse<List<LoadTimeEntryDto>>> GetTimeEntries(long? propertyId = null, long? staffMemberId = null, DateTime? startDate = null, DateTime? endDate = null, ETimeEntryStatus? status = null);
        Task<ServiceResponse<List<LoadTimeEntryDto>>> GetTimeEntriesByProperty(long propertyId, DateTime? startDate = null, DateTime? endDate = null);
        Task<ServiceResponse<List<LoadTimeEntryDto>>> GetTimeEntriesByStaffMember(long staffMemberId, DateTime? startDate = null, DateTime? endDate = null);
        Task<ServiceResponse<List<LoadTimeEntryDto>>> GetTimeEntriesByMaintenanceRequest(long maintenanceRequestId);
        Task<ServiceResponse<List<LoadTimeEntryDto>>> GetPendingApprovals();
        Task<ServiceResponse<LoadTimeEntryDto>> SubmitForApproval(long id, SubmitTimeEntryDto dto);
        Task<ServiceResponse<LoadTimeEntryDto>> ApproveTimeEntry(long id, ApproveTimeEntryDto dto);
        Task<ServiceResponse<LoadTimeEntryDto>> RejectTimeEntry(long id, ApproveTimeEntryDto dto);
    }
}
