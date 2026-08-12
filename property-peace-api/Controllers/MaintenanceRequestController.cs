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
            await Task.CompletedTask;
            return LegacyReadOrCreateGone();
        }

        [Authorize]
        [HttpPut("{maintenanceRequestId}")]
        [Obsolete("Use named transitions under api/maintenance-requests. Legacy aggregate mutation is disabled.")]
        public Task<IActionResult> UpdateMaintenanceRequest(long maintenanceRequestId, [FromBody] UpdateMaintenanceRequestDto updateMaintenanceRequestDto)
        {
            IActionResult result = StatusCode(StatusCodes.Status410Gone, new
            {
                Message = "Legacy maintenance mutation is disabled. Use the named maintenance workflow transitions.",
                Code = "maintenance.legacy_mutation_disabled"
            });
            return Task.FromResult(result);
        }

        [Authorize]
        [HttpGet("{maintenanceRequestId}")]
        public async Task<IActionResult> GetMaintenanceRequestById(long maintenanceRequestId)
        {
            await Task.CompletedTask;
            return LegacyReadOrCreateGone();
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpGet("property/{propertyId}")]
        public async Task<IActionResult> GetMaintenanceRequestsByPropertyId(long propertyId)
        {
            await Task.CompletedTask;
            return LegacyReadOrCreateGone();
        }

        [Authorize]
        [HttpGet("unit/{unitId}")]
        public async Task<IActionResult> GetMaintenanceRequestsByUnitId(long unitId)
        {
            await Task.CompletedTask;
            return LegacyReadOrCreateGone();
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpGet("property/{propertyId}/current")]
        public Task<IActionResult> GetCurrentMaintenanceByPropertyId(long propertyId) =>
            Task.FromResult(LegacyReadOrCreateGone());

        [Authorize(Roles = "Landlord,Admin")]
        [HttpGet("property/{propertyId}/history")]
        public Task<IActionResult> GetMaintenanceHistoryByPropertyId(long propertyId) =>
            Task.FromResult(LegacyReadOrCreateGone());

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
        public Task<IActionResult> GetMaintenanceEventsByRequestId(long maintenanceRequestId) =>
            Task.FromResult(LegacyReadOrCreateGone());

        [Authorize(Roles = "Landlord,Admin")]
        [HttpGet("property/{propertyId}/open-count")]
        public Task<IActionResult> GetPropertyOpenMaintenanceRequestsCount(long propertyId) =>
            Task.FromResult(LegacyReadOrCreateGone());

        [Authorize]
        [HttpDelete("{maintenanceRequestId}")]
        [Obsolete("Legacy aggregate mutation is disabled.")]
        public Task<IActionResult> DeleteMaintenanceRequest(long maintenanceRequestId) => Task.FromResult(LegacyMutationGone());

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
        [Obsolete("Use the canonical completion reopen transition.")]
        public Task<IActionResult> ReopenMaintenance(long requestId) => Task.FromResult(LegacyMutationGone());

        [Authorize(Roles = "Landlord,Admin")]
        [HttpPut("resolve/{requestId}")]
        [Obsolete("Use the canonical completion confirmation or staff-close transition.")]
        public Task<IActionResult> ResolveMaintenance(long requestId) => Task.FromResult(LegacyMutationGone());

        [Authorize(Roles = "Landlord,Admin")]
        [HttpPut("{maintenanceRequestId}/assign")]
        [Obsolete("Use POST api/maintenance-requests/{id}/assign.")]
        public Task<IActionResult> AssignMaintenanceRequest(long maintenanceRequestId, [FromBody] AssignMaintenanceRequestDto dto) =>
            Task.FromResult(LegacyMutationGone());

        private IActionResult LegacyMutationGone() =>
            StatusCode(StatusCodes.Status410Gone, new
            {
                Message = "Legacy maintenance mutation is disabled. Use the named maintenance workflow transitions.",
                Code = "maintenance.legacy_mutation_disabled"
            });

        private IActionResult LegacyReadOrCreateGone() =>
            StatusCode(StatusCodes.Status410Gone, new
            {
                Message = "This legacy maintenance endpoint is disabled. Use the scoped canonical maintenance API.",
                Code = "maintenance.legacy_endpoint_disabled"
            });

        [Authorize(Roles = "Landlord,Admin")]
        [HttpPost("{maintenanceRequestId}/generate-tenant-message")]
        public async Task<IActionResult> GenerateTenantMessage(long maintenanceRequestId)
        {
            await Task.CompletedTask;
            return LegacyReadOrCreateGone();
        }
    }
}