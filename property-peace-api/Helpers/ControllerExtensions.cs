using brownstone_hub_api.Repositories.Users;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace brownstone_hub_api.Helpers
{
    public static class ControllerExtensions
    {
        /// <summary>
        /// Gets the current authenticated user from JWT token claims
        /// </summary>
        public static async Task<long?> GetCurrentUserIdAsync(this ControllerBase controller, IUserRepository userRepository)
        {
            // Try to get user ID directly from claims first
            var userIdClaim = controller.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!string.IsNullOrEmpty(userIdClaim) && long.TryParse(userIdClaim, out var userId))
            {
                return userId;
            }

            // Try alternative claim names
            userIdClaim = controller.User.FindFirst("userId")?.Value;
            if (!string.IsNullOrEmpty(userIdClaim) && long.TryParse(userIdClaim, out userId))
            {
                return userId;
            }

            // If user ID not in claims, get email from "sub" claim (JWT standard)
            var email = controller.User.FindFirst("sub")?.Value;
            if (string.IsNullOrEmpty(email))
            {
                // Fallback to NameIdentifier (might be email in some cases)
                email = controller.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            }
            if (string.IsNullOrEmpty(email))
            {
                email = controller.User.FindFirst(ClaimTypes.Name)?.Value;
            }

            if (!string.IsNullOrEmpty(email))
            {
                try
                {
                    var user = await userRepository.GetUser(email);
                    return user?.Id;
                }
                catch (Exception)
                {
                    return null;
                }
            }

            return null;
        }

        /// <summary>
        /// Gets the current authenticated user DTO from JWT token claims
        /// </summary>
        public static async Task<Dtos.User.LoadUserDto?> GetCurrentUserAsync(this ControllerBase controller, IUserRepository userRepository)
        {
            return await userRepository.GetCurrentUser();
        }

        /// <summary>
        /// Gets the current organization ID from HttpContext (set by OrganizationContextMiddleware)
        /// </summary>
        public static long? GetCurrentOrganizationId(this ControllerBase controller)
        {
            if (controller.HttpContext.Items.TryGetValue("OrganizationId", out var orgIdObj) && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }

        /// <summary>
        /// Gets the current organization ID from HttpContext or returns 403 if not found
        /// </summary>
        public static long? GetCurrentOrganizationIdOrForbid(this ControllerBase controller)
        {
            var orgId = controller.GetCurrentOrganizationId();
            if (!orgId.HasValue)
            {
                return null; // Caller should return Forbid() or BadRequest()
            }
            return orgId;
        }
    }
}

