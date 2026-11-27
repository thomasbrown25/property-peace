using brownstone_hub_api.Helpers;
using brownstone_hub_api.Repositories.Organizations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Route("api/dashboard/online-payments-setup-dismissal")]
[Authorize(Roles = "Landlord,Admin")]
public sealed class DashboardSetupDismissalController(IOrganizationMemberRepository members) : ControllerBase
{
    [HttpGet]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> GetDismissal(CancellationToken cancellationToken)
    {
        if (HttpContext.Items["UserId"] is not long userId || this.GetCurrentOrganizationId() is not long organizationId)
            return Forbid();

        var dismissed = await members.GetOnlinePaymentsSetupDismissalAsync(organizationId, userId, cancellationToken);
        return dismissed.HasValue ? Ok(new { Dismissed = dismissed.Value }) : Forbid();
    }

    [HttpPut]
    public async Task<IActionResult> Dismiss(CancellationToken cancellationToken)
    {
        if (HttpContext.Items["UserId"] is not long userId || this.GetCurrentOrganizationId() is not long organizationId)
            return Forbid();

        var saved = await members.DismissOnlinePaymentsSetupAsync(organizationId, userId, cancellationToken);
        return saved ? NoContent() : Forbid();
    }
}
