using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Helpers;
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

        [Authorize(Roles = "Landlord,Admin,Tenant")]
        [HttpGet("")]
        public async Task<IActionResult> GetRentCollection([FromQuery] long? propertyId = null, [FromQuery] long? leaseId = null, [FromQuery] bool lifetime = false)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var response = await _rentCollectionService.GetRentCollection(organizationId.Value, propertyId, leaseId, lifetime);

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

            // Use the requested lease when provided, but only if it belongs to this tenant.
            var lease = leaseId.HasValue
                ? leaseResponse.Data.FirstOrDefault(l => l.Id == leaseId.Value)
                : leaseResponse.Data.First();

            if (lease == null)
            {
                return NotFound(new { Message = "Lease not found for tenant" });
            }

            // Get property to get landlordId
            var propertyResponse = await _propertyService.GetPropertyById(lease.PropertyId);
            if (!propertyResponse.Success || propertyResponse.Data == null)
            {
                return NotFound(new { Message = "Property not found for lease" });
            }

            var landlordId = propertyResponse.Data.LandlordId;
            // Get rent collection for the tenant's property (filtered to their lease)
            var response = await _rentCollectionService.GetRentCollection(landlordId, lease.PropertyId, lease.Id);

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

        [Authorize]
        [HttpPost("payment")]
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

            // Only set CreatedByUserId for landlords/admins (manual entries)
            if (userId.HasValue)
            {
                var userRoles = User?.FindAll(ClaimTypes.Role)?.Select(c => c.Value).ToList();
                if (userRoles != null && (userRoles.Contains("Landlord") || userRoles.Contains("Admin")))
                {
                    newPayment.CreatedByUserId = userId.Value;
                }
            }

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