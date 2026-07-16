using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.MaintenanceAgent;
using brownstone_hub_api.Helpers;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.MaintenanceAgentService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/maintenance-agent")]
    [Authorize(Roles = "Tenant,Admin")]
    public class MaintenanceAgentController(
        IMaintenanceAgentService maintenanceAgentService,
        IUserRepository userRepository,
        DataContext dataContext,
        ILogger<MaintenanceAgentController> logger) : ControllerBase
    {
        private readonly IMaintenanceAgentService _maintenanceAgentService = maintenanceAgentService;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly DataContext _dataContext = dataContext;
        private readonly ILogger<MaintenanceAgentController> _logger = logger;

        [HttpPost("chat")]
        public async Task<IActionResult> Chat([FromBody] MaintenanceAgentChatRequestDto request, CancellationToken cancellationToken)
        {
            try
            {
                var response = await _maintenanceAgentService.ChatAsync(request.Messages, cancellationToken);
                return Ok(new { success = true, data = response });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in Maintenance Agent chat");
                return StatusCode(500, new { message = "An error occurred. Please try again." });
            }
        }

        /// <summary>
        /// Returns agent settings for the tenant's landlord organization.
        /// Tenants use this to know whether to open the AI chat or the form drawer.
        /// </summary>
        [HttpGet("settings")]
        public async Task<IActionResult> GetSettings()
        {
            try
            {
                var userId = await this.GetCurrentUserIdAsync(_userRepository);
                if (!userId.HasValue)
                    return Unauthorized(new { message = "User not authenticated" });

                // Find the tenant record and walk up to its organization
                var tenant = await _dataContext.Tenants
                    .FirstOrDefaultAsync(t => t.UserId == userId.Value && !t.IsDeleted);

                if (tenant?.OrganizationId == null)
                {
                    // No org found — default to agent enabled so the chat still works
                    return Ok(new { success = true, data = new { isMaintenanceAgentEnabled = true } });
                }

                var org = await _dataContext.Organizations
                    .FirstOrDefaultAsync(o => o.Id == tenant.OrganizationId && !o.IsDeleted);

                return Ok(new
                {
                    success = true,
                    data = new { isMaintenanceAgentEnabled = org?.IsMaintenanceAgentEnabled ?? true }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching maintenance agent settings");
                return StatusCode(500, new { message = "An error occurred." });
            }
        }
    }
}
