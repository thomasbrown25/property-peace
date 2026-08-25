using System.Security.Claims;
using brownstone_hub_api.Dtos.RentPaymentAccess;
using brownstone_hub_api.Services.RentPaymentAccess;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Route("api/admin/rent-payment-access/requests")]
[Authorize(Roles = "Admin")]
public sealed class AdminRentPaymentAccessController(IRentPaymentAccessService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<RentPaymentAccessListItemDto>>> List(
        [FromQuery] string? status,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await service.ListForAdminAsync(status, cancellationToken));
        }
        catch (RentPaymentAccessValidationException)
        {
            return BadRequest(new { message = "The rent-payment access status is invalid." });
        }
    }

    [HttpGet("{publicId:guid}")]
    public async Task<ActionResult<RentPaymentAccessAdminDetailDto>> Get(Guid publicId, CancellationToken cancellationToken)
    {
        var request = await service.GetForAdminAsync(publicId, cancellationToken);
        return request is null
            ? NotFound(new { message = "The rent-payment access request was not found." })
            : Ok(request);
    }

    [HttpPost("{publicId:guid}/approve")]
    public Task<ActionResult<RentPaymentAccessAdminDetailDto>> Approve(
        Guid publicId,
        [FromBody] ReviewRentPaymentAccessRequestDto review,
        CancellationToken cancellationToken) =>
        ReviewAsync(publicId, review, cancellationToken, static (access, id, actorId, details, token) =>
            access.ApproveAsync(id, actorId, details, token));

    [HttpPost("{publicId:guid}/reject")]
    public Task<ActionResult<RentPaymentAccessAdminDetailDto>> Reject(
        Guid publicId,
        [FromBody] ReviewRentPaymentAccessRequestDto review,
        CancellationToken cancellationToken) =>
        ReviewAsync(publicId, review, cancellationToken, static (access, id, actorId, details, token) =>
            access.RejectAsync(id, actorId, details, token), reasonRequired: true);

    [HttpPost("{publicId:guid}/suspend")]
    public Task<ActionResult<RentPaymentAccessAdminDetailDto>> Suspend(
        Guid publicId,
        [FromBody] ReviewRentPaymentAccessRequestDto review,
        CancellationToken cancellationToken) =>
        ReviewAsync(publicId, review, cancellationToken, static (access, id, actorId, details, token) =>
            access.SuspendAsync(id, actorId, details, token), reasonRequired: true);

    private async Task<ActionResult<RentPaymentAccessAdminDetailDto>> ReviewAsync(
        Guid publicId,
        ReviewRentPaymentAccessRequestDto? review,
        CancellationToken cancellationToken,
        Func<IRentPaymentAccessService, Guid, int, ReviewRentPaymentAccessRequestDto, CancellationToken, Task<RentPaymentAccessAdminDetailDto>> transition,
        bool reasonRequired = false)
    {
        if (!TryGetAdminUserId(out var actorUserId))
            return Unauthorized(new { message = "Administrator authentication is required." });
        if (review is null || (reasonRequired && string.IsNullOrWhiteSpace(review.DecisionReason)))
            return BadRequest(new { message = "A decision reason is required." });

        try
        {
            return Ok(await transition(service, publicId, actorUserId, review, cancellationToken));
        }
        catch (RentPaymentAccessNotFoundException)
        {
            return NotFound(new { message = "The rent-payment access request was not found." });
        }
        catch (RentPaymentAccessInvalidTransitionException)
        {
            return Conflict(new { message = "The requested rent-payment access transition is not allowed." });
        }
        catch (RentPaymentAccessConcurrencyException)
        {
            return Conflict(new { message = "The rent-payment access request changed. Refresh and try again." });
        }
        catch (RentPaymentAccessValidationException)
        {
            return BadRequest(new { message = "The review request is invalid." });
        }
    }

    private bool TryGetAdminUserId(out int userId)
    {
        if (HttpContext.Items.TryGetValue("UserId", out var item) && item is long itemUserId &&
            itemUserId is > 0 and <= int.MaxValue)
        {
            userId = (int)itemUserId;
            return true;
        }

        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("userId");
        if (int.TryParse(claim, out userId) && userId > 0)
            return true;

        userId = 0;
        return false;
    }
}
