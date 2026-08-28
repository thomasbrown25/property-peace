using System.Security.Claims;
using brownstone_hub_api.Attributes;
using brownstone_hub_api.Dtos.Stripe;
using brownstone_hub_api.Filters;
using brownstone_hub_api.Helpers;
using brownstone_hub_api.Services.RentPaymentAccess;
using brownstone_hub_api.Services.StripeRentPayments;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/stripe/connect-preparation")]
    [Authorize(Roles = "Landlord,Admin")]
    [RequireOrganizationRole("Owner", "Manager")]
    [RequireRentPaymentActionReady(RentPaymentAction.Configure)]
    public sealed class StripeConnectPreparationController(IStripeConnectPreparationService service) : ControllerBase
    {
        [HttpGet]
        public async Task<ActionResult<StripeConnectPreparationDto?>> Get(CancellationToken cancellationToken)
        {
            var scope = GetScope();
            if (scope.Result != null) return scope.Result;
            return Ok(await service.GetAsync(scope.UserId, scope.OrganizationId, cancellationToken));
        }

        [HttpPost]
        public async Task<ActionResult<StripeConnectPreparationDto>> Save(
            [FromBody] SaveStripeConnectPreparationRequest request, CancellationToken cancellationToken)
        {
            var scope = GetScope();
            if (scope.Result != null) return scope.Result;

            try
            {
                return Ok(await service.SaveAsync(scope.UserId, scope.OrganizationId, request, cancellationToken));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
        }

        private (long UserId, long OrganizationId, ActionResult? Result) GetScope()
        {
            var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("userId");
            if (!long.TryParse(userIdValue, out var userId) || userId <= 0)
                return (0, 0, Unauthorized(new { message = "Authenticated user context is required." }));

            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return (0, 0, StatusCode(StatusCodes.Status403Forbidden,
                    new { message = "Organization context is required." }));

            return (userId, organizationId.Value, null);
        }
    }
}
