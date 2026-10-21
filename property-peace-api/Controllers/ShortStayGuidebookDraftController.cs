using brownstone_hub_api.Attributes;
using brownstone_hub_api.Dtos.ShortStay;
using brownstone_hub_api.Services.ShortStay;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Route("api/short-stay/units/{unitId:long}/guidebook-draft")]
[Authorize(Roles = "Landlord,Admin")]
public sealed class ShortStayGuidebookDraftController(ShortStayGuidebookDraftService drafts) : ControllerBase
{
    [HttpGet]
    [RequireOrganizationRole("Owner", "Manager")]
    public async Task<IActionResult> Get(long unitId, CancellationToken cancellationToken)
    {
        Response.Headers.CacheControl = "no-store";
        var response = await drafts.Get(unitId, cancellationToken);
        return StatusCode(response.StatusCode, response);
    }

    [HttpPut]
    [RequireOrganizationRole("Owner", "Manager")]
    public async Task<IActionResult> Put(long unitId, [FromBody] SaveShortStayGuidebookDraftDto request, CancellationToken cancellationToken)
    {
        Response.Headers.CacheControl = "no-store";
        var response = await drafts.Put(unitId, request, cancellationToken);
        return StatusCode(response.StatusCode, response);
    }

    /// <summary>Permanently discard a manual draft. Repeating this request is safe.</summary>
    [HttpDelete]
    [RequireOrganizationRole("Owner", "Manager")]
    public async Task<IActionResult> Delete(long unitId, CancellationToken cancellationToken)
    {
        Response.Headers.CacheControl = "no-store";
        var response = await drafts.Delete(unitId, cancellationToken);
        return StatusCode(response.StatusCode, response);
    }
}
