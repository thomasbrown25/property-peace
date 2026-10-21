using brownstone_hub_api.Attributes;
using brownstone_hub_api.Dtos.Stripe;
using brownstone_hub_api.Dtos.BankAccount;
using brownstone_hub_api.Services.StripeService;
using brownstone_hub_api.Services.UserService;
using brownstone_hub_api.Services.OrganizationService;
using brownstone_hub_api.Services.BankAccountService;
using brownstone_hub_api.Services.StripeRentPayments;
using brownstone_hub_api.Services.RentPaymentAccess;
using brownstone_hub_api.Repositories.BankAccounts;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Models;
using brownstone_hub_api.Config;
using brownstone_hub_api.Filters;
using brownstone_hub_api.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Stripe;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/stripe")]
    [Authorize]
    public class StripeController : ControllerBase
    {
        private readonly IStripeService _stripeService;
        private readonly IUserService _userService;
        private readonly IOrganizationService _organizationService;
        private readonly IBankAccountService _bankAccountService;
        private readonly IBankAccountRepository _bankAccountRepository;
        private readonly IUserRepository _userRepository;
        private readonly ILogger<StripeController> _logger;
        private readonly IConfiguration _configuration;
        private readonly IStripeConnectedPayeeService? _stripeConnectedPayeeService;
        private readonly IStripePaymentTransactionQueryService? _stripePaymentTransactionQueryService;
        private readonly IStripeConnectPreparationService? _stripeConnectPreparationService;

        public StripeController(
            IStripeService stripeService,
            IUserService userService,
            IOrganizationService organizationService,
            IBankAccountService bankAccountService,
            IBankAccountRepository bankAccountRepository,
            IUserRepository userRepository,
            ILogger<StripeController> logger,
            IConfiguration? configuration = null,
            IStripeConnectedPayeeService? stripeConnectedPayeeService = null,
            IStripePaymentTransactionQueryService? stripePaymentTransactionQueryService = null,
            IStripeConnectPreparationService? stripeConnectPreparationService = null)
        {
            _stripeService = stripeService;
            _userService = userService;
            _organizationService = organizationService;
            _bankAccountService = bankAccountService;
            _bankAccountRepository = bankAccountRepository;
            _userRepository = userRepository;
            _logger = logger;
            _configuration = configuration ?? new ConfigurationBuilder().Build();
            _stripeConnectedPayeeService = stripeConnectedPayeeService;
            _stripePaymentTransactionQueryService = stripePaymentTransactionQueryService;
            _stripeConnectPreparationService = stripeConnectPreparationService;
        }

        [RequireOrganizationRole("Owner", "Manager")]
        [HttpGet("payment-transactions")]
        public async Task<IActionResult> GetPaymentTransactions([FromQuery] long? propertyId = null, CancellationToken cancellationToken = default)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(StatusCodes.Status403Forbidden, new { Message = "Organization context is required" });
            if (_stripePaymentTransactionQueryService == null)
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new { Message = "Stripe transactions are unavailable" });

            try
            {
                var transactions = await _stripePaymentTransactionQueryService.ListAsync(
                    organizationId.Value, propertyId, cancellationToken);
                return Ok(transactions);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Stripe payment transactions could not be loaded for organization {OrganizationId}", organizationId.Value);
                return StatusCode(StatusCodes.Status502BadGateway, new { Message = "Stripe payment transactions could not be loaded" });
            }
        }

        /// <summary>
        /// Create or get Stripe Connect account for the current landlord
        /// </summary>
        [RequireOrganizationRole("Owner", "Manager")]
        [RequireStripeConnectSetupReady]
        [HttpPost("connect-account")]
        public async Task<IActionResult> CreateConnectAccount([FromBody] CreateConnectAccountRequest request)
        {
            try
            {
                // Get current user ID from JWT claims
                long? userId = null;
                var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userIdClaim))
                {
                    userIdClaim = User?.FindFirst("userId")?.Value;
                }

                if (!string.IsNullOrEmpty(userIdClaim) && long.TryParse(userIdClaim, out var parsedUserId))
                {
                    userId = parsedUserId;
                }
                else
                {
                    // Fallback: get user by email
                    var email = User?.FindFirst("sub")?.Value;
                    if (string.IsNullOrEmpty(email))
                    {
                        email = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                    }
                    if (string.IsNullOrEmpty(email))
                    {
                        email = User?.FindFirst(ClaimTypes.Name)?.Value;
                    }

                    if (!string.IsNullOrEmpty(email))
                    {
                        var userResponse = await _userService.GetUserByEmailAsync(email);
                        if (userResponse.Success && userResponse.Data != null)
                        {
                            userId = userResponse.Data.Id;
                        }
                    }
                }

                if (!userId.HasValue)
                {
                    return Unauthorized(new { Message = "User ID not found in token" });
                }

                // Get user email
                var dbUserResponse = await _userService.GetUserByIdAsync(userId.Value);
                if (!dbUserResponse.Success || dbUserResponse.Data == null)
                {
                    return NotFound(new { Message = "User not found" });
                }
                var dbUser = dbUserResponse.Data;
                if (dbUser.IsDemo)
                {
                    return BadRequest(new { Message = "Stripe payment setup is not available in demo mode." });
                }

                var organizationId = this.GetCurrentOrganizationIdOrForbid();
                if (!organizationId.HasValue)
                    return StatusCode(StatusCodes.Status403Forbidden, new { Message = "Organization context is required" });
                if (_stripeConnectPreparationService == null)
                    return StatusCode(StatusCodes.Status503ServiceUnavailable,
                        new { Message = "Payout preparation validation is unavailable" });

                try
                {
                    var preparation = await _stripeConnectPreparationService.GetValidatedForHandoffAsync(
                        userId.Value, organizationId.Value, HttpContext.RequestAborted);
                    if (preparation == null)
                        return Conflict(new { Message = "Complete and save the payout setup before continuing to Stripe." });
                }
                catch (Exception ex) when (ex is InvalidOperationException or UnauthorizedAccessException)
                {
                    return Conflict(new { Message = ex.Message });
                }

                var (_, owned, ownershipError) = await ResolveOwnedOnboardingAsync(userId.Value);
                if (ownershipError != null) return ownershipError;
                if (!string.Equals(owned!.StripeAccountId, dbUser.StripeAccountId, StringComparison.Ordinal))
                    return StatusCode(StatusCodes.Status403Forbidden, new { Message = "Connected account ownership changed" });

                if (request.ReturnUrl != null || request.RefreshUrl != null)
                    return BadRequest(new { Message = "Custom redirects are not accepted." });
                var returnUrl = $"{_configuration["FrontendBaseUrl"] ?? $"{Request.Scheme}://{Request.Host}"}/landlord/settings?tab=payments&stripe=connected";
                ServiceResponse<CreateStripeAccountResponseDto> response;
                if (string.Equals(request.OperatingType, "business", StringComparison.OrdinalIgnoreCase))
                {
                    var legalBusinessName = request.LegalBusinessName?.Trim();
                    var ein = new string((request.Ein ?? string.Empty).Where(char.IsDigit).ToArray());
                    if (string.IsNullOrWhiteSpace(legalBusinessName) || legalBusinessName.Length > 200 || ein.Length != 9)
                        return BadRequest(new { Message = "A valid legal business name and 9-digit EIN are required." });
                    response = await _stripeService.CreateConnectAccountAsync(userId.Value, dbUser.Email,
                        returnUrl, owned.StripeAccountId, "business", legalBusinessName, ein);
                }
                else
                {
                    response = await _stripeService.CreateConnectAccountAsync(
                        userId.Value, dbUser.Email, returnUrl, owned.StripeAccountId);
                }

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating Stripe Connect account");
                return StatusCode(500, new { Message = "An error occurred while creating Stripe account" });
            }
        }

        /// <summary>
        /// Get Stripe account status for the current landlord
        /// </summary>
        [HttpGet("account-status")]
        [RequireOrganizationRole("Owner", "Manager")]
        [RequireStripeConnectSetupReady]
        public async Task<IActionResult> GetAccountStatus()
        {
            try
            {
                var organizationId = this.GetCurrentOrganizationIdOrForbid();
                if (!organizationId.HasValue)
                    return StatusCode(StatusCodes.Status403Forbidden, new { Message = "Organization context is required" });

                // Get current user ID from JWT claims
                long? userId = null;
                var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userIdClaim))
                {
                    userIdClaim = User?.FindFirst("userId")?.Value;
                }

                if (!string.IsNullOrEmpty(userIdClaim) && long.TryParse(userIdClaim, out var parsedUserId))
                {
                    userId = parsedUserId;
                }
                else
                {
                    // Fallback: get user by email
                    var email = User?.FindFirst("sub")?.Value;
                    if (string.IsNullOrEmpty(email))
                    {
                        email = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                    }
                    if (string.IsNullOrEmpty(email))
                    {
                        email = User?.FindFirst(ClaimTypes.Name)?.Value;
                    }

                    if (!string.IsNullOrEmpty(email))
                    {
                        var userResponse = await _userService.GetUserByEmailAsync(email);
                        if (userResponse.Success && userResponse.Data != null)
                        {
                            userId = userResponse.Data.Id;
                        }
                    }
                }

                if (!userId.HasValue)
                {
                    return Unauthorized(new { Message = "User ID not found in token" });
                }

                var (_, owned, ownershipError) = await ResolveOwnedOnboardingAsync(userId.Value);
                if (ownershipError != null) return ownershipError;
                if (owned!.StripeAccountId == null)
                {
                    return Ok(new StripeAccountStatusDto
                    {
                        AccountId = null,
                        Status = null,
                        IsEnabled = false,
                        ChargesEnabled = false,
                        PayoutsEnabled = false,
                        DetailsSubmitted = false
                    });
                }

                var response = await _stripeService.GetAccountStatusAsync(
                    owned.StripeAccountId, userId.Value, organizationId.Value);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                if (response.Data != null)
                    response.Data.CanManageAccount = true;
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting Stripe account status");
                return StatusCode(500, new { Message = "An error occurred while getting Stripe account status" });
            }
        }

        /// <summary>
        /// Create account link for onboarding (if account exists but needs more info)
        /// </summary>
        [HttpPost("account-link")]
        [RequireOrganizationRole("Owner", "Manager")]
        [RequireStripeConnectSetupReady]
        public async Task<IActionResult> CreateAccountLink([FromBody] CreateAccountLinkRequest request)
        {
            try
            {
                // Get current user ID from JWT claims
                long? userId = null;
                var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userIdClaim))
                {
                    userIdClaim = User?.FindFirst("userId")?.Value;
                }

                if (!string.IsNullOrEmpty(userIdClaim) && long.TryParse(userIdClaim, out var parsedUserId))
                {
                    userId = parsedUserId;
                }
                else
                {
                    // Fallback: get user by email
                    var email = User?.FindFirst("sub")?.Value;
                    if (string.IsNullOrEmpty(email))
                    {
                        email = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                    }
                    if (string.IsNullOrEmpty(email))
                    {
                        email = User?.FindFirst(ClaimTypes.Name)?.Value;
                    }

                    if (!string.IsNullOrEmpty(email))
                    {
                        var userResponse = await _userService.GetUserByEmailAsync(email);
                        if (userResponse.Success && userResponse.Data != null)
                        {
                            userId = userResponse.Data.Id;
                        }
                    }
                }

                if (!userId.HasValue)
                {
                    return Unauthorized(new { Message = "User ID not found in token" });
                }

                // Get user with Stripe account info
                var dbUserResponse = await _userService.GetUserByIdAsync(userId.Value);
                if (!dbUserResponse.Success || dbUserResponse.Data == null)
                {
                    return NotFound(new { Message = "User not found" });
                }
                var dbUser = dbUserResponse.Data;
                if (dbUser != null && dbUser.IsDemo)
                {
                    return BadRequest(new { Message = "Stripe payment setup is not available in demo mode." });
                }

                var (_, owned, ownershipError) = await ResolveOwnedOnboardingAsync(userId.Value);
                if (ownershipError != null) return ownershipError;
                if (owned!.StripeAccountId == null) return Conflict(new { Message = "Set up a Stripe account first" });
                if (request.ReturnUrl != null || request.RefreshUrl != null ||
                    request.Type is not (null or "account_onboarding" or "account_update"))
                    return BadRequest(new { Message = "Custom redirects or link types are not accepted" });
                var returnUrl = $"{Request.Scheme}://{Request.Host}/landlord/settings?tab=payments&stripe=connected";
                var refreshUrl = $"{Request.Scheme}://{Request.Host}/landlord/settings?tab=payments&stripe=refresh";
                var linkType = request.Type ?? "account_onboarding";

                var response = await _stripeService.CreateAccountLinkAsync(
                    owned.StripeAccountId, returnUrl, refreshUrl, linkType);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(new { OnboardingUrl = response.Data });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating Stripe account link");
                return StatusCode(500, new { Message = "An error occurred while creating account link" });
            }
        }

        /// <summary>
        /// Create login link for accessing Stripe Express Dashboard
        /// </summary>
        [HttpPost("login-link")]
        [RequireOrganizationRole("Owner", "Manager")]
        [RequireStripeConnectSetupReady]
        public async Task<IActionResult> CreateLoginLink()
        {
            try
            {
                // Get current user ID from JWT claims
                long? userId = null;
                var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userIdClaim))
                {
                    userIdClaim = User?.FindFirst("userId")?.Value;
                }

                if (!string.IsNullOrEmpty(userIdClaim) && long.TryParse(userIdClaim, out var parsedUserId))
                {
                    userId = parsedUserId;
                }
                else
                {
                    // Fallback: get user by email
                    var email = User?.FindFirst("sub")?.Value;
                    if (string.IsNullOrEmpty(email))
                    {
                        email = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                    }
                    if (string.IsNullOrEmpty(email))
                    {
                        email = User?.FindFirst(ClaimTypes.Name)?.Value;
                    }

                    if (!string.IsNullOrEmpty(email))
                    {
                        var userResponse = await _userService.GetUserByEmailAsync(email);
                        if (userResponse.Success && userResponse.Data != null)
                        {
                            userId = userResponse.Data.Id;
                        }
                    }
                }

                if (!userId.HasValue)
                {
                    return Unauthorized(new { Message = "User ID not found in token" });
                }

                // Get user with Stripe account info
                var dbUserResponse = await _userService.GetUserByIdAsync(userId.Value);
                if (!dbUserResponse.Success || dbUserResponse.Data == null)
                {
                    return NotFound(new { Message = "User not found" });
                }
                var dbUser = dbUserResponse.Data;
                if (dbUser != null && dbUser.IsDemo)
                {
                    return BadRequest(new { Message = "Stripe payment setup is not available in demo mode." });
                }

                var (_, owned, ownershipError) = await ResolveOwnedOnboardingAsync(userId.Value);
                if (ownershipError != null) return ownershipError;
                if (owned!.StripeAccountId == null) return Conflict(new { Message = "Set up a Stripe account first" });

                var response = await _stripeService.CreateLoginLinkAsync(owned.StripeAccountId);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(new { DashboardUrl = response.Data });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating Stripe login link");
                return StatusCode(500, new { Message = "An error occurred while creating login link" });
            }
        }

        /// <summary>
        /// Create account session for embedded onboarding
        /// </summary>
        [HttpPost("account-session")]
        [RequireOrganizationRole("Owner", "Manager")]
        [RequireStripeConnectSetupReady]
        public async Task<IActionResult> CreateAccountSession()
        {
            try
            {
                // Get current user ID from JWT claims
                long? userId = null;
                var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userIdClaim))
                {
                    userIdClaim = User?.FindFirst("userId")?.Value;
                }

                if (!string.IsNullOrEmpty(userIdClaim) && long.TryParse(userIdClaim, out var parsedUserId))
                {
                    userId = parsedUserId;
                }
                else
                {
                    // Fallback: get user by email
                    var email = User?.FindFirst("sub")?.Value;
                    if (string.IsNullOrEmpty(email))
                    {
                        email = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                    }
                    if (string.IsNullOrEmpty(email))
                    {
                        email = User?.FindFirst(ClaimTypes.Name)?.Value;
                    }

                    if (!string.IsNullOrEmpty(email))
                    {
                        var userResponse = await _userService.GetUserByEmailAsync(email);
                        if (userResponse.Success && userResponse.Data != null)
                        {
                            userId = userResponse.Data.Id;
                        }
                    }
                }

                if (!userId.HasValue)
                {
                    return Unauthorized(new { Message = "User ID not found in token" });
                }

                // Get user with Stripe account info
                var dbUserResponse = await _userService.GetUserByIdAsync(userId.Value);
                if (!dbUserResponse.Success || dbUserResponse.Data == null)
                {
                    return NotFound(new { Message = "User not found" });
                }
                var dbUser = dbUserResponse.Data;
                if (dbUser != null && dbUser.IsDemo)
                {
                    return BadRequest(new { Message = "Stripe payment setup is not available in demo mode." });
                }

                var (_, owned, ownershipError) = await ResolveOwnedOnboardingAsync(userId.Value);
                if (ownershipError != null) return ownershipError;
                if (owned!.StripeAccountId == null) return Conflict(new { Message = "Set up a Stripe account first" });

                var response = await _stripeService.CreateAccountSessionAsync(owned.StripeAccountId);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating Stripe account session");
                return StatusCode(500, new { Message = "An error occurred while creating account session" });
            }
        }

        /// <summary>
        /// Create a short-lived Stripe session for embedded payout account management.
        /// Bank credentials are entered directly into Stripe's component and never pass through this API.
        /// </summary>
        [HttpPost("account-management-session")]
        [RequireOrganizationRole("Owner", "Manager")]
        [RequireStripeConnectSetupReady]
        public async Task<IActionResult> CreateAccountManagementSession()
        {
            try
            {
                var userIdResponse = await _userService.GetCurrentUserIdAsync();
                if (!userIdResponse.Success || !userIdResponse.Data.HasValue)
                    return Unauthorized(new { Message = "User not found" });

                var dbUserResponse = await _userService.GetUserByIdAsync(userIdResponse.Data.Value);
                if (!dbUserResponse.Success || dbUserResponse.Data == null)
                    return NotFound(new { Message = "User not found" });
                if (dbUserResponse.Data.IsDemo)
                    return BadRequest(new { Message = "Stripe payment setup is not available in demo mode." });

                var organizationId = this.GetCurrentOrganizationIdOrForbid();
                if (!organizationId.HasValue)
                    return StatusCode(StatusCodes.Status403Forbidden, new { Message = "Organization context is required" });
                var (_, owned, ownershipError) = await ResolveOwnedOnboardingAsync(userIdResponse.Data.Value);
                if (ownershipError != null) return ownershipError;
                if (owned!.StripeAccountId == null) return Conflict(new { Message = "Set up a Stripe account first" });
                var response = await _stripeService.CreateAccountManagementSessionAsync(owned.StripeAccountId);
                return response.Success ? Ok(response) : BadRequest(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating Stripe account-management session");
                return StatusCode(500, new { Message = "An error occurred while creating account-management session" });
            }
        }

        /// <summary>
        /// Sync/create bank account from Stripe Connect account
        /// </summary>
        [HttpPost("sync-bank-account")]
        [RequireRentPaymentActionReady(RentPaymentAction.Configure)]
        public async Task<IActionResult> SyncBankAccount()
        {
            try
            {
                if (User?.Identity?.IsAuthenticated != true)
                {
                    return Unauthorized(new { Message = "Authentication is required" });
                }

                // Get current user ID
                var userIdResponse = await _userService.GetCurrentUserIdAsync();
                if (!userIdResponse.Success || !userIdResponse.Data.HasValue)
                {
                    return Unauthorized(new { Message = "User not found" });
                }

                var userId = userIdResponse.Data.Value;
                var authenticatedUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                    ?? User.FindFirst("userId")?.Value;
                if (long.TryParse(authenticatedUserIdClaim, out var authenticatedUserId)
                    && authenticatedUserId != userId)
                {
                    return Unauthorized(new { Message = "Authenticated user does not match the requested user" });
                }

                // Get user with Stripe account info
                var dbUserResponse = await _userService.GetUserByIdAsync(userId);
                if (!dbUserResponse.Success || dbUserResponse.Data == null)
                {
                    return NotFound(new { Message = "User not found" });
                }

                var dbUser = dbUserResponse.Data;
                if (dbUser.IsDemo)
                {
                    return BadRequest(new { Message = "Stripe payment setup is not available in demo mode." });
                }

                var (organizationId, destination, destinationError) =
                    await ResolveOwnedApprovedDestinationAsync(userId);
                if (destinationError != null)
                    return destinationError;

                // Refresh Stripe and internal readiness for this exact authenticated user,
                // organization and destination before returning or creating any bank record.
                // The refresh may suspend a formerly approved payee, so fail closed on either
                // an unavailable snapshot or a denied readiness decision.
                var accountStatusResponse = await _stripeService.GetAccountStatusAsync(
                    destination!.StripeAccountId, userId, organizationId);
                if (!accountStatusResponse.Success || accountStatusResponse.Data == null
                    || !accountStatusResponse.Data.IsAccountReadyForRentTransfers)
                {
                    return StatusCode(StatusCodes.Status403Forbidden, new
                    {
                        Message = "This Stripe destination is not currently eligible for rent payouts"
                    });
                }

                // Check if bank account already exists for this organization
                // Allow the same Stripe account to be used across multiple organizations
                var existingBankAccount = await _bankAccountRepository.GetBankAccountByOrganizationAndStripeAccountIdAsync(
                    organizationId, destination.StripeAccountId);
                if (existingBankAccount != null)
                {
                    // Bank account already exists for this organization, return it in the same format as creation
                    var existingDto = new LoadBankAccountDto
                    {
                        Id = existingBankAccount.Id,
                        OrganizationId = existingBankAccount.OrganizationId,
                        StripeAccountId = existingBankAccount.StripeAccountId,
                        DisplayName = existingBankAccount.DisplayName,
                        Last4 = existingBankAccount.Last4,
                        BankName = existingBankAccount.BankName,
                        AccountType = existingBankAccount.AccountType,
                        IsActive = existingBankAccount.IsActive,
                        IsDefault = existingBankAccount.IsDefault,
                        CreatedAt = existingBankAccount.CreatedAt,
                        UpdatedAt = existingBankAccount.UpdatedAt
                    };
                    var existingResponse = new ServiceResponse<LoadBankAccountDto>
                    {
                        Data = existingDto,
                        Message = "Bank account already exists for this organization",
                        Success = true
                    };
                    _logger.LogInformation("Bank account {BankAccountId} already exists for organization {OrganizationId} with Stripe account {StripeAccountId}",
                        existingBankAccount.Id, organizationId, destination.StripeAccountId);
                    return Ok(existingResponse);
                }

                // Try to get external account (bank account) details from Stripe
                string? last4 = null;
                string? bankName = null;
                string? accountType = null;

                try
                {
                    var accountService = new Stripe.AccountService();
                    var account = await accountService.GetAsync(destination.StripeAccountId);

                    // Get external accounts (bank accounts)
                    if (account.ExternalAccounts != null && account.ExternalAccounts.Data != null && account.ExternalAccounts.Data.Count > 0)
                    {
                        var bankAccount = account.ExternalAccounts.Data.FirstOrDefault(ea => ea is Stripe.BankAccount) as Stripe.BankAccount;
                        if (bankAccount != null)
                        {
                            last4 = bankAccount.Last4;
                            bankName = bankAccount.BankName;
                            accountType = bankAccount.AccountType;
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Could not fetch bank account details from Stripe for account {AccountId}", destination.StripeAccountId);
                    // Continue without bank account details - we'll create with what we have
                }

                // Create bank account record
                var createDto = new CreateBankAccountDto
                {
                    OrganizationId = organizationId,
                    StripeAccountId = destination.StripeAccountId,
                    DisplayName = $"Bank Account {(!string.IsNullOrEmpty(last4) ? $"(****{last4})" : "")}".Trim(),
                    Last4 = last4,
                    BankName = bankName,
                    AccountType = accountType,
                    IsDefault = false // Don't set as default automatically
                };

                var createResponse = await _bankAccountService.CreateBankAccountAsync(createDto);
                if (!createResponse.Success)
                {
                    _logger.LogError("Failed to create bank account: {Message}", createResponse.Message);
                    return BadRequest(createResponse);
                }

                _logger.LogInformation("Successfully created bank account {BankAccountId} for organization {OrganizationId} with Stripe account {StripeAccountId}",
                    createResponse.Data?.Id, organizationId, destination.StripeAccountId);
                return Ok(createResponse);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error syncing bank account");
                return StatusCode(500, new { Message = "An error occurred while syncing bank account" });
            }
        }

        /// <summary>
        /// Get Stripe publishable key
        /// </summary>
        [AllowAnonymous] // Publishable key is safe to expose publicly
        [HttpGet("publishable-key")]
        public IActionResult GetPublishableKey()
        {
            try
            {
                var publishableKey = _stripeService.GetPublishableKey();
                if (string.IsNullOrEmpty(publishableKey))
                {
                    return BadRequest(new { Message = "Publishable key not configured" });
                }
                return Ok(new { publishableKey = publishableKey });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting Stripe publishable key");
                return StatusCode(500, new { Message = "An error occurred while getting publishable key" });
            }
        }

        /// <summary>
        /// Create a setup intent so tenants can save or update a payment method without making a payment
        /// </summary>
        [Authorize(Roles = "Tenant")]
        [HttpPost("create-setup-intent")]
        [RequireRentPaymentActionReady(RentPaymentAction.Pay)]
        public async Task<IActionResult> CreateSetupIntent()
        {
            try
            {
                var userId = await GetCurrentUserIdAsync();
                if (!userId.HasValue)
                {
                    return Unauthorized(new { Message = "User ID not found in token" });
                }

                var dbUserResponse = await _userService.GetUserByIdAsync(userId.Value);
                if (!dbUserResponse.Success || dbUserResponse.Data == null)
                {
                    return NotFound(new { Message = "User not found" });
                }

                var dbUser = dbUserResponse.Data;
                if (dbUser.IsDemo)
                {
                    return BadRequest(new { Message = "Payment method setup is not available in demo mode." });
                }

                var customerId = dbUser.StripeCustomerId;
                if (string.IsNullOrWhiteSpace(customerId))
                {
                    var fullName = string.Join(" ", new[] { dbUser.Firstname, dbUser.Lastname }.Where(x => !string.IsNullOrWhiteSpace(x)));
                    var customerResponse = await _stripeService.CreateCustomerAsync(
                        dbUser.Email,
                        string.IsNullOrWhiteSpace(fullName) ? dbUser.Email : fullName,
                        new Dictionary<string, string>
                        {
                            { "userId", dbUser.Id.ToString() },
                            { "role", "Tenant" }
                        }
                    );

                    if (!customerResponse.Success || customerResponse.Data == null)
                    {
                        return BadRequest(customerResponse);
                    }

                    customerId = customerResponse.Data.Id;
                    await _userRepository.UpdateStripeCustomerIdAsync(dbUser.Id, customerId);
                }

                var setupIntentService = new SetupIntentService();
                var setupIntent = await setupIntentService.CreateAsync(new SetupIntentCreateOptions
                {
                    Customer = customerId,
                    Usage = "off_session",
                    AutomaticPaymentMethods = new SetupIntentAutomaticPaymentMethodsOptions
                    {
                        Enabled = true
                    },
                    Metadata = new Dictionary<string, string>
                    {
                        { "userId", dbUser.Id.ToString() },
                        { "role", "Tenant" }
                    }
                });

                return Ok(new ServiceResponse<CreateSetupIntentResponseDto>
                {
                    Data = new CreateSetupIntentResponseDto
                    {
                        ClientSecret = setupIntent.ClientSecret,
                        SetupIntentId = setupIntent.Id,
                        CustomerId = customerId
                    },
                    Message = "Setup intent created successfully"
                });
            }
            catch (StripeException ex)
            {
                _logger.LogError(ex, "Stripe error creating tenant setup intent");
                return BadRequest(new { Message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating tenant setup intent");
                return StatusCode(500, new { Message = "An error occurred while creating setup intent" });
            }
        }

        /// <summary>
        /// Create a payment intent for tenant payment
        /// </summary>
        [Authorize(Roles = "Tenant")]
        [HttpPost("create-payment-intent")]
        [RequireRentPaymentActionReady(RentPaymentAction.Pay)]
        public async Task<IActionResult> CreatePaymentIntent([FromBody] CreatePaymentIntentDto request)
        {
            try
            {
                if (!_configuration.GetValue<bool>("Stripe:RentPaymentsEnabled"))
                {
                    _logger.LogWarning("Blocked rent PaymentIntent creation because the emergency payment gate is closed");
                    return StatusCode(StatusCodes.Status503ServiceUnavailable, new
                    {
                        Message = "Online rent payments are temporarily unavailable. Please try again later."
                    });
                }

                if (request.LeaseId <= 0 || request.Amount <= 0)
                {
                    return BadRequest(new { Message = "Invalid lease ID or amount" });
                }

                if (!Guid.TryParse(request.OperationId, out _))
                {
                    return BadRequest(new { success = false, message = "A valid payment operation ID is required" });
                }

                var response = await _stripeService.CreatePaymentIntentAsync(request.LeaseId, request.Amount, request.OperationId, request.Description);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating payment intent");
                return StatusCode(500, new { Message = "An error occurred while creating payment intent" });
            }
        }

        /// <summary>
        /// Update an existing tenant payment intent amount without recreating the Stripe Payment Element
        /// </summary>
        [Authorize(Roles = "Tenant")]
        [HttpPost("update-payment-intent")]
        [RequireRentPaymentActionReady(RentPaymentAction.Pay)]
        public async Task<IActionResult> UpdatePaymentIntent([FromBody] UpdatePaymentIntentDto request)
        {
            try
            {
                if (!_configuration.GetValue<bool>("Stripe:RentPaymentsEnabled"))
                {
                    _logger.LogWarning("Blocked rent PaymentIntent update because the emergency payment gate is closed");
                    return StatusCode(StatusCodes.Status503ServiceUnavailable, new
                    {
                        Message = "Online rent payments are temporarily unavailable. Please try again later."
                    });
                }

                if (string.IsNullOrWhiteSpace(request.PaymentIntentId) || request.LeaseId <= 0 || request.Amount <= 0)
                {
                    return BadRequest(new { Message = "Invalid payment intent, lease ID, or amount" });
                }

                var response = await _stripeService.UpdatePaymentIntentAsync(request.PaymentIntentId, request.LeaseId, request.Amount, request.Description);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating payment intent");
                return StatusCode(500, new { Message = "An error occurred while updating payment intent" });
            }
        }

        /// <summary>
        /// Confirm a payment after successful Stripe payment
        /// </summary>
        [Authorize(Roles = "Tenant")]
        [HttpPost("confirm-payment")]
        public Task<IActionResult> ConfirmPayment([FromBody] ConfirmPaymentDto request)
        {
            // Browser confirmation is deliberately non-authoritative. Stripe's signed webhook
            // validates the durable rent-payment aggregate and performs accounting finalization.
            IActionResult result = StatusCode(StatusCodes.Status202Accepted, new
            {
                Success = true,
                Message = "Payment submitted. Final status will be recorded from Stripe."
            });
            return Task.FromResult(result);
        }

        /// <summary>
        /// Acknowledge browser-side confirmation; signed Stripe webhooks own accounting.
        /// This compatibility endpoint never allocates rent, fees, or deposits.
        /// </summary>
        [Authorize(Roles = "Tenant")]
        [HttpPost("confirm-payment-allocated")]
        public Task<IActionResult> ConfirmPaymentAllocated([FromBody] ConfirmPaymentDto request)
        {
            // Retained as a compatibility acknowledgement only. It must never write payment
            // or allocation records from browser-supplied lease, amount, or date values.
            IActionResult result = StatusCode(StatusCodes.Status202Accepted, new
            {
                Success = true,
                Message = "Payment submitted. Final status will be recorded from Stripe."
            });
            return Task.FromResult(result);
        }

        /// <summary>
        /// Link an existing Stripe account to the current user
        /// </summary>
        [NonAction]
        [ApiExplorerSettings(IgnoreApi = true)]
        public async Task<IActionResult> LinkExistingAccount([FromBody] LinkAccountRequest request)
        {
            try
            {
                // Get current user ID from JWT claims
                long? userId = null;
                var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userIdClaim))
                {
                    userIdClaim = User?.FindFirst("userId")?.Value;
                }

                if (!string.IsNullOrEmpty(userIdClaim) && long.TryParse(userIdClaim, out var parsedUserId))
                {
                    userId = parsedUserId;
                }
                else
                {
                    // Fallback: get user by email
                    var email = User?.FindFirst("sub")?.Value;
                    if (string.IsNullOrEmpty(email))
                    {
                        email = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                    }
                    if (string.IsNullOrEmpty(email))
                    {
                        email = User?.FindFirst(ClaimTypes.Name)?.Value;
                    }

                    if (!string.IsNullOrEmpty(email))
                    {
                        var userResponse = await _userService.GetUserByEmailAsync(email);
                        if (userResponse.Success && userResponse.Data != null)
                        {
                            userId = userResponse.Data.Id;
                        }
                    }
                }

                if (!userId.HasValue)
                {
                    return Unauthorized(new { Message = "User ID not found in token" });
                }

                if (string.IsNullOrEmpty(request.AccountId))
                {
                    return BadRequest(new { Message = "Account ID is required" });
                }

                var dbUserResponse = await _userService.GetUserByIdAsync(userId.Value);
                if (!dbUserResponse.Success || dbUserResponse.Data == null)
                {
                    return NotFound(new { Message = "User not found" });
                }
                if (dbUserResponse.Data.IsDemo)
                {
                    return BadRequest(new { Message = "Stripe payment setup is not available in demo mode." });
                }

                var response = await _stripeService.LinkExistingAccountAsync(userId.Value, request.AccountId);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error linking Stripe account");
                return StatusCode(500, new { Message = "An error occurred while linking account" });
            }
        }

        private async Task<(long OrganizationId, ApprovedStripeDestination? Destination, IActionResult? Error)>
            ResolveOwnedApprovedDestinationAsync(long actorUserId)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
            {
                return (0, null, StatusCode(StatusCodes.Status403Forbidden,
                    new { Message = "Organization context is required" }));
            }

            if (_stripeConnectedPayeeService == null)
            {
                return (organizationId.Value, null, StatusCode(StatusCodes.Status503ServiceUnavailable,
                    new { Message = "Payout account management is unavailable" }));
            }

            var destination = await _stripeConnectedPayeeService.ResolveApprovedDestinationAsync(
                actorUserId, organizationId.Value, HttpContext.RequestAborted);
            if (destination == null || destination.PayeeUserId != actorUserId)
            {
                return (organizationId.Value, null, StatusCode(StatusCodes.Status403Forbidden,
                    new { Message = "Payout account management is unavailable for this organization" }));
            }

            if (!await _stripeConnectedPayeeService.IsApprovedDestinationAsync(
                    actorUserId, organizationId.Value, destination.StripeAccountId,
                    HttpContext.RequestAborted))
            {
                return (organizationId.Value, null, StatusCode(StatusCodes.Status403Forbidden,
                    new { Message = "This Stripe destination is not payout-approved for the current organization" }));
            }

            return (organizationId.Value, destination, null);
        }

        private async Task<(long OrganizationId, OwnedStripeAccount? Account, IActionResult? Error)> ResolveOwnedOnboardingAsync(long actorUserId)
        {
            if (User?.Identity?.IsAuthenticated != true || actorUserId <= 0 ||
                !long.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("userId")?.Value,
                    out var claimUserId) || claimUserId != actorUserId)
                return (0, null, Unauthorized(new { Message = "Authenticated account owner is required" }));
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return (0, null, StatusCode(403, new { Message = "Organization context is required" }));
            if (_stripeConnectedPayeeService == null)
                return (organizationId.Value, null, StatusCode(503, new { Message = "Account ownership validation is unavailable" }));
            var account = await _stripeConnectedPayeeService.ResolveOwnedAccountForOnboardingAsync(
                actorUserId, organizationId.Value, HttpContext.RequestAborted);
            if (account == null || account.UserId != actorUserId)
                return (organizationId.Value, null, StatusCode(403, new { Message = "This account is not owned in the selected organization" }));
            // No pre-Connect identity proof is available for first-time accounts. Never silently
            // treat Connect preparation or a collection approval as identity verification.
            if (_configuration.GetValue<bool>("ShortStayCollection:RequireIdentityBeforeConnect"))
                return (organizationId.Value, null, StatusCode(403, new { Message = "Pre-Connect identity verification is required" }));
            return (organizationId.Value, account, null);
        }

        private async Task<long?> GetCurrentUserIdAsync()
        {
            var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim))
            {
                userIdClaim = User?.FindFirst("userId")?.Value;
            }

            if (!string.IsNullOrEmpty(userIdClaim) && long.TryParse(userIdClaim, out var parsedUserId))
            {
                return parsedUserId;
            }

            var email = User?.FindFirst("sub")?.Value;
            if (string.IsNullOrEmpty(email))
            {
                email = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            }
            if (string.IsNullOrEmpty(email))
            {
                email = User?.FindFirst(ClaimTypes.Name)?.Value;
            }

            if (!string.IsNullOrEmpty(email))
            {
                var userResponse = await _userService.GetUserByEmailAsync(email);
                if (userResponse.Success && userResponse.Data != null)
                {
                    return userResponse.Data.Id;
                }
            }

            return null;
        }
    }

    public class CreateConnectAccountRequest
    {
        public string? ReturnUrl { get; set; }
        public string? RefreshUrl { get; set; }
        public string? OperatingType { get; set; }
        public string? LegalBusinessName { get; set; }
        public string? Ein { get; set; }
    }

    public class CreateAccountLinkRequest
    {
        public string? ReturnUrl { get; set; }
        public string? RefreshUrl { get; set; }
        public string? Type { get; set; } // "account_onboarding" or "account_update"
    }

    public class LinkAccountRequest
    {
        public string AccountId { get; set; } = string.Empty;
    }

    public class CreatePaymentIntentRequest
    {
        public long LeaseId { get; set; }
        public decimal Amount { get; set; }
        public string? Description { get; set; }
    }

    public class ConfirmPaymentRequest
    {
        public string PaymentIntentId { get; set; } = string.Empty;
        public long LeaseId { get; set; }
        public decimal Amount { get; set; }
        public DateTime PaymentDate { get; set; }
    }
}

