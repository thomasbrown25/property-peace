using brownstone_hub_api.Services.ShortStay;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Route("api/admin/short-stay-collection-applications")]
[Authorize(Roles = "Admin")]
public sealed class AdminShortStayCollectionController(AdminShortStayCollectionService service) : ControllerBase
{
    private IActionResult Result<T>(Models.ServiceResponse<T> response)
    {
        Response.Headers.CacheControl = "no-store";
        Response.Headers.Pragma = "no-cache";
        return StatusCode(response.StatusCode, response);
    }
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct) => Result(await service.List(ct));
    [HttpPost("{id:long}/begin-review")]
    public async Task<IActionResult> BeginReview(long id, CancellationToken ct) => Result(await service.BeginReview(id, ct));
    [HttpPost("{id:long}/approve")]
    public async Task<IActionResult> Approve(long id, [FromBody] ApproveShortStayCollectionRequest? request, CancellationToken ct) =>
        Result(await service.Approve(id, request?.CaseReference, request?.PropertyAuthorityConfirmed == true, ct));
    [HttpPost("{id:long}/suspend")]
    public async Task<IActionResult> Suspend(long id, [FromBody] ShortStayCollectionReasonRequest? request, CancellationToken ct) =>
        Result(await service.Suspend(id, request?.ReasonCode, ct));
    [HttpPost("{id:long}/reject")]
    public async Task<IActionResult> Reject(long id, [FromBody] ShortStayCollectionReasonRequest? request, CancellationToken ct) =>
        Result(await service.Reject(id, request?.ReasonCode, ct));
}
