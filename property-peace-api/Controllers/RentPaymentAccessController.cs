using brownstone_hub_api.Attributes;
using brownstone_hub_api.Dtos.RentPaymentAccess;
using brownstone_hub_api.Security;
using brownstone_hub_api.Services.RentPaymentAccess;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Route("api/rent-payment-access")]
[Authorize(Roles = "Landlord,Admin")]
[RequireOrganizationRole("Owner", "Manager")]
public sealed class RentPaymentAccessController(
    IRentPaymentAccessService service,
    IOrganizationAuthorityResolver authorityResolver) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<RentPaymentAccessDto>> Get(CancellationToken cancellationToken)
    {
        var context = await ResolveAuthorizedContextAsync(cancellationToken);
        if (context.Result is not null) return context.Result;

        return Ok(await service.GetForOrganizationAsync(context.OrganizationId!.Value, cancellationToken));
    }

    [HttpPost("requests")]
    public new async Task<ActionResult<RentPaymentAccessDto>> Request(CancellationToken cancellationToken)
    {
        var context = await ResolveAuthorizedContextAsync(cancellationToken);
        if (context.Result is not null) return context.Result;

        try
        {
            return Ok(await service.RequestAsync(
                context.OrganizationId!.Value,
                context.UserId!.Value,
                cancellationToken));
        }
        catch (RentPaymentAccessInvalidTransitionException)
        {
            return Conflict(new { message = "The rent-payment access request cannot be made in its current state." });
        }
    }

    private async Task<TrustedContext> ResolveAuthorizedContextAsync(CancellationToken cancellationToken)
    {
        if (!HttpContext.Items.TryGetValue("OrganizationId", out var organizationValue) ||
            organizationValue is not long organizationId || organizationId is <= 0 or > int.MaxValue ||
            !HttpContext.Items.TryGetValue("UserId", out var userValue) ||
            userValue is not long userId || userId is <= 0 or > int.MaxValue)
        {
            return TrustedContext.Forbidden();
        }

        try
        {
            var member = await authorityResolver.ResolveActiveMemberAsync(userId, organizationId, cancellationToken);
            if (member is null || !IsOwnerOrManager(member.Role))
                return TrustedContext.Forbidden();

            return new TrustedContext((int)organizationId, (int)userId, null);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch
        {
            return TrustedContext.Forbidden();
        }
    }

    private static bool IsOwnerOrManager(string? role) =>
        string.Equals(role, "Owner", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(role, "Manager", StringComparison.OrdinalIgnoreCase);

    private sealed record TrustedContext(int? OrganizationId, int? UserId, ActionResult<RentPaymentAccessDto>? Result)
    {
        public static TrustedContext Forbidden() => new(null, null, new ObjectResult(new { message = "Organization access is not permitted." })
        {
            StatusCode = StatusCodes.Status403Forbidden
        });
    }
}
