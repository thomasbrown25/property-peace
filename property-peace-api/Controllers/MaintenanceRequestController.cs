using brownstone_hub_api.Dtos.MaintenanceRequest;
using brownstone_hub_api.Helpers;
using brownstone_hub_api.Services.MaintenanceRequestService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/maintenance-request")]
    [Authorize(Roles = "Tenant,Landlord,Admin")]
    public class MaintenanceRequestController(IMaintenanceRequestService maintenanceRequestService) : ControllerBase
    {
        private readonly IMaintenanceRequestService _maintenanceRequestService = maintenanceRequestService;

        [Authorize]
        [HttpPost("")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> AddMaintenanceRequest([FromForm] string maintenanceData, [FromForm] List<IFormFile> files)
        {
            try
            {
                var jsonObject = JObject.Parse(maintenanceData);

                // Remove category-related fields - AI will choose the category
                jsonObject.Remove("CategoryId");
                jsonObject.Remove("categoryId");
                jsonObject.Remove("category");

                var maintenanceDataDto = jsonObject.ToObject<AddMaintenanceRequestDto>();
                if (maintenanceDataDto == null)
                {
                    return BadRequest(new { Message = "Invalid maintenance request data" });
                }

                // All logic (title generation, category selection) is handled in the service
                var response = await _maintenanceRequestService.AddMaintenanceRequest(maintenanceDataDto, files);

                if (!response.Success)
                    return StatusCode(response.StatusCode, new
                    {
                        response.Message,
                        response.Errors
                    });

                return Ok(response);
            }
            catch (JsonException ex)
            {
                return BadRequest(new { Message = "Invalid JSON format", Error = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "An error occurred while processing the request", Error = ex.Message });
            }
        }

        [Authorize]
        [HttpPut("{maintenanceRequestId}")]
        public async Task<IActionResult> UpdateMaintenanceRequest(long maintenanceRequestId, [FromBody] UpdateMaintenanceRequestDto updateMaintenanceRequestDto)
        {
            var response = await _maintenanceRequestService.UpdateMaintenanceRequest(maintenanceRequestId, updateMaintenanceRequestDto);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize]
        [HttpGet("{maintenanceRequestId}")]
        public async Task<IActionResult> GetMaintenanceRequestById(long maintenanceRequestId)
        {
            var response = await _maintenanceRequestService.GetMaintenanceRequestById(maintenanceRequestId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);

        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpGet("property/{propertyId}")]
        public async Task<IActionResult> GetMaintenanceRequestsByPropertyId(long propertyId)
        {
            var response = await _maintenanceRequestService.GetMaintenanceRequestsByPropertyId(propertyId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize]
        [HttpGet("unit/{unitId}")]
        public async Task<IActionResult> GetMaintenanceRequestsByUnitId(long unitId)
        {
            var response = await _maintenanceRequestService.GetMaintenanceRequestsByUnitId(unitId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpGet("property/{propertyId}/current")]
        public async Task<IActionResult> GetCurrentMaintenanceByPropertyId(long propertyId)
        {
            var response = await _maintenanceRequestService.GetCurrentMaintenanceByPropertyId(propertyId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpGet("property/{propertyId}/history")]
        public async Task<IActionResult> GetMaintenanceHistoryByPropertyId(long propertyId)
        {
            var response = await _maintenanceRequestService.GetMaintenanceHistoryByPropertyId(propertyId);
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpGet("organization/current")]
        public async Task<IActionResult> GetCurrentMaintenanceByOrganizationId()
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var response = await _maintenanceRequestService.GetCurrentMaintenanceByOrganizationId(organizationId.Value);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpGet("organization/history")]
        public async Task<IActionResult> GetMaintenanceHistoryByOrganizationId()
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var response = await _maintenanceRequestService.GetMaintenanceHistoryByOrganizationId(organizationId.Value);
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize(Roles = "Tenant,Admin")]
        [HttpGet("tenant/current")]
        public async Task<IActionResult> GetCurrentMaintenanceByTenant()
        {
            var response = await _maintenanceRequestService.GetCurrentMaintenanceByTenantUserId();
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize(Roles = "Tenant,Admin")]
        [HttpGet("tenant/history")]
        public async Task<IActionResult> GetMaintenanceHistoryByTenant()
        {
            var response = await _maintenanceRequestService.GetMaintenanceHistoryByTenantUserId();
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize]
        [HttpGet("{maintenanceRequestId}/events")]
        public async Task<IActionResult> GetMaintenanceEventsByRequestId(long maintenanceRequestId)
        {
            var response = await _maintenanceRequestService.GetMaintenanceEventsByRequestId(maintenanceRequestId);
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });
            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpGet("property/{propertyId}/open-count")]
        public async Task<IActionResult> GetPropertyOpenMaintenanceRequestsCount(long propertyId)
        {
            var response = await _maintenanceRequestService.GetPropertyOpenMaintenanceRequestsCount(propertyId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize]
        [HttpDelete("{maintenanceRequestId}")]
        public async Task<IActionResult> DeleteMaintenanceRequest(long maintenanceRequestId)
        {
            var response = await _maintenanceRequestService.DeleteMaintenanceRequest(maintenanceRequestId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize]
        [HttpGet("categories")]
        public async Task<IActionResult> GetMaintenanceCategories()
        {
            var response = await _maintenanceRequestService.GetMaintenanceCategories();

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize]
        [HttpPost("analyze")]
        public async Task<IActionResult> AnalyzeMaintenanceRequest([FromBody] AnalyzeMaintenanceRequestDto request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.Description))
                {
                    return BadRequest(new { Message = "Description is required for analysis" });
                }

                var response = await _maintenanceRequestService.AnalyzeMaintenanceRequest(
                    request.Title ?? string.Empty,
                    request.Description ?? string.Empty
                );

                if (!response.Success)
                    return StatusCode(response.StatusCode, new
                    {
                        response.Message,
                        response.Errors
                    });

                return Ok(response);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "An error occurred while analyzing the request", Error = ex.Message });
            }
        }

        [Authorize]
        [HttpPut("reopen/{requestId}")]
        public async Task<IActionResult> ReopenMaintenance(long requestId)
        {
            var response = await _maintenanceRequestService.ReopenMaintenance(requestId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpPut("resolve/{requestId}")]
        public async Task<IActionResult> ResolveMaintenance(long requestId)
        {
            var response = await _maintenanceRequestService.ResolveMaintenance(requestId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpPut("{maintenanceRequestId}/assign")]
        public async Task<IActionResult> AssignMaintenanceRequest(long maintenanceRequestId, [FromBody] AssignMaintenanceRequestDto dto)
        {
            var response = await _maintenanceRequestService.AssignMaintenanceRequest(maintenanceRequestId, dto);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpPost("{maintenanceRequestId}/generate-tenant-message")]
        public async Task<IActionResult> GenerateTenantMessage(long maintenanceRequestId)
        {
            var response = await _maintenanceRequestService.GenerateTenantMessage(maintenanceRequestId);

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