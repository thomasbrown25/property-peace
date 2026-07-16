using brownstone_hub_api.Dtos.BankAccount;
using brownstone_hub_api.Services.BankAccountService;
using brownstone_hub_api.Services.OrganizationService;
using brownstone_hub_api.Services.UserService;
using brownstone_hub_api.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/bank-accounts")]
    [Authorize(Roles = "Landlord,Admin")]
    public class BankAccountController : ControllerBase
    {
        private readonly IBankAccountService _bankAccountService;
        private readonly IOrganizationService _organizationService;
        private readonly IUserService _userService;
        private readonly ILogger<BankAccountController> _logger;

        public BankAccountController(
            IBankAccountService bankAccountService,
            IOrganizationService organizationService,
            IUserService userService,
            ILogger<BankAccountController> logger)
        {
            _bankAccountService = bankAccountService;
            _organizationService = organizationService;
            _userService = userService;
            _logger = logger;
        }

        /// <summary>
        /// Get all bank accounts for the current organization
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetBankAccounts()
        {
            try
            {
                // Get current user ID
                var userIdResponse = await _userService.GetCurrentUserIdAsync();
                if (!userIdResponse.Success || !userIdResponse.Data.HasValue)
                {
                    return Unauthorized(new { Message = "User not found" });
                }

                var userId = userIdResponse.Data.Value;

                // Get current user's organization
                var userOrgResponse = await _organizationService.GetCurrentUserOrganizationAsync(userId);
                if (!userOrgResponse.Success || userOrgResponse.Data == null)
                {
                    return NotFound(new { Message = "Organization not found" });
                }

                var organizationId = userOrgResponse.Data.Id;
                var response = await _bankAccountService.GetBankAccountsByOrganizationIdAsync(organizationId);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting bank accounts");
                return StatusCode(500, new { Message = "An error occurred while getting bank accounts" });
            }
        }

        /// <summary>
        /// Get a bank account by ID
        /// </summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetBankAccount(long id)
        {
            try
            {
                var response = await _bankAccountService.GetBankAccountByIdAsync(id);

                if (!response.Success)
                {
                    return NotFound(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting bank account {Id}", id);
                return StatusCode(500, new { Message = "An error occurred while getting bank account" });
            }
        }

        /// <summary>
        /// Create a new bank account
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> CreateBankAccount([FromBody] CreateBankAccountDto bankAccountDto)
        {
            try
            {
                // Get current user ID
                var userIdResponse = await _userService.GetCurrentUserIdAsync();
                if (!userIdResponse.Success || !userIdResponse.Data.HasValue)
                {
                    return Unauthorized(new { Message = "User not found" });
                }

                var userId = userIdResponse.Data.Value;

                // Get current user's organization
                var userOrgResponse = await _organizationService.GetCurrentUserOrganizationAsync(userId);
                if (!userOrgResponse.Success || userOrgResponse.Data == null)
                {
                    return NotFound(new { Message = "Organization not found" });
                }

                // Ensure the organization ID matches
                bankAccountDto.OrganizationId = userOrgResponse.Data.Id;

                var response = await _bankAccountService.CreateBankAccountAsync(bankAccountDto);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating bank account");
                return StatusCode(500, new { Message = "An error occurred while creating bank account" });
            }
        }

        /// <summary>
        /// Update a bank account (display name, isActive, isDefault)
        /// </summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateBankAccount(long id, [FromBody] UpdateBankAccountDto bankAccountDto)
        {
            try
            {
                bankAccountDto.Id = id;
                var response = await _bankAccountService.UpdateBankAccountAsync(bankAccountDto);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating bank account {Id}", id);
                return StatusCode(500, new { Message = "An error occurred while updating bank account" });
            }
        }

        /// <summary>
        /// Delete a bank account (soft delete)
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteBankAccount(long id)
        {
            try
            {
                var response = await _bankAccountService.DeleteBankAccountAsync(id);

                if (!response.Success)
                {
                    return NotFound(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting bank account {Id}", id);
                return StatusCode(500, new { Message = "An error occurred while deleting bank account" });
            }
        }
    }
}

