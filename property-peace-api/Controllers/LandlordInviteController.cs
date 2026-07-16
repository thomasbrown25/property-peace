using brownstone_hub_api.Dtos.LandlordInvite;
using brownstone_hub_api.Services.LandlordInviteService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class LandlordInviteController(
        ILandlordInviteService landlordInviteService) : ControllerBase
    {
        private readonly ILandlordInviteService _landlordInviteService = landlordInviteService;

        [HttpPost("")]
        public async Task<IActionResult> CreateInvite([FromBody] AddLandlordInviteDto invite)
        {
            var response = await _landlordInviteService.CreateInvite(invite);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpGet("validate/{token}")]
        [AllowAnonymous]
        public async Task<IActionResult> ValidateInviteToken(string token)
        {
            var response = await _landlordInviteService.ValidateInviteToken(token);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpGet("admin")]
        public async Task<IActionResult> GetInvitesByAdmin()
        {
            var response = await _landlordInviteService.GetInvitesByAdmin();

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpPost("mark-used/{token}")]
        [AllowAnonymous]
        public async Task<IActionResult> MarkInviteAsUsed(string token)
        {
            var response = await _landlordInviteService.MarkInviteAsUsed(token);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }
    }
}
