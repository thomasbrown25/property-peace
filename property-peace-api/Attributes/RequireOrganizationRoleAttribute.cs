using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Repositories.Users;
using System.Security.Claims;

namespace brownstone_hub_api.Attributes
{
    public class RequireOrganizationRoleAttribute : ActionFilterAttribute
    {
        private readonly string[] _allowedRoles;

        public RequireOrganizationRoleAttribute(params string[] allowedRoles)
        {
            _allowedRoles = allowedRoles;
        }

        public IReadOnlyList<string> AllowedRoles => _allowedRoles;

        public override async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            var memberRepository = context.HttpContext.RequestServices.GetRequiredService<IOrganizationMemberRepository>();
            var userRepository = context.HttpContext.RequestServices.GetRequiredService<IUserRepository>();
            var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<RequireOrganizationRoleAttribute>>();

            try
            {
                // Get organization ID from context (set by middleware) or from route/query
                var organizationId = GetOrganizationId(context);
                if (!organizationId.HasValue)
                {
                    context.Result = new ObjectResult(new { Message = "Organization context required" })
                    {
                        StatusCode = StatusCodes.Status403Forbidden
                    };
                    return;
                }

                // Get user ID
                var userId = await GetUserIdAsync(context, userRepository);
                if (!userId.HasValue)
                {
                    context.Result = new ObjectResult(new { Message = "User not authenticated" })
                    {
                        StatusCode = 401
                    };
                    return;
                }

                // Check if user has required role
                var member = await memberRepository.GetMemberAsync(organizationId.Value, userId.Value);
                if (member == null || !member.IsActive)
                {
                    context.Result = new ObjectResult(new { Message = "You are not a member of this organization" })
                    {
                        StatusCode = 403
                    };
                    return;
                }

                if (_allowedRoles.Length > 0 && !_allowedRoles.Contains(member.Role, StringComparer.OrdinalIgnoreCase))
                {
                    context.Result = new ObjectResult(new { Message = "You do not have the required role for this action" })
                    {
                        StatusCode = 403
                    };
                    return;
                }

                await next();
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error checking organization role");
                context.Result = new ObjectResult(new { Message = "Error verifying permissions" })
                {
                    StatusCode = 500
                };
            }
        }

        private static long? GetOrganizationId(ActionExecutingContext context)
        {
            // Only trust the organization selected and membership-validated by
            // OrganizationContextMiddleware. Route and query values are caller-controlled.
            if (context.HttpContext.Items.TryGetValue("OrganizationId", out var orgIdObj) &&
                orgIdObj is long orgId && orgId > 0)
            {
                return orgId;
            }

            return null;
        }

        private async Task<long?> GetUserIdAsync(ActionExecutingContext context, IUserRepository userRepository)
        {
            // Try from context items
            if (context.HttpContext.Items.TryGetValue("UserId", out var userIdObj) && userIdObj is long userId)
            {
                return userId;
            }

            // Try from claims
            var userIdClaim = context.HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? context.HttpContext.User.FindFirst("userId")?.Value
                ?? context.HttpContext.User.FindFirst("sub")?.Value;

            if (!string.IsNullOrEmpty(userIdClaim) && long.TryParse(userIdClaim, out var parsedUserId))
            {
                return parsedUserId;
            }

            // Try to get from email
            var email = context.HttpContext.User.FindFirst(ClaimTypes.Email)?.Value
                ?? context.HttpContext.User.FindFirst("email")?.Value;

            if (!string.IsNullOrEmpty(email))
            {
                var user = await userRepository.GetUser(email);
                return user?.Id;
            }

            return null;
        }
    }
}

