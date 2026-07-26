using brownstone_hub_api.Dtos.Impersonation;
using brownstone_hub_api.Services.ImpersonationService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;


namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/admin/impersonation")]
    public class AdminImpersonationController(IImpersonationService impersonationService) : ControllerBase
    {
        private readonly IImpersonationService _impersonationService = impersonationService;

        [Authorize(Policy = "AdminOnly")]
        [HttpPost("start")]
        public async Task<ActionResult<ImpersonationTokenDto>> Start(StartImpersonationDto request)
        {
            return await Execute(() => _impersonationService.StartAsync(request, User, IpAddress(), UserAgent()));
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpPost("start/{targetUserId:long}")]
        public async Task<ActionResult<ImpersonationTokenDto>> Start(long targetUserId, StartImpersonationDto request)
        {
            request.TargetUserId = targetUserId;
            return await Execute(() => _impersonationService.StartAsync(request, User, IpAddress(), UserAgent()));
        }

        [Authorize]
        [HttpGet("status")]
        public async Task<ActionResult<ImpersonationStatusDto>> Status()
        {
            return await Execute(() => _impersonationService.GetStatusAsync(User));
        }

        // The dedicated, tab-isolated impersonation refresh token is accepted only in JSON; no cookie is read or written.
        [AllowAnonymous]
        [HttpPost("refresh")]
        public async Task<ActionResult<ImpersonationTokenDto>> Refresh([FromBody] ImpersonationRefreshDto request)
        {
            return await Execute(() => _impersonationService.RefreshAsync(request.RefreshToken, IpAddress(), UserAgent()));
        }

        [Authorize]
        [HttpPost("stop")]
        public async Task<ActionResult<StopImpersonationDto>> Stop()
        {
            Request.Cookies.TryGetValue("refreshToken", out var actorRefreshToken);

            try
            {
                var result = await _impersonationService.StopAsync(User, actorRefreshToken ?? string.Empty, IpAddress(), UserAgent());
                SetRefreshTokenCookie(result.RefreshToken, result.RefreshTokenExpiresAt);
                return Ok(result.Response);
            }
            catch (ImpersonationException exception)
            {
                return StatusCode(exception.StatusCode, new { success = false, message = exception.Message });
            }
        }

        private async Task<ActionResult<T>> Execute<T>(Func<Task<T>> operation)
        {
            try
            {
                return Ok(await operation());
            }
            catch (ImpersonationException exception)
            {
                return StatusCode(exception.StatusCode, new { success = false, message = exception.Message });
            }
        }

        private string? IpAddress() => HttpContext.Connection.RemoteIpAddress?.ToString();
        private string? UserAgent() => Request.Headers.UserAgent.FirstOrDefault();

        private void SetRefreshTokenCookie(string refreshToken, DateTime expiresAt)
        {
            var secure = !HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment() || Request.IsHttps;
            Response.Cookies.Append("refreshToken", refreshToken, new CookieOptions
            {
                HttpOnly = true,
                Secure = secure,
                SameSite = secure ? SameSiteMode.None : SameSiteMode.Lax,
                Expires = expiresAt,
                Path = "/"
            });
        }
    }
}
