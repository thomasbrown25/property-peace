using System.Security.Claims;
using brownstone_hub_api.Services.FeatureReadiness;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace brownstone_hub_api.Filters;

[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = true)]
public sealed class RequireFeatureReadyAttribute(string feature) : Attribute, IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var readinessService = context.HttpContext.RequestServices.GetRequiredService<IFeatureReadinessService>();
        var idValue = context.HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!long.TryParse(idValue, out var userId))
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        var organizationId = context.HttpContext.Items.TryGetValue("OrganizationId", out var value) &&
                             value is long canonicalOrganizationId && canonicalOrganizationId > 0
            ? canonicalOrganizationId
            : (long?)null;
        var readiness = await readinessService.GetAsync(userId, organizationId, feature);
        if (!readiness.CanInvoke)
        {
            context.Result = new ObjectResult(new
            {
                Message = "This feature is not ready for use.",
                readiness.Feature,
                readiness.State,
                readiness.Blockers,
            }) { StatusCode = StatusCodes.Status403Forbidden };
            return;
        }

        await next();
    }
}
