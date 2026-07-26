using System.Diagnostics;
using System.Security.Claims;
using System.Text.Json;
using brownstone_hub_api.Data;
using Microsoft.AspNetCore.Routing;

namespace brownstone_hub_api.Middleware
{
    /// <summary>Writes one body-free audit row after every request authenticated with an impersonation token.</summary>
    public sealed class ImpersonationAuditMiddleware(
        RequestDelegate next,
        ILogger<ImpersonationAuditMiddleware> logger)
    {
        private readonly RequestDelegate _next = next;
        private readonly ILogger<ImpersonationAuditMiddleware> _logger = logger;

        public async Task InvokeAsync(HttpContext context, DataContext dataContext)
        {
            if (!IsImpersonating(context.User))
            {
                await _next(context);
                return;
            }

            var started = Stopwatch.GetTimestamp();
            Exception? failure = null;
            try
            {
                await _next(context);
            }
            catch (Exception exception)
            {
                failure = exception;
                throw;
            }
            finally
            {
                try
                {
                    var principal = context.User;
                    var route = context.GetEndpoint() is RouteEndpoint endpoint
                        ? endpoint.RoutePattern.RawText
                        : null;
                    var statusCode = failure == null
                        ? context.Response.StatusCode
                        : StatusCodes.Status500InternalServerError;

                    dataContext.ImpersonationAuditRecords.Add(new ImpersonationAuditRecord
                    {
                        ImpersonationSessionId = Guid.TryParse(principal.FindFirstValue("impersonation_session_id"), out var sessionId) ? sessionId : null,
                        ActorUserId = long.TryParse(principal.FindFirstValue("actor_user_id"), out var actorId) ? actorId : null,
                        TargetUserId = long.TryParse(principal.FindFirstValue("userId") ?? principal.FindFirstValue(ClaimTypes.NameIdentifier), out var targetId) ? targetId : null,
                        OrganizationId = context.Items.TryGetValue("OrganizationId", out var organization) && long.TryParse(organization?.ToString(), out var organizationId) ? organizationId : null,
                        Action = "request",
                        Result = failure != null ? "exception" : statusCode < 400 ? "succeeded" : "rejected",
                        Detail = null,
                        HttpMethod = Truncate(context.Request.Method, 16),
                        Route = Truncate(route, 512),
                        StatusCode = statusCode,
                        TraceId = Truncate(Activity.Current?.TraceId.ToString() ?? context.TraceIdentifier, 128),
                        CorrelationId = Truncate(context.Request.Headers["X-Correlation-ID"].FirstOrDefault(), 128),
                        IpAddress = Truncate(context.Connection.RemoteIpAddress?.ToString(), 64),
                        UserAgent = Truncate(context.Request.Headers.UserAgent.FirstOrDefault(), 512),
                        DurationMilliseconds = (long)Stopwatch.GetElapsedTime(started).TotalMilliseconds,
                        EntityRouteIds = SafeRouteIds(context.Request.RouteValues),
                        OccurredAt = DateTime.UtcNow
                    });
                    await dataContext.SaveChangesAsync(CancellationToken.None);
                }
                catch (Exception auditException)
                {
                    // Auditing must not replace the API result or leak persistence details to the caller.
                    _logger.LogError(auditException, "Failed to persist impersonation request audit for trace {TraceId}", context.TraceIdentifier);
                }
            }
        }

        private static bool IsImpersonating(ClaimsPrincipal principal) =>
            principal.Identity?.IsAuthenticated == true &&
            string.Equals(principal.FindFirstValue("is_impersonating"), "true", StringComparison.OrdinalIgnoreCase);

        private static string? SafeRouteIds(RouteValueDictionary routeValues)
        {
            var ids = new SortedDictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var (key, rawValue) in routeValues)
            {
                if (!key.EndsWith("id", StringComparison.OrdinalIgnoreCase) || rawValue == null) continue;
                var value = rawValue.ToString();
                if (long.TryParse(value, out _) || Guid.TryParse(value, out _)) ids[key] = value!;
            }
            return ids.Count == 0 ? null : JsonSerializer.Serialize(ids);
        }

        private static string? Truncate(string? value, int maximum) =>
            string.IsNullOrWhiteSpace(value) ? null : value[..Math.Min(value.Length, maximum)];
    }

    public static class ImpersonationAuditMiddlewareExtensions
    {
        public static IApplicationBuilder UseImpersonationAudit(this IApplicationBuilder builder) =>
            builder.UseMiddleware<ImpersonationAuditMiddleware>();
    }
}
