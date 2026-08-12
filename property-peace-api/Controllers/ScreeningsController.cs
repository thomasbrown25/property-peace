using brownstone_hub_api.Config;
using brownstone_hub_api.Domain.Screening;
using brownstone_hub_api.Dtos.Screening;
using brownstone_hub_api.Filters;
using brownstone_hub_api.Helpers;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.Screening;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Route("api/screenings")]
[Authorize(Roles = "Landlord,Admin")]
[RequireFeatureReady(FeatureKeys.TenantScreening)]
public sealed class ScreeningsController : ControllerBase
{
    private readonly ITenantScreeningService _screening;
    private readonly ITenantScreeningDecisionService _decisions;
    private readonly ITenantScreeningAdverseActionService _adverseActions;
    private readonly IUserRepository _users;

    public ScreeningsController(ITenantScreeningService screening, ITenantScreeningDecisionService decisions,
        ITenantScreeningAdverseActionService adverseActions, IUserRepository users) =>
        (_screening, _decisions, _adverseActions, _users) = (screening, decisions, adverseActions, users);

    [HttpPost("invitations")]
    public async Task<IActionResult> CreateInvitation([FromBody] CreateScreeningInvitationDto request,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey, CancellationToken cancellationToken)
    {
        if (!TryIdempotencyKey(idempotencyKey, out var key)) return BadRequest(new { message = "A valid Idempotency-Key header is required." });
        return await Staff(async (org, user) => Accepted(await _screening.CreateInvitationAsync(
            new CreateTenantScreeningInvitationCommand(org, user, request.ApplicationId, request.Package, request.Payer, key), cancellationToken)));
    }

    [HttpGet("{orderId:long}")]
    public Task<IActionResult> GetOrder(long orderId, CancellationToken ct) => Staff(async (org, user) =>
        (await _screening.GetStaffOrderAsync(org, user, orderId, ct)) is { } result ? Ok(result) : NotFound());

    [HttpGet("application/{applicationId:long}")]
    public Task<IActionResult> GetByApplication(long applicationId, CancellationToken ct) =>
        Staff(async (org, user) => Ok(await _screening.ListStaffOrdersByApplicationAsync(org, user, applicationId, ct)));

    [HttpGet("{orderId:long}/detail")]
    public Task<IActionResult> GetDetail(long orderId, CancellationToken ct) => Staff(async (org, user) =>
        (await _screening.GetStaffDetailAsync(org, user, orderId, ct)) is { } result ? Ok(result) : NotFound());

    [HttpGet("application/{applicationId:long}/details")]
    public Task<IActionResult> GetDetailsByApplication(long applicationId, CancellationToken ct) => Staff(async (org, user) =>
        Ok(await _screening.ListStaffDetailsByApplicationAsync(org, user, applicationId, ct)));

    [HttpGet("application/{applicationId:long}/quote-options")]
    public Task<IActionResult> QuoteOptions(long applicationId, CancellationToken ct) => Staff(async (org, user) =>
        Ok(await _screening.GetQuoteOptionsAsync(org, user, applicationId, ct)));

    [HttpPost("{orderId:long}/applicant-access/revoke")]
    public Task<IActionResult> RevokeApplicantAccess(long orderId, CancellationToken ct) => Staff(async (org, user) =>
        Ok(await _screening.RevokeApplicantAccessAsync(org, user, orderId, ct)));

    [HttpPost("{orderId:long}/applicant-access/rotate")]
    public Task<IActionResult> RotateApplicantAccess(long orderId, CancellationToken ct) => Staff(async (org, user) =>
        Ok(await _screening.RotateApplicantAccessAsync(org, user, orderId, ct)));

    [HttpPost("{orderId:long}/retry-invitation")]
    public Task<IActionResult> RetryInvitation(long orderId, CancellationToken ct) => Staff(async (org, user) =>
    { await _screening.RetryInvitationDeliveryAsync(org, user, orderId, ct); return Accepted(); });

    [HttpPost("{orderId:long}/reconcile")]
    public Task<IActionResult> Reconcile(long orderId, CancellationToken ct) =>
        Staff(async (org, user) => Ok(await _screening.ReconcileOrderAsync(org, user, orderId, ct)));

    [HttpPost("{orderId:long}/report-access")]
    public Task<IActionResult> ReportAccess(long orderId, [FromBody] ScreeningReportAccessDto request, CancellationToken ct) => Staff(async (org, user) =>
    {
        if (!Enum.IsDefined(request.Purpose)) return BadRequest(new { message = "Invalid report access purpose." });
        var result = await _decisions.RequestReportAccessAsync(org, user, orderId, request.Purpose, request.ElevationId, ct);
        NoStore();
        return Ok(new ScreeningReportAccessExchangeDto(result.AccessUri, result.ExpiresAt));
    });

    [HttpPost("{orderId:long}/decision")]
    public Task<IActionResult> HumanDecision(long orderId, [FromBody] HumanScreeningDecisionDto request, CancellationToken ct) => Staff(async (org, user) =>
    {
        var x = await _decisions.RecordHumanDecisionAsync(new RecordHumanScreeningDecisionCommand(org, user, orderId,
            request.Decision, request.CriteriaVersion, request.ReportRevisionId, request.ReasonCodes), ct);
        return Ok(new ScreeningDecisionResult(x.Id, x.Revision, x.Decision,
            System.Text.Json.JsonSerializer.Deserialize<string[]>(x.ReasonCodesJson) ?? [], x.CreatedAt));
    });

