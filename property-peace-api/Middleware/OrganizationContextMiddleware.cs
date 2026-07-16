using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Repositories.Users;
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
            IOrganizationMemberRepository memberRepository)
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
                            catch (Exception ex)
                            {
                                _logger.LogWarning(ex, "Could not find user by email/claim: {UserIdClaim}", userIdClaim);
                            }
                        }
                    }

                    if (userId.HasValue)
                    {
                        bool organizationContextSet = false;
                        
                        // Get organization ID from header if provided
                        var organizationIdHeader = context.Request.Headers["X-Organization-Id"].FirstOrDefault();
                        if (!string.IsNullOrEmpty(organizationIdHeader) && long.TryParse(organizationIdHeader, out var organizationId))
                        {
                            // Verify user is a member of this organization
                            var isMember = await memberRepository.IsUserMemberOfOrganizationAsync(userId.Value, organizationId);
                            if (isMember)
                            {
                                // Store in context for use in controllers/services
                                context.Items["OrganizationId"] = organizationId;
                                context.Items["UserId"] = userId.Value;
                                organizationContextSet = true;
                            }
                            else
                            {
                                _logger.LogWarning("User {UserId} attempted to access organization {OrganizationId} without membership. Falling back to user's CurrentOrganizationId.", userId.Value, organizationId);
                            }
                        }
                        
                        // If organization context not set (no header, invalid header, or membership check failed),
                        // fall back to user's CurrentOrganizationId
                        if (!organizationContextSet)
                        {
                            var user = await userRepository.GetUser(userId.Value);
                            if (user?.CurrentOrganizationId != null)
                            {
                                context.Items["OrganizationId"] = user.CurrentOrganizationId;
                                context.Items["UserId"] = userId.Value;
                                _logger.LogDebug("Organization context set from user's CurrentOrganizationId: {OrganizationId} for UserId: {UserId}", 
                                    user.CurrentOrganizationId, userId.Value);
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
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error setting organization context");
                    // Continue without organization context - let authorization handle it
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

