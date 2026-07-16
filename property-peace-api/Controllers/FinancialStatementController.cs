using brownstone_hub_api.Services.FinancialStatementService;
using brownstone_hub_api.Services.OrganizationService;
using brownstone_hub_api.Services.UserService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/financial-statements")]
    [Authorize(Roles = "Landlord,Admin")]
    public class FinancialStatementController : ControllerBase
    {
        private readonly IFinancialStatementService _financialStatementService;
        private readonly IOrganizationService _organizationService;
        private readonly IUserService _userService;
        private readonly ILogger<FinancialStatementController> _logger;

        public FinancialStatementController(
            IFinancialStatementService financialStatementService,
            IOrganizationService organizationService,
            IUserService userService,
            ILogger<FinancialStatementController> logger)
        {
            _financialStatementService = financialStatementService;
            _organizationService = organizationService;
            _userService = userService;
            _logger = logger;
        }

        /// <summary>
        /// Get Profit and Loss statement
        /// </summary>
        [HttpGet("profit-loss")]
        public async Task<IActionResult> GetProfitAndLoss([FromQuery] DateTime startDate, [FromQuery] DateTime endDate)
        {
            try
            {
                var userIdResponse = await _userService.GetCurrentUserIdAsync();
                if (!userIdResponse.Success || !userIdResponse.Data.HasValue)
                {
                    return Unauthorized(new { Message = "User not found" });
                }

                var userId = userIdResponse.Data.Value;
                var userOrgResponse = await _organizationService.GetCurrentUserOrganizationAsync(userId);
                if (!userOrgResponse.Success || userOrgResponse.Data == null)
                {
                    return NotFound(new { Message = "Organization not found" });
                }

                var organizationId = userOrgResponse.Data.Id;
                var response = await _financialStatementService.GetProfitAndLossAsync(organizationId, startDate, endDate);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting Profit and Loss statement");
                return StatusCode(500, new { Message = "An error occurred while getting Profit and Loss statement" });
            }
        }

        /// <summary>
        /// Get Balance Sheet
        /// </summary>
        [HttpGet("balance-sheet")]
        public async Task<IActionResult> GetBalanceSheet([FromQuery] DateTime asOfDate)
        {
            try
            {
                var userIdResponse = await _userService.GetCurrentUserIdAsync();
                if (!userIdResponse.Success || !userIdResponse.Data.HasValue)
                {
                    return Unauthorized(new { Message = "User not found" });
                }

                var userId = userIdResponse.Data.Value;
                var userOrgResponse = await _organizationService.GetCurrentUserOrganizationAsync(userId);
                if (!userOrgResponse.Success || userOrgResponse.Data == null)
                {
                    return NotFound(new { Message = "Organization not found" });
                }

                var organizationId = userOrgResponse.Data.Id;
                var response = await _financialStatementService.GetBalanceSheetAsync(organizationId, asOfDate);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting Balance Sheet");
                return StatusCode(500, new { Message = "An error occurred while getting Balance Sheet" });
            }
        }

        /// <summary>
        /// Get Cash Flow statement
        /// </summary>
        [HttpGet("cash-flow")]
        public async Task<IActionResult> GetCashFlow([FromQuery] DateTime startDate, [FromQuery] DateTime endDate)
        {
            try
            {
                var userIdResponse = await _userService.GetCurrentUserIdAsync();
                if (!userIdResponse.Success || !userIdResponse.Data.HasValue)
                {
                    return Unauthorized(new { Message = "User not found" });
                }

                var userId = userIdResponse.Data.Value;
                var userOrgResponse = await _organizationService.GetCurrentUserOrganizationAsync(userId);
                if (!userOrgResponse.Success || userOrgResponse.Data == null)
                {
                    return NotFound(new { Message = "Organization not found" });
                }

                var organizationId = userOrgResponse.Data.Id;
                var response = await _financialStatementService.GetCashFlowAsync(organizationId, startDate, endDate);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting Cash Flow statement");
                return StatusCode(500, new { Message = "An error occurred while getting Cash Flow statement" });
            }
        }
    }
}
