using brownstone_hub_api.Services.PropertyRecordService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/property-records")]
    [Authorize(Roles = "Landlord,Admin")]
    public class PropertyRecordsController(
        IPropertyRecordService propertyRecordService,
        ILogger<PropertyRecordsController> logger) : ControllerBase
    {
        private readonly IPropertyRecordService _propertyRecordService = propertyRecordService;
        private readonly ILogger<PropertyRecordsController> _logger = logger;

        [HttpGet("prefill")]
        public async Task<IActionResult> GetPrefill(
            [FromQuery] string streetAddress,
            [FromQuery] string city,
            [FromQuery] string state,
            [FromQuery] string zipCode,
            [FromQuery] string? propertyType,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(streetAddress) || string.IsNullOrWhiteSpace(city) || string.IsNullOrWhiteSpace(state) || string.IsNullOrWhiteSpace(zipCode))
                return BadRequest(new { success = false, message = "Complete address fields are required." });

            if (!IsSingleUnitPropertyType(propertyType))
                return BadRequest(new { success = false, message = "Property record prefill is only available for single-family/single-unit properties." });

            try
            {
                var result = await _propertyRecordService.GetPropertyDetailsAsync(new PropertyRecordLookupRequest
                {
                    StreetAddress = streetAddress,
                    City = city,
                    State = state,
                    ZipCode = zipCode,
                    PropertyType = propertyType
                }, cancellationToken);

                if (result == null)
                    return NotFound(new { success = false, message = "No property record details were found for this address." });

                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching property record prefill for {StreetAddress}, {City}, {State} {ZipCode}", streetAddress, city, state, zipCode);
                return StatusCode(500, new { success = false, message = "An error occurred while fetching property record details." });
            }
        }

        private static bool IsSingleUnitPropertyType(string? propertyType)
        {
            if (string.IsNullOrWhiteSpace(propertyType)) return false;
            return propertyType.Equals("singleFamily", StringComparison.OrdinalIgnoreCase)
                || propertyType.Equals("townhouse", StringComparison.OrdinalIgnoreCase)
                || propertyType.Equals("condominium", StringComparison.OrdinalIgnoreCase);
        }
    }
}
