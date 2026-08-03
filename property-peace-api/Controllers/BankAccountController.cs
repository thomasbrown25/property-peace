using brownstone_hub_api.Dtos.BankAccount;
using brownstone_hub_api.Services.BankAccountService;
using brownstone_hub_api.Services.OrganizationService;
using brownstone_hub_api.Services.UserService;
using brownstone_hub_api.Helpers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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
        private readonly DataContext _context;
        private readonly ILogger<BankAccountController> _logger;

        public BankAccountController(
            IBankAccountService bankAccountService,
            IOrganizationService organizationService,
            IUserService userService,
            DataContext context,
            ILogger<BankAccountController> logger)
        {
            _bankAccountService = bankAccountService;
            _organizationService = organizationService;
            _userService = userService;
            _context = context;
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
                var organizationId = this.GetCurrentOrganizationIdOrForbid();
                if (!organizationId.HasValue)
                {
                    return StatusCode(403, new { Message = "Organization context is required" });
                }

                var response = await _bankAccountService.GetBankAccountByIdAsync(id, organizationId.Value);

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

                var linkedAccount = await _context.Users.AsNoTracking()
                    .Where(x => x.Id == userId && !x.IsDeleted)
                    .Select(x => x.StripeAccountId)
                    .SingleOrDefaultAsync();
                if (string.IsNullOrWhiteSpace(linkedAccount)
                    || !string.Equals(linkedAccount, bankAccountDto.StripeAccountId, StringComparison.Ordinal))
                {
                    return StatusCode(403, new { Message = "The Stripe account must be linked to the authenticated user." });
                }

                var approvedForOrganization = await _context.StripeConnectedPayeeReviews.AsNoTracking().AnyAsync(x =>
                    x.UserId == userId
                    && x.StripeAccountId == linkedAccount
                    && x.Status == StripePayeeReviewStatus.PayoutApproved
                    && x.PropertyAuthorityAttested
                    && x.ApprovedOrganizationId == bankAccountDto.OrganizationId
                    && _context.OrganizationMembers.Any(member => member.UserId == userId
                        && member.OrganizationId == bankAccountDto.OrganizationId
                        && member.IsActive
                        && (member.Role == "Owner" || member.Role == "Manager")));
                if (!approvedForOrganization)
                {
                    return StatusCode(403, new { Message = "The Stripe payee is not approved for this organization." });
                }

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
                var organizationId = this.GetCurrentOrganizationIdOrForbid();
                if (!organizationId.HasValue)
                {
                    return StatusCode(403, new { Message = "Organization context is required" });
                }

                bankAccountDto.Id = id;
                var response = await _bankAccountService.UpdateBankAccountAsync(bankAccountDto, organizationId.Value);

                if (!response.Success)
                {
                    return NotFound(response);
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
                var organizationId = this.GetCurrentOrganizationIdOrForbid();
                if (!organizationId.HasValue)
                {
                    return StatusCode(403, new { Message = "Organization context is required" });
                }

                var response = await _bankAccountService.DeleteBankAccountAsync(id, organizationId.Value);

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

