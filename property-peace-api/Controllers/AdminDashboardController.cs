using brownstone_hub_api.Dtos.AdminDashboard;
using brownstone_hub_api.Services.AdminDashboardService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Route("api/admin/dashboard")]
[Authorize(Roles = "Admin")]
public sealed class AdminDashboardController : ControllerBase
{
    private readonly IAdminDashboardService _dashboardService;

    public AdminDashboardController(IAdminDashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    /// <summary>
    /// Returns cross-tenant, production-scoped platform aggregates without message,
    /// maintenance-body, or tenant-body content.
    /// </summary>
    [HttpGet("summary")]
    [ProducesResponseType(typeof(AdminDashboardSummaryDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<AdminDashboardSummaryDto>> GetSummary(
        [FromQuery] int windowDays = 30,
        CancellationToken cancellationToken = default)
    {
        return Ok(await _dashboardService.GetSummaryAsync(windowDays, cancellationToken));
    }
}
