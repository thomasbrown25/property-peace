using brownstone_hub_api.Dtos.Account;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Services.AccountService;
using brownstone_hub_api.Services.OrganizationService;
using brownstone_hub_api.Services.UserService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/accounts")]
    [Authorize(Roles = "Landlord,Admin")]
    public class AccountController : ControllerBase
    {
        private readonly IAccountService _accountService;
        private readonly IOrganizationService _organizationService;
        private readonly IUserService _userService;
        private readonly ILogger<AccountController> _logger;

        public AccountController(
            IAccountService accountService,
            IOrganizationService organizationService,
            IUserService userService,
            ILogger<AccountController> logger)
        {
            _accountService = accountService;
            _organizationService = organizationService;
            _userService = userService;
            _logger = logger;
        }

        /// <summary>
        /// Get all accounts for the current organization
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetAccounts()
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
                var response = await _accountService.GetAccountsByOrganizationIdAsync(organizationId);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting accounts");
                return StatusCode(500, new { Message = "An error occurred while getting accounts" });
            }
        }

        /// <summary>
        /// Get accounts by type for the current organization
        /// </summary>
        [HttpGet("type/{accountType}")]
        public async Task<IActionResult> GetAccountsByType(EAccountType accountType)
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
                var response = await _accountService.GetAccountsByTypeAsync(organizationId, accountType);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting accounts by type");
                return StatusCode(500, new { Message = "An error occurred while getting accounts" });
            }
        }

        /// <summary>
        /// Get account hierarchy for the current organization
        /// </summary>
        [HttpGet("hierarchy")]
        public async Task<IActionResult> GetAccountHierarchy()
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
                var response = await _accountService.GetAccountHierarchyAsync(organizationId);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting account hierarchy");
                return StatusCode(500, new { Message = "An error occurred while getting account hierarchy" });
            }
        }

        /// <summary>
        /// Get an account by ID
        /// </summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetAccount(long id)
        {
            try
            {
                var response = await _accountService.GetAccountByIdAsync(id);

                if (!response.Success)
                {
                    return NotFound(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting account {Id}", id);
                return StatusCode(500, new { Message = "An error occurred while getting account" });
            }
        }

        /// <summary>
        /// Create a new account
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> CreateAccount([FromBody] AddAccountDto accountDto)
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

                accountDto.OrganizationId = userOrgResponse.Data.Id;

                var response = await _accountService.CreateAccountAsync(accountDto);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating account");
                return StatusCode(500, new { Message = "An error occurred while creating account" });
            }
        }

        /// <summary>
        /// Update an account
        /// </summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateAccount(long id, [FromBody] UpdateAccountDto accountDto)
        {
            try
            {
                accountDto.Id = id;
                var response = await _accountService.UpdateAccountAsync(accountDto);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating account {Id}", id);
                return StatusCode(500, new { Message = "An error occurred while updating account" });
            }
        }

        /// <summary>
        /// Delete an account (soft delete)
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteAccount(long id)
        {
            try
            {
                var response = await _accountService.DeleteAccountAsync(id);

                if (!response.Success)
                {
                    return NotFound(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting account {Id}", id);
                return StatusCode(500, new { Message = "An error occurred while deleting account" });
            }
        }

        /// <summary>
        /// Seed standard accounts for the current organization
        /// </summary>
        [HttpPost("seed")]
        public async Task<IActionResult> SeedStandardAccounts()
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
                var response = await _accountService.SeedStandardAccountsAsync(organizationId);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error seeding standard accounts");
                return StatusCode(500, new { Message = "An error occurred while seeding standard accounts" });
            }
        }
    }
}
