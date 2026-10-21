using brownstone_hub_api.Attributes;
using brownstone_hub_api.Dtos.ShortStay;
using brownstone_hub_api.Services.ShortStay;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Route("api/short-stay/properties/{propertyId:long}/timezone")]
[Authorize(Roles = "Landlord,Admin")]
public sealed class ShortStayPropertyTimeZoneController(ShortStayPropertyTimeZoneService timeZones) : ControllerBase
{
    [HttpGet]
    [RequireOrganizationRole("Owner", "Manager")]
    public async Task<IActionResult> Get(long propertyId, CancellationToken cancellationToken)
    {
        var response = await timeZones.Get(propertyId, cancellationToken);
        return StatusCode(response.StatusCode, response);
    }

    [HttpPut]
    [RequireOrganizationRole("Owner", "Manager")]
    public async Task<IActionResult> Put(long propertyId, [FromBody] SaveShortStayPropertyTimeZoneDto request, CancellationToken cancellationToken)
    {
        var response = await timeZones.Put(propertyId, request, cancellationToken);
        return StatusCode(response.StatusCode, response);
    }
}
