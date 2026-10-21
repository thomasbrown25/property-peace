using brownstone_hub_api.Attributes;
using brownstone_hub_api.Dtos.ShortStay;
using brownstone_hub_api.Services.ShortStay;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Route("api/short-stay/units/{unitId:long}/listing")]
[Authorize(Roles = "Landlord,Admin")]
public sealed class ShortStayListingController(ShortStayListingService listings) : ControllerBase
{
    [HttpGet]
    [RequireOrganizationRole("Owner", "Manager")]
    public async Task<IActionResult> Get(long unitId, CancellationToken cancellationToken)
    {
        var response = await listings.Get(unitId, cancellationToken);
        return StatusCode(response.StatusCode, response);
    }

    [HttpPut]
    [RequireOrganizationRole("Owner", "Manager")]
    public async Task<IActionResult> Put(long unitId, [FromBody] SaveShortStayListingDto request, CancellationToken cancellationToken)
    {
        var response = await listings.Put(unitId, request, cancellationToken);
        return StatusCode(response.StatusCode, response);
    }
}
