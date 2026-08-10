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
            if (!TryGetValidatedManagementContext(out var userId, out var organizationId))
                return StatusCode(StatusCodes.Status403Forbidden, new { Message = "Validated organization context is required." });

            var response = await _tenantInviteService.CreateInvite(invite, userId, organizationId);

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
            if (!TryGetValidatedManagementContext(out var userId, out var organizationId))
                return StatusCode(StatusCodes.Status403Forbidden, new { Message = "Validated organization context is required." });

            var response = await _tenantInviteService.GetInvitesByTenantId(tenantId, userId, organizationId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpGet("landlord")]
        [Authorize(Roles = "Landlord,Admin")]
        public async Task<IActionResult> GetInvitesByLandlordId()
        {
            if (!TryGetValidatedManagementContext(out var userId, out var organizationId))
                return StatusCode(StatusCodes.Status403Forbidden, new { Message = "Validated organization context is required." });

            var response = await _tenantInviteService.GetInvitesByLandlordId(userId, organizationId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpDelete("{inviteId}")]
        [Authorize(Roles = "Landlord,Admin")]
        public async Task<IActionResult> DeleteInvite(long inviteId)
        {
            if (!TryGetValidatedManagementContext(out var userId, out var organizationId))
                return StatusCode(StatusCodes.Status403Forbidden, new { Message = "Validated organization context is required." });

            var response = await _tenantInviteService.DeleteInvite(inviteId, userId, organizationId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpPost("{inviteId}/resend")]
        [Authorize(Roles = "Landlord,Admin")]
        public async Task<IActionResult> ResendInvite(long inviteId)
        {
            if (!TryGetValidatedManagementContext(out var userId, out var organizationId))
                return StatusCode(StatusCodes.Status403Forbidden, new { Message = "Validated organization context is required." });

            var response = await _tenantInviteService.ResendInvite(inviteId, userId, organizationId);

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

        private bool TryGetValidatedManagementContext(out long userId, out long organizationId)
        {
            userId = 0;
            organizationId = 0;
            var rawUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("userId")?.Value
                ?? User.FindFirst("sub")?.Value;
            if (!long.TryParse(rawUserId, out var claimUserId) || claimUserId <= 0)
                return false;

            if (!HttpContext.Items.TryGetValue("UserId", out var contextUserValue)
                || contextUserValue is not long contextUserId
                || contextUserId != claimUserId
                || !HttpContext.Items.TryGetValue("OrganizationId", out var organizationValue)
                || organizationValue is not long contextOrganizationId
                || contextOrganizationId <= 0)
            {
                return false;
            }

            userId = contextUserId;
            organizationId = contextOrganizationId;
            return true;
        }
    }
}

