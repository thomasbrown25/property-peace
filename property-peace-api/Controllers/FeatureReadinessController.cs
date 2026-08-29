using System.Security.Claims;
using brownstone_hub_api.Config;
using brownstone_hub_api.Services.FeatureReadiness;
using brownstone_hub_api.Services.RentPaymentAccess;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Route("api/feature-readiness")]
[Authorize]
public sealed class FeatureReadinessController(
    IFeatureReadinessService readinessService,
    IRentPaymentActionReadinessService rentPaymentActionReadinessService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<FeatureReadinessDto>>> GetAll()
    {
        if (!long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Unauthorized();

        return Ok(await readinessService.GetAllAsync(userId, GetCanonicalOrganizationId()));
    }

    [HttpGet("{feature}")]
    public async Task<ActionResult<FeatureReadinessDto>> Get(string feature)
    {
        if (!long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Unauthorized();

        var readiness = await readinessService.GetAsync(userId, GetCanonicalOrganizationId(), feature);
        if (!FeatureKeys.All.Contains(feature, StringComparer.OrdinalIgnoreCase))
            return NotFound(readiness);

        return Ok(readiness);
    }

    [HttpGet("rent-payments/configure")]
    public Task<ActionResult<RentPaymentActionReadiness>> GetRentPaymentConfigureReadiness(
        CancellationToken cancellationToken) =>
        GetRentPaymentActionReadiness(RentPaymentAction.Configure, cancellationToken);

    [HttpGet("rent-payments/pay")]
    public Task<ActionResult<RentPaymentActionReadiness>> GetRentPaymentPayReadiness(
        CancellationToken cancellationToken) =>
        GetRentPaymentActionReadiness(RentPaymentAction.Pay, cancellationToken);

    private async Task<ActionResult<RentPaymentActionReadiness>> GetRentPaymentActionReadiness(
        RentPaymentAction action,
        CancellationToken cancellationToken)
    {
        if (!long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) ||
            userId is <= 0 or > int.MaxValue ||
            GetCanonicalOrganizationId() is not long organizationId ||
            organizationId is <= 0 or > int.MaxValue)
            return Forbid();

        return Ok(await rentPaymentActionReadinessService.EvaluateAsync(
            (int)userId, (int)organizationId, action, cancellationToken));
    }
    private long? GetCanonicalOrganizationId() =>
        HttpContext.Items.TryGetValue("OrganizationId", out var value) && value is long organizationId && organizationId > 0
            ? organizationId
            : null;
}
