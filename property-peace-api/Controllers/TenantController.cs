using brownstone_hub_api.Dtos.Tenant;
using brownstone_hub_api.Dtos.User;
using brownstone_hub_api.Helpers;
using brownstone_hub_api.Services.TenantService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    public class TenantController(ITenantService tenantService) : ControllerBase
    {
        private readonly ITenantService _tenantService = tenantService;

        [Authorize]
        [HttpPost("")]
        public async Task<IActionResult> AddOrUpdateTenant([FromBody] AddTenantDto tenant)
        {
            var response = await _tenantService.AddOrUpdateTenant(tenant);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize]
        [HttpGet("lease/{leaseId}")]
        public async Task<IActionResult> GetTenantsByLeaseId(long leaseId)
        {
            var response = await _tenantService.GetTenantsByLeaseId(leaseId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize]
        [HttpGet("{id}")]
        public async Task<IActionResult> GetTenantById(long id)
        {
            var response = await _tenantService.GetTenantById(id);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize]
        [HttpGet("organization")]
        public async Task<IActionResult> GetAllTenantsByOrganizationId()
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var response = await _tenantService.GetAllTenantsByOrganizationId(organizationId.Value);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTenant(long id)
        {
            var response = await _tenantService.DeleteTenant(id);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize]
        [HttpGet("check-email/{email}")]
        public async Task<IActionResult> CheckEmailExists(string email)
        {
            var response = await _tenantService.CheckEmailExists(email);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize]
        [HttpPost("get-by-email")]
        public async Task<IActionResult> GetTenantByEmail([FromBody] CheckEmailDto request)
        {
            if (string.IsNullOrWhiteSpace(request.Email))
            {
                return BadRequest(new { Message = "Email is required" });
            }

            var response = await _tenantService.GetTenantByEmail(request.Email);

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