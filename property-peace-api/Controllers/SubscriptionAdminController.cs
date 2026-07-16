using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using brownstone_hub_api.Dtos.Subscription;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.SubscriptionService;
using brownstone_hub_api.Services.StripeService;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/admin/subscription")]
    [Authorize(Roles = "Admin")]
    public class SubscriptionAdminController : ControllerBase
    {
        private readonly ISubscriptionService _subscriptionService;
        private readonly ISubscriptionPlanService _planService;
        private readonly IStripeSyncService _stripeSyncService;
        private readonly ILogger<SubscriptionAdminController> _logger;

        public SubscriptionAdminController(
            ISubscriptionService subscriptionService,
            ISubscriptionPlanService planService,
            IStripeSyncService stripeSyncService,
            ILogger<SubscriptionAdminController> logger)
        {
            _subscriptionService = subscriptionService;
            _planService = planService;
            _stripeSyncService = stripeSyncService;
            _logger = logger;
        }

        /// <summary>
        /// Get all user subscriptions (admin only)
        /// </summary>
        [HttpGet("users")]
        public async Task<IActionResult> GetAllUserSubscriptions()
        {
            try
            {
                var response = await _subscriptionService.GetAllUserSubscriptionsAsync();
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all user subscriptions");
                return StatusCode(500, new { Message = "An error occurred while retrieving subscriptions" });
            }
        }

        /// <summary>
        /// Get subscription for a specific user (admin only)
        /// </summary>
        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetUserSubscription(long userId)
        {
            try
            {
                var response = await _subscriptionService.GetUserSubscriptionAsync(userId);
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting subscription for user {UserId}", userId);
                return StatusCode(500, new { Message = "An error occurred while retrieving subscription" });
            }
        }

        /// <summary>
        /// Admin: Assign subscription to user
        /// </summary>
        [HttpPost("assign")]
        public async Task<IActionResult> AssignSubscription([FromBody] AdminAssignSubscriptionDto assignDto)
        {
            try
            {
                var createDto = new CreateSubscriptionDto
                {
                    PlanId = assignDto.PlanId,
                    BillingCycle = assignDto.BillingCycle ?? "Monthly"
                };

                var response = await _subscriptionService.SubscribeAsync(assignDto.UserId, createDto);
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error assigning subscription to user {UserId}", assignDto.UserId);
                return StatusCode(500, new { Message = "An error occurred while assigning subscription" });
            }
        }

        /// <summary>
        /// Admin: Assign the hidden Lifetime Plan to a user without Stripe/payment setup.
        /// </summary>
        [HttpPost("assign-lifetime")]
        public async Task<IActionResult> AssignLifetimePlan([FromBody] AdminAssignLifetimePlanDto assignDto)
        {
            try
            {
                if (assignDto == null)
                {
                    return BadRequest(new ServiceResponse<SubscriptionDto>
                    {
                        Success = false,
                        StatusCode = 400,
                        Message = "Request body is required"
                    });
                }

                var response = await _subscriptionService.AssignLifetimePlanAsync(assignDto);
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode > 0 ? response.StatusCode : 400, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error assigning Lifetime Plan");
                return StatusCode(500, new { Message = "An error occurred while assigning the Lifetime Plan" });
            }
        }

        /// <summary>
        /// Admin: Extend trial period
        /// </summary>
        [HttpPost("extend-trial")]
        public async Task<IActionResult> ExtendTrial([FromBody] ExtendTrialDto extendDto)
        {
            try
            {
                var response = await _subscriptionService.ExtendTrialAsync(extendDto.UserId, extendDto.AdditionalDays);
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error extending trial for user {UserId}", extendDto.UserId);
                return StatusCode(500, new { Message = "An error occurred while extending trial" });
            }
        }

        /// <summary>
        /// Admin: Override property limit (temporary)
        /// </summary>
        [HttpPost("override-limit")]
        public Task<IActionResult> OverrideLimit([FromBody] OverrideLimitDto overrideDto)
        {
            try
            {
                // This would require adding an OverrideMaxProperties field to Subscription model
                // For now, we'll just log it
                _logger.LogInformation("Admin override limit requested for user {UserId}, new limit: {Limit}", 
                    overrideDto.UserId, overrideDto.MaxProperties);
                
                return Task.FromResult<IActionResult>(Ok(new { Message = "Override limit feature not yet implemented" }));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error overriding limit for user {UserId}", overrideDto.UserId);
                return Task.FromResult<IActionResult>(StatusCode(500, new { Message = "An error occurred while overriding limit" }));
            }
        }

        /// <summary>
        /// Get all subscription plans (admin)
        /// </summary>
        [HttpGet("plans")]
        public async Task<IActionResult> GetPlans()
        {
            try
            {
                var response = await _planService.GetAllPlansAsync();
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting subscription plans");
                return StatusCode(500, new { Message = "An error occurred while retrieving plans" });
            }
        }

        /// <summary>
        /// Create or update subscription plan (admin)
        /// </summary>
        [HttpPost("plans")]
        public async Task<IActionResult> CreateOrUpdatePlan([FromBody] SubscriptionPlanDto planDto)
        {
            try
            {
                ServiceResponse<SubscriptionPlanDto> response;
                if (planDto.Id > 0)
                {
                    response = await _planService.UpdatePlanAsync(planDto.Id, planDto);
                }
                else
                {
                    response = await _planService.CreatePlanAsync(planDto);
                }

                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating/updating subscription plan");
                return StatusCode(500, new { Message = "An error occurred while saving plan" });
            }
        }

        /// <summary>
        /// Update user subscription plan (admin)
        /// </summary>
        [HttpPost("subscription/{subscriptionId}/update-plan")]
        public async Task<IActionResult> UpdateSubscriptionPlan(long subscriptionId, [FromBody] AdminUpdateSubscriptionDto updateDto)
        {
            try
            {
                // Get subscription
                var subscriptionResponse = await _subscriptionService.GetUserSubscriptionAsync(updateDto.UserId);
                if (!subscriptionResponse.Success || subscriptionResponse.Data == null)
                {
                    return StatusCode(subscriptionResponse.StatusCode, subscriptionResponse);
                }

                var subscription = subscriptionResponse.Data;
                if (subscription.Id != subscriptionId)
                {
                    return BadRequest(new { Message = "Subscription ID mismatch" });
                }

                // Update subscription using existing upgrade/downgrade logic
                var updateSubscriptionDto = new UpdateSubscriptionDto
                {
                    NewPlanId = updateDto.NewPlanId,
                    Prorate = updateDto.Prorate
                };

                ServiceResponse<SubscriptionDto> response;
                if (updateDto.IsUpgrade)
                {
                    response = await _subscriptionService.UpgradeSubscriptionAsync(updateSubscriptionDto);
                }
                else
                {
                    response = await _subscriptionService.DowngradeSubscriptionAsync(updateSubscriptionDto);
                }

                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating subscription {SubscriptionId}", subscriptionId);
                return StatusCode(500, new { Message = "An error occurred while updating subscription" });
            }
        }

        /// <summary>
        /// Creates Stripe products + prices for any active paid plans that are missing them.
        /// Safe to run multiple times — skips plans that already have a StripeProductId.
        /// </summary>
        [HttpPost("provision-stripe")]
        public async Task<IActionResult> ProvisionStripeProducts()
        {
            try
            {
                var response = await _stripeSyncService.ProvisionMissingStripeProductsAsync();
                if (!response.Success)
                {
                    return StatusCode(500, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error provisioning Stripe products");
                return StatusCode(500, new { Message = "An error occurred while provisioning Stripe products" });
            }
        }

        /// <summary>
        /// Sync subscription plans from Stripe (updates Price IDs and Product IDs)
        /// </summary>
        [HttpPost("sync-stripe")]
        public async Task<IActionResult> SyncStripePlans()
        {
            try
            {
                var response = await _stripeSyncService.SyncPlansFromStripeAsync();
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode > 0 ? response.StatusCode : 500, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error syncing plans from Stripe");
                return StatusCode(500, new { Message = "An error occurred while syncing from Stripe" });
            }
        }

        /// <summary>
        /// Get all Stripe products for review (doesn't update database)
        /// </summary>
        [HttpGet("stripe-products")]
        public async Task<IActionResult> GetStripeProducts()
        {
            try
            {
                var response = await _stripeSyncService.GetStripeProductsAsync();
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode > 0 ? response.StatusCode : 500, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting Stripe products");
                return StatusCode(500, new { Message = "An error occurred while retrieving Stripe products" });
            }
        }

        /// <summary>
        /// Admin: Migrate all active subscriptions for a plan to the new price IDs
        /// </summary>
        [HttpPost("plans/{planId}/migrate-subscriptions")]
        public async Task<IActionResult> MigrateSubscriptionsToNewPrice(long planId, [FromQuery] bool prorate = true)
        {
            try
            {
                var response = await _subscriptionService.MigrateSubscriptionsToNewPriceAsync(planId, prorate);
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode > 0 ? response.StatusCode : 500, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error migrating subscriptions for plan {PlanId}", planId);
                return StatusCode(500, new { Message = "An error occurred while migrating subscriptions" });
            }
        }

        /// <summary>
        /// Admin: Sync subscriptions from database to Stripe and clean up unused prices
        /// </summary>
        [HttpPost("sync-and-cleanup")]
        public async Task<IActionResult> SyncSubscriptionsAndCleanupPrices()
        {
            try
            {
                // Step 1: Sync subscriptions to Stripe
                var syncResponse = await _stripeSyncService.SyncSubscriptionsToStripeAsync();
                
                // Step 2: Clean up unused prices
                var cleanupResponse = await _stripeSyncService.DeleteUnusedStripePricesAsync();

                var result = new
                {
                    SyncResult = syncResponse.Data,
                    CleanupResult = cleanupResponse.Data,
                    SyncSuccess = syncResponse.Success,
                    CleanupSuccess = cleanupResponse.Success,
                    OverallSuccess = syncResponse.Success && cleanupResponse.Success,
                    Messages = new List<string>
                    {
                        syncResponse.Message ?? "Subscription sync completed",
                        cleanupResponse.Message ?? "Price cleanup completed"
                    }
                };

                if (!syncResponse.Success && !cleanupResponse.Success)
                {
                    return StatusCode(500, result);
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error syncing subscriptions and cleaning up prices");
                return StatusCode(500, new { Message = "An error occurred while syncing and cleaning up" });
            }
        }

        /// <summary>
        /// Get orphaned subscriptions (subscriptions without Stripe IDs) - Admin only
        /// </summary>
        [HttpGet("orphaned")]
        public async Task<IActionResult> GetOrphanedSubscriptions()
        {
            try
            {
                var response = await _subscriptionService.GetOrphanedSubscriptionsAsync();
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting orphaned subscriptions");
                return StatusCode(500, new { Message = "An error occurred while retrieving orphaned subscriptions" });
            }
        }

        /// <summary>
        /// Fix a single orphaned subscription by creating it in Stripe - Admin only
        /// </summary>
        [HttpPost("orphaned/{subscriptionId}/fix")]
        public async Task<IActionResult> FixOrphanedSubscription(long subscriptionId)
        {
            try
            {
                var response = await _subscriptionService.FixOrphanedSubscriptionAsync(subscriptionId);
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fixing orphaned subscription {SubscriptionId}", subscriptionId);
                return StatusCode(500, new { Message = "An error occurred while fixing the orphaned subscription" });
            }
        }

        /// <summary>
        /// Fix all orphaned subscriptions - Admin only
        /// </summary>
        [HttpPost("orphaned/fix-all")]
        public async Task<IActionResult> FixAllOrphanedSubscriptions()
        {
            try
            {
                var response = await _subscriptionService.FixAllOrphanedSubscriptionsAsync();
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fixing all orphaned subscriptions");
                return StatusCode(500, new { Message = "An error occurred while fixing orphaned subscriptions" });
            }
        }
    }
}

