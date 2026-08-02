using System.Security.Claims;
using brownstone_hub_api.Dtos.Stripe;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.StripeRentPayments;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/admin/stripe/payees")]
    [Authorize(Roles = "Admin")]
    public sealed class StripePayeeReviewController(IStripeConnectedPayeeService service,
        IStripeConnectedAccountGateway accountGateway) : ControllerBase
    {
        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<StripePayeeReviewDto>>> List(
            [FromQuery] StripePayeeReviewStatus? status, CancellationToken cancellationToken)
        {
            var reviews = await service.ListAsync(status, cancellationToken);
            return Ok(reviews.Select(ToDto));
        }

        [HttpPost("{stripeAccountId}/review")]
        public async Task<ActionResult<StripePayeeReviewDto>> BeginReview(string stripeAccountId, CancellationToken cancellationToken) =>
            Ok(ToDto(await service.BeginReviewAsync(stripeAccountId, cancellationToken)));

        [HttpPost("{stripeAccountId}/approve")]
        public async Task<ActionResult<StripePayeeReviewDto>> Approve(string stripeAccountId,
            [FromBody] ApproveStripePayeeRequest request, CancellationToken cancellationToken)
        {
            var snapshot = await accountGateway.GetSnapshotAsync(stripeAccountId, cancellationToken);
            await service.SyncStripeSnapshotAsync(snapshot, null, cancellationToken);
            var review = await service.ApproveAsync(stripeAccountId, GetAdminUserId(), request.OrganizationId,
                request.Evidence, request.Notes, request.PropertyAuthorityAttested, cancellationToken);
            return Ok(ToDto(review));
        }

        [HttpPost("{stripeAccountId}/suspend")]
        public async Task<ActionResult<StripePayeeReviewDto>> Suspend(string stripeAccountId,
            [FromBody] SuspendStripePayeeRequest request, CancellationToken cancellationToken)
        {
            var review = await service.SuspendAsync(stripeAccountId, GetAdminUserId(), request.Reason, cancellationToken);
            return Ok(ToDto(review));
        }

        private long GetAdminUserId()
        {
            var value = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("userId");
            return long.TryParse(value, out var id) && id > 0
                ? id
                : throw new UnauthorizedAccessException("Administrator user ID is missing.");
        }

        private static StripePayeeReviewDto ToDto(StripeConnectedPayeeReview x) => new(
            x.StripeAccountId, x.UserId, x.Status, x.CreatedAt, x.ApprovedAt, x.ApprovedByUserId,
            x.ApprovalEvidence, x.ApprovalNotes, x.PropertyAuthorityAttested, x.ApprovedOrganizationId, x.SuspendedAt,
            x.SuspensionReason, x.LastStripeSnapshotAt, x.StripeDetailsSubmitted, x.StripePayoutsEnabled,
            x.StripeTransfersActive, x.CurrentlyDueRequirementCount, x.PastDueRequirementCount,
            x.StripeDisabledReason, x.PayoutSchedulePolicy, x.InstantPayoutsAllowed);
    }
}
