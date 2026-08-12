using System.Security.Claims;
using brownstone_hub_api.Dtos.Leads;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Services.Leads;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Route("api/public/listings/{listingId:long}/leads")]
[AllowAnonymous]
public sealed class PublicLeadController(ILeadService service, IPublicLeadSessionService sessions) : ControllerBase
{
    [HttpGet("pre-screen")]
    public async Task<IActionResult> PreScreen(long listingId, CancellationToken ct) =>
        await PublicExecute(async () => Ok(await service.GetPublicPreScreenAsync(listingId, ct)));

    [HttpPost("inquiries")]
    public async Task<IActionResult> Inquiry(long listingId, PublicInquiryRequest request, CancellationToken ct) =>
        await PublicExecute(async () => Accepted(await service.SubmitInquiryAsync(listingId, request, AbuseKey, ct)));

    [HttpPost("verify")]
    public async Task<IActionResult> Verify(long listingId, VerifyLeadContactRequest request, CancellationToken ct) =>
        await PublicExecute(async () =>
        {
            // Deliberately identical status and shape for valid, expired, consumed, and unknown credentials.
            // Invalid attempts receive an indistinguishable decoy session which cannot resolve to a lead.
            var leadId = await service.VerifyContactAsync(request.Token, AbuseKey, ct, listingId);
            return Ok(new PublicVerificationResult(sessions.Issue(listingId, leadId)));
        });

    [HttpPost("showings")]
    public async Task<IActionResult> BrowserBook(long listingId, BrowserBookShowingRequest request,
        CancellationToken ct) => await PublicExecute(async () =>
        {
            var authority = sessions.ResolveBookingAuthority(request.Session, listingId)
                ?? throw new LeadNotFoundException();
            return Ok(await service.BookShowingFromVerifiedSessionAsync(authority,
                new(request.AvailabilityId, request.TimeZoneId, request.IdempotencyKey), AbuseKey, ct));
        });

    [HttpGet("showing-availability")]
    public async Task<IActionResult> Availability(long listingId, [FromQuery] DateTime? fromUtc, CancellationToken ct) =>
        await PublicExecute(async () => Ok(await service.GetAvailableSlotsAsync(listingId,
            fromUtc ?? DateTime.UtcNow, ct)));

    [HttpPost("{leadId:long}/showings")]
    public async Task<IActionResult> Book(long listingId, long leadId, BookShowingRequest request, CancellationToken ct) =>
        await PublicExecute(async () => Ok(await service.BookShowingAsync(leadId, request, 0, AbuseKey, ct, listingId)));

    [HttpPost("showings/{showingId:long}/manage")]
    public async Task<IActionResult> Manage(long listingId, long showingId, ManageShowingRequest request,
        CancellationToken ct) => await PublicExecute(async () =>
        {
            var showing = await service.AuthenticatePublicShowingAsync(listingId, showingId,
                request.ManagementCode, AbuseKey, ct);
            return Ok(new ManageShowingResult(sessions.IssueManagement(listingId, showingId, showing.LeadId), showing));
        });

    [HttpPost("showings/{showingId:long}/reschedule")]
    public async Task<IActionResult> Reschedule(long listingId, long showingId, PublicRescheduleShowingRequest request,
        CancellationToken ct) => await PublicExecute(async () =>
        {
            var authority = sessions.ResolveManagementAuthority(request.Session, listingId, showingId)
                ?? throw new LeadNotFoundException();
            return Ok(await service.ReschedulePublicShowingAsync(authority,
                new(request.AvailabilityId, request.TimeZoneId, request.IdempotencyKey,
                    ConcurrencyToken: request.ConcurrencyToken), AbuseKey, ct));
        });

    [HttpPost("showings/{showingId:long}/cancel")]
    public async Task<IActionResult> Cancel(long listingId, long showingId, PublicCancelShowingRequest request,
        CancellationToken ct) => await PublicExecute(async () =>
        {
            var authority = sessions.ResolveManagementAuthority(request.Session, listingId, showingId)
                ?? throw new LeadNotFoundException();
            await service.CancelPublicShowingAsync(authority, request.ConcurrencyToken, AbuseKey, ct);
            return NoContent();
        });

