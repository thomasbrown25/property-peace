using brownstone_hub_api.Dtos.Vendor;
using brownstone_hub_api.Services.UserService;
using brownstone_hub_api.Services.VendorService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/vendor")]
    [Authorize(Roles = "Landlord,Admin")]
    public class VendorController(
        IVendorService vendorService,
        IUserService userService) : ControllerBase
    {
        private readonly IVendorService _vendorService = vendorService;
        private readonly IUserService _userService = userService;

        [HttpGet("")]
        public async Task<IActionResult> GetVendors([FromQuery] long landlordId, [FromQuery] bool includeInactive = false)
        {
            var response = await _vendorService.GetVendorsByLandlordId(landlordId, includeInactive);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [HttpGet("{vendorId}")]
        public async Task<IActionResult> GetVendorById(long vendorId)
        {
            var response = await _vendorService.GetVendorById(vendorId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [HttpPost("")]
        public async Task<IActionResult> AddVendor([FromBody] AddVendorDto vendorDto)
        {
            // Get current user ID if not provided
            if (vendorDto.LandlordId == 0)
            {
                var userIdResponse = await _userService.GetCurrentUserIdAsync();
                if (!userIdResponse.Success || !userIdResponse.Data.HasValue)
                {
                    return Unauthorized(new { Message = "User not found" });
                }
                vendorDto.LandlordId = userIdResponse.Data.Value;
            }

            var response = await _vendorService.AddVendor(vendorDto);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [HttpPut("{vendorId}")]
        public async Task<IActionResult> UpdateVendor(long vendorId, [FromBody] UpdateVendorDto vendorDto)
        {
            vendorDto.Id = vendorId;

            var response = await _vendorService.UpdateVendor(vendorDto);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [HttpDelete("{vendorId}")]
        public async Task<IActionResult> DeleteVendor(long vendorId, [FromQuery] bool softDelete = true)
        {
            ServiceResponse<bool> response;
            
            if (softDelete)
            {
                response = await _vendorService.SoftDeleteVendor(vendorId);
            }
            else
            {
                response = await _vendorService.DeleteVendor(vendorId);
            }

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [HttpGet("search")]
        public async Task<IActionResult> SearchVendors([FromQuery] long landlordId, [FromQuery] string? q, [FromQuery] string? category = null)
        {
            var searchTerm = q ?? string.Empty;
            var response = await _vendorService.SearchVendors(landlordId, searchTerm, category);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [HttpGet("categories")]
        public IActionResult GetVendorCategories()
        {
            // Common vendor categories
            var categories = new[]
            {
                "Plumber",
                "Electrician",
                "HVAC",
                "General Contractor",
                "Carpenter",
                "Painter",
                "Landscaper",
                "Roofer",
                "Appliance Repair",
                "Locksmith",
                "Cleaning Service",
                "Pest Control",
                "Property Management",
                "Legal Services",
                "Accounting/Bookkeeping",
                "Insurance",
                "Other"
            };

            return Ok(new { categories });
        }
    }
}

