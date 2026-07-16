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
                        StatusCode = 400
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

        private long? GetOrganizationId(ActionExecutingContext context)
        {
            // Try from context items (set by middleware)
            if (context.HttpContext.Items.TryGetValue("OrganizationId", out var orgIdObj) && orgIdObj is long orgId)
            {
                return orgId;
            }

            // Try from route values
            if (context.RouteData.Values.TryGetValue("organizationId", out var routeOrgId) && routeOrgId != null)
            {
                if (long.TryParse(routeOrgId.ToString(), out var parsedOrgId))
                {
                    return parsedOrgId;
                }
            }

            // Try from query string
            if (context.HttpContext.Request.Query.TryGetValue("organizationId", out var queryOrgId) && long.TryParse(queryOrgId, out var parsedQueryOrgId))
            {
                return parsedQueryOrgId;
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

