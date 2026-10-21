using brownstone_hub_api.Attributes;
using brownstone_hub_api.Dtos.ShortStay;
using brownstone_hub_api.Services.ShortStay;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Route("api/short-stay/units/{unitId:long}/airbnb-calendar")]
[Authorize(Roles = "Landlord,Admin")]
public sealed class AirbnbCalendarController(AirbnbCalendarService calendar) : ControllerBase
{
    [HttpGet]
    [RequireOrganizationRole("Owner", "Manager")]
    public async Task<IActionResult> Get(long unitId, CancellationToken ct)
    {
        var result = await calendar.Get(unitId, ct);
        return StatusCode(result.StatusCode, result);
    }

    [HttpPut]
    [RequireOrganizationRole("Owner", "Manager")]
    public async Task<IActionResult> Connect(long unitId, [FromBody] ConnectAirbnbCalendarDto? request, CancellationToken ct)
    {
        var result = await calendar.Connect(unitId, request, ct);
        return StatusCode(result.StatusCode, result);
    }

    [HttpPost("refresh")]
    [RequireOrganizationRole("Owner", "Manager")]
    public async Task<IActionResult> Refresh(long unitId, CancellationToken ct)
    {
        var result = await calendar.Refresh(unitId, ct);
        return StatusCode(result.StatusCode, result);
    }

    [HttpDelete]
    [RequireOrganizationRole("Owner", "Manager")]
    public async Task<IActionResult> Disable(long unitId, CancellationToken ct)
    {
        var result = await calendar.Disable(unitId, ct);
        return StatusCode(result.StatusCode, result);
    }
}
