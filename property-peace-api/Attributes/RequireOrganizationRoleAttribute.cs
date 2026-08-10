using brownstone_hub_api.Entitlements.Policy;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Security;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
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
            var authorityResolver = context.HttpContext.RequestServices.GetRequiredService<IOrganizationAuthorityResolver>();
            var userRepository = context.HttpContext.RequestServices.GetRequiredService<IUserRepository>();
            var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<RequireOrganizationRoleAttribute>>();

            var organizationId = GetOrganizationId(context);
            if (!organizationId.HasValue)
            {
                context.Result = Error("Organization context required", StatusCodes.Status403Forbidden);
                return;
            }

            var userId = await GetUserIdAsync(context, userRepository);
            if (!userId.HasValue)
            {
                context.Result = Error("User not authenticated", StatusCodes.Status401Unauthorized);
                return;
            }

            if (!TryGetRequiredRoles(out var requiredRoles))
            {
                logger.LogError("Organization role filter contains an unknown role requirement");
                context.Result = Error("Error verifying permissions", StatusCodes.Status500InternalServerError);
                return;
            }

            OrganizationMember? member;
            try
            {
                member = await authorityResolver.ResolveActiveMemberAsync(
                    userId.Value,
                    organizationId.Value,
                    context.HttpContext.RequestAborted);
            }
            catch (OperationCanceledException) when (context.HttpContext.RequestAborted.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error checking organization role");
                context.Result = Error("Error verifying permissions", StatusCodes.Status500InternalServerError);
                return;
            }

            if (member is null)
            {
                context.Result = Error("You are not a member of this organization", StatusCodes.Status403Forbidden);
                return;
            }

            var hasKnownRole = IsAuthorized(member, organizationId.Value, OrganizationRole.Viewer);
            if (!hasKnownRole ||
                (requiredRoles.Count > 0 &&
                    !requiredRoles.Any(requiredRole => IsAuthorized(member, organizationId.Value, requiredRole))))
            {
                context.Result = Error("You do not have the required role for this action", StatusCodes.Status403Forbidden);
                return;
            }

            // Keep downstream execution outside the authority-resolution catch so the global
            // exception handler, rather than this authorization filter, owns action failures.
            await next();
        }

        private bool TryGetRequiredRoles(out IReadOnlyList<OrganizationRole> roles)
        {
            var parsed = new List<OrganizationRole>(_allowedRoles.Length);
            foreach (var rawRole in _allowedRoles)
            {
                if (!Enum.TryParse<OrganizationRole>(rawRole, ignoreCase: true, out var role) ||
                    !Enum.IsDefined(role) ||
                    int.TryParse(rawRole, out _))
                {
                    roles = [];
                    return false;
                }

                parsed.Add(role);
            }

            roles = parsed;
            return true;
        }

        private static bool IsAuthorized(OrganizationMember member, long organizationId, OrganizationRole requiredRole)
        {
            var decision = OrganizationAuthorityPolicy.Evaluate(
                new OrganizationAuthorityFacts(organizationId, Exists: true, IsActive: true, IsDeleted: false),
                new OrganizationMembershipFacts(
                    organizationId,
                    MembershipState.Active,
                    Role: null,
                    RawRole: member.Role,
                    Permissions: []),
                new OrganizationAuthorityRequirement(requiredRole));

            return decision.IsAllowed;
        }

        private static ObjectResult Error(string message, int statusCode) => new(new { Message = message })
        {
            StatusCode = statusCode
        };

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

        private static async Task<long?> GetUserIdAsync(ActionExecutingContext context, IUserRepository userRepository)
        {
            if (context.HttpContext.Items.TryGetValue("UserId", out var userIdObj) && userIdObj is long userId)
            {
                return userId;
            }

            var userIdClaim = context.HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? context.HttpContext.User.FindFirst("userId")?.Value
                ?? context.HttpContext.User.FindFirst("sub")?.Value;

            if (!string.IsNullOrEmpty(userIdClaim) && long.TryParse(userIdClaim, out var parsedUserId))
            {
                return parsedUserId;
            }

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
