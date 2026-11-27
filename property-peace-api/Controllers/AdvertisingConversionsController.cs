using System.Security.Claims;
using brownstone_hub_api.Dtos.AdvertisingConversions;
using brownstone_hub_api.Middleware;
using brownstone_hub_api.Services.AdvertisingConversions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Route("api/advertising-conversions")]
[Authorize(Policy = "LandlordOnly")]
public sealed class AdvertisingConversionsController(IRegistrationConversionReporter reporter) : ControllerBase
{
    [HttpPost("registration-completed")]
    [OrganizationContextOptional]
    public async Task<IActionResult> ReportRegistrationCompleted(
        [FromBody] RegistrationCompletedConversionDto request,
        CancellationToken cancellationToken)
    {
        if (!long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) || userId <= 0)
            return Unauthorized();
        if (User.HasClaim(claim => claim.Type == "is_impersonating"))
            return Forbid();

        await reporter.ReportCompletedRegistrationAsync(userId, request.Oppref, cancellationToken);
        return NoContent();
    }
}
