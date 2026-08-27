using System.Security.Claims;
using brownstone_hub_api.Dtos.Mfa;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.MfaService;
using brownstone_hub_api.Services.UserService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

/// <summary>
/// MFA contract: authenticated enrollment/status endpoints configure SMS or TOTP.
/// Password login returns mfaRequired/challengeId instead of credentials when MFA is enabled;
/// POST login/verify is the only MFA path that creates access/refresh credentials.
/// Existing passkey authentication remains passwordless and independently creates its session.
/// </summary>
[ApiController]
[Route("api/mfa")]
public sealed class MfaController(IMfaService mfa, IUserService users, IWebHostEnvironment environment) : ControllerBase
{
    [Authorize]
    [HttpGet("status")]
    public async Task<ActionResult<MfaStatusDto>> Status(CancellationToken ct) => Ok(await mfa.GetStatusAsync(UserId(), ct));

    [Authorize]
    [HttpPost("enrollment/sms")]
    public async Task<ActionResult<MfaChallengeDto>> EnrollSms(SmsEnrollmentRequest request, CancellationToken ct)
    {
        try { return Ok(await mfa.BeginSmsEnrollmentAsync(UserId(), request.PhoneNumber, ct)); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException) { return StatusCode(503, new { message = "Verification code delivery is unavailable." }); }
    }

    [Authorize]
    [HttpPost("enrollment/totp")]
    public async Task<ActionResult<TotpEnrollmentDto>> EnrollTotp(CancellationToken ct) => Ok(await mfa.BeginTotpEnrollmentAsync(UserId(), ct));

    [Authorize]
    [HttpPost("enrollment/verify")]
    public async Task<ActionResult<MfaEnrollmentResult>> VerifyEnrollment(VerifyMfaRequest request, CancellationToken ct)
    {
        var result = await mfa.VerifyEnrollmentAsync(UserId(), request.ChallengeId, request.Code, ct);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [Authorize]
    [HttpDelete("enrollment/{method}")]
    public async Task<IActionResult> Disable(MfaMethod method, CancellationToken ct)
    {
        await mfa.DisableAsync(UserId(), method, ct);
        return NoContent();
    }

    [AllowAnonymous]
    [HttpPost("login/verify")]
    public async Task<ActionResult<PasswordLoginResponseDto>> VerifyLogin(VerifyMfaRequest request, CancellationToken ct)
    {
        var verified = await mfa.VerifyLoginAsync(request.ChallengeId, request.Code, ct);
        if (!verified.Success || !verified.UserId.HasValue)
            return Unauthorized(new PasswordLoginResponseDto { Success = false, Message = "The MFA challenge is invalid or expired." });

        var isPersistent = request.RememberMe ?? true;
        var session = await users.CreateRefreshSession(verified.UserId.Value, isPersistent);
        SetRefreshCookie(session.RefreshToken, session.RefreshTokenExpiresAt, session.IsPersistent);
        return Ok(new PasswordLoginResponseDto { Success = true, Data = session.User });
    }

    private long UserId()
    {
        var value = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("userId")
            ?? User.FindFirstValue("sub");
        return long.TryParse(value, out var id) ? id : throw new UnauthorizedAccessException();
    }

    private void SetRefreshCookie(string token, DateTime expires, bool isPersistent)
    {
        var secure = !environment.IsDevelopment() || Request.IsHttps;
        var options = new CookieOptions
        {
            HttpOnly = true, Secure = secure, SameSite = secure ? SameSiteMode.None : SameSiteMode.Lax,
            Path = "/"
        };
        if (isPersistent) options.Expires = expires;
        Response.Cookies.Append("refreshToken", token, options);
    }
}
