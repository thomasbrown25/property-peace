using brownstone_hub_api.Dtos.StaffMember;
using brownstone_hub_api.Services.StaffMemberInviteService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/staff-member-invite")]
    [Authorize(Roles = "Landlord,Admin")]
    public class StaffMemberInviteController(IStaffMemberInviteService staffMemberInviteService) : ControllerBase
    {
        private readonly IStaffMemberInviteService _staffMemberInviteService = staffMemberInviteService;

        [HttpPost]
        public async Task<IActionResult> CreateInvite([FromBody] AddStaffMemberInviteDto dto)
        {
            var response = await _staffMemberInviteService.CreateInvite(dto);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("validate/{token}")]
        [AllowAnonymous]
        public async Task<IActionResult> ValidateInviteToken(string token)
        {
            var response = await _staffMemberInviteService.ValidateInviteToken(token);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPost("accept-existing-user")]
        [Authorize]
        public async Task<IActionResult> AcceptInviteForExistingUser([FromBody] AcceptStaffMemberInviteDto dto)
        {
            var userId = long.Parse(User.FindFirst("UserId")?.Value ?? "0");
            var response = await _staffMemberInviteService.AcceptInviteForExistingUser(dto, userId);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPost("accept")]
        [AllowAnonymous]
        public async Task<IActionResult> AcceptInviteByEmail([FromBody] AcceptStaffMemberInviteDto dto)
        {
            var response = await _staffMemberInviteService.AcceptInviteByEmail(dto);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPost("resend/{inviteId}")]
        public async Task<IActionResult> ResendInvite(long inviteId)
        {
            var response = await _staffMemberInviteService.ResendInvite(inviteId);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("staff-member/{staffMemberId}")]
        public async Task<IActionResult> GetInvitesByStaffMemberId(long staffMemberId)
        {
            var response = await _staffMemberInviteService.GetInvitesByStaffMemberId(staffMemberId);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet]
        public async Task<IActionResult> GetInvitesByLandlordId()
        {
            var response = await _staffMemberInviteService.GetInvitesByLandlordId();
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpDelete("{inviteId}")]
        public async Task<IActionResult> DeleteInvite(long inviteId)
        {
            var response = await _staffMemberInviteService.DeleteInvite(inviteId);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }
    }
}
