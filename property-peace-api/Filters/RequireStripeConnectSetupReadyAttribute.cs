using System.Security.Claims;
using brownstone_hub_api.Services.StripeRentPayments;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace brownstone_hub_api.Filters;

/// <summary>Connect setup is independent of rent collection approval and its emergency intake switch.</summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public sealed class RequireStripeConnectSetupReadyAttribute : Attribute, IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var http = context.HttpContext;
        if (http.User.Identity?.IsAuthenticated != true ||
            http.Items["UserId"] is not long userId || userId <= 0 ||
            http.Items["OrganizationId"] is not long organizationId || organizationId <= 0 ||
            !long.TryParse(http.User.FindFirst(ClaimTypes.NameIdentifier)?.Value ??
                http.User.FindFirst("userId")?.Value, out var claimUserId) || claimUserId != userId)
        {
            context.Result = new ObjectResult(new { Message = "Authenticated organization owner is required" })
                { StatusCode = StatusCodes.Status403Forbidden };
            return;
        }

        var secret = http.RequestServices.GetRequiredService<IConfiguration>()["Stripe:SecretKey"];
        if (string.IsNullOrWhiteSpace(secret) ||
            !(secret.StartsWith("sk_test_", StringComparison.Ordinal) || secret.StartsWith("sk_live_", StringComparison.Ordinal)) ||
            secret.Contains("placeholder", StringComparison.OrdinalIgnoreCase) ||
            secret.Contains("your_", StringComparison.OrdinalIgnoreCase) ||
            secret.Contains("redacted", StringComparison.OrdinalIgnoreCase))
        {
            context.Result = new ObjectResult(new { Message = "Stripe Connect setup is unavailable" })
                { StatusCode = StatusCodes.Status503ServiceUnavailable };
            return;
        }

        try
        {
            var payees = http.RequestServices.GetRequiredService<IStripeConnectedPayeeService>();
            var owned = await payees.ResolveOwnedAccountForOnboardingAsync(userId, organizationId, http.RequestAborted);
            if (owned == null || owned.UserId != userId)
            {
                context.Result = new ObjectResult(new { Message = "Connected account ownership is not authorized" })
                    { StatusCode = StatusCodes.Status403Forbidden };
                return;
            }
        }
        catch (OperationCanceledException) when (http.RequestAborted.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception)
        {
            context.Result = new ObjectResult(new { Message = "Stripe Connect authorization is unavailable" })
                { StatusCode = StatusCodes.Status503ServiceUnavailable };
            return;
        }

        await next();
    }
}
