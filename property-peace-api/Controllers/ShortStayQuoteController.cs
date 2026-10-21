using System.Globalization;
using brownstone_hub_api.Attributes;
using brownstone_hub_api.Services.ShortStay;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Route("api/short-stay/units/{unitId:long}/quote-preview")]
[Authorize(Roles = "Landlord,Admin")]
public sealed class ShortStayQuoteController(ShortStayQuoteService quotes) : ControllerBase
{
    [HttpGet]
    [RequireOrganizationRole("Owner", "Manager")]
    public async Task<IActionResult> Get(long unitId, [FromQuery] string? checkIn, [FromQuery] string? checkOut,
        [FromQuery] int guests, CancellationToken cancellationToken)
    {
        if (HttpContext?.Request.Query.Keys.Any(key => key is not ("checkIn" or "checkOut" or "guests")) == true)
            return BadRequest("Only dates and guest count are accepted; prices are server-owned");
        if (!DateOnly.TryParseExact(checkIn, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var start) ||
            !DateOnly.TryParseExact(checkOut, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var end))
            return BadRequest("Use yyyy-MM-dd property-local dates");
        var (status, quote) = await quotes.Get(unitId, new(start, end, guests), cancellationToken);
        return StatusCode(status, quote);
    }
}
