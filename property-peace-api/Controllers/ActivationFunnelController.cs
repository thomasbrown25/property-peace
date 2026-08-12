using brownstone_hub_api.Dtos.ActivationFunnel;
using brownstone_hub_api.Services.ActivationFunnel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Route("api/admin/activation-funnel")]
[Authorize(Roles = "Admin")]
public sealed class ActivationFunnelController(IActivationFunnelProjection projection) : ControllerBase
{
    [HttpGet]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    [ProducesResponseType(typeof(ActivationFunnelReportDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<ActivationFunnelReportDto>> Get(
        [FromQuery] DateTimeOffset startUtc,
        [FromQuery] DateTimeOffset endUtc,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await projection.GetAsync(startUtc, endUtc, cancellationToken));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { Message = exception.Message });
        }
    }
}
