using System.Globalization;
using brownstone_hub_api.Dtos.Entitlements;
using brownstone_hub_api.Entitlements.Decision;
using brownstone_hub_api.Entitlements.Enforcement;
using brownstone_hub_api.Entitlements.Policy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

/// <summary>Returns the authoritative entitlement decision for the middleware-owned request scope.</summary>
[ApiController]
[Route("api/entitlements")]
[Authorize]
public sealed class EntitlementDecisionController(IEntitlementDecisionService decisionService) : ControllerBase
{
    [HttpGet("{featureKey}")]
    public async Task<IActionResult> Get(string featureKey, CancellationToken cancellationToken = default)
    {
        var feature = EntitlementCatalog.Features
            .SingleOrDefault(item => string.Equals(item.Key.Value, featureKey, StringComparison.Ordinal))?.Key;
        if (!feature.HasValue)
        {
            return NotFound();
        }

        if (!TryGetPositiveId(HttpContext.Items["UserId"], out var userId))
        {
            return Unauthorized();
        }

        if (!TryGetPositiveId(HttpContext.Items["OrganizationId"], out var organizationId))
        {
            return Forbid();
        }

        var decision = await decisionService.DecideAsync(
            new EntitlementDecisionRequest(
                userId.ToString(CultureInfo.InvariantCulture),
                organizationId,
                feature.Value),
            cancellationToken);

        if (IsInfrastructureFailure(decision.Reason))
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new EntitlementDeniedResponse(
                false,
                EntitlementCatalog.Version,
                feature.Value.Value,
                decision.Reason.Value,
                "unavailable",
                "This feature is currently unavailable. Try again later."));
        }

        return Ok(ToResponse(decision));
    }

    private static EntitlementDecisionResponse ToResponse(UnifiedEntitlementDecision decision) =>
        new(
            decision.IsAllowed,
            decision.MatrixVersion,
            decision.Feature.Value,
            decision.EffectivePlan?.Value,
            decision.Reason.Value,
            CategoryWireValue(decision.Category),
            decision.Quota is null
                ? null
                : new EntitlementQuotaResponse(decision.Quota.Unit, decision.Quota.Limit),
            Array.AsReadOnly(decision.RequiredAddOns.Select(item => item.Value).ToArray()),
            Array.AsReadOnly(decision.ReadinessDependencies.Select(item => item.Value).ToArray()));

    private static bool IsInfrastructureFailure(EntitlementReasonCode reason) =>
        reason == EntitlementReasonCodes.PolicyError ||
        reason == EntitlementReasonCodes.FactsUnavailable;

    private static string CategoryWireValue(EntitlementDecisionCategory category) => category switch
    {
        EntitlementDecisionCategory.Upgrade => "upgrade",
        EntitlementDecisionCategory.Setup => "setup",
        EntitlementDecisionCategory.Unauthorized => "unauthorized",
        EntitlementDecisionCategory.Allowed => "allowed",
        _ => "unavailable"
    };

    private static bool TryGetPositiveId(object? value, out long id)
    {
        id = value switch
        {
            long longValue => longValue,
            int intValue => intValue,
            _ => 0
        };
        return id > 0;
    }
}
