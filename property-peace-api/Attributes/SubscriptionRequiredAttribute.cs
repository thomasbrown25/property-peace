using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using brownstone_hub_api.Services.SubscriptionService;
using brownstone_hub_api.Services.UserService;
using System.Security.Claims;

namespace brownstone_hub_api.Attributes
{
    /// <summary>
    /// Attribute to require an active subscription for an action
    /// </summary>
    public class SubscriptionRequiredAttribute : ActionFilterAttribute
    {
        public override async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            var subscriptionService = context.HttpContext.RequestServices.GetRequiredService<ISubscriptionService>();
            var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<SubscriptionRequiredAttribute>>();

            try
            {
                // Check subscription status (service gets userId internally from authenticated user)
                var statusResponse = await subscriptionService.GetSubscriptionStatusAsync();
                if (!statusResponse.Success || statusResponse.Data == null)
                {
                    context.Result = new ObjectResult(new { Message = "Unable to verify subscription status" })
                    {
                        StatusCode = 500
                    };
                    return;
                }

                var status = statusResponse.Data;
                if (!status.HasActiveSubscription)
                {
                    context.Result = new ObjectResult(new 
                    { 
                        Message = "An active subscription is required",
                        RequiresSubscription = true,
                        CanStartTrial = status.Subscription == null
                    })
                    {
                        StatusCode = 403
                    };
                    return;
                }

                await next();
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error checking subscription requirement");
                context.Result = new ObjectResult(new { Message = "Error verifying subscription" })
                {
                    StatusCode = 500
                };
            }
        }
    }
}

