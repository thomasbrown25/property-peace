using System.Security.Claims;
using Microsoft.ApplicationInsights.Channel;
using Microsoft.ApplicationInsights.DataContracts;
using Microsoft.ApplicationInsights.Extensibility;
using Microsoft.AspNetCore.Http;

namespace brownstone_hub_api.Telemetry;

/// <summary>
/// Correlates Application Insights telemetry with the stable, non-PII user ID
/// already present in authenticated Property Peace JWTs.
/// </summary>
public sealed class AuthenticatedUserTelemetryInitializer(IHttpContextAccessor httpContextAccessor)
    : ITelemetryInitializer
{
    public void Initialize(ITelemetry telemetry)
    {
        ArgumentNullException.ThrowIfNull(telemetry);

        var httpContext = httpContextAccessor.HttpContext;
        var identity = httpContext?.User?.Identity;
        if (identity?.IsAuthenticated != true)
        {
            return;
        }

        var userId = FindNumericUserId(httpContext!.User);
        if (userId is null)
        {
            return;
        }

        telemetry.Context.User.AuthenticatedUserId ??= userId;

        if (telemetry is ISupportProperties propertyTelemetry)
        {
            if (TryGetPositiveOrganizationId(httpContext.Items["OrganizationId"], out var organizationId))
            {
                propertyTelemetry.Properties.TryAdd("organizationId", organizationId);
            }

            if (!string.IsNullOrWhiteSpace(identity.AuthenticationType))
            {
                propertyTelemetry.Properties.TryAdd("authenticationType", identity.AuthenticationType);
            }
        }
    }

    private static string? FindNumericUserId(ClaimsPrincipal principal)
    {
        foreach (var claimType in new[] { ClaimTypes.NameIdentifier, "userId" })
        {
            var value = principal.FindFirst(claimType)?.Value;
            if (long.TryParse(value, out var userId) && userId > 0)
            {
                return userId.ToString(System.Globalization.CultureInfo.InvariantCulture);
            }
        }

        return null;
    }

    private static bool TryGetPositiveOrganizationId(object? value, out string organizationId)
    {
        if (value is long longValue && longValue > 0)
        {
            organizationId = longValue.ToString(System.Globalization.CultureInfo.InvariantCulture);
            return true;
        }

        if (long.TryParse(value?.ToString(), out var parsedValue) && parsedValue > 0)
        {
            organizationId = parsedValue.ToString(System.Globalization.CultureInfo.InvariantCulture);
            return true;
        }

        organizationId = string.Empty;
        return false;
    }
}
