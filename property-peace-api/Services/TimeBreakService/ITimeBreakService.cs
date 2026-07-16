using brownstone_hub_api.Dtos.TimeBreak;

namespace brownstone_hub_api.Services.TimeBreakService
{
    public interface ITimeBreakService
    {
        Task<ServiceResponse<LoadTimeBreakDto>> AddTimeBreak(AddTimeBreakDto dto);
        Task<ServiceResponse<LoadTimeBreakDto>> UpdateTimeBreak(long id, UpdateTimeBreakDto dto);
        Task<ServiceResponse<bool>> DeleteTimeBreak(long id);
        Task<ServiceResponse<LoadTimeBreakDto>> GetTimeBreakById(long id);
        Task<ServiceResponse<List<LoadTimeBreakDto>>> GetTimeBreaksByTimeEntryId(long timeEntryId);
    }
}
