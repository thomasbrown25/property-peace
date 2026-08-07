using System.Security.Cryptography;
using System.Text.Json;
using brownstone_hub_api.Dtos.Screening;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.Screening;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Route("api/screenings/applicant")]
[AllowAnonymous]
public sealed class ScreeningApplicantController : ControllerBase
{
    private const string SessionCookie = "pp-screening-session";
    private readonly ITenantScreeningService _screening;
    private readonly ITenantScreeningDecisionService _decisions;
    private readonly ITenantScreeningAdverseActionService? _adverseActions;
    private readonly IDataProtector _sessionProtector;
    private readonly TimeProvider _clock;

    public ScreeningApplicantController(ITenantScreeningService screening, ITenantScreeningDecisionService decisions,
        ITenantScreeningAdverseActionService? adverseActions = null, IDataProtectionProvider? dataProtectionProvider = null,
        TimeProvider? clock = null)
    {
        _screening = screening;
        _decisions = decisions;
        _adverseActions = adverseActions;
        _sessionProtector = (dataProtectionProvider ?? new EphemeralDataProtectionProvider())
            .CreateProtector("property-peace.screening-applicant-session.v1");
        _clock = clock ?? TimeProvider.System;
    }

    [HttpPost("session")]
    public Task<IActionResult> CreateSession(CancellationToken ct) => WithHeaderToken(async token =>
    {
        // Resolve current state first so revoked and expired capabilities cannot become browser sessions.
        await _screening.GetApplicantStatusAsync(token, ct);
        var expiresAt = _clock.GetUtcNow().AddMinutes(15);
        var protectedValue = _sessionProtector.Protect(JsonSerializer.Serialize(new ApplicantSession(token, expiresAt)));
        Response.Cookies.Append(SessionCookie, protectedValue, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Path = "/api/screenings/applicant",
            Expires = expiresAt,
            MaxAge = TimeSpan.FromMinutes(15),
            IsEssential = true
        });
        return NoContent();
    });

    [HttpGet("invitation")]
    public Task<IActionResult> Invitation(CancellationToken ct) => WithToken(async token =>
        Ok(await _screening.GetApplicantInvitationAsync(token, ct)));

    [HttpGet("status")]
    public Task<IActionResult> Status(CancellationToken ct) => WithToken(async token =>
        Ok(await _screening.GetApplicantStatusAsync(token, ct)));

    [HttpGet("adverse-action")]
    public Task<IActionResult> AdverseAction(CancellationToken ct) => WithToken(async token =>
        Ok(await (_adverseActions ?? throw new ScreeningUnavailableException()).GetApplicantNoticeAsync(token, ct)));

    [HttpPost("adverse-action/reconsideration")]
    public Task<IActionResult> Reconsider([FromBody] ReconsiderationDto request, CancellationToken ct) => WithToken(async token =>
        Accepted(await (_adverseActions ?? throw new ScreeningUnavailableException()).RequestApplicantReconsiderationAsync(token, request.Reason, ct)));

    [HttpPost("consent/start")]
    public Task<IActionResult> ConsentAndStart([FromBody] ApplicantConsentDto request, CancellationToken ct) => WithToken(async token =>
    {
        if (!request.DisclosureAccepted || !request.AuthorizationAccepted)
            return BadRequest(new { message = "Disclosure and authorization consent are required." });
        var result = await _screening.ConsentAndStartAsync(token, request.ExpectedQuoteReference,
            request.DisclosureVersion, request.AuthorizationVersion,
            HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            Request.Headers.UserAgent.ToString(), ct);
        if (result.ContinuationUri is not null && result.ContinuationExpiresAt.HasValue)
            return Ok(new ScreeningContinuationExchangeDto(result.ContinuationUri, result.ContinuationExpiresAt.Value));
        return Ok(new { result.Status, result.Outcome });
    });

    [HttpPost("report-access")]
    public Task<IActionResult> ReportAccess(CancellationToken ct) => WithToken(async token =>
    {
        var result = await _decisions.RequestApplicantReportAccessAsync(token, ScreeningReportAccessPurpose.DisputeReview, ct);
        return Ok(new ScreeningReportAccessExchangeDto(result.AccessUri, result.ExpiresAt));
    });

    [HttpPost("disputes")]
    public Task<IActionResult> Dispute([FromBody] ScreeningDisputeDto request, CancellationToken ct) => WithToken(async token =>
    {
        var x = await _decisions.OpenDisputeAsync(ScreeningDisputeOpenCommand.ForApplicant(token,
            request.ReportRevisionId, request.IssueCodes, request.Narrative), ct);
        return Accepted(new ScreeningDisputeResult(x.Id, x.Status, x.OpenedAt, x.ResolvedAt,
            JsonSerializer.Deserialize<string[]>(x.IssueCodesJson) ?? []));
    });

    private Task<IActionResult> WithToken(Func<string, Task<IActionResult>> action)
    {
        SecureHeaders();
        var token = ReadHeaderToken() ?? ReadSessionToken();
        return token is null
            ? Task.FromResult<IActionResult>(Unauthorized(new { message = "Valid screening access is required." }))
            : Execute(token, action);
    }

    private Task<IActionResult> WithHeaderToken(Func<string, Task<IActionResult>> action)
    {
        SecureHeaders();
        var token = ReadHeaderToken();
        return token is null
            ? Task.FromResult<IActionResult>(Unauthorized(new { message = "A valid screening access header is required." }))
            : Execute(token, action);
    }

    private async Task<IActionResult> Execute(string token, Func<string, Task<IActionResult>> action)
    {
        try { return await action(token); }
        catch (ScreeningUnavailableException) { return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Tenant screening is temporarily unavailable." }); }
        catch (ScreeningInvalidInvitationException) { return StatusCode(StatusCodes.Status403Forbidden, new { message = "Screening access was denied." }); }
        catch (ScreeningAccessExpiredException) { return StatusCode(StatusCodes.Status410Gone, new { message = "Screening access has expired or was revoked." }); }
        catch (ScreeningInvitationExpiredException) { return StatusCode(StatusCodes.Status410Gone, new { message = "The screening quote has expired." }); }
        catch (ScreeningConsentMismatchException) { return Conflict(new { message = "The quote or consent version changed. Refresh the invitation." }); }
        catch (ScreeningAuthorizationException) { return StatusCode(StatusCodes.Status403Forbidden, new { message = "Screening access was denied." }); }
        catch (ScreeningResourceNotFoundException) { return NotFound(new { message = "The requested screening resource was not found." }); }
        catch (ScreeningProviderCorrelationException) { return UnprocessableEntity(new { message = "The screening request could not be correlated." }); }
        catch (ScreeningPolicyViolationException) { return UnprocessableEntity(new { message = "The screening request cannot be completed." }); }
        catch (ScreeningInvalidStateException) { return Conflict(new { message = "The screening operation is not valid in the current state." }); }
        catch (ScreeningReportAccessDeniedException) { return StatusCode(StatusCodes.Status403Forbidden, new { message = "Screening report access was denied." }); }
        catch (ScreeningReportAccessException) { return StatusCode(StatusCodes.Status502BadGateway, new { message = "Report access could not be completed." }); }
        catch (InvalidOperationException) { return Conflict(new { message = "The screening operation is not valid in the current state." }); }
        catch (ArgumentException) { return BadRequest(new { message = "The screening request is invalid." }); }
    }

    private string? ReadHeaderToken()
    {
        if (!Request.Headers.TryGetValue("X-Screening-Access", out var values) || values.Count != 1) return null;
        var token = values[0];
        return IsValidToken(token) ? token : null;
    }

    private string? ReadSessionToken()
    {
        if (!Request.Cookies.TryGetValue(SessionCookie, out var value) || string.IsNullOrWhiteSpace(value)) return null;
        try
        {
            var session = JsonSerializer.Deserialize<ApplicantSession>(_sessionProtector.Unprotect(value));
            return session is not null && session.ExpiresAt > _clock.GetUtcNow() && IsValidToken(session.Token) ? session.Token : null;
        }
        catch (Exception exception) when (exception is CryptographicException or JsonException) { return null; }
    }

    private static bool IsValidToken(string? token) =>
        !string.IsNullOrWhiteSpace(token) && token.Length <= 500 && !token.Any(char.IsControl);

    private void SecureHeaders()
    {
        Response.Headers.CacheControl = "no-store";
        Response.Headers["Referrer-Policy"] = "no-referrer";
        Response.Headers["X-Robots-Tag"] = "noindex, nofollow";
        Response.Headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";
    }

    private sealed record ApplicantSession(string Token, DateTimeOffset ExpiresAt);
}
