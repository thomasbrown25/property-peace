using brownstone_hub_api.Dtos.Stripe;
using brownstone_hub_api.Dtos.BankAccount;
using brownstone_hub_api.Services.StripeService;
using brownstone_hub_api.Services.UserService;
using brownstone_hub_api.Services.OrganizationService;
using brownstone_hub_api.Services.BankAccountService;
using brownstone_hub_api.Repositories.BankAccounts;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Stripe;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/stripe")]
    [Authorize(Roles = "Tenant,Landlord,Admin")]
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

        public StripeController(
            IStripeService stripeService,
            IUserService userService,
            IOrganizationService organizationService,
            IBankAccountService bankAccountService,
            IBankAccountRepository bankAccountRepository,
            IUserRepository userRepository,
            ILogger<StripeController> logger,
            IConfiguration? configuration = null)
        {
            _stripeService = stripeService;
            _userService = userService;
            _organizationService = organizationService;
            _bankAccountService = bankAccountService;
            _bankAccountRepository = bankAccountRepository;
            _userRepository = userRepository;
            _logger = logger;
            _configuration = configuration ?? new ConfigurationBuilder().Build();
        }

        /// <summary>
        /// Create or get Stripe Connect account for the current landlord
        /// </summary>
        [Authorize(Roles = "Landlord,Admin")]
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

                var returnUrl = request.ReturnUrl ?? $"{Request.Scheme}://{Request.Host}/landlord/settings?tab=payments&stripe=connected";
                var refreshUrl = request.RefreshUrl ?? $"{Request.Scheme}://{Request.Host}/landlord/settings?tab=payments&stripe=refresh";

                var response = await _stripeService.CreateConnectAccountAsync(userId.Value, dbUser.Email, returnUrl);

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
        [Authorize(Roles = "Landlord,Admin")]
        [HttpGet("account-status")]
        public async Task<IActionResult> GetAccountStatus()
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
                if (dbUser == null)
                {
                    return NotFound(new { Message = "User not found" });
                }

                if (string.IsNullOrEmpty(dbUser?.StripeAccountId))
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

                var response = await _stripeService.GetAccountStatusAsync(dbUser.StripeAccountId);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

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
        [Authorize(Roles = "Landlord,Admin")]
        [HttpPost("account-link")]
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
                if (dbUser == null || string.IsNullOrEmpty(dbUser.StripeAccountId))
                {
                    return BadRequest(new { Message = "Stripe account not found. Please create an account first." });
                }

                var returnUrl = request.ReturnUrl ?? $"{Request.Scheme}://{Request.Host}/landlord/settings?tab=payments&stripe=connected";
                var refreshUrl = request.RefreshUrl ?? $"{Request.Scheme}://{Request.Host}/landlord/settings?tab=payments&stripe=refresh";
                var linkType = request.Type ?? "account_onboarding";

                var response = await _stripeService.CreateAccountLinkAsync(dbUser.StripeAccountId, returnUrl, refreshUrl, linkType);

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
        [Authorize(Roles = "Landlord,Admin")]
        [HttpPost("login-link")]
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
                if (dbUser == null || string.IsNullOrEmpty(dbUser.StripeAccountId))
                {
                    return BadRequest(new { Message = "Stripe account not found. Please create an account first." });
                }

                var response = await _stripeService.CreateLoginLinkAsync(dbUser.StripeAccountId);

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
        [Authorize(Roles = "Landlord,Admin")]
        [HttpPost("account-session")]
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
                if (dbUser == null || string.IsNullOrEmpty(dbUser.StripeAccountId))
                {
                    return BadRequest(new { Message = "Stripe account not found. Please create an account first." });
                }

                var response = await _stripeService.CreateAccountSessionAsync(dbUser.StripeAccountId);

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
        /// Sync/create bank account from Stripe Connect account
        /// </summary>
        [Authorize(Roles = "Landlord,Admin")]
        [HttpPost("sync-bank-account")]
        public async Task<IActionResult> SyncBankAccount()
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

                if (string.IsNullOrEmpty(dbUser.StripeAccountId))
                {
                    return BadRequest(new { Message = "Stripe account not found. Please complete onboarding first." });
                }

                // Get user's organization
                var userOrgResponse = await _organizationService.GetCurrentUserOrganizationAsync(userId);
                if (!userOrgResponse.Success || userOrgResponse.Data == null)
                {
                    return NotFound(new { Message = "Organization not found" });
                }

                var organizationId = userOrgResponse.Data.Id;

                // Check if bank account already exists for this organization
                // Allow the same Stripe account to be used across multiple organizations
                var existingBankAccount = await _bankAccountRepository.GetBankAccountByOrganizationAndStripeAccountIdAsync(organizationId, dbUser.StripeAccountId);
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
                        existingBankAccount.Id, organizationId, dbUser.StripeAccountId);
                    return Ok(existingResponse);
                }

                // Fetch account details from Stripe
                var accountStatusResponse = await _stripeService.GetAccountStatusAsync(dbUser.StripeAccountId);
                if (!accountStatusResponse.Success || accountStatusResponse.Data == null)
                {
                    return BadRequest(new { Message = "Failed to fetch Stripe account details" });
                }

                // Try to get external account (bank account) details from Stripe
                string? last4 = null;
                string? bankName = null;
                string? accountType = null;

                try
                {
                    var accountService = new Stripe.AccountService();
                    var account = await accountService.GetAsync(dbUser.StripeAccountId);

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
                    _logger.LogWarning(ex, "Could not fetch bank account details from Stripe for account {AccountId}", dbUser.StripeAccountId);
                    // Continue without bank account details - we'll create with what we have
                }

                // Create bank account record
                var createDto = new CreateBankAccountDto
                {
                    OrganizationId = organizationId,
                    StripeAccountId = dbUser.StripeAccountId,
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
                    createResponse.Data?.Id, organizationId, dbUser.StripeAccountId);
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

                var response = await _stripeService.CreatePaymentIntentAsync(request.LeaseId, request.Amount, request.Description);

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
        public async Task<IActionResult> ConfirmPayment([FromBody] ConfirmPaymentDto request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.PaymentIntentId) || request.LeaseId <= 0 || request.Amount <= 0)
                {
                    return BadRequest(new { Message = "Invalid payment confirmation data" });
                }

                var response = await _stripeService.ConfirmPaymentAsync(
                    request.PaymentIntentId,
                    request.LeaseId,
                    request.Amount,
                    request.PaymentDate
                );

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error confirming payment");
                return StatusCode(500, new { Message = "An error occurred while confirming payment" });
            }
        }

        /// <summary>
        /// Confirm a payment and allocate it across rent, fees, and deposit
        /// </summary>
        [Authorize(Roles = "Tenant")]
        [HttpPost("confirm-payment-allocated")]
        public async Task<IActionResult> ConfirmPaymentAllocated([FromBody] ConfirmPaymentDto request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.PaymentIntentId) || request.LeaseId <= 0 || request.Amount <= 0)
                {
                    return BadRequest(new { Message = "Invalid payment confirmation data" });
                }

                var response = await _stripeService.ConfirmPaymentAllocatedAsync(
                    request.PaymentIntentId,
                    request.LeaseId,
                    request.Amount,
                    request.PaymentDate
                );

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error confirming allocated payment");
                return StatusCode(500, new { Message = "An error occurred while confirming payment" });
            }
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

