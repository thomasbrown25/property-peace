using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using brownstone_hub_api.Dtos.Subscription;
using brownstone_hub_api.Services.SubscriptionService;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/subscription")]
    public class SubscriptionController : ControllerBase
    {
        private readonly ISubscriptionService _subscriptionService;
        private readonly ILogger<SubscriptionController> _logger;

        public SubscriptionController(
            ISubscriptionService subscriptionService,
            ILogger<SubscriptionController> logger)
        {
            _subscriptionService = subscriptionService;
            _logger = logger;
        }


        /// <summary>
        /// Get all available subscription plans
        /// </summary>
        [HttpGet("plans")]
        public async Task<IActionResult> GetPlans()
        {
            try
            {
                var response = await _subscriptionService.GetAvailablePlansAsync();
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
        /// Get current user's subscription
        /// </summary>
        [HttpGet("current")]
        [Authorize(Roles = "Landlord,Admin,Tenant")]
        public async Task<IActionResult> GetCurrentSubscription()
        {
            try
            {
                var response = await _subscriptionService.GetUserSubscriptionAsync();
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting current subscription");
                return StatusCode(500, new { Message = "An error occurred while retrieving subscription" });
            }
        }

        /// <summary>
        /// Create a new subscription
        /// </summary>
        [HttpPost("subscribe")]
        [Authorize(Roles = "Landlord,Admin,Tenant")]
        public async Task<IActionResult> Subscribe([FromBody] CreateSubscriptionDto createDto)
        {
            try
            {
                var response = await _subscriptionService.SubscribeAsync(createDto);
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating subscription");
                return StatusCode(500, new { Message = "An error occurred while creating subscription" });
            }
        }

        /// <summary>
        /// Upgrade subscription to a higher tier
        /// </summary>
        [HttpPost("upgrade")]
        [Authorize(Roles = "Landlord,Admin,Tenant")]
        public async Task<IActionResult> Upgrade([FromBody] UpdateSubscriptionDto updateDto)
        {
            try
            {
                var response = await _subscriptionService.UpgradeSubscriptionAsync(updateDto);
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error upgrading subscription");
                return StatusCode(500, new { Message = "An error occurred while upgrading subscription" });
            }
        }

        /// <summary>
        /// Downgrade subscription to a lower tier
        /// </summary>
        [HttpPost("downgrade")]
        [Authorize(Roles = "Landlord,Admin,Tenant")]
        public async Task<IActionResult> Downgrade([FromBody] UpdateSubscriptionDto updateDto)
        {
            try
            {
                var response = await _subscriptionService.DowngradeSubscriptionAsync(updateDto);
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error downgrading subscription");
                return StatusCode(500, new { Message = "An error occurred while downgrading subscription" });
            }
        }

        /// <summary>
        /// Cancel subscription
        /// </summary>
        [HttpPost("cancel")]
        [Authorize(Roles = "Landlord,Admin,Tenant")]
        public async Task<IActionResult> Cancel([FromQuery] bool cancelAtPeriodEnd = true)
        {
            try
            {
                var response = await _subscriptionService.CancelSubscriptionAsync(cancelAtPeriodEnd);
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cancelling subscription");
                return StatusCode(500, new { Message = "An error occurred while cancelling subscription" });
            }
        }

        /// <summary>
        /// Resume a cancelled subscription
        /// </summary>
        [HttpPost("resume")]
        [Authorize(Roles = "Landlord,Admin,Tenant")]
        public async Task<IActionResult> Resume()
        {
            try
            {
                var response = await _subscriptionService.ResumeSubscriptionAsync();
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resuming subscription");
                return StatusCode(500, new { Message = "An error occurred while resuming subscription" });
            }
        }

        /// <summary>
        /// Pause subscription
        /// </summary>
        [HttpPost("pause")]
        [Authorize(Roles = "Landlord,Admin,Tenant")]
        public async Task<IActionResult> Pause([FromQuery] bool pauseAtPeriodEnd = true)
        {
            try
            {
                var response = await _subscriptionService.PauseSubscriptionAsync(pauseAtPeriodEnd);
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error pausing subscription");
                return StatusCode(500, new { Message = "An error occurred while pausing subscription" });
            }
        }

        /// <summary>
        /// Resume a paused subscription
        /// </summary>
        [HttpPost("resume-paused")]
        [Authorize(Roles = "Landlord,Admin,Tenant")]
        public async Task<IActionResult> ResumePaused()
        {
            try
            {
                var response = await _subscriptionService.ResumePausedSubscriptionAsync();
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resuming paused subscription");
                return StatusCode(500, new { Message = "An error occurred while resuming paused subscription" });
            }
        }

        /// <summary>
        /// Retired trial endpoint retained for client compatibility.
        /// </summary>
        [HttpPost("start-trial")]
        [Authorize(Roles = "Landlord,Admin,Tenant")]
        public Task<IActionResult> StartTrial()
            => Task.FromResult<IActionResult>(
                StatusCode(StatusCodes.Status410Gone, new { Message = "Trials are no longer available." }));

        /// <summary>
        /// Get subscription status and limits
        /// </summary>
        [HttpGet("status")]
        [Authorize(Roles = "Landlord,Admin,Tenant")]
        public async Task<IActionResult> GetStatus()
        {
            try
            {
                var response = await _subscriptionService.GetSubscriptionStatusAsync();
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting subscription status");
                return StatusCode(500, new { Message = "An error occurred while retrieving subscription status" });
            }
        }

        /// <summary>
        /// Get payment history/invoices for current user
        /// </summary>
        [HttpGet("payment-history")]
        [Authorize(Roles = "Landlord,Admin,Tenant")]
        public async Task<IActionResult> GetPaymentHistory()
        {
            try
            {
                var response = await _subscriptionService.GetPaymentHistoryAsync();
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting payment history");
                return StatusCode(500, new { Message = "An error occurred while retrieving payment history" });
            }
        }

        /// <summary>
        /// Create Stripe customer portal session for managing subscription
        /// </summary>
        [HttpPost("customer-portal")]
        [Authorize(Roles = "Landlord,Admin,Tenant")]
        public async Task<IActionResult> CreateCustomerPortalSession([FromBody] CreateCustomerPortalSessionDto request)
        {
            try
            {
                var returnUrl = request.ReturnUrl ?? $"{Request.Scheme}://{Request.Host}/landlord/subscription";
                var response = await _subscriptionService.CreateCustomerPortalSessionAsync(returnUrl);
                
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating customer portal session");
                return StatusCode(500, new { Message = "An error occurred while creating customer portal session" });
            }
        }

        /// <summary>
        /// Create Stripe checkout session for subscription
        /// </summary>
        [HttpPost("checkout-session")]
        [Authorize(Roles = "Landlord,Admin,Tenant")]
        public async Task<IActionResult> CreateCheckoutSession([FromBody] CreateCheckoutSessionDto createDto)
        {
            try
            {
                // Set default URLs if not provided
                var baseUrl = $"{Request.Scheme}://{Request.Host}";
                createDto.SuccessUrl = createDto.SuccessUrl ?? $"{baseUrl}/landlord/subscription?success=true";
                createDto.CancelUrl = createDto.CancelUrl ?? $"{baseUrl}/landlord/subscription?canceled=true";

                var response = await _subscriptionService.CreateCheckoutSessionAsync(createDto);
                
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating checkout session");
                return StatusCode(500, new { Message = "An error occurred while creating checkout session" });
            }
        }

        /// <summary>
        /// Sync subscription from Stripe (useful if webhook was missed)
        /// </summary>
        [HttpPost("sync")]
        [Authorize(Roles = "Landlord,Admin,Tenant")]
        public async Task<IActionResult> SyncSubscriptionFromStripe([FromBody] SyncSubscriptionDto request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.StripeSubscriptionId))
                {
                    return BadRequest(new { Message = "Stripe subscription ID is required" });
                }

                var response = await _subscriptionService.SyncSubscriptionFromStripeAsync(request.StripeSubscriptionId);
                
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error syncing subscription from Stripe");
                return StatusCode(500, new { Message = "An error occurred while syncing subscription" });
            }
        }
    }
}

