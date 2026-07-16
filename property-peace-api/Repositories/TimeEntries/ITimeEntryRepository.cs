using brownstone_hub_api.Dtos.TimeEntry;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Repositories.TimeEntries
{
    public interface ITimeEntryRepository
    {
        Task<LoadTimeEntryDto> AddTimeEntry(AddTimeEntryDto dto);
        Task<LoadTimeEntryDto?> GetTimeEntryById(long id);
        Task<LoadTimeEntryDto?> UpdateTimeEntry(UpdateTimeEntryDto dto);
        Task<bool> DeleteTimeEntry(long id);
        Task<List<LoadTimeEntryDto>> GetTimeEntriesByOrganizationId(long organizationId, DateTime? startDate = null, DateTime? endDate = null);
        Task<List<LoadTimeEntryDto>> GetTimeEntriesByPropertyId(long propertyId, DateTime? startDate = null, DateTime? endDate = null);
        Task<List<LoadTimeEntryDto>> GetTimeEntriesByStaffMemberId(long staffMemberId, DateTime? startDate = null, DateTime? endDate = null);
        Task<List<LoadTimeEntryDto>> GetTimeEntriesByMaintenanceRequestId(long maintenanceRequestId);
        Task<List<LoadTimeEntryDto>> GetPendingApprovals(long organizationId);
        Task<List<LoadTimeEntryDto>> GetTimeEntriesByStatus(long organizationId, ETimeEntryStatus status, DateTime? startDate = null, DateTime? endDate = null);
    }
}
