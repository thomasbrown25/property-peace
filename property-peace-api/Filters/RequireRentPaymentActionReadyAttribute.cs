using brownstone_hub_api.Services.RentPaymentAccess;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace brownstone_hub_api.Filters;

/// <summary>Enforces a server-resolved rent-payment action against middleware-owned organization scope.</summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = true)]
public sealed class RequireRentPaymentActionReadyAttribute : Attribute, IAsyncActionFilter
{
    private static readonly IReadOnlyList<string> UnavailableBlockers =
        ["provider_disabled", "access_not_approved", "actor_not_authorized"];

    private readonly RentPaymentAction _action;

    public RequireRentPaymentActionReadyAttribute(RentPaymentAction action)
    {
        if (!Enum.IsDefined(action) || action == RentPaymentAction.RequestAccess)
            throw new ArgumentOutOfRangeException(nameof(action), action,
                "RequestAccess has separate owner/manager authorization and must not use the readiness filter.");

        _action = action;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        if (!TryGetPositiveId(context.HttpContext.Items["UserId"], out var userId) ||
            !TryGetPositiveId(context.HttpContext.Items["OrganizationId"], out var organizationId))
        {
            context.Result = Denied(_action, ["actor_not_authorized"]);
            return;
        }

        try
        {
            var service = context.HttpContext.RequestServices.GetRequiredService<IRentPaymentActionReadinessService>();
            var readiness = await service.EvaluateAsync(userId, organizationId, _action, context.HttpContext.RequestAborted);
            if (!readiness.Allowed)
            {
                context.Result = string.Equals(readiness.AccessStatus, "Unavailable", StringComparison.OrdinalIgnoreCase)
                    ? Unavailable(_action, readiness.Blockers)
                    : Denied(_action, readiness.Blockers);
                return;
            }
        }
        catch (OperationCanceledException) when (context.HttpContext.RequestAborted.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception)
        {
            context.Result = Unavailable(_action);
            return;
        }

        await next();
    }

    private static ObjectResult Denied(RentPaymentAction action, IReadOnlyList<string> blockers) => new(new
    {
        Message = "This rent-payment action is not ready for use.",
        Action = action,
        Blockers = blockers
    }) { StatusCode = StatusCodes.Status403Forbidden };

    private static ObjectResult Unavailable(RentPaymentAction action, IReadOnlyList<string>? blockers = null) => new(new
    {
        Message = "Rent-payment availability cannot be confirmed right now.",
        Action = action,
        Blockers = blockers ?? UnavailableBlockers
    }) { StatusCode = StatusCodes.Status503ServiceUnavailable };

    private static bool TryGetPositiveId(object? value, out int id)
    {
        var longValue = value switch
        {
            long longId => longId,
            int intId => intId,
            _ => 0
        };
        id = longValue is > 0 and <= int.MaxValue ? (int)longValue : 0;
        return id > 0;
    }
}
