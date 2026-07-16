using brownstone_hub_api.Services.GeneralLedgerService;
using brownstone_hub_api.Services.OrganizationService;
using brownstone_hub_api.Services.UserService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/general-ledger")]
    [Authorize(Roles = "Landlord,Admin")]
    public class GeneralLedgerController : ControllerBase
    {
        private readonly IGeneralLedgerService _generalLedgerService;
        private readonly IOrganizationService _organizationService;
        private readonly IUserService _userService;
        private readonly ILogger<GeneralLedgerController> _logger;

        public GeneralLedgerController(
            IGeneralLedgerService generalLedgerService,
            IOrganizationService organizationService,
            IUserService userService,
            ILogger<GeneralLedgerController> logger)
        {
            _generalLedgerService = generalLedgerService;
            _organizationService = organizationService;
            _userService = userService;
            _logger = logger;
        }

        /// <summary>
        /// Get ledger entries by account
        /// </summary>
        [HttpGet("account/{accountId}")]
        public async Task<IActionResult> GetEntriesByAccount(long accountId, [FromQuery] DateTime? startDate = null, [FromQuery] DateTime? endDate = null)
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
                var response = await _generalLedgerService.GetEntriesByAccountAsync(organizationId, accountId, startDate, endDate);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting ledger entries by account");
                return StatusCode(500, new { Message = "An error occurred while getting ledger entries" });
            }
        }

        /// <summary>
        /// Get ledger entries by date range
        /// </summary>
        [HttpGet("entries")]
        public async Task<IActionResult> GetEntriesByDateRange([FromQuery] DateTime startDate, [FromQuery] DateTime endDate)
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
                var response = await _generalLedgerService.GetEntriesByDateRangeAsync(organizationId, startDate, endDate);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting ledger entries by date range");
                return StatusCode(500, new { Message = "An error occurred while getting ledger entries" });
            }
        }

        /// <summary>
        /// Get account balance
        /// </summary>
        [HttpGet("account/{accountId}/balance")]
        public async Task<IActionResult> GetAccountBalance(long accountId, [FromQuery] DateTime? asOfDate = null)
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
                var response = await _generalLedgerService.GetAccountBalanceAsync(organizationId, accountId, asOfDate);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting account balance");
                return StatusCode(500, new { Message = "An error occurred while getting account balance" });
            }
        }

        /// <summary>
        /// Get all account balances
        /// </summary>
        [HttpGet("balances")]
        public async Task<IActionResult> GetAccountBalances([FromQuery] DateTime? asOfDate = null)
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
                var response = await _generalLedgerService.GetAccountBalancesAsync(organizationId, asOfDate);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting account balances");
                return StatusCode(500, new { Message = "An error occurred while getting account balances" });
            }
        }

        /// <summary>
        /// Create a new ledger entry
        /// </summary>
        [HttpPost("entry")]
        public async Task<IActionResult> CreateLedgerEntry([FromBody] CreateLedgerEntryRequestDto request)
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
                var response = await _generalLedgerService.CreateLedgerEntryAsync(
                    organizationId,
                    request.AccountId,
                    request.TransactionId,
                    request.TransactionType ?? "ManualEntry",
                    request.Amount,
                    request.TransactionDate,
                    request.Description,
                    request.Reference
                );

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating ledger entry");
                return StatusCode(500, new { Message = "An error occurred while creating ledger entry" });
            }
        }
    }

    public class CreateLedgerEntryRequestDto
    {
        public long AccountId { get; set; }
        public long? TransactionId { get; set; }
        public string? TransactionType { get; set; }
        public decimal Amount { get; set; }
        public DateTime TransactionDate { get; set; }
        public string? Description { get; set; }
        public string? Reference { get; set; }
    }
}
