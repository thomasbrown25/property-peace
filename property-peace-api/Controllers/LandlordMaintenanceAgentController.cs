using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.MaintenanceAgent;
using brownstone_hub_api.Helpers;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.LandlordMaintenanceAgentService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/landlord-maintenance-agent")]
    [Authorize(Roles = "Landlord,Admin")]
    public class LandlordMaintenanceAgentController(
        ILandlordMaintenanceAgentService landlordMaintenanceAgentService,
        IUserRepository userRepository,
        DataContext dataContext,
        ILogger<LandlordMaintenanceAgentController> logger) : ControllerBase
    {
        private readonly ILandlordMaintenanceAgentService _landlordMaintenanceAgentService = landlordMaintenanceAgentService;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly DataContext _dataContext = dataContext;
        private readonly ILogger<LandlordMaintenanceAgentController> _logger = logger;

        [HttpPost("chat")]
        public async Task<IActionResult> Chat([FromBody] LandlordMaintenanceAgentChatRequestDto request, CancellationToken cancellationToken)
        {
            try
            {
                var response = await _landlordMaintenanceAgentService.ChatAsync(
                    request.Messages,
                    request.PropertyId,
                    request.PropertyName,
                    request.UnitId,
                    request.UnitName,
                    cancellationToken);
                return Ok(new { success = true, data = response });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in Landlord Maintenance Agent chat");
                return StatusCode(500, new { message = "An error occurred. Please try again." });
            }
        }

        [HttpGet("settings")]
        public async Task<IActionResult> GetSettings()
        {
            try
            {
                var userId = await this.GetCurrentUserIdAsync(_userRepository);
                if (!userId.HasValue)
                    return Unauthorized(new { message = "User not authenticated" });

                var property = await _dataContext.Properties
                    .AsNoTracking()
                    .FirstOrDefaultAsync(p => p.LandlordId == userId.Value && !p.IsDeleted && p.OrganizationId != null);

                if (property?.OrganizationId == null)
                {
                    return Ok(new { success = true, data = new { isMaintenanceAgentEnabled = false } });
                }

                var org = await _dataContext.Organizations
                    .AsNoTracking()
                    .FirstOrDefaultAsync(o => o.Id == property.OrganizationId && !o.IsDeleted);

                return Ok(new
                {
                    success = true,
                    data = new { isMaintenanceAgentEnabled = org?.IsMaintenanceAgentEnabled ?? false }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching landlord maintenance agent settings");
                return StatusCode(500, new { message = "An error occurred." });
            }
        }
    }
}
