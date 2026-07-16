using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using brownstone_hub_api.Dtos.User;
using brownstone_hub_api.Services.UserService;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/admin/user")]
    [Authorize(Roles = "Admin")]
    public class UserAdminController : ControllerBase
    {
        private readonly IUserService _userService;
        private readonly ILogger<UserAdminController> _logger;

        public UserAdminController(
            IUserService userService,
            ILogger<UserAdminController> logger)
        {
            _userService = userService;
            _logger = logger;
        }

        /// <summary>
        /// Get all users (admin only)
        /// </summary>
        [HttpGet("all")]
        public async Task<IActionResult> GetAllUsers([FromQuery] bool includeDeleted = false)
        {
            try
            {
                var response = await _userService.GetAllUsers(includeDeleted);
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all users");
                return StatusCode(500, new { Message = "An error occurred while retrieving users" });
            }
        }

        /// <summary>
        /// Update a user by ID (admin only)
        /// </summary>
        [HttpPut("{userId}")]
        public async Task<IActionResult> UpdateUser(long userId, [FromBody] UpdateUserDto updateUserDto)
        {
            try
            {
                var response = await _userService.UpdateUserAccountInfoById(userId, updateUserDto);
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating user {UserId}", userId);
                return StatusCode(500, new { Message = "An error occurred while updating the user" });
            }
        }

        /// <summary>
        /// Delete a user by ID (admin only) - completely removes user and all related data
        /// </summary>
        [HttpDelete("{userId}")]
        public async Task<IActionResult> DeleteUser(long userId)
        {
            try
            {
                var response = await _userService.HardDeleteUserCompletely(userId);
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting user {UserId}", userId);
                return StatusCode(500, new { Message = "An error occurred while deleting the user" });
            }
        }

        /// <summary>
        /// Suspend a user account (admin only)
        /// </summary>
        [HttpPost("{userId}/suspend")]
        public async Task<IActionResult> SuspendUser(long userId)
        {
            try
            {
                var response = await _userService.SuspendUser(userId);
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error suspending user {UserId}", userId);
                return StatusCode(500, new { Message = "An error occurred while suspending the user" });
            }
        }

        /// <summary>
        /// Unsuspend a user account (admin only)
        /// </summary>
        [HttpPost("{userId}/unsuspend")]
        public async Task<IActionResult> UnsuspendUser(long userId)
        {
            try
            {
                var response = await _userService.UnsuspendUser(userId);
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error unsuspending user {UserId}", userId);
                return StatusCode(500, new { Message = "An error occurred while unsuspending the user" });
            }
        }

        /// <summary>
        /// Set a user's password (admin only). Does not require the current password.
        /// Works for any user including Google sign-up; user can then login with email+password or continue using Google/Apple.
        /// </summary>
        [HttpPost("{userId}/set-password")]
        public async Task<IActionResult> SetPassword(long userId, [FromBody] AdminSetPasswordDto request)
        {
            try
            {
                if (request == null || string.IsNullOrWhiteSpace(request.NewPassword))
                {
                    return BadRequest(new { Message = "New password is required." });
                }
                var response = await _userService.AdminSetPassword(userId, request.NewPassword);
                if (!response.Success)
                {
                    return BadRequest(response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error setting password for user {UserId}", userId);
                return StatusCode(500, new { Message = "An error occurred while setting the password" });
            }
        }
    }
}

