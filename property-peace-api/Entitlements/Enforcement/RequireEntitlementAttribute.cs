using System.Globalization;
using brownstone_hub_api.Entitlements.Decision;
using brownstone_hub_api.Entitlements.Policy;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace brownstone_hub_api.Entitlements.Enforcement;

/// <summary>Enforces a catalog feature against the middleware-selected organization.</summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = true)]
public sealed class RequireEntitlementAttribute(string featureKey) : Attribute, IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var feature = EntitlementCatalog.Features
            .SingleOrDefault(item => string.Equals(item.Key.Value, featureKey, StringComparison.Ordinal))?.Key;
        if (!feature.HasValue ||
            !TryGetPositiveId(context.HttpContext.Items["UserId"], out var userId) ||
            !TryGetPositiveId(context.HttpContext.Items["OrganizationId"], out var organizationId))
        {
            context.Result = new ForbidResult();
            return;
        }

        var service = context.HttpContext.RequestServices.GetRequiredService<IEntitlementDecisionService>();
        var decision = await service.DecideAsync(
            new EntitlementDecisionRequest(
                userId.ToString(CultureInfo.InvariantCulture),
                organizationId,
                feature.Value),
            context.HttpContext.RequestAborted);

        if (!decision.IsAllowed)
        {
            var infrastructureFailure = decision.Reason == EntitlementReasonCodes.PolicyError ||
                                        decision.Reason == EntitlementReasonCodes.FactsUnavailable;
            context.Result = new ObjectResult(new
            {
                Message = infrastructureFailure
                    ? "SMS availability cannot be confirmed right now."
                    : "This organization is not entitled to this SMS operation.",
                ReasonCode = decision.Reason.Value
            }) { StatusCode = infrastructureFailure ? StatusCodes.Status503ServiceUnavailable : StatusCodes.Status403Forbidden };
            return;
        }

        await next();
    }

    private static bool TryGetPositiveId(object? value, out long id)
    {
        id = value switch { long longValue => longValue, int intValue => intValue, _ => 0 };
        return id > 0;
    }
}
