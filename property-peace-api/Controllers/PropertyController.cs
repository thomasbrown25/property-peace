using brownstone_hub_api.Dtos.Property;
using brownstone_hub_api.Helpers;
using brownstone_hub_api.Services.PropertyService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    public class PropertyController(IPropertyService propertyService) : ControllerBase
    {
        private readonly IPropertyService _propertyService = propertyService;

        [Authorize]
        [HttpPost("")]
        public async Task<IActionResult> AddOrUpdateProperty([FromForm] string propertyData, [FromForm] List<IFormFile> files)
        {
            var settings = new Newtonsoft.Json.JsonSerializerSettings
            {
                ContractResolver = new Newtonsoft.Json.Serialization.CamelCasePropertyNamesContractResolver()
            };
            var newPropertyDto = Newtonsoft.Json.JsonConvert.DeserializeObject<UpdatePropertyDto>(propertyData, settings);
            var response = await _propertyService.AddOrUpdateProperty(newPropertyDto, files);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    Message = !string.IsNullOrEmpty(response.Errors?.Message) ? response.Errors.Message : response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize]
        [HttpGet("{propertyId}")]
        public async Task<IActionResult> GetPropertyById(long propertyId)
        {
            var response = await _propertyService.GetPropertyById(propertyId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize]
        [HttpGet("list")]
        public async Task<IActionResult> GetPropertiesByLandlordId()
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });
            
            var response = await _propertyService.GetPropertiesByOrganizationId(organizationId.Value);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize]
        [HttpGet("occupied-count")]
        public async Task<IActionResult> GetOccupiedPropertiesCountAsync()
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var response = await _propertyService.GetOccupiedPropertiesCountAsync(organizationId.Value);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);

        }

        [Authorize]
        [HttpGet("vacant-count")]
        public async Task<IActionResult> GetVacantPropertiesCountAsync()
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var response = await _propertyService.GetVacantPropertiesCountAsync(organizationId.Value);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize]
        [HttpDelete("{propertyId}")]
        public async Task<IActionResult> DeleteProperty(long propertyId)
        {
            var response = await _propertyService.DeleteProperty(propertyId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize]
        [HttpPut("{propertyId}/inactivate")]
        public async Task<IActionResult> InactivateProperty(long propertyId)
        {
            var response = await _propertyService.InactivateProperty(propertyId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize]
        [HttpPut("{propertyId}/reactivate")]
        public async Task<IActionResult> ReactivateProperty(long propertyId)
        {
            var response = await _propertyService.ReactivateProperty(propertyId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize]
        [HttpGet("is-single-unit-portfolio")]
        public async Task<IActionResult> IsSingleUnitPortfolio()
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var response = await _propertyService.IsSingleUnitPortfolio(organizationId.Value);

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