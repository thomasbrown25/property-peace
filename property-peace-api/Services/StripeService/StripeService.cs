using Stripe;
using Stripe.Checkout;
using brownstone_hub_api.Dtos.Stripe;
using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Services.PaymentService;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Models;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Utils;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Http;
using System.Security.Claims;
using brownstone_hub_api.Services.StripeRentPayments;

namespace brownstone_hub_api.Services.StripeService
{
    public class StripeService : IStripeService
    {
        private readonly IUserRepository _userRepository;
        private readonly ILeaseRepository _leaseRepository;
        private readonly IPropertyRepository _propertyRepository;
        private readonly IPaymentService _paymentService;
        private readonly INotificationService _notificationService;
        private readonly DataContext _context;
        private readonly IConfiguration _configuration;
        private readonly ILogger<StripeService> _logger;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly IStripeRentPaymentService _stripeRentPaymentService;
        private readonly string? _stripeSecretKey;
        private readonly string? _stripePublishableKey;

        public StripeService(
            IUserRepository userRepository,
            ILeaseRepository leaseRepository,
            IPropertyRepository propertyRepository,
            IPaymentService paymentService,
            INotificationService notificationService,
            DataContext context,
            IConfiguration configuration,
            ILogger<StripeService> logger,
            IHttpContextAccessor httpContextAccessor,
            IStripeRentPaymentService stripeRentPaymentService)
        {
            _userRepository = userRepository;
            _leaseRepository = leaseRepository;
            _propertyRepository = propertyRepository;
            _paymentService = paymentService;
            _notificationService = notificationService;
            _context = context;
            _configuration = configuration;
            _logger = logger;
            _httpContextAccessor = httpContextAccessor;
            _stripeRentPaymentService = stripeRentPaymentService;

            _stripeSecretKey = _configuration["Stripe:SecretKey"];
            _stripePublishableKey = _configuration["Stripe:PublishableKey"];

            if (string.IsNullOrWhiteSpace(_stripeSecretKey))
            {
                _logger.LogWarning("Stripe:SecretKey is not configured");
            }

            if (string.IsNullOrWhiteSpace(_stripePublishableKey))
            {
                _logger.LogWarning("Stripe:PublishableKey is not configured");
            }

            if (!string.IsNullOrWhiteSpace(_stripeSecretKey))
            {
                StripeConfiguration.ApiKey = _stripeSecretKey;
            }
        }

        /// <summary>
        /// Ensures the connected account has stripe_balance.stripe_transfers capability requested so it can receive
        /// destination transfers (tenant payments to landlord). Call when creating an account or when creating an account link (e.g. add bank).
        /// </summary>
        private async Task EnsureStripeTransfersCapabilityRequestedAsync(string accountId)
        {
            const string stripeTransfersCapability = "stripe_balance.stripe_transfers";
            var requestOptions = new RequestOptions { StripeAccount = accountId };
            var accountService = new Stripe.AccountService();

            try
            {
                var capability = await accountService.Capabilities.GetAsync(accountId, stripeTransfersCapability, null, requestOptions);
                if (capability.Status == "active" || capability.Requested == true)
                    return;
            }
            catch (StripeException)
            {
                // Capability may not exist yet; we'll request it below
            }

            try
            {
                await accountService.Capabilities.UpdateAsync(accountId, stripeTransfersCapability, new AccountCapabilityUpdateOptions { Requested = true }, requestOptions);
                _logger.LogInformation("Requested capability {Capability} for Stripe account {AccountId}", stripeTransfersCapability, accountId);
            }
            catch (StripeException ex)
            {
                _logger.LogWarning(ex, "Could not request capability {Capability} for account {AccountId}: {Message}", stripeTransfersCapability, accountId, ex.Message);
            }
        }

