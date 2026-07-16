using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Services.UserService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/notifications")]
    [Authorize(Roles = "Tenant,Landlord,Admin")]
    public class NotificationController(
        INotificationService notificationService,
        IUserService userService) : ControllerBase
    {
        private readonly INotificationService _notificationService = notificationService;
        private readonly IUserService _userService = userService;

        [HttpGet("list")]
        public async Task<ActionResult<ServiceResponse<NotificationListResponseDto>>> GetNotifications()
        {
            var userIdResponse = await _userService.GetCurrentUserIdAsync();
            if (!userIdResponse.Success || !userIdResponse.Data.HasValue)
            {
                return Unauthorized(new { Message = userIdResponse.Message ?? "User not found" });
            }
            var response = await _notificationService.GetNotifications(userIdResponse.Data.Value);

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

        [HttpGet("unread-count")]
        public async Task<ActionResult<ServiceResponse<int>>> GetUnreadCount()
        {
            var userIdResponse = await _userService.GetCurrentUserIdAsync();
            if (!userIdResponse.Success || !userIdResponse.Data.HasValue)
            {
                return Unauthorized(new { Message = userIdResponse.Message ?? "User not found" });
            }
            var response = await _notificationService.GetUnreadCount(userIdResponse.Data.Value);

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

        [HttpPost("mark-read/{notificationId}")]
        public async Task<ActionResult<ServiceResponse<bool>>> MarkNotificationAsRead(long notificationId)
        {
            var response = await _notificationService.MarkNotificationAsRead(notificationId);

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

        [HttpPost("mark-all-read")]
        public async Task<ActionResult<ServiceResponse<int>>> MarkAllNotificationsAsRead()
        {
            var userIdResponse = await _userService.GetCurrentUserIdAsync();
            if (!userIdResponse.Success || !userIdResponse.Data.HasValue)
            {
                return Unauthorized(new { Message = userIdResponse.Message ?? "User not found" });
            }
            var response = await _notificationService.MarkAllNotificationsAsRead(userIdResponse.Data.Value);

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

        [HttpPost("create")]
        public async Task<ActionResult<ServiceResponse<NotificationDto>>> CreateNotification([FromBody] CreateNotificationDto createNotificationDto)
        {
            var response = await _notificationService.CreateNotification(createNotificationDto);

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

