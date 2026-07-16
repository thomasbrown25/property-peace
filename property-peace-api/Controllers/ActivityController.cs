using brownstone_hub_api.Dtos.Activity;
using brownstone_hub_api.Services.ActivityService;
using brownstone_hub_api.Services.UserService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/activities")]
    [Authorize(Roles = "Tenant,Landlord,Admin")]
    public class ActivityController(
        IActivityService activityService,
        IUserService userService) : ControllerBase
    {
        private readonly IActivityService _activityService = activityService;
        private readonly IUserService _userService = userService;

        [HttpGet]
        public async Task<ActionResult<ServiceResponse<ActivityListResponseDto>>> GetActivities(
            [FromQuery] DateTime? startDate,
            [FromQuery] DateTime? endDate,
            [FromQuery] List<string>? activityTypes,
            [FromQuery] long? propertyId,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            var userIdResponse = await _userService.GetCurrentUserIdAsync();
            if (!userIdResponse.Success || !userIdResponse.Data.HasValue)
            {
                return Unauthorized(new { Message = userIdResponse.Message ?? "User not found" });
            }

            var filter = new ActivityFilterDto
            {
                StartDate = startDate,
                EndDate = endDate,
                ActivityTypes = activityTypes,
                PropertyId = propertyId,
                Page = page,
                PageSize = pageSize
            };

            var response = await _activityService.GetActivities(userIdResponse.Data.Value, filter);

            if (!response.Success)
            {
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });
            }

            return Ok(response);
        }
    }
}

