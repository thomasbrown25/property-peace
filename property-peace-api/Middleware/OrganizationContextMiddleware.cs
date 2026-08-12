using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Security;
using System.Security.Claims;

namespace brownstone_hub_api.Middleware
{
    public class OrganizationContextMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<OrganizationContextMiddleware> _logger;

        public OrganizationContextMiddleware(RequestDelegate next, ILogger<OrganizationContextMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(
            HttpContext context,
            IUserRepository userRepository,
            IOrganizationAuthorityResolver authorityResolver)
        {
            if (context.User.Identity?.IsAuthenticated == true)
            {
                try
                {
                    long? userId = null;
                    
                    // Try to get user ID from claims
                    var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                        ?? context.User.FindFirst("userId")?.Value
                        ?? context.User.FindFirst("sub")?.Value;

                    if (!string.IsNullOrEmpty(userIdClaim))
                    {
                        // Try parsing as long (numeric ID)
                        if (long.TryParse(userIdClaim, out var parsedUserId))
                        {
                            userId = parsedUserId;
                        }
                        else
                        {
                            // If not a number, it might be an email - try to get user by email
                            try
                            {
                                var userDto = await userRepository.GetUserByEmailAsync(userIdClaim);
                                if (userDto != null)
                                {
                                    userId = userDto.Id;
                                }
                            }
                            catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
                            {
                                throw;
                            }
                            catch (Exception ex)
                            {
                                _logger.LogWarning(ex, "Could not find user by email/claim: {UserIdClaim}", userIdClaim);
                            }
                        }
                    }

                    if (userId.HasValue)
                    {
                        var organizationHeaderWasProvided = context.Request.Headers.ContainsKey("X-Organization-Id");
                        var organizationIdHeader = context.Request.Headers["X-Organization-Id"].FirstOrDefault();

                        if (organizationHeaderWasProvided)
                        {
                            if (!long.TryParse(organizationIdHeader, out var organizationId) || organizationId <= 0)
                            {
                                _logger.LogWarning(
                                    "User {UserId} supplied an invalid organization ID header: {Header}",
                                    userId.Value,
                                    organizationIdHeader ?? "null");
                                context.Items.Remove("OrganizationId");
                                context.Items.Remove("UserId");
                                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                                return;
                            }

                            var isMember = await authorityResolver.HasActiveMembershipAsync(
                                userId.Value,
                                organizationId,
                                context.RequestAborted);
                            if (!isMember)
                            {
                                _logger.LogWarning(
                                    "User {UserId} attempted to access organization {OrganizationId} without membership.",
                                    userId.Value,
                                    organizationId);
                                context.Items.Remove("OrganizationId");
                                context.Items.Remove("UserId");
                                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                                return;
                            }

                            context.Items["OrganizationId"] = organizationId;
                            context.Items["UserId"] = userId.Value;
                        }
                        else
                        {
                            // With no explicit selection, preserve the product convention of using
                            // the user's persisted current organization as the default.
                            var user = await userRepository.GetUser(userId.Value);
                            if (user?.CurrentOrganizationId is > 0)
                            {
                                var persistedOrganizationId = user.CurrentOrganizationId.Value;
                                var isMember = await authorityResolver.HasActiveMembershipAsync(
                                    userId.Value,
                                    persistedOrganizationId,
                                    context.RequestAborted);
                                if (!isMember)
                                {
                                    _logger.LogWarning(
                                        "User {UserId}'s persisted organization {OrganizationId} is no longer an authorized membership.",
                                        userId.Value,
                                        persistedOrganizationId);
                                    context.Items.Remove("OrganizationId");
                                    context.Items.Remove("UserId");
                                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                                    return;
                                }

                                context.Items["OrganizationId"] = persistedOrganizationId;
                                context.Items["UserId"] = userId.Value;
                                _logger.LogDebug("Organization context set from user's CurrentOrganizationId: {OrganizationId} for UserId: {UserId}", 
                                    persistedOrganizationId, userId.Value);
                            }
                            else
                            {
                                _logger.LogWarning("No organization context found - UserId: {UserId}, User CurrentOrganizationId: {CurrentOrgId}, Header: {Header}", 
                                    userId.Value, user?.CurrentOrganizationId?.ToString() ?? "null", organizationIdHeader ?? "null");
                            }
                        }
                    }
                    else
                    {
                        _logger.LogWarning("Could not determine user ID from claims for authenticated user");
                    }
                }
                catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error setting organization context");
                    // Organization authorization could not be verified. Fail closed rather than
                    // allowing an authenticated request to continue with stale or absent scope.
                    context.Items.Remove("OrganizationId");
                    context.Items.Remove("UserId");
                    context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                    return;
                }
            }

            await _next(context);
        }
    }

    public static class OrganizationContextMiddlewareExtensions
    {
        public static IApplicationBuilder UseOrganizationContext(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<OrganizationContextMiddleware>();
        }
    }
}

