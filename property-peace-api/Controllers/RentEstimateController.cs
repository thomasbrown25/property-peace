using brownstone_hub_api.Entitlements.Decision;
using brownstone_hub_api.Entitlements.Enforcement;
using brownstone_hub_api.Entitlements.Policy;
using brownstone_hub_api.Services.RentEstimateService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/rent-estimate")]
    [Authorize(Roles = "Landlord,Admin")]
    public class RentEstimateController(
        IRentEstimateService rentEstimateService,
        IEntitlementDecisionService entitlementDecisionService,
        IEntitlementResourceOrganizationResolver resourceOrganizationResolver,
        ILogger<RentEstimateController> logger) : ControllerBase
    {
        private readonly IRentEstimateService _rentEstimateService = rentEstimateService;
        private readonly IEntitlementDecisionService _entitlementDecisionService = entitlementDecisionService;
        private readonly IEntitlementResourceOrganizationResolver _resourceOrganizationResolver = resourceOrganizationResolver;
        private readonly ILogger<RentEstimateController> _logger = logger;

        /// <summary>
        /// GET /api/rent-estimate?propertyId=1&amp;unitId=2&amp;forceRefresh=true
        /// Returns a rent estimate for the selected organization's property.
        /// Subscription entitlement and Rentcast operational readiness are separate fail-closed decisions.
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetRentEstimate(
            [FromQuery] long propertyId,
            [FromQuery] long? unitId,
            [FromQuery] bool forceRefresh,
            CancellationToken cancellationToken)
        {
            if (!TryTrustedScope(out var userId, out var organizationId, out var scopeDenial))
                return scopeDenial!;

            if (propertyId <= 0)
                return BadRequest(new { success = false, message = "propertyId is required." });

            var resourceOrganizationId = await _resourceOrganizationResolver
                .GetPropertyOrganizationIdAsync(propertyId, cancellationToken);
            if (!resourceOrganizationId.HasValue)
                return NotFound(new { success = false, message = "Property not found." });

            var decision = await _entitlementDecisionService.DecideAsync(
                EntitlementEnforcement.Request(
                    userId,
                    organizationId,
                    FeatureKeys.RentEstimate,
                    resourceOrganizationId),
                cancellationToken);
            if (!EntitlementEnforcement.IsAllowed(FeatureKeys.RentEstimate, decision))
                return EntitlementEnforcement.Denied(FeatureKeys.RentEstimate, decision);

            try
            {
                var result = await _rentEstimateService.GetRentEstimateAsync(
                    propertyId,
                    unitId,
                    organizationId,
                    forceRefresh,
                    cancellationToken);

                return result.Outcome switch
                {
                    RentEstimateOutcome.Success when result.Data is not null => Ok(new { success = true, data = result.Data }),
                    RentEstimateOutcome.InvalidInput => BadRequest(new { success = false, code = "invalid-input", message = "The property or unit does not have valid rent-estimate inputs." }),
                    RentEstimateOutcome.NotFound => NotFound(new { success = false, code = "not-found", message = "The property or unit was not found." }),
                    _ => StatusCode(StatusCodes.Status503ServiceUnavailable, new { success = false, code = "provider-unavailable", message = "Rent estimates are temporarily unavailable. Try again later." })
                };
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching rent estimate for property {PropertyId}, unit {UnitId}", propertyId, unitId);
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new { success = false, code = "provider-unavailable", message = "Rent estimates are temporarily unavailable. Try again later." });
            }
        }

        private bool TryTrustedScope(out long userId, out long organizationId, out IActionResult? denial)
        {
            userId = HttpContext.Items["UserId"] switch
            {
                long value when value > 0 => value,
                int value when value > 0 => value,
                _ => 0
            };
            organizationId = HttpContext.Items["OrganizationId"] switch
            {
                long value when value > 0 => value,
                int value when value > 0 => value,
                _ => 0
            };

            denial = userId <= 0
                ? EntitlementEnforcement.MissingUser(FeatureKeys.RentEstimate)
                : organizationId <= 0
                    ? EntitlementEnforcement.MissingOrganization(FeatureKeys.RentEstimate)
                    : null;
            return denial is null;
        }
    }
}
