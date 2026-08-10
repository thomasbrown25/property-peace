using System.Globalization;
using brownstone_hub_api.Entitlements.Decision;
using brownstone_hub_api.Entitlements.Policy;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;

namespace brownstone_hub_api.Entitlements.Enforcement;

public sealed record EntitlementDeniedResponse(
    bool Success,
    string MatrixVersion,
    string FeatureKey,
    string ReasonCode,
    string Category,
    string Message);

/// <summary>Enforces the server-owned Advanced Reporting entitlement against middleware-owned scope.</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false, Inherited = true)]
public sealed class AdvancedReportingEntitlementAttribute : Attribute, IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(next);

        if (!TryGetPositiveId(context.HttpContext.Items["UserId"], out var userId))
        {
            context.Result = Denied(
                StatusCodes.Status401Unauthorized,
                EntitlementReasonCodes.InvalidInput,
                EntitlementDecisionCategory.Unauthorized,
                "Sign in and try again.");
            return;
        }

        if (!TryGetPositiveId(context.HttpContext.Items["OrganizationId"], out var organizationId))
        {
            context.Result = Denied(
                StatusCodes.Status403Forbidden,
                EntitlementReasonCodes.OrganizationRequired,
                EntitlementDecisionCategory.Unauthorized,
                "Select an organization and try again.");
            return;
        }

        var service = context.HttpContext.RequestServices.GetRequiredService<IEntitlementDecisionService>();
        var decision = await service.DecideAsync(
            new EntitlementDecisionRequest(
                userId.ToString(CultureInfo.InvariantCulture),
                organizationId,
                FeatureKeys.AdvancedReporting),
            context.HttpContext.RequestAborted);

        if (!decision.IsAllowed)
        {
            context.Result = Denied(
                IsInfrastructureFailure(decision.Reason)
                    ? StatusCodes.Status503ServiceUnavailable
                    : StatusCodes.Status403Forbidden,
                decision.Reason,
                decision.Category,
                Message(decision.Category));
            return;
        }

        await next();
    }

    private static ObjectResult Denied(
        int statusCode,
        EntitlementReasonCode reason,
        EntitlementDecisionCategory category,
        string message) =>
        new(new EntitlementDeniedResponse(
            false,
            EntitlementCatalog.Version,
            FeatureKeys.AdvancedReporting.Value,
            reason.Value,
            CategoryWireValue(category),
            message))
        {
            StatusCode = statusCode
        };

    private static string Message(EntitlementDecisionCategory category) => category switch
    {
        EntitlementDecisionCategory.Upgrade => "Upgrade your plan to use this feature.",
        EntitlementDecisionCategory.Setup => "Complete feature setup and try again.",
        EntitlementDecisionCategory.Unauthorized => "Verify your organization access and try again.",
        _ => "This feature is currently unavailable. Try again later."
    };

    private static bool IsInfrastructureFailure(EntitlementReasonCode reason) =>
        reason == EntitlementReasonCodes.PolicyError ||
        reason == EntitlementReasonCodes.FactsUnavailable;

    private static string CategoryWireValue(EntitlementDecisionCategory category) => category switch
    {
        EntitlementDecisionCategory.Upgrade => "upgrade",
        EntitlementDecisionCategory.Setup => "setup",
        EntitlementDecisionCategory.Unauthorized => "unauthorized",
        EntitlementDecisionCategory.Allowed => "allowed",
        _ => "unavailable"
    };

    private static bool TryGetPositiveId(object? value, out long id)
    {
        id = value switch
        {
            long longValue => longValue,
            int intValue => intValue,
            _ => 0
        };
        return id > 0;
    }
}
