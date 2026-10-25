using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Services.PaymentService;
using brownstone_hub_api.Services.Payments;
using brownstone_hub_api.Services.UserService;
using brownstone_hub_api.Helpers;
using brownstone_hub_api.Middleware;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Tenant,Landlord,Admin")]
    public class PaymentController(
        IPaymentService paymentService,
        IUserService userService,
        LeaseChargeLedger? chargeLedger = null) : ControllerBase
    {
        private readonly IPaymentService paymentService = paymentService;
        private readonly IUserService userService = userService;

        [Authorize(Roles = "Tenant")]
        [HttpGet("{leaseId}/tenant-charges")]
        [TenantSelfOrganization(allowWithoutOrganization: true)]
        public async Task<IActionResult> GetTenantLeaseCharges(long leaseId)
        {
            var userId = await GetCurrentUserIdAsync();
            if (!userId.HasValue)
                return Unauthorized(new { Message = "Authenticated user context is required" });
            // A headerless self-read uses the lease-derived organization. With an
            // explicit selection, require middleware-validated authority for that org.
            long? selectedOrganizationId = null;
            if (Request.Headers.ContainsKey("X-Organization-Id"))
            {
                selectedOrganizationId = this.GetCurrentOrganizationIdOrForbid();
                if (!selectedOrganizationId.HasValue)
                    return StatusCode(403, new { Message = "Organization context is required" });
            }
            var charges = await chargeLedger!.ForTenant(leaseId, userId.Value, selectedOrganizationId: selectedOrganizationId);
            return charges == null ? StatusCode(403, new { Message = "Access denied to this lease" }) : Ok(charges);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpGet("{leaseId}/charges")]
        public async Task<IActionResult> GetLeaseCharges(long leaseId)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });
            var charges = await chargeLedger!.ForLandlord(leaseId, organizationId.Value);
            return charges == null ? StatusCode(403, new { Message = "Access denied to this lease" }) : Ok(charges);
        }

        private async Task<long?> GetCurrentUserIdAsync()
        {
            var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                           ?? User?.FindFirst("userId")?.Value;

            if (!string.IsNullOrEmpty(userIdClaim) && long.TryParse(userIdClaim, out var parsed))
                return parsed;

            var email = User?.FindFirst("sub")?.Value
                     ?? User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                     ?? User?.FindFirst(ClaimTypes.Name)?.Value;

            if (!string.IsNullOrEmpty(email))
            {
                var userResponse = await userService.GetUserByEmailAsync(email);
                if (userResponse.Success && userResponse.Data != null)
                    return userResponse.Data.Id;
            }

            return null;
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpPost]
        [ManualPaymentWrite]
        public async Task<IActionResult> AddPayment(AddPaymentDto newPayment)
        {
            var userId = await GetCurrentUserIdAsync();
            if (!userId.HasValue)
                return Unauthorized(new { Message = "Authenticated user context is required" });
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            // This is a manual-entry endpoint. Provider provenance and lifecycle state are
            // written only by the Stripe orchestration/webhook path.
            newPayment.CreatedByUserId = userId.Value;
            newPayment.Method = "Manual Entry";
            newPayment.Status = "Completed";
            newPayment.StripePaymentIntentId = null;
            newPayment.StripePaymentMethodId = null;
            var response = await paymentService.AddManualPayment(newPayment, organizationId.Value);
            if (!response.Success)
            {
                if (response.StatusCode == 403)
                    return StatusCode(403, new { Message = response.Message });
                return BadRequest(response.Message);
            }
            return Ok(response.Data);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpGet("{leaseId}")]
        public async Task<IActionResult> GetPaymentsByLeaseId(long leaseId)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });
            var response = await paymentService.GetPaymentsByLeaseId(leaseId, organizationId.Value);
            if (!response.Success)
            {
                if (response.StatusCode == 403)
                    return StatusCode(403, new { Message = response.Message });
                return BadRequest(response.Message);
            }
            return Ok(response.Data);
        }

        [Authorize(Roles = "Tenant")]
        [HttpGet("{leaseId}/tenant-history")]
        [TenantSelfOrganization(allowWithoutOrganization: true)]
        public async Task<IActionResult> GetTenantLeasePaymentHistory(long leaseId)
        {
            var userId = await GetCurrentUserIdAsync();
            if (!userId.HasValue)
                return Unauthorized(new { Message = "Authenticated user context is required" });

            var response = await paymentService.GetTenantLeasePaymentHistory(leaseId, userId.Value);
            if (!response.Success)
            {
                if (response.StatusCode == 403)
                    return StatusCode(403, new { Message = response.Message });
                return BadRequest(new { Message = response.Message });
            }

            return Ok(response.Data);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpPut("{paymentId}")]
        public async Task<IActionResult> UpdatePayment(long paymentId, [FromBody] UpdatePaymentDto updatePayment)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
            {
                return StatusCode(403, new { Message = "Organization context is required" });
            }

            var response = await paymentService.UpdatePayment(paymentId, updatePayment, organizationId.Value);
            if (!response.Success)
            {
                if (response.StatusCode == 404)
                    return NotFound(new { Message = response.Message });
                return BadRequest(response.Message);
            }
            return Ok(response.Data);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpGet("all")]
        public async Task<IActionResult> GetAllPayments([FromQuery] long? propertyId = null, [FromQuery] long? unitId = null)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
            {
                return StatusCode(403, new { Message = "Organization context is required" });
            }

            var response = await paymentService.GetAllPayments(organizationId.Value, propertyId, unitId);
            if (!response.Success)
            {
                return BadRequest(response.Message);
            }
            return Ok(response.Data);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpGet("tenant/{tenantId}")]
        public async Task<IActionResult> GetPaymentHistoryByTenantId(long tenantId)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
            {
                return StatusCode(403, new { Message = "Organization context is required" });
            }

            var response = await paymentService.GetPaymentHistoryByTenantId(tenantId, organizationId.Value);
            if (!response.Success)
            {
                if (response.StatusCode == 403)
                    return StatusCode(403, new { Message = response.Message });
                if (response.StatusCode == 404)
                    return NotFound(new { Message = response.Message });
                return BadRequest(response.Message);
            }
            return Ok(response.Data);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpDelete("{paymentId}")]
        public async Task<IActionResult> DeletePayment(long paymentId)
        {
            var userId = await GetCurrentUserIdAsync();
            var response = await paymentService.DeletePayment(paymentId, userId);
            if (!response.Success)
            {
                if (response.StatusCode == 403)
                {
                    return StatusCode(403, response.Message);
                }
                return BadRequest(response.Message);
            }
            return Ok(response.Data);
        }
    }
}
