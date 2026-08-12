using System.Security.Claims;
using brownstone_hub_api.Dtos.LeasingPipeline;
using brownstone_hub_api.Services.LeasingPipeline;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Route("api/leasing-pipeline")]
[Authorize(Roles = "Landlord,Admin")]
public sealed class LeasingPipelineController(ILeasingPipelineService service) : ControllerBase
{
    [HttpGet("properties/{propertyId:long}")]
    public Task<ActionResult<LeasingPipelineDto>> Property(long propertyId, [FromQuery] long? unitId, CancellationToken ct) =>
        ExecuteRead((org, user) => service.GetForPropertyAsync(org, user, propertyId, unitId, ct));

    [HttpGet("listings/{listingId:long}")]
    public Task<ActionResult<LeasingPipelineDto>> Listing(long listingId, CancellationToken ct) =>
        ExecuteRead((org, user) => service.GetForListingAsync(org, user, listingId, ct));

    [HttpGet("applications/{applicationId:long}")]
    public Task<ActionResult<LeasingPipelineDto>> Application(long applicationId, CancellationToken ct) =>
        ExecuteRead((org, user) => service.GetForApplicationAsync(org, user, applicationId, ct));

    [HttpPost("properties/{propertyId:long}/units/{unitId:long}/showings")]
    public async Task<ActionResult<LeasingPipelineDto>> Showing(long propertyId, long unitId,
        [FromBody] ShowingTransitionRequest request, CancellationToken ct)
    {
        if (!TryScope(out var org, out var user)) return Forbid();
        var revision = Request.Headers.IfMatch.FirstOrDefault();
        var key = Request.Headers["Idempotency-Key"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(revision) || string.IsNullOrWhiteSpace(key))
            return StatusCode(StatusCodes.Status428PreconditionRequired,
                new ProblemDetails { Status = 428, Title = "If-Match and Idempotency-Key are required." });
        try
        {
            return Ok(await service.TransitionShowingAsync(org, user, propertyId, unitId, revision, key,
                HttpContext.TraceIdentifier, request, ct));
        }
        catch (PipelineNotFoundException) { return NotFound(); }
        catch (PipelineForbiddenException) { return Forbid(); }
        catch (PipelineConflictException ex) { return Conflict(new ProblemDetails { Status = 409, Title = ex.Message }); }
        catch (PipelineValidationException ex) { return BadRequest(new ProblemDetails { Status = 400, Title = ex.Message }); }
    }

    private async Task<ActionResult<LeasingPipelineDto>> ExecuteRead(Func<long, long, Task<LeasingPipelineDto>> action)
    {
        if (!TryScope(out var org, out var user)) return Forbid();
        try { return Ok(await action(org, user)); }
        catch (PipelineNotFoundException) { return NotFound(); }
        catch (PipelineForbiddenException) { return Forbid(); }
        catch (PipelineConflictException ex) { return Conflict(new ProblemDetails { Status = 409, Title = ex.Message }); }
        catch (PipelineValidationException ex) { return BadRequest(new ProblemDetails { Status = 400, Title = ex.Message }); }
    }

    private bool TryScope(out long organizationId, out long userId)
    {
        organizationId = HttpContext.Items.TryGetValue("OrganizationId", out var org) && org is long oid ? oid : 0;
        userId = HttpContext.Items.TryGetValue("UserId", out var actor) && actor is long uid ? uid : 0;
        if (userId <= 0) long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out userId);
        return organizationId > 0 && userId > 0;
    }
}
