using brownstone_hub_api.Services.ShortStay;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Authorize]
[Route("api/short-stay/units/{unitId:long}/holds")]
public sealed class ShortStayHoldController(ShortStayHoldService holds) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create(long unitId, [FromBody] ShortStayHoldRequest request, CancellationToken cancellationToken)
    {
        if (request is null || request.UnexpectedFields is { Count: > 0 }) return BadRequest("Only dates, guest count and idempotency key are accepted.");
        var result = await holds.Create(unitId, request, cancellationToken);
        return StatusCode(result.StatusCode, result.Hold is not null ? (object)result.Hold : new { reason = result.Reason });
    }
}