    [HttpPost("{orderId:long}/disputes")]
    public Task<IActionResult> StaffDispute(long orderId, [FromBody] ScreeningDisputeDto request, CancellationToken ct) => Staff(async (org, user) =>
    {
        var x = await _decisions.OpenDisputeAsync(ScreeningDisputeOpenCommand.ForStaff(org, user, orderId,
            request.ReportRevisionId, request.IssueCodes, request.Narrative), ct);
        return Accepted(new ScreeningDisputeResult(x.Id, x.Status, x.OpenedAt, x.ResolvedAt,
            System.Text.Json.JsonSerializer.Deserialize<string[]>(x.IssueCodesJson) ?? []));
    });

    [HttpPost("{orderId:long}/cancel-or-expire")]
    public Task<IActionResult> CancelOrExpire(long orderId, [FromBody] ScreeningCancellationDto request, CancellationToken ct) => Staff(async (org, user) =>
    { await _decisions.CancelOrExpireAsync(new ScreeningOrderCancellationCommand(org, user, orderId, request.ReasonCode), ct); return NoContent(); });

    [HttpPost("{orderId:long}/adverse-actions")]
    public Task<IActionResult> CreateAdverseAction(long orderId, [FromBody] CreateAdverseActionDto request, CancellationToken ct) => Staff(async (org, user) =>
        Accepted(await _adverseActions.CreateAndDeliverAsync(new CreateScreeningAdverseActionCommand(org, user, orderId,
            request.DecisionRevisionId, request.ActionType, request.Channel), ct)));

    [HttpPost("adverse-actions/{adverseActionId:long}/retry")]
    public Task<IActionResult> RetryAdverseAction(long adverseActionId, [FromBody] RetryAdverseActionDto request, CancellationToken ct) => Staff(async (org, user) =>
        Accepted(await _adverseActions.RetryDeliveryAsync(new RetryScreeningAdverseActionDeliveryCommand(org, user, adverseActionId, request.Channel), ct)));

    [HttpPost("adverse-actions/{adverseActionId:long}/reconsideration")]
    public Task<IActionResult> Reconsider(long adverseActionId, [FromBody] ReconsiderationDto request, CancellationToken ct) => Staff(async (org, user) =>
        Accepted(await _adverseActions.RequestReconsiderationAsync(new ScreeningReconsiderationCommand(org, user, adverseActionId, request.Reason), ct)));

    [HttpPost("adverse-actions/{adverseActionId:long}/reconsideration/resolve")]
    public Task<IActionResult> ResolveReconsideration(long adverseActionId, [FromBody] ResolveReconsiderationDto request, CancellationToken ct) => Staff(async (org, user) =>
        Ok(await _adverseActions.ResolveReconsiderationAsync(new ResolveScreeningReconsiderationCommand(org, user, adverseActionId,
            request.Reason, request.NewDecisionRevisionId), ct)));

    private async Task<IActionResult> Staff(Func<long, long, Task<IActionResult>> action)
    {
        var org = this.GetCurrentOrganizationId();
        if (org is null or <= 0) return Forbid();
        var user = await _users.GetCurrentUser();
        if (user is null || user.Id <= 0) return Unauthorized();
        try { return await action(org.Value, user.Id); }
        catch (ScreeningUnavailableException) { return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Tenant screening is temporarily unavailable." }); }
        catch (ScreeningAuthorizationException) { return Forbid(); }
        catch (ScreeningResourceNotFoundException) { return NotFound(); }
        catch (ScreeningInvalidInvitationException) { return NotFound(); }
        catch (ScreeningIdempotencyConflictException) { return Conflict(new { message = "The request conflicts with an earlier request." }); }
        catch (ScreeningPolicyViolationException) { return UnprocessableEntity(new { message = "The screening request cannot be completed." }); }
        catch (ScreeningProviderCorrelationException) { return UnprocessableEntity(new { message = "The screening request could not be correlated." }); }
        catch (ScreeningInvitationExpiredException) { return StatusCode(StatusCodes.Status410Gone, new { message = "The screening quote has expired." }); }
        catch (ScreeningAccessExpiredException) { return StatusCode(StatusCodes.Status410Gone, new { message = "Screening access has expired or was revoked." }); }
        catch (ScreeningConsentMismatchException) { return Conflict(new { message = "The screening request conflicts with current consent evidence." }); }
        catch (ScreeningInvalidStateException) { return Conflict(new { message = "The screening operation is not valid in the current state." }); }
        catch (ScreeningReportAccessDeniedException) { return Forbid(); }
        catch (ScreeningReportAccessException) { return StatusCode(StatusCodes.Status502BadGateway, new { message = "Report access could not be completed." }); }
        catch (InvalidOperationException) { return Conflict(new { message = "The screening operation is not valid in the current state." }); }
        catch (ArgumentException) { return BadRequest(new { message = "The screening request is invalid." }); }
    }

    private bool TryIdempotencyKey(string? value, out string key)
    {
        key = value?.Trim() ?? string.Empty;
        return key.Length is > 0 and <= 200 && !key.Any(char.IsControl);
    }
    private void NoStore()
    {
        Response.Headers.CacheControl = "no-store";
        Response.Headers["Referrer-Policy"] = "no-referrer";
    }
}
