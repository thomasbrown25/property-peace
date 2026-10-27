using brownstone_hub_api.Attributes;
using brownstone_hub_api.Dtos.ShortStay;
using brownstone_hub_api.Services.ShortStay;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Route("api/short-stay/collection-applications")]
[Authorize]
[RequireOrganizationRole("Owner", "Manager")]
public sealed class ShortStayCollectionController(ShortStayCollectionService service) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        PreventResponseCaching();
        var response = await service.Get(cancellationToken);
        return StatusCode(response.StatusCode, response);
    }

    [HttpGet("requirements")]
    public async Task<IActionResult> Requirements(CancellationToken cancellationToken)
    {
        PreventResponseCaching();
        var response = await service.GetRequirements(cancellationToken);
        return StatusCode(response.StatusCode, response);
    }

    [HttpPut("draft")]
    public async Task<IActionResult> Put([FromBody] SaveShortStayCollectionDraftDto request, CancellationToken cancellationToken)
    {
        PreventResponseCaching();
        var response = await service.Put(request, cancellationToken);
        return StatusCode(response.StatusCode, response);
    }

    [HttpPost("submit")]
    public async Task<IActionResult> Submit(CancellationToken cancellationToken)
    {
        PreventResponseCaching();
        var response = await service.Submit(cancellationToken);
        return StatusCode(response.StatusCode, response);
    }

    private void PreventResponseCaching()
    {
        Response.Headers.CacheControl = "no-store";
        Response.Headers.Pragma = "no-cache";
    }

    [HttpPost("{id:long}/identity-session")]
    public async Task<IActionResult> IdentitySession(long id, CancellationToken cancellationToken)
    {
        PreventResponseCaching();
        var response = await service.IdentitySession(id, cancellationToken);
        return StatusCode(response.StatusCode, response);
    }

    [HttpPost("{id:long}/identity-refresh")]
    public async Task<IActionResult> IdentityRefresh(long id, CancellationToken cancellationToken)
    {
        PreventResponseCaching();
        var response = await service.IdentityRefresh(id, cancellationToken);
        return StatusCode(response.StatusCode, response);
    }
}
