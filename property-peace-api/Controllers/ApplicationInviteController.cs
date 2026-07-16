using brownstone_hub_api.Dtos.ApplicationInvite;
using brownstone_hub_api.Services.ApplicationInviteService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    public class ApplicationInviteController(
        IApplicationInviteService applicationInviteService) : ControllerBase
    {
        private readonly IApplicationInviteService _applicationInviteService = applicationInviteService;

        [HttpPost("")]
        public async Task<IActionResult> CreateInvite([FromBody] AddApplicationInviteDto invite)
        {
            var response = await _applicationInviteService.CreateInvite(invite);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpGet("validate/{token}")]
        [AllowAnonymous]
        public async Task<IActionResult> ValidateInviteToken(string token)
        {
            var response = await _applicationInviteService.ValidateInviteToken(token);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpGet("property/{propertyId}")]
        public async Task<IActionResult> GetInvitesByProperty(long propertyId)
        {
            var response = await _applicationInviteService.GetInvitesByPropertyId(propertyId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpGet("landlord")]
        public async Task<IActionResult> GetInvitesByLandlord()
        {
            var response = await _applicationInviteService.GetInvitesByLandlordId();

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteInvite(long id)
        {
            var response = await _applicationInviteService.DeleteInvite(id);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpPost("application/{applicationId}/resend")]
        public async Task<IActionResult> ResendInviteByApplicationId(long applicationId)
        {
            var response = await _applicationInviteService.ResendInviteByApplicationId(applicationId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpPost("{id}/resend")]
        public async Task<IActionResult> ResendInvite(long id)
        {
            var response = await _applicationInviteService.ResendInvite(id);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpPost("submit/{token}")]
        [AllowAnonymous]
        public async Task<IActionResult> SubmitApplicationWithToken(string token, [FromBody] Dtos.Application.AddRentalApplicationDto application)
        {
            var response = await _applicationInviteService.SubmitApplicationWithToken(token, application);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }
    }
}