    private string AbuseKey => HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    private async Task<IActionResult> PublicExecute(Func<Task<IActionResult>> action)
    {
        try { return await action(); }
        catch (LeadRateLimitException) { return StatusCode(429, GenericProblem(429, "Request could not be processed.")); }
        catch (LeadConcurrencyException) { return Conflict(GenericProblem(409, "Request could not be processed.")); }
        catch (LeadConflictException) { return Conflict(GenericProblem(409, "Request could not be processed.")); }
        catch (LeadValidationException) { return BadRequest(GenericProblem(400, "Request could not be processed.")); }
        catch (LeadNotFoundException) { return NotFound(GenericProblem(404, "Request could not be processed.")); }
    }

    private static ProblemDetails GenericProblem(int status, string title) => new() { Status = status, Title = title };
}

[ApiController]
[Route("api/leads")]
[Authorize(Roles = "Landlord,Admin")]
public sealed class LeadController(ILeadService service) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Pipeline([FromQuery] LeadStatus? status, [FromQuery] long? ownerUserId,
        [FromQuery] long? listingId, [FromQuery] DateTime? followUpFromUtc, [FromQuery] DateTime? followUpToUtc,
        [FromQuery] bool? followUpMissing, CancellationToken ct) =>
        await Execute(async (org, user) => Ok(await service.GetPipelineAsync(org, user,
            new(status, ownerUserId, listingId, followUpFromUtc, followUpToUtc, followUpMissing), ct)));

    [HttpGet("{leadId:long}")]
    public async Task<IActionResult> Detail(long leadId, CancellationToken ct) =>
        await Execute(async (org, user) => Ok(await service.GetLeadAsync(org, user, leadId, ct)));

    [HttpPatch("{leadId:long}")]
    public async Task<IActionResult> Update(long leadId, UpdateLeadRequest request, CancellationToken ct) =>
        await Execute(async (org, user) => Ok(await service.UpdateLeadAsync(org, user, leadId, request, ct)));

    [HttpGet("{leadId:long}/notes")]
    public async Task<IActionResult> Notes(long leadId, CancellationToken ct) =>
        await Execute(async (org, user) => Ok(await service.GetNotesAsync(org, user, leadId, ct)));

    [HttpPost("{leadId:long}/notes")]
    public async Task<IActionResult> Note(long leadId, AddLeadNoteRequest request, CancellationToken ct) =>
        await Execute(async (org, user) =>
        {
            await service.AddNoteAsync(org, user, leadId, request.Body, ct);
            return NoContent();
        });

    [HttpGet("{leadId:long}/tasks")]
    public async Task<IActionResult> Tasks(long leadId, CancellationToken ct) =>
        await Execute(async (org, user) => Ok(await service.GetTasksAsync(org, user, leadId, ct)));

    [HttpPost("{leadId:long}/tasks")]
    public async Task<IActionResult> AddTask(long leadId, AddLeadTaskRequest request, CancellationToken ct) =>
        await Execute(async (org, user) => Ok(await service.AddTaskAsync(org, user, leadId, request.Title,
            request.AssigneeUserId, request.DueAtUtc, ct)));

    [HttpPost("{leadId:long}/tasks/{taskId:long}/complete")]
    public async Task<IActionResult> CompleteTask(long leadId, long taskId, CompleteLeadTaskRequest request,
        CancellationToken ct) => await Execute(async (org, user) =>
            Ok(await service.CompleteTaskAsync(org, user, leadId, taskId, request.ConcurrencyToken, ct)));

    [HttpPost("{leadId:long}/convert-to-application")]
    public async Task<IActionResult> Convert(long leadId, CancellationToken ct) =>
        await Execute(async (org, user) => Ok(await service.ConvertToApplicationAsync(org, user, leadId, ct)));

    [HttpPut("listings/{listingId:long}/pre-screen")]
    public async Task<IActionResult> Config(long listingId, PreScreenConfigurationDto request, CancellationToken ct) =>
        await Execute(async (org, user) => Ok(await service.SetPreScreenConfigurationAsync(org, user, listingId,
            request, ct)));

    [HttpPost("listings/{listingId:long}/showing-availability")]
    public async Task<IActionResult> AddAvailability(long listingId, AddShowingAvailabilityRequest request,
        CancellationToken ct) => await Execute(async (org, user) => Ok(await service.AddAvailabilityAsync(org, user,
            listingId, request.StartsAt, request.EndsAt, request.TimeZoneId, ct)));

    [HttpGet("listings/{listingId:long}/showing-availability")]
    public async Task<IActionResult> Availability(long listingId, CancellationToken ct) =>
        await Execute(async (org, user) => Ok(await service.GetStaffAvailabilityAsync(org, user, listingId, ct)));

    [HttpGet("showings")]
    public async Task<IActionResult> Showings([FromQuery] long? listingId, CancellationToken ct) =>
        await Execute(async (org, user) => Ok(await service.GetStaffShowingsAsync(org, user, listingId, ct)));

    [HttpPut("listings/{listingId:long}/showing-availability/{availabilityId:long}")]
    public async Task<IActionResult> UpdateAvailability(long listingId, long availabilityId,
        UpdateShowingAvailabilityRequest request, CancellationToken ct) => await Execute(async (org, user) =>
            Ok(await service.UpdateAvailabilityAsync(org, user, listingId, availabilityId, request, ct)));

    [HttpPost("showings/{showingId:long}/cancel")]
    public async Task<IActionResult> Cancel(long showingId, CancellationToken ct) =>
        await Execute(async (org, user) =>
        {
            await service.CancelShowingAsStaffAsync(org, user, showingId, IfMatch(), ct);
            return NoContent();
        });

    [HttpPost("showings/{showingId:long}/reschedule")]
    public async Task<IActionResult> Reschedule(long showingId, RescheduleShowingRequest request, CancellationToken ct) =>
        await Execute(async (org, user) => Ok(await service.RescheduleShowingAsync(org, user, showingId,
            request with { ConcurrencyToken = request.ConcurrencyToken ?? IfMatch() }, ct)));

    [HttpPost("showings/{showingId:long}/complete")]
    public async Task<IActionResult> Complete(long showingId, CompleteShowingRequest request, CancellationToken ct) =>
        await Execute(async (org, user) =>
        {
            await service.CompleteShowingAsync(org, user, showingId, request.NoShow,
                string.IsNullOrWhiteSpace(request.ConcurrencyToken) ? IfMatch() : request.ConcurrencyToken, ct);
            return NoContent();
        });

    private string IfMatch() => Request.Headers.IfMatch.FirstOrDefault() ?? "";

    private async Task<IActionResult> Execute(Func<long, long, Task<IActionResult>> action)
    {
        if (!Scope(out var organizationId, out var userId)) return Forbid();
        try { return await action(organizationId, userId); }
        catch (LeadForbiddenException) { return Forbid(); }
        catch (LeadNotFoundException) { return NotFound(); }
        catch (LeadConcurrencyException e) { return StatusCode(412, new ProblemDetails { Status = 412, Title = e.Message }); }
        catch (LeadConflictException e) { return Conflict(new ProblemDetails { Status = 409, Title = e.Message }); }
        catch (LeadValidationException e) { return BadRequest(new ProblemDetails { Status = 400, Title = e.Message }); }
    }

    private bool Scope(out long organizationId, out long userId)
    {
        organizationId = HttpContext.Items["OrganizationId"] as long? ?? 0;
        userId = HttpContext.Items["UserId"] as long? ?? 0;
        if (userId == 0) long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out userId);
        return organizationId > 0 && userId > 0;
    }
}
