using brownstone_hub_api.Dtos.Activity;

namespace brownstone_hub_api.Services.ActivityService
{
    public interface IActivityService
    {
        Task<ServiceResponse<ActivityListResponseDto>> GetActivities(long userId, ActivityFilterDto filter);
    }
}

