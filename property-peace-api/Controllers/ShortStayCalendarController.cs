using System.Globalization;
using brownstone_hub_api.Attributes;
using brownstone_hub_api.Dtos.ShortStay;
using brownstone_hub_api.Services.ShortStay;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Route("api/short-stay/units/{unitId:long}/calendar")]
[Authorize(Roles = "Landlord,Admin")]
public sealed class ShortStayCalendarController(ShortStayCalendarService calendar) : ControllerBase
{
    private static bool Parse(string? value, out DateOnly date) =>
        DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out date);

    [HttpGet]
    [RequireOrganizationRole("Owner", "Manager")]
    public async Task<IActionResult> Get(long unitId, [FromQuery] string? start, [FromQuery] string? end, CancellationToken cancellationToken)
    {
        if (!Parse(start, out var first) || !Parse(end, out var last)) return BadRequest("Use yyyy-MM-dd local dates");
        var response = await calendar.Get(unitId, first, last, cancellationToken);
        return StatusCode(response.StatusCode, response);
    }

    [HttpPost("blocks")]
    [RequireOrganizationRole("Owner", "Manager")]
    public async Task<IActionResult> PostBlock(long unitId, [FromBody] SaveShortStayBlockDto request, CancellationToken cancellationToken)
    {
        var response = await calendar.PostBlock(unitId, request, cancellationToken);
        return StatusCode(response.StatusCode, response);
    }

    [HttpDelete("blocks/{blockId:long}")]
    [RequireOrganizationRole("Owner", "Manager")]
    public async Task<IActionResult> DeleteBlock(long unitId, long blockId, CancellationToken cancellationToken)
    {
        var response = await calendar.DeleteBlock(unitId, blockId, cancellationToken);
        return StatusCode(response.StatusCode, response);
    }

    [HttpPut("rates/{date}")]
    [RequireOrganizationRole("Owner", "Manager")]
    public async Task<IActionResult> PutRate(long unitId, string date, [FromBody] SaveShortStayRateDto request, CancellationToken cancellationToken)
    {
        if (!Parse(date, out var day)) return BadRequest("Use yyyy-MM-dd local date");
        var response = await calendar.PutRate(unitId, day, request, cancellationToken);
        return StatusCode(response.StatusCode, response);
    }

    [HttpDelete("rates/{date}")]
    [RequireOrganizationRole("Owner", "Manager")]
    public async Task<IActionResult> DeleteRate(long unitId, string date, CancellationToken cancellationToken)
    {
        if (!Parse(date, out var day)) return BadRequest("Use yyyy-MM-dd local date");
        var response = await calendar.DeleteRate(unitId, day, cancellationToken);
        return StatusCode(response.StatusCode, response);
    }
}
