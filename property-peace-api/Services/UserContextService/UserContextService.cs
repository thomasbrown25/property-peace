using brownstone_hub_api.Dtos.User;
using brownstone_hub_api.Services.UserService;
using Microsoft.AspNetCore.Http;
using System.Security.Claims;

namespace brownstone_hub_api.Services.UserContextService
{
    public class UserContextService(
        IHttpContextAccessor httpContextAccessor,
        IUserService userService,
        ILogger<UserContextService> logger) : IUserContextService
    {
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly IUserService _userService = userService;
        private readonly ILogger<UserContextService> _logger = logger;

        public async Task<long?> GetCurrentUserIdAsync()
        {
            try
            {
                var user = _httpContextAccessor.HttpContext?.User;
                if (user == null)
                    return null;

                // Try to get user ID directly from claims first
                var userIdClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userIdClaim))
                {
                    userIdClaim = user.FindFirst("userId")?.Value;
                }

                if (!string.IsNullOrEmpty(userIdClaim) && long.TryParse(userIdClaim, out var userId))
                {
                    return userId;
                }

                // If user ID not in claims, get email from "sub" claim (JWT standard)
                var email = user.FindFirst("sub")?.Value;
                if (string.IsNullOrEmpty(email))
                {
                    // Fallback to NameIdentifier (might be email in some cases)
                    email = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                }
                if (string.IsNullOrEmpty(email))
                {
                    email = user.FindFirst(ClaimTypes.Name)?.Value;
                }

                if (!string.IsNullOrEmpty(email))
                {
                    try
                    {
                        var userResponse = await _userService.GetUserByEmailAsync(email);
                        return userResponse.Success && userResponse.Data != null ? userResponse.Data.Id : null;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to get user by email {Email}", email);
                        return null;
                    }
                }

                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting current user ID");
                return null;
            }
        }

        public async Task<LoadUserDto?> GetCurrentUserAsync()
        {
            try
            {
                var userId = await GetCurrentUserIdAsync();
                if (!userId.HasValue)
                    return null;

                var response = await _userService.GetUserByIdAsync(userId.Value);
                return response.Success ? response.Data : null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting current user");
                return null;
            }
        }
    }
}
