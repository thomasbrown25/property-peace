using System.Text.RegularExpressions;
using brownstone_hub_api.Services.PushNotifications;
using brownstone_hub_api.Services.UserService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

public sealed record ExpoPushTokenRequest(string? Token);

[ApiController]
[Route("api/notifications/push-tokens")]
[Authorize(Roles = "Tenant,Landlord,Admin")]
public sealed class ExpoPushTokenController(IUserService users, IExpoPushTokenService tokens) : ControllerBase
{
    private static readonly Regex ExpoToken = new(@"^(?:ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{1,200}\]$", RegexOptions.Compiled | RegexOptions.CultureInvariant);

    [HttpPost]
    public async Task<IActionResult> Register([FromBody] ExpoPushTokenRequest request)
    {
        if (request?.Token is null || !ExpoToken.IsMatch(request.Token)) return BadRequest(new { Message = "Invalid Expo push token" });
        var user = await users.GetCurrentUserIdAsync();
        if (!user.Success || !user.Data.HasValue) return Unauthorized();
        await tokens.RegisterAsync(user.Data.Value, request.Token);
        return NoContent();
    }

    [HttpDelete]
    public async Task<IActionResult> Unregister([FromBody] ExpoPushTokenRequest request)
    {
        if (request?.Token is null || !ExpoToken.IsMatch(request.Token)) return BadRequest(new { Message = "Invalid Expo push token" });
        var user = await users.GetCurrentUserIdAsync();
        if (!user.Success || !user.Data.HasValue) return Unauthorized();
        await tokens.UnregisterAsync(user.Data.Value, request.Token);
        return NoContent();
    }
}
