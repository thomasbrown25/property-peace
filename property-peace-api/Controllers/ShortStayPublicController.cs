using System.Globalization;
using brownstone_hub_api.Services.ShortStay;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/short-stay/public/units/{unitId:long}")]
public sealed class ShortStayPublicController(ShortStayPublicService publicListings) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(long unitId, CancellationToken cancellationToken)
    {
        var (status, listing) = await publicListings.Get(unitId, cancellationToken);
        return StatusCode(status, listing);
    }

    [HttpGet("quote")]
    public async Task<IActionResult> Quote(long unitId, [FromQuery] string? checkIn, [FromQuery] string? checkOut,
        [FromQuery] int guests, CancellationToken cancellationToken)
    {
        if (HttpContext?.Request.Query.Keys.Any(key => key is not ("checkIn" or "checkOut" or "guests")) == true)
            return BadRequest("Only dates and guest count are accepted; prices are server-owned");
        if (!DateOnly.TryParseExact(checkIn, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var start) ||
            !DateOnly.TryParseExact(checkOut, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var end))
            return BadRequest("Use yyyy-MM-dd property-local dates");
        var (status, quote) = await publicListings.Quote(unitId, new(start, end, guests), cancellationToken);
        return StatusCode(status, quote);
    }
}
