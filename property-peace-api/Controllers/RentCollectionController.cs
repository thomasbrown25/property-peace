using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Helpers;
using brownstone_hub_api.Middleware;
using brownstone_hub_api.Services.RentCollectionService;
using brownstone_hub_api.Services.LeaseService;
using brownstone_hub_api.Services.PropertyService;
using brownstone_hub_api.Services.UserService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/rent-collection")]
    public class RentCollectionController(
        IRentCollectionService rentCollectionService,
        ILeaseService leaseService,
        IPropertyService propertyService,
        IUserService userService) : ControllerBase
    {
        private readonly IRentCollectionService _rentCollectionService = rentCollectionService;
        private readonly ILeaseService _leaseService = leaseService;
        private readonly IPropertyService _propertyService = propertyService;
        private readonly IUserService _userService = userService;

        [Authorize(Roles = "Landlord,Admin")]
        [HttpGet("")]
        public async Task<IActionResult> GetRentCollection([FromQuery] long? propertyId = null, [FromQuery] long? leaseId = null, [FromQuery] bool lifetime = false, [FromQuery] string? month = null)
        {
            DateTime? period = null;
            if (month != null)
            {
                if (!System.Text.RegularExpressions.Regex.IsMatch(month, @"^\d{4}-(0[1-9]|1[0-2])$")
                    || !DateTime.TryParseExact(month + "-01", "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var parsedMonth))
                    return BadRequest(new { Message = "Month must be YYYY-MM" });
                period = parsedMonth;
            }
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var response = await _rentCollectionService.GetRentCollection(organizationId.Value, propertyId, leaseId, lifetime, period);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin,Tenant")]
        [HttpGet("tenant/my-rent")]
        [TenantSelfOrganization]
        public async Task<IActionResult> GetMyRentCollection([FromQuery] long? leaseId = null)
        {
            // Get current user ID from JWT token
            long? userId = null;
            var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim))
            {
                userIdClaim = User?.FindFirst("userId")?.Value;
            }

            if (!string.IsNullOrEmpty(userIdClaim) && long.TryParse(userIdClaim, out var parsedUserId))
            {
                userId = parsedUserId;
            }
            else
            {
                // If user ID not in claims, look up by email
                var email = User?.FindFirst("sub")?.Value;
                if (string.IsNullOrEmpty(email))
                {
                    email = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                }
                if (string.IsNullOrEmpty(email))
                {
                    email = User?.FindFirst(ClaimTypes.Name)?.Value;
                }

                if (!string.IsNullOrEmpty(email))
                {
                    try
                    {
                        var userResponse = await _userService.GetUserByEmailAsync(email);
                        if (userResponse.Success && userResponse.Data != null)
                        {
                            userId = userResponse.Data.Id;
                        }
                    }
                    catch (Exception)
                    {
                        return Unauthorized(new { Message = "Unable to retrieve user information" });
                    }
                }
            }

            if (!userId.HasValue)
            {
                return Unauthorized(new { Message = "User ID not found in token" });
            }

            // Get tenant's leases
            var leaseResponse = await _leaseService.GetLeasesByTenantUserId(userId.Value);
            if (!leaseResponse.Success || leaseResponse.Data == null || !leaseResponse.Data.Any())
            {
                return NotFound(new { Message = "No active leases found for tenant" });
            }

            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });
            // Use only this tenant's leases in the verified organization.
            var lease = leaseId.HasValue
                ? leaseResponse.Data.FirstOrDefault(l => l.Id == leaseId.Value && l.OrganizationId == organizationId.Value)
                : leaseResponse.Data.FirstOrDefault(l => l.OrganizationId == organizationId.Value);

            if (lease == null)
            {
                return NotFound(new { Message = "Lease not found for tenant" });
            }

            if (lease.OrganizationId != organizationId.Value)
                return StatusCode(403, new { Message = "Lease does not belong to the selected organization" });

            // Verify the property is in the canonical lease-derived organization.
            var propertyResponse = await _propertyService.GetPropertyById(lease.PropertyId);
            if (!propertyResponse.Success || propertyResponse.Data == null)
            {
                return NotFound(new { Message = "Property not found for lease" });
            }

            if (propertyResponse.Data.OrganizationId != organizationId.Value)
                return StatusCode(403, new { Message = "Property does not belong to the selected organization" });
            // Get rent collection for the tenant's property (filtered to their lease)
            var response = await _rentCollectionService.GetRentCollection(organizationId.Value, lease.PropertyId, lease.Id);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            // Filter rent records to only show the tenant's lease
            if (response.Data != null && response.Data.RentRecords != null)
            {
                response.Data.RentRecords = response.Data.RentRecords.Where(r => r.LeaseId == lease.Id).ToList();
            }

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpPost("payment")]
        [ManualPaymentWrite]
        public async Task<IActionResult> AddPayment([FromBody] AddPaymentDto newPayment)
        {
            // Get current user ID for tracking who created the payment (landlord manual entry)
            long? userId = null;
            var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim))
            {
                userIdClaim = User?.FindFirst("userId")?.Value;
            }

            if (!string.IsNullOrEmpty(userIdClaim) && long.TryParse(userIdClaim, out var parsedUserId))
            {
                userId = parsedUserId;
            }
            else
            {
                // If user ID not in claims, look up by email (from Sub claim)
                var email = User?.FindFirst("sub")?.Value;
                if (string.IsNullOrEmpty(email))
                {
                    email = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                }
                if (string.IsNullOrEmpty(email))
                {
                    email = User?.FindFirst(ClaimTypes.Name)?.Value;
                }

                if (!string.IsNullOrEmpty(email))
                {
                    var userResponse = await _userService.GetUserByEmailAsync(email);
                    if (userResponse.Success && userResponse.Data != null)
                    {
                        userId = userResponse.Data.Id;
                    }
                }
            }

            if (!userId.HasValue)
                return Unauthorized(new { Message = "Authenticated user context is required" });

            // This is a manual-entry endpoint. Never accept provider identity or status
            // from the browser; Stripe orchestration owns those fields.
            newPayment.CreatedByUserId = userId.Value;
            newPayment.Method = "Manual Entry";
            newPayment.Status = "Completed";
            newPayment.StripePaymentIntentId = null;
            newPayment.StripePaymentMethodId = null;

            var response = await _rentCollectionService.AddPayment(newPayment);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpPost("send-reminder/{leaseId}")]
        public async Task<IActionResult> SendRentReminder(long leaseId)
        {
            var response = await _rentCollectionService.SendRentReminder(leaseId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }
    }
}