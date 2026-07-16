using brownstone_hub_api.Dtos.TimeBreak;

namespace brownstone_hub_api.Repositories.TimeBreaks
{
    public interface ITimeBreakRepository
    {
        Task<LoadTimeBreakDto> AddTimeBreak(AddTimeBreakDto dto);
        Task<LoadTimeBreakDto?> GetTimeBreakById(long id);
        Task<LoadTimeBreakDto?> UpdateTimeBreak(UpdateTimeBreakDto dto);
        Task<bool> DeleteTimeBreak(long id);
        Task<List<LoadTimeBreakDto>> GetTimeBreaksByTimeEntryId(long timeEntryId);
    }
}
