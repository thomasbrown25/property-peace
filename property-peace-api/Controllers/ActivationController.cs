using System.Security.Claims;
using brownstone_hub_api.Dtos.Activation;
using brownstone_hub_api.Services.Activation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Route("api/activation")]
[Authorize(Roles = "Landlord,Admin")]
public sealed class ActivationController(IActivationService activationService) : ControllerBase
{
    [HttpGet]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    [ProducesResponseType(typeof(ActivationResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<ActivationResponseDto>> Get(CancellationToken cancellationToken)
    {
        var rawUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("userId")?.Value
            ?? User.FindFirst("sub")?.Value;
        if (!long.TryParse(rawUserId, out var userId) || userId <= 0)
            return Unauthorized();

        if (!HttpContext.Items.TryGetValue("UserId", out var contextUserValue)
            || contextUserValue is not long contextUserId
            || contextUserId != userId
            || !HttpContext.Items.TryGetValue("OrganizationId", out var organizationValue)
            || organizationValue is not long organizationId
            || organizationId <= 0)
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                new { Message = "Validated organization context is required." });
        }

        try
        {
            return Ok(await activationService.EvaluateAsync(userId, organizationId, cancellationToken));
        }
        catch (ActivationAccessDeniedException)
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                new { Message = "Active organization membership is required." });
        }
    }
}