        public async Task<ServiceResponse<CreateStripeAccountResponseDto>> CreateConnectAccountAsync(long userId, string email, string returnUrl)
        {
            var response = new ServiceResponse<CreateStripeAccountResponseDto>();

            try
            {
                // Check if user already has a Stripe account
                var user = await _userRepository.GetUser(userId);
                if (user == null)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    return response;
                }

                if (!string.IsNullOrEmpty(user.StripeAccountId))
                {
                    // User already has an account, return existing account info
                    var accountStatus = await GetAccountStatusAsync(user.StripeAccountId);
                    if (accountStatus.Success && accountStatus.Data != null)
                    {
                        response.Data = new CreateStripeAccountResponseDto
                        {
                            AccountId = user.StripeAccountId,
                            Status = accountStatus.Data.Status ?? "unknown",
                            OnboardingUrl = accountStatus.Data.OnboardingUrl ?? string.Empty
                        };
                        response.Message = "Stripe account already exists";
                        return response;
                    }
                }

                // Create a new Stripe Connect account
                var accountOptions = new AccountCreateOptions
                {
                    Type = "express", // Use Express accounts for simpler onboarding
                    Country = "US", // Default to US, can be made configurable
                    Email = email,
                    BusinessProfile = new AccountBusinessProfileOptions
                    {
                        // Prefill a valid, reachable URL so Stripe onboarding doesn't block on "Your website" validation.
                        // Stripe validates that the URL is reachable; use a URL that resolves (e.g. app or marketing site).
                        Url = _configuration["Stripe:BusinessWebsiteUrl"]?.Trim()
                            ?? _configuration["FrontendBaseUrl"]?.Trim()
                            ?? "https://app.propertypeace.io"
                    },
                    Capabilities = new AccountCapabilitiesOptions
                    {
                        CardPayments = new AccountCapabilitiesCardPaymentsOptions
                        {
                            Requested = true
                        },
                        Transfers = new AccountCapabilitiesTransfersOptions
                        {
                            Requested = true
                        }
                    }
                };

                var accountService = new Stripe.AccountService();
                var account = await accountService.CreateAsync(accountOptions);

                // Request stripe_balance.stripe_transfers so destination charges/transfers work (required for tenant payments to landlord)
                await EnsureStripeTransfersCapabilityRequestedAsync(account.Id);

                // Update user with Stripe account ID
                await UpdateUserStripeAccountAsync(userId, account.Id, account.DetailsSubmitted ? "active" : "pending");

                // Create account link for onboarding
                var accountLinkResponse = await CreateAccountLinkAsync(account.Id, returnUrl, returnUrl);

                response.Data = new CreateStripeAccountResponseDto
                {
                    AccountId = account.Id,
                    Status = account.DetailsSubmitted ? "active" : "pending",
                    OnboardingUrl = accountLinkResponse.Success ? accountLinkResponse.Data : string.Empty
                };
                response.Message = "Stripe account created successfully";
            }
            catch (StripeException ex)
            {
                _logger.LogError(ex, "Stripe error creating Connect account for user {UserId}. Error: {ErrorType}, Code: {ErrorCode}, Message: {Message}",
                    userId, ex.GetType().Name, ex.StripeError?.Code, ex.Message);
                response.Success = false;

                // Provide more helpful error messages for common issues
                if (ex.Message.Contains("signed up for Connect") || ex.Message.Contains("Connect"))
                {
                    response.Message = "Stripe Connect is not enabled on your Stripe account. Please enable Stripe Connect in your Stripe Dashboard (Settings → Connect) before creating connected accounts. See https://stripe.com/docs/connect for more information.";
                }
                else
                {
                    response.Message = $"Stripe error: {ex.Message}";
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating Stripe Connect account for user {UserId}", userId);
                response.Success = false;
                response.Message = $"Error creating Stripe account: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<StripeAccountStatusDto>> GetAccountStatusAsync(string accountId)
        {
            var response = new ServiceResponse<StripeAccountStatusDto>();

            try
            {
                var accountService = new Stripe.AccountService();
                var account = await accountService.GetAsync(accountId);

                response.Data = new StripeAccountStatusDto
                {
                    AccountId = account.Id,
                    Status = account.DetailsSubmitted ? "active" : "pending",
                    IsEnabled = account.ChargesEnabled && account.PayoutsEnabled,
                    ChargesEnabled = account.ChargesEnabled,
                    PayoutsEnabled = account.PayoutsEnabled,
                    DetailsSubmitted = account.DetailsSubmitted
                };
                response.Message = "Account status retrieved successfully";
            }
            catch (StripeException ex)
            {
                _logger.LogError(ex, "Stripe error getting account status for {AccountId}", accountId);
                response.Success = false;
                response.Message = $"Stripe error: {ex.Message}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting Stripe account status for {AccountId}", accountId);
                response.Success = false;
                response.Message = $"Error getting account status: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<string>> CreateAccountLinkAsync(string accountId, string returnUrl, string refreshUrl, string type = "account_onboarding")
        {
            var response = new ServiceResponse<string>();

            try
            {
                // Ensure destination account can receive transfers (required for tenant payments) whenever they open onboarding/update (e.g. add bank)
                await EnsureStripeTransfersCapabilityRequestedAsync(accountId);

                var accountLinkService = new AccountLinkService();
                var accountLinkOptions = new AccountLinkCreateOptions
                {
                    Account = accountId,
                    RefreshUrl = refreshUrl,
                    ReturnUrl = returnUrl,
                    Type = type // "account_onboarding" or "account_update"
                };

                var accountLink = await accountLinkService.CreateAsync(accountLinkOptions);
                response.Data = accountLink.Url;
                response.Message = "Account link created successfully";
            }
            catch (StripeException ex)
            {
                _logger.LogError(ex, "Stripe error creating account link for {AccountId}", accountId);
                response.Success = false;
                response.Message = $"Stripe error: {ex.Message}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating account link for {AccountId}", accountId);
                response.Success = false;
                response.Message = $"Error creating account link: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<string>> CreateLoginLinkAsync(string accountId)
        {
            var response = new ServiceResponse<string>();

            try
            {
                // Use AccountService.LoginLinks to create a login link for Express Dashboard access
                // According to Stripe.NET source: AccountService has a LoginLinks property that returns AccountLoginLinkService
                // API endpoint: POST /v1/accounts/:id/login_links (no parameters needed)
                var accountService = new Stripe.AccountService();
                var loginLink = await accountService.LoginLinks.CreateAsync(accountId);

                response.Data = loginLink.Url;
                response.Message = "Login link created successfully";
            }
            catch (StripeException ex)
            {
                _logger.LogError(ex, "Stripe error creating login link for {AccountId}", accountId);
                response.Success = false;
                response.Message = $"Stripe error: {ex.Message}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating login link for {AccountId}", accountId);
                response.Success = false;
                response.Message = $"Error creating login link: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<AccountSessionDto>> CreateAccountSessionAsync(string accountId)
        {
            var response = new ServiceResponse<AccountSessionDto>();

            try
            {
                var accountSessionService = new AccountSessionService();
                var accountSessionOptions = new AccountSessionCreateOptions
                {
                    Account = accountId,
                    Components = new AccountSessionComponentsOptions
                    {
                        AccountOnboarding = new AccountSessionComponentsAccountOnboardingOptions
                        {
                            Enabled = true
                        }
                    }
                };

                var accountSession = await accountSessionService.CreateAsync(accountSessionOptions);
                response.Data = new AccountSessionDto
                {
                    ClientSecret = accountSession.ClientSecret
                };
                response.Message = "Account session created successfully";
            }
            catch (StripeException ex)
            {
                _logger.LogError(ex, "Stripe error creating account session for {AccountId}", accountId);
                response.Success = false;
                response.Message = $"Stripe error: {ex.Message}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating account session for {AccountId}", accountId);
                response.Success = false;
                response.Message = $"Error creating account session: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<bool>> UpdateUserStripeAccountAsync(long userId, string accountId, string status)
        {
            var response = new ServiceResponse<bool>();

            try
            {
                var success = await _userRepository.UpdateStripeAccountAsync(userId, accountId, status);
                if (success)
                {
                    response.Data = true;
                    response.Message = "User Stripe account updated successfully";
                }
                else
                {
                    response.Success = false;
                    response.Message = "Failed to update user Stripe account";
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Stripe account for user {UserId}", userId);
                response.Success = false;
                response.Message = $"Error updating Stripe account: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<bool>> LinkExistingAccountAsync(long userId, string accountId)
        {
            var response = new ServiceResponse<bool>();

            try
            {
                // Verify the account exists in Stripe
                var accountService = new Stripe.AccountService();
                var account = await accountService.GetAsync(accountId);

                if (account == null)
                {
                    response.Success = false;
                    response.Message = "Stripe account not found";
                    return response;
                }

                // Update user with the Stripe account ID
                var status = account.DetailsSubmitted ? "active" : "pending";
                var updateResult = await UpdateUserStripeAccountAsync(userId, accountId, status);

                if (updateResult.Success)
                {
                    response.Data = true;
                    response.Message = "Account linked successfully";
                }
                else
                {
                    response.Success = false;
                    response.Message = updateResult.Message;
                }
            }
            catch (StripeException ex)
            {
                _logger.LogError(ex, "Stripe error linking account {AccountId} to user {UserId}", accountId, userId);
                response.Success = false;
                response.Message = $"Stripe error: {ex.Message}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error linking account {AccountId} to user {UserId}", accountId, userId);
                response.Success = false;
                response.Message = $"Error linking account: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<CreatePaymentIntentResponseDto>> CreatePaymentIntentAsync(long leaseId, decimal amount, string operationId, string? description)
        {
            var response = new ServiceResponse<CreatePaymentIntentResponseDto>();
            try
            {
                var organizationId = GetCurrentOrganizationId();
                if (!organizationId.HasValue)
                {
                    response.Success = false;
                    response.Message = "Organization ID not found in context";
                    return response;
                }
                var lease = await _leaseRepository.GetLeaseById(leaseId, organizationId.Value);
                if (lease == null)
                {
                    response.Success = false;
                    response.Message = "Lease not found";
                    return response;
                }
                var tenantUserId = GetCurrentUserId();
                if (!tenantUserId.HasValue || !await _context.TenantLeases.AnyAsync(tl =>
                        tl.LeaseId == leaseId && tl.Tenant.UserId == tenantUserId.Value && !tl.Tenant.IsDeleted))
                {
                    response.Success = false;
                    response.Message = "Tenant is not authorized for this lease";
                    return response;
                }
                var destinationStripeAccountId = await _context.Leases
                    .Where(l => l.Id == leaseId && l.OrganizationId == organizationId.Value && !l.IsDeleted)
                    .Select(l => l.OperatingAccount != null && l.OperatingAccount.IsActive
                        ? l.OperatingAccount.StripeAccountId
                        : l.Unit.Property.OperatingAccount != null && l.Unit.Property.OperatingAccount.IsActive
                            ? l.Unit.Property.OperatingAccount.StripeAccountId
                            : l.Unit.Property.Landlord.StripeAccountEnabled && !l.Unit.Property.Landlord.IsDeleted
                                ? l.Unit.Property.Landlord.StripeAccountId
                                : null)
                    .SingleOrDefaultAsync();
                if (string.IsNullOrWhiteSpace(destinationStripeAccountId))
                {
                    response.Success = false;
                    response.Message = "Lease does not have an eligible connected Stripe destination";
                    return response;
                }
                var amountCents = ToRentAmountCents(amount);
                var paymentIntent = await _stripeRentPaymentService.CreateAsync(new CreateStripeRentPaymentCommand(
                    leaseId, organizationId.Value, tenantUserId.Value, operationId, amountCents, "usd",
                    destinationStripeAccountId, description));
                response.Data = new CreatePaymentIntentResponseDto
                {
                    ClientSecret = paymentIntent.ClientSecret,
                    PaymentIntentId = paymentIntent.PaymentIntentId
                };
                response.Message = "Payment intent created successfully";
            }
            catch (StripeException ex)
            {
                _logger.LogError(ex, "Stripe error creating payment intent for lease {LeaseId}", leaseId);
                response.Success = false;
                response.Message = $"Stripe error: {ex.Message}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating payment intent for lease {LeaseId}", leaseId);
                response.Success = false;
                response.Message = $"Error creating payment intent: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<CreatePaymentIntentResponseDto>> UpdatePaymentIntentAsync(string paymentIntentId, long leaseId, decimal amount, string? description)
        {
            var response = new ServiceResponse<CreatePaymentIntentResponseDto>();
            try
            {
                var organizationId = GetCurrentOrganizationId();
                if (!organizationId.HasValue)
                {
                    response.Success = false;
                    response.Message = "Organization ID not found in context";
                    return response;
                }

                var lease = await _leaseRepository.GetLeaseById(leaseId, organizationId.Value);
                if (lease == null)
                {
                    response.Success = false;
                    response.Message = "Lease not found";
                    return response;
                }
                var tenantUserId = GetCurrentUserId();
                if (!tenantUserId.HasValue)
                {
                    response.Success = false;
                    response.Message = "Tenant user ID not found in context";
                    return response;
                }
                var paymentIntent = await _stripeRentPaymentService.UpdateAsync(new UpdateStripeRentPaymentCommand(
                    paymentIntentId, leaseId, tenantUserId.Value, ToRentAmountCents(amount), description));
                response.Data = new CreatePaymentIntentResponseDto
                {
                    ClientSecret = paymentIntent.ClientSecret,
                    PaymentIntentId = paymentIntent.PaymentIntentId
                };
                response.Message = "Payment intent updated successfully";
            }
            catch (StripeException ex)
            {
                _logger.LogError(ex, "Stripe error updating payment intent {PaymentIntentId} for lease {LeaseId}", paymentIntentId, leaseId);
                response.Success = false;
                response.Message = $"Stripe error: {ex.Message}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating payment intent {PaymentIntentId} for lease {LeaseId}", paymentIntentId, leaseId);
                response.Success = false;
                response.Message = $"Error updating payment intent: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<bool>> ConfirmPaymentAsync(string paymentIntentId, long leaseId, decimal amount, DateTime paymentDate, bool recordAsProcessing = true)
        {
            var response = new ServiceResponse<bool>();

            try
            {
                // Verify payment intent status
                var paymentIntentService = new PaymentIntentService();
                var paymentIntent = await paymentIntentService.GetAsync(paymentIntentId, new PaymentIntentGetOptions
                {
                    Expand = new List<string> { "payment_method" }
                });

                if (paymentIntent.Status != "succeeded" && !(recordAsProcessing && paymentIntent.Status == "processing"))
                {
                    response.Success = false;
                    response.Message = $"Payment not ready to record. Status: {paymentIntent.Status}";
                    return response;
                }

                var existingCompletedPayment = await _context.Payments
                    .FirstOrDefaultAsync(p => p.Reference == paymentIntentId && p.LeaseId == leaseId && p.Status == "Completed");
                if (existingCompletedPayment != null)
                {
                    await StoreStripePaymentMethodAsync(existingCompletedPayment, paymentIntent);
                    response.Data = true;
                    response.Message = "Payment already completed";
                    return response;
                }

                if (recordAsProcessing)
                {
                    var existingProcessingPayment = await _context.Payments
                        .FirstOrDefaultAsync(p => p.Reference == paymentIntentId && p.LeaseId == leaseId && p.Status == "Processing");
                    if (existingProcessingPayment != null)
                    {
                        await StoreStripePaymentMethodAsync(existingProcessingPayment, paymentIntent);
                        response.Data = true;
                        response.Message = "Payment is already processing";
                        return response;
                    }
                }

                if (!recordAsProcessing)
                {
                    var processingPayments = await _context.Payments
                        .Where(p => p.Reference == paymentIntentId && p.LeaseId == leaseId && p.Status == "Processing")
                        .ToListAsync();
                    _context.Payments.RemoveRange(processingPayments);
                    await _context.SaveChangesAsync();
                }

                // Frontend confirmation records Processing; Stripe webhook later flips to Completed.
                var addPaymentDto = new brownstone_hub_api.Dtos.Payment.AddPaymentDto
                {
                    LeaseId = leaseId,
                    Amount = amount,
                    PaymentDate = paymentDate,
                    Method = "Online Payment",
                    Status = recordAsProcessing ? "Processing" : "Completed",
                    Reference = paymentIntentId,
                    StripePaymentIntentId = paymentIntentId,
                    StripePaymentMethodId = paymentIntent.PaymentMethodId
                };

                var paymentResult = await _paymentService.AddPayment(addPaymentDto);

                if (!paymentResult.Success)
                {
                    response.Success = false;
                    response.Message = paymentResult.Message;
                    return response;
                }

                var recordedPayment = await _context.Payments
                    .OrderByDescending(p => p.Id)
                    .FirstOrDefaultAsync(p => p.Reference == paymentIntentId && p.LeaseId == leaseId);
                if (recordedPayment != null)
                {
                    await StoreStripePaymentMethodAsync(recordedPayment, paymentIntent);
                }

                if (recordAsProcessing)
                {
                    response.Data = true;
                    response.Message = "Payment is processing and will be marked paid after Stripe webhook approval";
                    return response;
                }

                // Get lease to find landlord and send notification
                try
                {
                    var leaseWithProperty = await _context.Leases
                        .Include(l => l.Unit)
                            .ThenInclude(u => u.Property)
                        .FirstOrDefaultAsync(l => l.Id == leaseId);

                    if (leaseWithProperty != null && leaseWithProperty.Unit?.Property != null)
                    {
                        var landlordId = leaseWithProperty.Unit.Property.LandlordId;
                        
                        // Format property name similar to RentCollectionService
                        // For single family: just property name
                        // For multi-unit: property name – unit name
                        var propertyName = leaseWithProperty.Unit.Property.PropertyType.ToString().ToLower() == "singlefamily"
                            ? leaseWithProperty.Unit.Property.Name
                            : !string.IsNullOrEmpty(leaseWithProperty.Unit.Name)
                                ? $"{leaseWithProperty.Unit.Property.Name} – {leaseWithProperty.Unit.Name}"
                                : leaseWithProperty.Unit.Property.Name ?? "Property";

                        // Create notification for payment confirmation
                        var notificationDto = new CreateNotificationDto
                        {
                            UserId = landlordId,
                            Type = ENotificationType.Payment,
                            Title = "Payment Received",
                            Message = $"Payment of ${amount:F2} was received via Stripe for {propertyName} on {paymentDate:MM/dd/yyyy}",
                            RelatedId = leaseId,
                            SendEmail = true,
                            SendSMS = true
                        };

                        await _notificationService.CreateNotification(notificationDto);
                        _logger.LogInformation("Payment notification sent to landlord {LandlordId} for payment {PaymentIntentId}", landlordId, paymentIntentId);
                    }
                    else
                    {
                        _logger.LogWarning("Could not find lease or property information for lease {LeaseId} when creating payment notification", leaseId);
                    }
                }
                catch (Exception ex)
                {
                    // Log but don't fail payment processing if notification fails
                    _logger.LogError(ex, "Failed to create notification for payment {PaymentIntentId}: {ErrorMessage}", paymentIntentId, ex.Message);
                }

                response.Data = true;
                response.Message = "Payment confirmed and recorded successfully";
            }
            catch (StripeException ex)
            {
                _logger.LogError(ex, "Stripe error confirming payment {PaymentIntentId}", paymentIntentId);
                response.Success = false;
                response.Message = $"Stripe error: {ex.Message}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error confirming payment {PaymentIntentId}", paymentIntentId);
                response.Success = false;
                response.Message = $"Error confirming payment: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<bool>> ConfirmPaymentAllocatedAsync(string paymentIntentId, long leaseId, decimal amount, DateTime paymentDate, bool recordAsProcessing = true)
        {
            var response = new ServiceResponse<bool>();

            try
            {
                var paymentIntentService = new PaymentIntentService();
                var paymentIntent = await paymentIntentService.GetAsync(paymentIntentId, new PaymentIntentGetOptions
                {
                    Expand = new List<string> { "payment_method" }
                });

                if (paymentIntent.Status != "succeeded" && !(recordAsProcessing && paymentIntent.Status == "processing"))
                {
                    response.Success = false;
                    response.Message = $"Payment not ready to record. Status: {paymentIntent.Status}";
                    return response;
                }

                var existingCompletedPayment = await _context.Payments
                    .FirstOrDefaultAsync(p => p.Reference == paymentIntentId && p.LeaseId == leaseId && p.Status == "Completed");
                if (existingCompletedPayment != null)
                {
                    await StoreStripePaymentMethodAsync(existingCompletedPayment, paymentIntent);
                    response.Data = true;
                    response.Message = "Payment already completed";
                    return response;
                }

                if (recordAsProcessing)
                {
                    var existingProcessingPayment = await _context.Payments
                        .FirstOrDefaultAsync(p => p.Reference == paymentIntentId && p.LeaseId == leaseId && p.Status == "Processing");
                    if (existingProcessingPayment != null)
                    {
                        await StoreStripePaymentMethodAsync(existingProcessingPayment, paymentIntent);
                        response.Data = true;
                        response.Message = "Payment is already processing";
                        return response;
                    }
                }

                if (!recordAsProcessing)
                {
                    var processingPayments = await _context.Payments
                        .Where(p => p.Reference == paymentIntentId && p.LeaseId == leaseId && p.Status == "Processing")
                        .ToListAsync();
                    _context.Payments.RemoveRange(processingPayments);
                    await _context.SaveChangesAsync();
                }

                var paymentStatus = recordAsProcessing ? "Processing" : "Completed";

                var lease = await _context.Leases
                    .Include(l => l.Unit)
                        .ThenInclude(u => u.Property)
                    .Include(l => l.LeaseFees)
                    .Include(l => l.Deposits)
                    .FirstOrDefaultAsync(l => l.Id == leaseId);

                if (lease == null)
                {
                    response.Success = false;
                    response.Message = "Lease not found";
                    return response;
                }

                var allPayments = await _context.Payments
                    .Where(p => p.LeaseId == leaseId)
                    .ToListAsync();

                var rentPayments = allPayments
                    .Where(p => p.FeeId == null && p.DepositId == null)
                    .Select(p => new LoadPaymentDto { Id = p.Id, LeaseId = p.LeaseId, Amount = p.Amount, PaymentDate = p.PaymentDate })
                    .ToList();

                var leaseDto = new LoadLeaseDto
                {
                    Id = lease.Id,
                    StartDate = lease.StartDate,
                    EndDate = lease.EndDate,
                    RentAmount = lease.RentAmount,
                    RentDueDay = lease.RentDueDay,
                    RentFrequency = lease.RentFrequency,
                    IsActive = lease.IsActive
                };

                var rentAmountDue = RentCalculator.GetAmountDueNow(leaseDto, rentPayments);

                var feesWithRemaining = (lease.LeaseFees ?? [])
                    .Select(fee =>
                    {
                        var feePayments = allPayments.Where(p => p.FeeId == fee.Id).Sum(p => p.Amount);
                        var remaining = Math.Max(0, fee.Amount - feePayments);
                        return (fee, remaining);
                    })
                    .Where(x => x.remaining > 0)
                    .OrderBy(x => x.fee.DueDate)
                    .ToList();

                var depositPaid = (lease.Deposits ?? []).Any(d => d.ReceivedDate != default && d.RefundedDate == null);
                var depositAmount = (lease.DepositAmount ?? 0) > 0 && !depositPaid ? (lease.DepositAmount ?? 0) : 0;

                var allocationOrder = new List<(string type, long? feeId, decimal amount)>();
                if (rentAmountDue > 0)
                    allocationOrder.Add(("rent", null, rentAmountDue));
                foreach (var (fee, remaining) in feesWithRemaining)
                    allocationOrder.Add(("fee", fee.Id, remaining));
                if (depositAmount > 0)
                    allocationOrder.Add(("deposit", null, depositAmount));

                var remainingToAllocate = amount;
                var referencePrefix = paymentIntentId;

                foreach (var (type, feeId, allocAmount) in allocationOrder)
                {
                    if (remainingToAllocate <= 0) break;

                    var toApply = Math.Min(allocAmount, remainingToAllocate);
                    if (toApply <= 0) continue;

                    if (type == "rent")
                    {
                        var addDto = new AddPaymentDto
                        {
                            LeaseId = leaseId,
                            Amount = toApply,
                            PaymentDate = paymentDate,
                            Reference = referencePrefix,
                            Method = "Online Payment",
                            Status = paymentStatus,
                            StripePaymentIntentId = paymentIntentId,
                            StripePaymentMethodId = paymentIntent.PaymentMethodId,
                            FeeId = null,
                            DepositId = null
                        };
                        await _paymentService.AddPayment(addDto);
                    }
                    else if (type == "fee" && feeId.HasValue)
                    {
                        var addDto = new AddPaymentDto
                        {
                            LeaseId = leaseId,
                            Amount = toApply,
                            PaymentDate = paymentDate,
                            Reference = referencePrefix,
                            Method = "Online Payment",
                            Status = paymentStatus,
                            StripePaymentIntentId = paymentIntentId,
                            StripePaymentMethodId = paymentIntent.PaymentMethodId,
                            FeeId = feeId,
                            DepositId = null
                        };
                        await _paymentService.AddPayment(addDto);
                    }
                    else if (type == "deposit")
                    {
                        if (recordAsProcessing)
                        {
                            var addDto = new AddPaymentDto
                            {
                                LeaseId = leaseId,
                                Amount = toApply,
                                PaymentDate = paymentDate,
                                Reference = referencePrefix,
                                Method = "Online Payment",
                                Status = paymentStatus,
                                StripePaymentIntentId = paymentIntentId,
                                StripePaymentMethodId = paymentIntent.PaymentMethodId,
                                FeeId = null,
                                DepositId = null
                            };
                            await _paymentService.AddPayment(addDto);
                        }
                        else
                        {
                            var deposit = new Deposit
                            {
                                LeaseId = leaseId,
                                Amount = toApply,
                                ReceivedDate = paymentDate,
                                Notes = $"Deposit paid via Stripe - Payment Intent: {paymentIntentId}",
                                OrganizationId = lease.OrganizationId ?? lease.Unit?.Property?.OrganizationId
                            };
                            _context.Deposits.Add(deposit);
                            await _context.SaveChangesAsync();
                        }
                    }

                    remainingToAllocate -= toApply;
                }

                var stripePaymentRecords = await _context.Payments
                    .Where(p => p.Reference == paymentIntentId && p.LeaseId == leaseId)
                    .ToListAsync();
                foreach (var stripePaymentRecord in stripePaymentRecords)
                {
                    await StoreStripePaymentMethodAsync(stripePaymentRecord, paymentIntent);
                }

                if (recordAsProcessing)
                {
                    response.Data = true;
                    response.Message = "Payment is processing and will be marked paid after Stripe webhook approval";
                    return response;
                }

                try
                {
                    if (lease.Unit?.Property != null)
                    {
                        var landlordId = lease.Unit.Property.LandlordId;
                        var propertyName = lease.Unit.Property.PropertyType.ToString().ToLower() == "singlefamily"
                            ? lease.Unit.Property.Name
                            : !string.IsNullOrEmpty(lease.Unit.Name)
                                ? $"{lease.Unit.Property.Name} – {lease.Unit.Name}"
                                : lease.Unit.Property.Name ?? "Property";

                        var notificationDto = new CreateNotificationDto
                        {
                            UserId = landlordId,
                            Type = ENotificationType.Payment,
                            Title = "Payment Received",
                            Message = $"Payment of ${amount:F2} was received via Stripe for {propertyName} on {paymentDate:MM/dd/yyyy}",
                            RelatedId = leaseId,
                            SendEmail = true,
                            SendSMS = true
                        };

                        await _notificationService.CreateNotification(notificationDto);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to create notification for payment {PaymentIntentId}", paymentIntentId);
                }

                response.Data = true;
                response.Message = "Payment confirmed and allocated successfully";
            }
            catch (StripeException ex)
            {
                _logger.LogError(ex, "Stripe error confirming allocated payment {PaymentIntentId}", paymentIntentId);
                response.Success = false;
                response.Message = $"Stripe error: {ex.Message}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error confirming allocated payment {PaymentIntentId}", paymentIntentId);
                response.Success = false;
                response.Message = $"Error confirming payment: {ex.Message}";
            }

            return response;
        }

        private async Task StoreStripePaymentMethodAsync(Payment payment, PaymentIntent paymentIntent)
        {
            if (payment == null || string.IsNullOrWhiteSpace(paymentIntent.Id))
                return;

            PaymentMethod? paymentMethod = paymentIntent.PaymentMethod;
            if (paymentMethod == null && !string.IsNullOrWhiteSpace(paymentIntent.PaymentMethodId))
            {
                try
                {
                    var paymentMethodService = new PaymentMethodService();
                    paymentMethod = await paymentMethodService.GetAsync(paymentIntent.PaymentMethodId);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Could not retrieve Stripe payment method {PaymentMethodId}", paymentIntent.PaymentMethodId);
                }
            }

            payment.StripePaymentIntentId = paymentIntent.Id;
            payment.StripePaymentMethodId = paymentIntent.PaymentMethodId;
            payment.UpdatedAt = DateTime.UtcNow;

            // Persist method details as soon as Stripe returns them so pending/processing payments
            // can show the specific method type without marking the payment as completed.
            var existing = await _context.StripePaymentMethods
                .FirstOrDefaultAsync(pm => pm.StripePaymentIntentId == paymentIntent.Id && pm.PaymentId == payment.Id);

            if (existing == null)
            {
                existing = new StripePaymentMethod
                {
                    PaymentId = payment.Id,
                    StripePaymentIntentId = paymentIntent.Id,
                    OrganizationId = payment.OrganizationId
                };
                _context.StripePaymentMethods.Add(existing);
            }

            existing.StripePaymentMethodId = paymentIntent.PaymentMethodId;
            existing.Type = paymentMethod?.Type;
            existing.Brand = paymentMethod?.Card?.Brand;
            existing.Last4 = paymentMethod?.Card?.Last4;
            existing.ExpMonth = paymentMethod?.Card?.ExpMonth;
            existing.ExpYear = paymentMethod?.Card?.ExpYear;
            existing.BankName = paymentMethod?.UsBankAccount?.BankName;
            existing.WalletType = paymentMethod?.Card?.Wallet?.Type;
            existing.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
        }

        public string GetPublishableKey()
        {
            if (string.IsNullOrWhiteSpace(_stripePublishableKey))
            {
                _logger.LogError("Stripe publishable key is not configured");
                return string.Empty;
            }
            return _stripePublishableKey;
        }

        // Subscription methods
        public async Task<ServiceResponse<Stripe.Customer>> CreateCustomerAsync(string email, string name, Dictionary<string, string>? metadata = null)
        {
            var response = new ServiceResponse<Stripe.Customer>();

            try
            {
                var customerService = new CustomerService();
                var customerOptions = new CustomerCreateOptions
                {
                    Email = email,
                    Name = name,
                    Metadata = metadata ?? new Dictionary<string, string>()
                };

                var customer = await customerService.CreateAsync(customerOptions);
                response.Data = customer;
                response.Message = "Customer created successfully";
            }
            catch (StripeException ex)
            {
                _logger.LogError(ex, "Stripe error creating customer for email {Email}", email);
                response.Success = false;
                response.Message = $"Stripe error: {ex.Message}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating customer for email {Email}", email);
                response.Success = false;
                response.Message = $"Error creating customer: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<Stripe.Subscription>> CreateSubscriptionAsync(string customerId, string priceId, int? trialDays = null, string? paymentMethodId = null, DateTime? billingCycleAnchor = null)
        {
            var response = new ServiceResponse<Stripe.Subscription>();

            try
            {
                var subscriptionService = new Stripe.SubscriptionService();
                var subscriptionOptions = new SubscriptionCreateOptions
                {
                    Customer = customerId,
                    Items = new List<SubscriptionItemOptions>
                    {
                        new SubscriptionItemOptions
                        {
                            Price = priceId
                        }
                    }
                };

                if (trialDays.HasValue && trialDays.Value > 0)
                {
                    subscriptionOptions.TrialPeriodDays = trialDays.Value;
                    
                    // For trial subscriptions, payment method is optional
                    // If no payment method is provided, Stripe will require it when the trial ends
                    if (!string.IsNullOrWhiteSpace(paymentMethodId))
                    {
                        subscriptionOptions.DefaultPaymentMethod = paymentMethodId;
                    }
                    else
                    {
                        // When trial is set and no payment method is provided,
                        // Stripe allows the subscription to be created without a payment method
                        // The subscription will require a payment method before the trial ends
                        _logger.LogInformation("Creating subscription with {TrialDays} day trial without payment method for customer {CustomerId}", trialDays.Value, customerId);
                    }
                }
                else
                {
                    // For non-trial subscriptions, payment method should be provided
                    if (!string.IsNullOrWhiteSpace(paymentMethodId))
                    {
                        subscriptionOptions.DefaultPaymentMethod = paymentMethodId;
                    }
                    else
                    {
                        _logger.LogWarning("Creating subscription without trial period and without payment method for customer {CustomerId} - this may fail", customerId);
                    }
                }

                // Set billing cycle anchor to backdate the subscription (preserve original period start)
                if (billingCycleAnchor.HasValue)
                {
                    subscriptionOptions.BillingCycleAnchor = billingCycleAnchor.Value;
                    _logger.LogInformation("Setting billing cycle anchor to {BillingCycleAnchor} to preserve original subscription period", billingCycleAnchor.Value);
                }

                var subscription = await subscriptionService.CreateAsync(subscriptionOptions);
                response.Data = subscription;
                response.Message = "Subscription created successfully";
            }
            catch (StripeException ex)
            {
                _logger.LogError(ex, "Stripe error creating subscription for customer {CustomerId}", customerId);
                response.Success = false;
                response.Message = $"Stripe error: {ex.Message}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating subscription for customer {CustomerId}", customerId);
                response.Success = false;
                response.Message = $"Error creating subscription: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<Stripe.Subscription>> UpdateSubscriptionAsync(string subscriptionId, string newPriceId, bool prorate = true)
        {
            var response = new ServiceResponse<Stripe.Subscription>();

            try
            {
                var subscriptionService = new Stripe.SubscriptionService();

                // Get current subscription to find the subscription item
                var currentSubscription = await subscriptionService.GetAsync(subscriptionId);
                if (currentSubscription.Items == null || !currentSubscription.Items.Data.Any())
                {
                    response.Success = false;
                    response.Message = "Subscription has no items";
                    return response;
                }

                var subscriptionItemId = currentSubscription.Items.Data[0].Id;

                var updateOptions = new SubscriptionUpdateOptions
                {
                    Items = new List<SubscriptionItemOptions>
                    {
                        new SubscriptionItemOptions
                        {
                            Id = subscriptionItemId,
                            Price = newPriceId
                        }
                    },
                    ProrationBehavior = prorate ? "create_prorations" : "none"
                };

                var subscription = await subscriptionService.UpdateAsync(subscriptionId, updateOptions);
                response.Data = subscription;
                response.Message = "Subscription updated successfully";
            }
            catch (StripeException ex)
            {
                _logger.LogError(ex, "Stripe error updating subscription {SubscriptionId}", subscriptionId);
                response.Success = false;
                response.Message = $"Stripe error: {ex.Message}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating subscription {SubscriptionId}", subscriptionId);
                response.Success = false;
                response.Message = $"Error updating subscription: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<Stripe.Subscription>> CancelSubscriptionAsync(string subscriptionId, bool cancelAtPeriodEnd = true)
        {
            var response = new ServiceResponse<Stripe.Subscription>();

            try
            {
                var subscriptionService = new Stripe.SubscriptionService();
                Stripe.Subscription subscription;

                if (cancelAtPeriodEnd)
                {
                    // Cancel at end of period
                    var updateOptions = new SubscriptionUpdateOptions
                    {
                        CancelAtPeriodEnd = true
                    };
                    subscription = await subscriptionService.UpdateAsync(subscriptionId, updateOptions);
                }
                else
                {
                    // Cancel immediately
                    subscription = await subscriptionService.CancelAsync(subscriptionId);
                }

                response.Data = subscription;
                response.Message = cancelAtPeriodEnd
                    ? "Subscription will be cancelled at end of period"
                    : "Subscription cancelled immediately";
            }
            catch (StripeException ex)
            {
                _logger.LogError(ex, "Stripe error cancelling subscription {SubscriptionId}", subscriptionId);
                response.Success = false;
                response.Message = $"Stripe error: {ex.Message}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cancelling subscription {SubscriptionId}", subscriptionId);
                response.Success = false;
                response.Message = $"Error cancelling subscription: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<Stripe.Subscription>> ResumeSubscriptionAsync(string subscriptionId)
        {
            var response = new ServiceResponse<Stripe.Subscription>();

            try
            {
                var subscriptionService = new Stripe.SubscriptionService();

                // Remove cancellation at period end
                var updateOptions = new SubscriptionUpdateOptions
                {
                    CancelAtPeriodEnd = false
                };

                var subscription = await subscriptionService.UpdateAsync(subscriptionId, updateOptions);
                response.Data = subscription;
                response.Message = "Subscription resumed successfully";
            }
            catch (StripeException ex)
            {
                _logger.LogError(ex, "Stripe error resuming subscription {SubscriptionId}", subscriptionId);
                response.Success = false;
                response.Message = $"Stripe error: {ex.Message}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resuming subscription {SubscriptionId}", subscriptionId);
                response.Success = false;
                response.Message = $"Error resuming subscription: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<Stripe.Subscription>> PauseSubscriptionAsync(string subscriptionId, DateTime? resumesAt = null)
        {
            var response = new ServiceResponse<Stripe.Subscription>();

            try
            {
                var subscriptionService = new Stripe.SubscriptionService();
                var updateOptions = new SubscriptionUpdateOptions
                {
                    PauseCollection = new SubscriptionPauseCollectionOptions
                    {
                        Behavior = "void",
                        ResumesAt = resumesAt
                    }
                };
                var subscription = await subscriptionService.UpdateAsync(subscriptionId, updateOptions);
                response.Data = subscription;
                response.Message = "Subscription paused successfully";
            }
            catch (StripeException ex)
            {
                _logger.LogError(ex, "Stripe error pausing subscription {SubscriptionId}", subscriptionId);
                response.Success = false;
                response.Message = $"Stripe error: {ex.Message}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error pausing subscription {SubscriptionId}", subscriptionId);
                response.Success = false;
                response.Message = $"Error pausing subscription: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<Stripe.Subscription>> UnpauseSubscriptionAsync(string subscriptionId)
        {
            var response = new ServiceResponse<Stripe.Subscription>();

            try
            {
                var subscriptionService = new Stripe.SubscriptionService();
                var updateOptions = new SubscriptionUpdateOptions();
                updateOptions.AddExtraParam("pause_collection", "");
                var subscription = await subscriptionService.UpdateAsync(subscriptionId, updateOptions);
                response.Data = subscription;
                response.Message = "Subscription unpaused successfully";
            }
            catch (StripeException ex)
            {
                _logger.LogError(ex, "Stripe error unpausing subscription {SubscriptionId}", subscriptionId);
                response.Success = false;
                response.Message = $"Stripe error: {ex.Message}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error unpausing subscription {SubscriptionId}", subscriptionId);
                response.Success = false;
                response.Message = $"Error unpausing subscription: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<Stripe.Subscription>> GetSubscriptionAsync(string subscriptionId)
        {
            var response = new ServiceResponse<Stripe.Subscription>();

            try
            {
                var subscriptionService = new Stripe.SubscriptionService();
                var subscription = await subscriptionService.GetAsync(subscriptionId);
                response.Data = subscription;
                response.Message = "Subscription retrieved successfully";
            }
            catch (StripeException ex)
            {
                _logger.LogError(ex, "Stripe error getting subscription {SubscriptionId}", subscriptionId);
                response.Success = false;
                response.Message = $"Stripe error: {ex.Message}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting subscription {SubscriptionId}", subscriptionId);
                response.Success = false;
                response.Message = $"Error getting subscription: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<Stripe.Customer>> GetCustomerAsync(string customerId)
        {
            var response = new ServiceResponse<Stripe.Customer>();

            try
            {
                var customerService = new CustomerService();
                var customer = await customerService.GetAsync(customerId);
                response.Data = customer;
                response.Message = "Customer retrieved successfully";
            }
            catch (StripeException ex)
            {
                _logger.LogError(ex, "Stripe error getting customer {CustomerId}", customerId);
                response.Success = false;
                response.Message = $"Stripe error: {ex.Message}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting customer {CustomerId}", customerId);
                response.Success = false;
                response.Message = $"Error getting customer: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<string>> CreateCheckoutSessionAsync(string customerId, string priceId, string successUrl, string cancelUrl, int? trialDays = null)
        {
            var response = new ServiceResponse<string>();

            try
            {
                // Validate Stripe API key is configured
                if (string.IsNullOrWhiteSpace(_stripeSecretKey))
                {
                    _logger.LogError("Stripe SecretKey is not configured");
                    response.Success = false;
                    response.Message = "Stripe API key is not configured. Please check your appsettings.json or environment variables.";
                    return response;
                }

                // Log which mode we're using (test vs live)
                var isTestMode = _stripeSecretKey.StartsWith("sk_test_");
                _logger.LogInformation("Creating checkout session with Stripe {Mode} mode, Price ID: {PriceId}",
                    isTestMode ? "TEST" : "LIVE", priceId);

                // Verify price exists before creating session
                try
                {
                    var priceService = new PriceService();
                    var price = await priceService.GetAsync(priceId);

                    if (price == null)
                    {
                        response.Success = false;
                        response.Message = $"Price ID '{priceId}' not found in Stripe. Please verify the price ID exists in your Stripe {(isTestMode ? "test" : "live")} mode dashboard.";
                        return response;
                    }

                    _logger.LogInformation("Price verified: {PriceId} - {Amount} {Currency} ({BillingScheme})",
                        price.Id, price.UnitAmount, price.Currency, price.BillingScheme);
                }
                catch (StripeException priceEx) when (priceEx.StripeError?.Code == "resource_missing")
                {
                    _logger.LogError(priceEx, "Price ID {PriceId} not found in Stripe {Mode} mode",
                        priceId, isTestMode ? "TEST" : "LIVE");
                    response.Success = false;
                    response.Message = $"Price ID '{priceId}' not found in Stripe {(isTestMode ? "test" : "live")} mode. " +
                        $"Please verify: 1) The price ID is correct, 2) You're using the correct Stripe API key (test vs live), " +
                        $"3) The price exists in your Stripe dashboard.";
                    return response;
                }

                var sessionService = new SessionService();

                var sessionOptions = new SessionCreateOptions
                {
                    Customer = customerId,
                    PaymentMethodTypes = new List<string> { "card" },
                    LineItems = new List<SessionLineItemOptions>
                    {
                        new SessionLineItemOptions
                        {
                            Price = priceId,
                            Quantity = 1
                        }
                    },
                    Mode = "subscription",
                    SuccessUrl = successUrl,
                    CancelUrl = cancelUrl
                };

                if (trialDays.HasValue && trialDays.Value > 0)
                {
                    // For trials, set payment method collection to "if_required"
                    // This allows the trial to start without requiring a credit card upfront
                    // Stripe will allow the checkout to complete without a payment method,
                    // and will require it when the trial period ends
                    sessionOptions.PaymentMethodCollection = "if_required";
                    
                    sessionOptions.SubscriptionData = new SessionSubscriptionDataOptions
                    {
                        TrialPeriodDays = trialDays.Value
                    };
                    
                    _logger.LogInformation("Creating checkout session with {TrialDays} day trial - payment method collection set to 'if_required'", trialDays.Value);
                }

                var session = await sessionService.CreateAsync(sessionOptions);
                response.Data = session.Url;
                response.Message = "Checkout session created successfully";
            }
            catch (StripeException ex)
            {
                var isTestMode = !string.IsNullOrWhiteSpace(_stripeSecretKey) && _stripeSecretKey.StartsWith("sk_test_");
                _logger.LogError(ex, "Stripe error creating checkout session for customer {CustomerId}, Price ID: {PriceId}, Mode: {Mode}",
                    customerId, priceId, isTestMode ? "TEST" : "LIVE");
                response.Success = false;
                response.Message = $"Stripe error: {ex.Message}";

                // Provide more helpful error message for common issues
                if (ex.StripeError?.Code == "resource_missing")
                {
                    response.Message = $"Price ID '{priceId}' not found in Stripe {(isTestMode ? "test" : "live")} mode. " +
                        $"Please verify the price ID in your Stripe dashboard matches the mode of your API key.";
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating checkout session for customer {CustomerId}", customerId);
                response.Success = false;
                response.Message = $"Error creating checkout session: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<Stripe.Product>> UpdateProductAsync(string productId, string name, string? description = null)
        {
            var response = new ServiceResponse<Stripe.Product>();

            try
            {
                var productService = new ProductService();
                var updateOptions = new ProductUpdateOptions
                {
                    Name = name
                };

                if (!string.IsNullOrWhiteSpace(description))
                {
                    updateOptions.Description = description;
                }

                var product = await productService.UpdateAsync(productId, updateOptions);
                response.Data = product;
                response.Message = "Product updated successfully";
            }
            catch (StripeException ex)
            {
                _logger.LogError(ex, "Stripe error updating product {ProductId}", productId);
                response.Success = false;
                response.Message = $"Stripe error: {ex.Message}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating product {ProductId}", productId);
                response.Success = false;
                response.Message = $"Error updating product: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<Stripe.Price>> CreatePriceAsync(string productId, decimal amount, string currency, string interval, int intervalCount = 1)
        {
            var response = new ServiceResponse<Stripe.Price>();

            try
            {
                var priceService = new PriceService();
                var priceOptions = new PriceCreateOptions
                {
                    Product = productId,
                    UnitAmount = (long)(amount * 100), // Convert to cents
                    Currency = currency.ToLower(),
                    Recurring = new PriceRecurringOptions
                    {
                        Interval = interval.ToLower(), // "month" or "year"
                        IntervalCount = intervalCount
                    }
                };

                var price = await priceService.CreateAsync(priceOptions);
                response.Data = price;
                response.Message = "Price created successfully";
            }
            catch (StripeException ex)
            {
                _logger.LogError(ex, "Stripe error creating price for product {ProductId}", productId);
                response.Success = false;
                response.Message = $"Stripe error: {ex.Message}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating price for product {ProductId}", productId);
                response.Success = false;
                response.Message = $"Error creating price: {ex.Message}";
            }

            return response;
        }

        private long? GetCurrentOrganizationId()
        {
            return _httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var value) == true
                && value is long organizationId
                ? organizationId
                : null;
        }

        private long? GetCurrentUserId()
        {
            var principal = _httpContextAccessor.HttpContext?.User;
            var value = principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? principal?.FindFirst("userId")?.Value;
            return long.TryParse(value, out var userId) ? userId : null;
        }

        private static long ToRentAmountCents(decimal amount)
        {
            var cents = amount * 100m;
            if (cents <= 0 || cents > 10_000_000m || cents != decimal.Truncate(cents))
                throw new ArgumentOutOfRangeException(nameof(amount), "Rent amount must use cents and be between $0.01 and $100,000.00.");
            return (long)cents;
        }

        public async Task<ServiceResponse<Stripe.Subscription>> UpdateSubscriptionPlanAsync(string subscriptionId, string newPriceId, bool prorate = true)
        {
            // Reuse existing UpdateSubscriptionAsync method
            return await UpdateSubscriptionAsync(subscriptionId, newPriceId, prorate);
        }
    }
}

