using System.Diagnostics;
using System.Globalization;
using System.Security.Claims;
using brownstone_hub_api.Data;
using brownstone_hub_api.Services.ImpersonationService;
using Microsoft.AspNetCore.SignalR;

namespace brownstone_hub_api.Hubs
{
    /// <summary>
    /// Revalidates every impersonated hub invocation and writes a body/token-free audit record.
    /// Connection registration also lets a stop or token expiry terminate an already-open transport.
    /// </summary>
    public sealed class ImpersonationHubFilter(
        IServiceScopeFactory scopeFactory,
        ImpersonationConnectionRegistry connectionRegistry,
        ILogger<ImpersonationHubFilter> logger) : IHubFilter
    {
        private readonly IServiceScopeFactory _scopeFactory = scopeFactory;
        private readonly ImpersonationConnectionRegistry _connectionRegistry = connectionRegistry;
        private readonly ILogger<ImpersonationHubFilter> _logger = logger;

        public async ValueTask<object?> InvokeMethodAsync(
            HubInvocationContext invocationContext,
            Func<HubInvocationContext, ValueTask<object?>> next)
        {
            var principal = invocationContext.Context.User;
            if (!IsImpersonating(principal)) return await next(invocationContext);

            var started = Stopwatch.GetTimestamp();
            var statusCode = StatusCodes.Status200OK;
            var result = "succeeded";

            try
            {
                if (!await IsSessionValidAsync(principal!))
                {
                    statusCode = StatusCodes.Status401Unauthorized;
                    result = "rejected";
                    invocationContext.Context.Abort();
                    throw new HubException("Impersonation session is stopped, expired, or invalid.");
                }

                return await next(invocationContext);
            }
            catch (OperationCanceledException)
            {
                if (statusCode == StatusCodes.Status200OK)
                {
                    statusCode = 499;
                    result = "cancelled";
                }
                throw;
            }
            catch
            {
                if (statusCode == StatusCodes.Status200OK)
                {
                    statusCode = StatusCodes.Status500InternalServerError;
                    result = "exception";
                }
                throw;
            }
            finally
            {
                await PersistAuditAsync(
                    invocationContext,
                    statusCode,
                    result,
                    (long)Stopwatch.GetElapsedTime(started).TotalMilliseconds);
            }
        }

        public async Task OnConnectedAsync(HubLifetimeContext context, Func<HubLifetimeContext, Task> next)
        {
            var principal = context.Context.User;
            if (!IsImpersonating(principal))
            {
                await next(context);
                return;
            }

            if (!TryGetSessionId(principal!, out var sessionId) || !await IsSessionValidAsync(principal!))
            {
                context.Context.Abort();
                throw new HubException("Impersonation session is stopped, expired, or invalid.");
            }

            // JWT expiry is never later than the impersonation session expiry.
            var expiresAt = GetAccessTokenExpiry(principal!);
            if (expiresAt <= DateTimeOffset.UtcNow)
            {
                context.Context.Abort();
                throw new HubException("Impersonation access token has expired.");
            }

            _connectionRegistry.Register(sessionId, context.Context, expiresAt);
            try
            {
                await next(context);
            }
            catch
            {
                _connectionRegistry.Unregister(sessionId, context.Context.ConnectionId);
                throw;
            }
        }

        public async Task OnDisconnectedAsync(HubLifetimeContext context, Exception? exception, Func<HubLifetimeContext, Exception?, Task> next)
        {
            if (IsImpersonating(context.Context.User) && TryGetSessionId(context.Context.User!, out var sessionId))
            {
                _connectionRegistry.Unregister(sessionId, context.Context.ConnectionId);
            }
            await next(context, exception);
        }

        private async Task<bool> IsSessionValidAsync(ClaimsPrincipal principal)
        {
            try
            {
                await using var scope = _scopeFactory.CreateAsyncScope();
                return await scope.ServiceProvider.GetRequiredService<IImpersonationService>()
                    .ValidateAccessTokenSessionAsync(principal);
            }
            catch (Exception exception)
            {
                // Fail closed. Do not attempt to audit from here; the invocation's single finally block owns that.
                _logger.LogError(exception, "Failed to validate impersonation session for SignalR connection {ConnectionId}",
                    Activity.Current?.Id);
                return false;
            }
        }

        private async Task PersistAuditAsync(HubInvocationContext invocation, int statusCode, string result, long durationMilliseconds)
        {
            try
            {
                var principal = invocation.Context.User!;
                var httpContext = invocation.Context.GetHttpContext();
                await using var scope = _scopeFactory.CreateAsyncScope();
                var dataContext = scope.ServiceProvider.GetRequiredService<DataContext>();
                dataContext.ImpersonationAuditRecords.Add(new ImpersonationAuditRecord
                {
                    ImpersonationSessionId = TryGetSessionId(principal, out var sessionId) ? sessionId : null,
                    ActorUserId = ParseLong(principal.FindFirstValue("actor_user_id")),
                    TargetUserId = ParseLong(principal.FindFirstValue("userId") ?? principal.FindFirstValue(ClaimTypes.NameIdentifier)),
                    OrganizationId = httpContext?.Items.TryGetValue("OrganizationId", out var organization) == true
                        ? ParseLong(organization?.ToString())
                        : null,
                    Action = "hub-invocation",
                    Result = result,
                    Detail = null,
                    HttpMethod = "SIGNALR",
                    Route = Truncate($"{invocation.Hub.GetType().Name}/{invocation.HubMethodName}", 512),
                    StatusCode = statusCode,
                    TraceId = Truncate(invocation.Context.ConnectionId, 128),
                    CorrelationId = Truncate(httpContext?.Request.Headers["X-Correlation-ID"].FirstOrDefault(), 128),
                    IpAddress = Truncate(httpContext?.Connection.RemoteIpAddress?.ToString(), 64),
                    UserAgent = Truncate(httpContext?.Request.Headers.UserAgent.FirstOrDefault(), 512),
                    DurationMilliseconds = durationMilliseconds,
                    OccurredAt = DateTime.UtcNow
                });
                await dataContext.SaveChangesAsync(CancellationToken.None);
            }
            catch (Exception exception)
            {
                // Never recurse/retry through the hub and never replace the invocation's actual result.
                _logger.LogError(exception, "Failed to persist impersonation SignalR invocation audit for connection {ConnectionId}",
                    invocation.Context.ConnectionId);
            }
        }

        private static bool IsImpersonating(ClaimsPrincipal? principal) =>
            principal?.Identity?.IsAuthenticated == true &&
            string.Equals(principal.FindFirstValue("is_impersonating"), "true", StringComparison.OrdinalIgnoreCase);

        private static bool TryGetSessionId(ClaimsPrincipal principal, out Guid sessionId) =>
            Guid.TryParse(principal.FindFirstValue("impersonation_session_id"), out sessionId);

        private static DateTimeOffset GetAccessTokenExpiry(ClaimsPrincipal principal) =>
            long.TryParse(principal.FindFirstValue("exp"), NumberStyles.None, CultureInfo.InvariantCulture, out var seconds)
                ? DateTimeOffset.FromUnixTimeSeconds(seconds)
                : DateTimeOffset.MinValue;

        private static long? ParseLong(string? value) => long.TryParse(value, out var parsed) ? parsed : null;
        private static string? Truncate(string? value, int maximum) =>
            string.IsNullOrWhiteSpace(value) ? null : value[..Math.Min(value.Length, maximum)];
    }
}
