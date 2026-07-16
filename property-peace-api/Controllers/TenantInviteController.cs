using brownstone_hub_api.Dtos.Tenant;
using brownstone_hub_api.Services.TenantInviteService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class TenantInviteController(
        ITenantInviteService tenantInviteService) : ControllerBase
    {
        private readonly ITenantInviteService _tenantInviteService = tenantInviteService;


        [HttpPost("")]
        [Authorize(Roles = "Landlord,Admin")]
        public async Task<IActionResult> CreateInvite([FromBody] AddTenantInviteDto invite)
        {
            var response = await _tenantInviteService.CreateInvite(invite);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpGet("validate/{token}")]
        [AllowAnonymous]
        public async Task<IActionResult> ValidateInviteToken(string token)
        {
            var response = await _tenantInviteService.ValidateInviteToken(token);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpGet("tenant/{tenantId}")]
        [Authorize(Roles = "Landlord,Admin")]
        public async Task<IActionResult> GetInvitesByTenantId(long tenantId)
        {
            var response = await _tenantInviteService.GetInvitesByTenantId(tenantId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpGet("landlord")]
        [Authorize(Roles = "Landlord,Admin")]
        public async Task<IActionResult> GetInvitesByLandlordId()
        {
            var response = await _tenantInviteService.GetInvitesByLandlordId();

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpDelete("{inviteId}")]
        [Authorize(Roles = "Landlord,Admin")]
        public async Task<IActionResult> DeleteInvite(long inviteId)
        {
            var response = await _tenantInviteService.DeleteInvite(inviteId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpPost("{inviteId}/resend")]
        [Authorize(Roles = "Landlord,Admin")]
        public async Task<IActionResult> ResendInvite(long inviteId)
        {
            var response = await _tenantInviteService.ResendInvite(inviteId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpPost("accept")]
        [AllowAnonymous]
        public async Task<IActionResult> AcceptInvite([FromBody] AcceptTenantInviteDto dto)
        {
            var response = await _tenantInviteService.AcceptInviteByEmail(dto);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpGet("pending")]
        [Authorize(Roles = "Tenant")]
        public async Task<IActionResult> GetPendingInviteForCurrentUser()
        {
            var response = await _tenantInviteService.GetPendingInviteForCurrentUser();

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }
    }
}

