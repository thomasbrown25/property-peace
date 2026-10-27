using System.Globalization;
using brownstone_hub_api.Attributes;
using brownstone_hub_api.Services.ShortStay;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Route("api/short-stay/units/{unitId:long}/inventory-report")]
[Authorize(Roles = "Landlord,Admin")]
public sealed class ShortStayInventoryReportController(ShortStayInventoryReportService reports) : ControllerBase
{
    [HttpGet]
    [RequireOrganizationRole("Owner", "Manager")]
    public async Task<IActionResult> Get(long unitId, [FromQuery] string? start, [FromQuery] string? end, CancellationToken ct)
    {
        if (!DateOnly.TryParseExact(start, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var first) ||
            !DateOnly.TryParseExact(end, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var last))
            return BadRequest("Use yyyy-MM-dd local dates");
        var result = await reports.Get(unitId, first, last, ct);
        return StatusCode(result.StatusCode, result);
    }
}
