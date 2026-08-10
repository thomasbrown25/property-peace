using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using brownstone_hub_api.Dtos.User;
using brownstone_hub_api.Dtos.UserSetting;
using Microsoft.IdentityModel.Tokens;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Repositories.Users;
using System.Text;
using brownstone_hub_api.Repositories.Roles;
using brownstone_hub_api.Dtos.Role;
using System.Text.RegularExpressions;
using System.Security.Cryptography;
using brownstone_hub_api.Repositories.Tenants;
using brownstone_hub_api.Services.TenantInviteService;
using brownstone_hub_api.Services.GoogleAuthService;
using brownstone_hub_api.Services.AppleAuthService;
using brownstone_hub_api.Services.OrganizationInviteService;
using brownstone_hub_api.Services.OrganizationService;
using brownstone_hub_api.Data;
using Microsoft.EntityFrameworkCore;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Repositories.NotificationSettings;
using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Services.SubscriptionService;
using brownstone_hub_api.Dtos.Subscription;
using brownstone_hub_api.Services.StripeService;
using Microsoft.AspNetCore.Http;
using brownstone_hub_api.Services.EmailVerificationService;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Services.AzureBlobService;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;

namespace brownstone_hub_api.Services.UserService
{
    public partial class UserService(
        IUserRepository userRepository,
        IRoleRepository roleRepository,
        IConfiguration configuration,
        ILogger<UserService> logger,
        IGoogleAuthService googleAuthService,
        IAppleAuthService appleAuthService,
        DataContext dataContext,
        BlobServiceClient? blobServiceClient = null,
        IAzureBlobService? azureBlobService = null,
        IHttpClientFactory? httpClientFactory = null,
        ITenantInviteService? tenantInviteService = null,
        ITenantRepository? tenantRepository = null,
        IOrganizationInviteService? organizationInviteService = null,
        IOrganizationService? organizationService = null,
        INotificationService? notificationService = null,
        INotificationSettingRepository? notificationSettingRepository = null,
        SubscriptionService.ISubscriptionService? subscriptionService = null,
        IStripeService? stripeService = null,
        IHttpContextAccessor? httpContextAccessor = null,
        IEmailService? emailService = null) : IUserService
    {
        private readonly IUserRepository _userRepository = userRepository;
        private readonly IRoleRepository _roleRepository = roleRepository;
        private readonly IConfiguration _configuration = configuration;
        private readonly ILogger _logger = logger;
        private readonly IGoogleAuthService _googleAuthService = googleAuthService;
        private readonly IAppleAuthService _appleAuthService = appleAuthService;
        private readonly DataContext _dataContext = dataContext;
        private readonly BlobServiceClient? _blobServiceClient = blobServiceClient;
        private readonly IAzureBlobService? _azureBlobService = azureBlobService;
        private readonly IHttpClientFactory? _httpClientFactory = httpClientFactory;
        private readonly ITenantInviteService? _tenantInviteService = tenantInviteService;
        private readonly ITenantRepository? _tenantRepository = tenantRepository;
        private readonly IOrganizationInviteService? _organizationInviteService = organizationInviteService;
        private readonly IOrganizationService? _organizationService = organizationService;
        private readonly INotificationService? _notificationService = notificationService;
        private readonly INotificationSettingRepository? _notificationSettingRepository = notificationSettingRepository;
        private readonly SubscriptionService.ISubscriptionService? _subscriptionService = subscriptionService;
        private readonly IStripeService? _stripeService = stripeService;
        private readonly IHttpContextAccessor? _httpContextAccessor = httpContextAccessor;
        private readonly IEmailService? _emailService = emailService;

        private long? GetOrganizationIdFromContext()
        {
            if (_httpContextAccessor?.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }

        /// <summary>
        /// Downloads the Google profile image and saves it to blob storage.
        /// Returns the blob SAS URL on success, or the original Google URL as fallback if blob upload fails.
        /// </summary>
        private async Task<string?> SaveGoogleProfileImageToStorageAsync(string googlePictureUrl, long userId)
        {
            if (_blobServiceClient == null || _azureBlobService == null || _httpClientFactory == null)
            {
                return googlePictureUrl;
            }

            try
            {
                using var httpClient = _httpClientFactory.CreateClient();
                using var response = await httpClient.GetAsync(googlePictureUrl);
                response.EnsureSuccessStatusCode();

                var contentType = response.Content.Headers.ContentType?.MediaType ?? "image/jpeg";
                var extension = contentType.Contains("png") ? ".png" : ".jpg";

                var containerName = "profile-images";
                var containerClient = _blobServiceClient.GetBlobContainerClient(containerName);
                await containerClient.CreateIfNotExistsAsync(PublicAccessType.None);

                var blobName = $"{userId}/{Guid.NewGuid()}{extension}";
                var blobClient = containerClient.GetBlobClient(blobName);

                await using var stream = await response.Content.ReadAsStreamAsync();
                await blobClient.UploadAsync(stream, new BlobHttpHeaders { ContentType = contentType });

                var sasUri = _azureBlobService.GenerateBlobSasUri(
                    _blobServiceClient,
                    blobClient,
                    TimeSpan.FromDays(365)
                );

                return sasUri;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to persist Google profile image for user {UserId}, falling back to Google URL", userId);
                return googlePictureUrl;
            }
        }

        public Task<ServiceResponse<LoadUserDto>> Register(AddUserDto newUser) =>
            Register(newUser, emailVerifiedByTrustedProvider: false);

        private async Task<ServiceResponse<LoadUserDto>> Register(
            AddUserDto newUser,
            bool emailVerifiedByTrustedProvider)
        {
            ServiceResponse<LoadUserDto> response = new();

            try
            {
                newUser.Email = newUser.Email?.Trim().ToLowerInvariant() ?? string.Empty;
                _logger.LogInformation("Register called for email: {Email}, BusinessName: '{BusinessName}', Roles: {Roles}",
                    newUser.Email, newUser.BusinessName ?? "(null)", string.Join(", ", newUser.Roles ?? new List<string>()));

                long? emailVerificationId = null;
                var hasInviteContext = !string.IsNullOrWhiteSpace(newUser.OrganizationInviteToken) ||
                    !string.IsNullOrWhiteSpace(newUser.InviteToken);
                if (!emailVerifiedByTrustedProvider && !hasInviteContext)
                {
                    emailVerificationId = await GetValidEmailVerificationIdAsync(
                        newUser.Email,
                        newUser.EmailVerificationProof);
                    if (!emailVerificationId.HasValue)
                    {
                        response.Success = false;
                        response.StatusCode = StatusCodes.Status403Forbidden;
                        response.Message = "Email verification is required before registration.";
                        return response;
                    }
                }

                // Never trust privileged/auth fields from the public registration payload.
                // App roles must be derived server-side from the registration context.
                newUser.PasswordHash = null;
                newUser.PasswordSalt = null;
                newUser.HasSeenTutorial = false;
                newUser.NotificationPreferencesConfigured = false;

                long? tenantId = null;
                string? organizationInviteToken = null;
                var serverAssignedRoles = new List<string> { "Landlord" };

                // Handle organization invite token if provided
                if (!string.IsNullOrEmpty(newUser.OrganizationInviteToken))
                {
                    if (_organizationInviteService == null)
                    {
                        response.Message = "Organization invite service not available.";
                        response.Success = false;
                        return response;
                    }

                    // Validate organization invite token
                    var orgInvite = await _organizationInviteService.GetInviteByTokenAsync(newUser.OrganizationInviteToken);
                    if (!orgInvite.Success || orgInvite.Data == null)
                    {
                        response.Message = orgInvite.Message ?? "Invalid or expired organization invite token.";
                        response.Success = false;
                        return response;
                    }

                    // Verify email matches invite
                    if (!string.Equals(newUser.Email, orgInvite.Data.Email, StringComparison.OrdinalIgnoreCase))
                    {
                        response.Message = "Email does not match the organization invite.";
                        response.Success = false;
                        return response;
                    }

                    // Check if invite is already accepted
                    if (orgInvite.Data.IsAccepted)
                    {
                        response.Message = "This organization invite has already been accepted.";
                        response.Success = false;
                        return response;
                    }

                    // Check if invite is expired
                    if (orgInvite.Data.ExpiresAt < DateTime.Now)
                    {
                        response.Message = "This organization invite has expired.";
                        response.Success = false;
                        return response;
                    }

                    organizationInviteToken = newUser.OrganizationInviteToken;
                }

                // Handle tenant invite token if provided
                if (!string.IsNullOrEmpty(newUser.InviteToken))
                {
                    if (_tenantInviteService == null || _tenantRepository == null)
                    {
                        response.Message = "Tenant invite service not available.";
                        response.Success = false;
                        return response;
                    }

                    // Validate invite token
                    var inviteValidation = await _tenantInviteService.ValidateInviteToken(newUser.InviteToken);
                    if (!inviteValidation.Success || inviteValidation.Data == null || !inviteValidation.Data.IsValid)
                    {
                        response.Message = inviteValidation.Data?.Message ?? "Invalid or expired invite token.";
                        response.Success = false;
                        return response;
                    }

                    // Verify email matches invite
                    if (!string.Equals(newUser.Email, inviteValidation.Data.Email, StringComparison.OrdinalIgnoreCase))
                    {
                        response.Message = "Email does not match the invite.";
                        response.Success = false;
                        return response;
                    }

                    tenantId = inviteValidation.Data.TenantId;

                    // Tenant invite registration is always a Tenant app user.
                    serverAssignedRoles = new List<string> { "Tenant" };
                }

                if (!emailVerifiedByTrustedProvider && !emailVerificationId.HasValue)
                {
                    emailVerificationId = await GetValidEmailVerificationIdAsync(
                        newUser.Email,
                        newUser.EmailVerificationProof);
                    if (!emailVerificationId.HasValue)
                    {
                        response.Success = false;
                        response.StatusCode = StatusCodes.Status403Forbidden;
                        response.Message = "Email verification is required before registration.";
                        return response;
                    }
                }

                if (await _userRepository.UserExists(newUser.Email))
                {
                    response.Message = "A user with that email already exists.";
                    response.Success = false;
                    _logger.LogTrace("Register user failed: A user with that email already exists.");
                    return response;
                }

                // Apply only server-derived roles. Never use roles supplied by the registration request.
                newUser.Roles = serverAssignedRoles
                    .Where(role => !string.IsNullOrWhiteSpace(role))
                    .Select(role => role.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                // Handle Google sign-up
                string? googleId = null;
                string? googleProfileImageUrl = null;
                if (!string.IsNullOrEmpty(newUser.GoogleAccessToken))
                {
                    var googleUser = await _googleAuthService.VerifyGoogleAccessTokenAsync(newUser.GoogleAccessToken);
                    if (googleUser != null)
                    {
                        googleId = googleUser.Id;
                        googleProfileImageUrl = googleUser.Picture;
                        // Ensure email matches Google email
                        if (string.IsNullOrEmpty(newUser.Email))
                        {
                            newUser.Email = googleUser.Email;
                        }
                    }
                }

                // Only create password hash if password is provided (not OAuth user)
                if (!string.IsNullOrEmpty(newUser.Password))
                {
                    // Validate password strength
                    var passwordValidation = Helpers.PasswordValidator.ValidatePassword(newUser.Password);
                    if (!passwordValidation.IsValid)
                    {
                        response.Success = false;
                        response.Message = passwordValidation.ErrorMessage;
                        response.StatusCode = 400;
                        return response;
                    }

                    CreatePasswordHash(newUser.Password, out byte[] passwordHash, out byte[] passwordSalt);
                    newUser.PasswordHash = passwordHash;
                    newUser.PasswordSalt = passwordSalt;
                }

                // Explicitly set HasSeenTutorial to false for new users
                newUser.HasSeenTutorial = false;

                // Default to Landlord role if no roles specified
                if (newUser.Roles == null || newUser.Roles.Count == 0)
                {
                    newUser.Roles = new List<string> { "Landlord" };
                }

                var token = CreateToken(newUser);

                Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction? registrationTransaction = null;
                if (emailVerificationId.HasValue && _dataContext.Database.IsRelational())
                {
                    registrationTransaction = await _dataContext.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
                }

                LoadUserDto loadedUser;
                await using (registrationTransaction)
                {
                    if (emailVerificationId.HasValue)
                    {
                        var consumedAtUtc = DateTime.UtcNow;
                        int consumedRows;
                        if (_dataContext.Database.IsRelational())
                        {
                            consumedRows = await _dataContext.EmailVerifications
                                .Where(verification =>
                                    verification.Id == emailVerificationId.Value &&
                                    verification.IsVerified &&
                                    verification.ExpiresAt >= consumedAtUtc)
                                .ExecuteUpdateAsync(setters => setters
                                    .SetProperty(verification => verification.Code, string.Empty)
                                    .SetProperty(verification => verification.ExpiresAt, consumedAtUtc.AddSeconds(-1)));
                        }
                        else
                        {
                            var verification = await _dataContext.EmailVerifications
                                .FirstOrDefaultAsync(candidate =>
                                    candidate.Id == emailVerificationId.Value &&
                                    candidate.IsVerified &&
                                    candidate.ExpiresAt >= consumedAtUtc);
                            if (verification == null)
                            {
                                consumedRows = 0;
                            }
                            else
                            {
                                verification.Code = string.Empty;
                                verification.ExpiresAt = consumedAtUtc.AddSeconds(-1);
                                await _dataContext.SaveChangesAsync();
                                consumedRows = 1;
                            }
                        }

                        if (consumedRows != 1)
                        {
                            if (registrationTransaction != null)
                            {
                                await registrationTransaction.RollbackAsync();
                            }

                            response.Success = false;
                            response.StatusCode = StatusCodes.Status403Forbidden;
                            response.Message = "Email verification is required before registration.";
                            return response;
                        }
                    }

                    loadedUser = await _userRepository.AddUser(newUser);
                    if (registrationTransaction != null)
                    {
                        await registrationTransaction.CommitAsync();
                    }
                }

                // Set LastLogin to creation date and LoginCount to 1 for new users
                if (loadedUser != null)
                {
                    var dbUser = await _userRepository.GetUser(loadedUser.Id);
                    if (dbUser != null)
                    {
                        dbUser.LastLogin = DateTime.Now;
                        dbUser.LoginCount = 1;

                        // Set GoogleId and profile image if this is a Google sign-up
                        if (!string.IsNullOrEmpty(googleId))
                        {
                            dbUser.GoogleId = googleId;
                            dbUser.AuthProvider = "Google";
                            // Save Google profile image to our storage (or keep Google URL as fallback)
                            if (!string.IsNullOrEmpty(googleProfileImageUrl))
                            {
                                dbUser.ProfileImageUrl = await SaveGoogleProfileImageToStorageAsync(googleProfileImageUrl, loadedUser.Id);
                            }
                        }

                        await _dataContext.SaveChangesAsync();
                    }
                }

                // Assign roles after the user is saved
                foreach (var roleName in newUser.Roles)
                {
                    var role = await _roleRepository.GetRoleByNameAsync(roleName.Trim());
                    if (role != null)
                    {
                        var userRole = new AddUserRoleDto
                        {
                            UserId = loadedUser.Id,
                            RoleId = role.Id
                        };
                        await _userRepository.AddUserRole(userRole);
                    }
                }

                // Ensure tenant users get a Free plan subscription (LeaseShield / subscription by userId)
                if (_subscriptionService != null && newUser.Roles != null &&
                    newUser.Roles.Any(r => string.Equals(r.Trim(), "Tenant", StringComparison.OrdinalIgnoreCase)))
                {
                    try
                    {
                        await _subscriptionService.EnsureTenantFreeSubscriptionAsync(loadedUser.Id);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Could not ensure Free subscription for tenant user {UserId}", loadedUser.Id);
                    }
                }

                // Link user to tenant if invite token was used
                if (tenantId.HasValue && _tenantRepository != null)
                {
                    var tenant = await _tenantRepository.GetTenantById(tenantId.Value);
                    if (tenant != null)
                    {
                        // Check if this is a placeholder tenant (has email but no UserId)
                        // If so, we need to handle it differently for existing users
                        bool isPlaceholder = !tenant.UserId.HasValue && !string.IsNullOrEmpty(tenant.Email);

                        if (isPlaceholder)
                        {
                            // This is a placeholder tenant for an existing user
                            // Delete the placeholder and create a new tenant record with the user's ID
                            var tenantEntity = await _dataContext.Tenants
                                .Include(t => t.Unit)
                                .FirstOrDefaultAsync(t => t.Id == tenantId.Value);

                            if (tenantEntity != null)
                            {
                                var organizationId = tenantEntity.OrganizationId;
                                var unitId = tenantEntity.UnitId;
                                var leaseId = tenantEntity.TenantLeases.FirstOrDefault()?.LeaseId;

                                // Delete the placeholder tenant
                                await _tenantRepository.DeleteTenant(tenantId.Value);

                                // Create new tenant record with existing user's ID
                                var newTenant = new brownstone_hub_api.Dtos.Tenant.AddTenantDto
                                {
                                    UserId = loadedUser.Id,
                                    Firstname = tenant.Firstname,
                                    Lastname = tenant.Lastname,
                                    Email = tenant.Email,
                                    PhoneNumber = tenant.PhoneNumber,
                                    LeaseId = leaseId,
                                    UnitId = unitId,
                                    IsActive = tenant.IsActive,
                                    OrganizationId = organizationId
                                };

                                var createdTenant = await _tenantRepository.AddTenant(newTenant);

                                // Set user's CurrentOrganizationId if tenant has organization
                                if (organizationId.HasValue)
                                {
                                    await _userRepository.UpdateCurrentOrganizationIdAsync(loadedUser.Id, organizationId.Value);
                                    _logger.LogInformation("Connected existing user {UserId} to organization {OrganizationId} via tenant invite",
                                        loadedUser.Id, organizationId.Value);
                                }
                            }
                        }
                        else
                        {
                            // Normal flow: update existing tenant with user ID
                            var tenantEntity = await _dataContext.Tenants.FindAsync(tenantId.Value);
                            var organizationId = tenantEntity?.OrganizationId;

                            var updateTenant = new brownstone_hub_api.Dtos.Tenant.AddTenantDto
                            {
                                Id = tenantId.Value,
                                UserId = loadedUser.Id,
                                Firstname = tenant.Firstname,
                                Lastname = tenant.Lastname,
                                Email = tenant.Email,
                                PhoneNumber = tenant.PhoneNumber,
                                LeaseId = tenant.LeaseId,
                                UnitId = tenant.UnitId,
                                IsActive = tenant.IsActive,
                                OrganizationId = organizationId // Preserve the tenant's OrganizationId
                            };
                            await _tenantRepository.UpdateTenant(tenantId.Value, updateTenant);

                            if (organizationId.HasValue)
                            {
                                await _userRepository.UpdateCurrentOrganizationIdAsync(loadedUser.Id, organizationId.Value);
                                _logger.LogInformation("Connected tenant invite user {UserId} to organization {OrganizationId}",
                                    loadedUser.Id, organizationId.Value);
                            }
                        }

                        // Mark invite as used
                        if (_tenantInviteService != null && !string.IsNullOrEmpty(newUser.InviteToken))
                        {
                            await _tenantInviteService.MarkInviteAsUsed(newUser.InviteToken);
                        }
                    }
                }

                // Accept organization invite if token was provided
                if (!string.IsNullOrEmpty(organizationInviteToken) && _organizationInviteService != null)
                {
                    // Get invite details first to get organization ID
                    var inviteResponse = await _organizationInviteService.GetInviteByTokenAsync(organizationInviteToken);
                    if (inviteResponse.Success && inviteResponse.Data != null)
                    {
                        var acceptInviteDto = new brownstone_hub_api.Dtos.OrganizationInvite.AcceptOrganizationInviteDto
                        {
                            Token = organizationInviteToken
                        };

                        var acceptResponse = await _organizationInviteService.AcceptInviteAsync(acceptInviteDto, loadedUser.Id);
                        if (acceptResponse.Success)
                        {
                            // Set the organization as the user's current organization
                            var dbUser = await _userRepository.GetUser(loadedUser.Id);
                            if (dbUser != null)
                            {
                                dbUser.CurrentOrganizationId = inviteResponse.Data.OrganizationId;
                                await _dataContext.SaveChangesAsync();

                                // Update the response data with the current organization
                                if (response.Data != null)
                                {
                                    response.Data.CurrentOrganizationId = inviteResponse.Data.OrganizationId;
                                    response.Data.CurrentOrganizationName = inviteResponse.Data.OrganizationName;
                                    response.Data.CurrentOrganizationRole = inviteResponse.Data.Role;
                                }
                            }
                        }
                        else
                        {
                            _logger.LogWarning("Failed to accept organization invite after user registration: {Message}", acceptResponse.Message);
                            // Don't fail registration if invite acceptance fails - user is created, they can accept manually later
                        }
                    }
                }
                // Set organization ID for tenant users created by landlords (no invite tokens)
                else if (string.IsNullOrEmpty(organizationInviteToken) &&
                         !tenantId.HasValue &&
                         newUser.Roles != null &&
                         newUser.Roles.Contains("Tenant", StringComparer.OrdinalIgnoreCase))
                {
                    // Get organization ID from context (set by OrganizationContextMiddleware for authenticated landlords)
                    // or from request body (if provided by frontend)
                    var organizationId = GetOrganizationIdFromContext() ?? newUser.OrganizationId;
                    if (organizationId.HasValue)
                    {
                        var dbUser = await _userRepository.GetUser(loadedUser.Id);
                        if (dbUser != null)
                        {
                            dbUser.CurrentOrganizationId = organizationId.Value;
                            await _dataContext.SaveChangesAsync();

                            _logger.LogInformation("Set organization {OrganizationId} as current organization for tenant user {UserId} created by landlord",
                                organizationId.Value, loadedUser.Id);

                            // Update the response data with the current organization
                            if (response.Data != null)
                            {
                                response.Data.CurrentOrganizationId = organizationId.Value;
                            }
                        }
                    }
                    else
                    {
                        _logger.LogWarning("Tenant user {UserId} created without organization context - no organization ID set", loadedUser.Id);
                    }
                }
                // Create organization for new users if no invite token was provided and they have a business name
                else if (string.IsNullOrEmpty(organizationInviteToken) &&
                         !string.IsNullOrWhiteSpace(newUser.BusinessName) &&
                         _organizationService != null &&
                         (newUser.Roles == null || !newUser.Roles.Contains("Tenant", StringComparer.OrdinalIgnoreCase)))
                {
                    try
                    {
                        _logger.LogInformation("Attempting to create organization '{OrganizationName}' for user {UserId} during registration",
                            newUser.BusinessName, loadedUser.Id);

                        var createOrgDto = new brownstone_hub_api.Dtos.Organization.CreateOrganizationDto
                        {
                            Name = newUser.BusinessName.Trim(),
                            Description = null
                        };

                        var orgResponse = await _organizationService.CreateOrganizationAsync(createOrgDto, loadedUser.Id);
                        if (orgResponse.Success && orgResponse.Data != null)
                        {
                            _logger.LogInformation("Organization '{OrganizationName}' (ID: {OrganizationId}) created successfully for user {UserId} during registration",
                                newUser.BusinessName, orgResponse.Data.Id, loadedUser.Id);

                            // Ensure the organization is set as the user's current organization
                            // CreateOrganizationAsync should have already done this, but we'll verify
                            var dbUser = await _userRepository.GetUser(loadedUser.Id);
                            if (dbUser != null)
                            {
                                if (dbUser.CurrentOrganizationId != orgResponse.Data.Id)
                                {
                                    dbUser.CurrentOrganizationId = orgResponse.Data.Id;
                                    await _dataContext.SaveChangesAsync();
                                    _logger.LogInformation("Set organization {OrganizationId} as current organization for user {UserId}",
                                        orgResponse.Data.Id, loadedUser.Id);
                                }
                                else
                                {
                                    _logger.LogInformation("Organization {OrganizationId} already set as current organization for user {UserId}",
                                        orgResponse.Data.Id, loadedUser.Id);
                                }
                            }
                            else
                            {
                                _logger.LogWarning("User {UserId} not found after organization creation", loadedUser.Id);
                            }

                            // Create a trial subscription for the new organization
                            if (dbUser != null && dbUser.CurrentOrganizationId.HasValue)
                            {
                                try
                                {
                                    // Check if organization already has a subscription
                                    var existingSubscription = await _dataContext.Subscriptions
                                        .FirstOrDefaultAsync(s => s.OrganizationId == orgResponse.Data.Id);

                                    if (existingSubscription == null)
                                    {
                                        // Get Free plan - this is the permanent free plan for all new users
                                        var freePlan = await _dataContext.SubscriptionPlans
                                            .FirstOrDefaultAsync(p => p.Name == "Free" && p.IsActive);

                                        if (freePlan != null)
                                        {
                                            _logger.LogInformation("Creating Free plan subscription for organization {OrganizationId} with plan {PlanId} ({PlanName}) for user {UserId}",
                                                orgResponse.Data.Id, freePlan.Id, freePlan.Name, loadedUser.Id);

                                            var subscriptionStartDate = DateTime.UtcNow;

                                            // Create subscription directly in database (no Stripe for free plan)
                                            var newSubscription = new Models.Subscription
                                            {
                                                OrganizationId = orgResponse.Data.Id,
                                                SubscriptionPlanId = freePlan.Id,
                                                Status = "Active", // Free plan is active, not a trial
                                                BillingCycle = "Monthly",
                                                TrialStart = null, // No trial dates for free plan
                                                TrialEnd = null,
                                                CurrentPeriodStart = subscriptionStartDate,
                                                CurrentPeriodEnd = null, // Free plan has no end date
                                                CreatedAt = DateTime.UtcNow,
                                                UpdatedAt = DateTime.UtcNow,
                                                // No StripeSubscriptionId or StripeCustomerId for free plan
                                                StripeSubscriptionId = null,
                                                StripeCustomerId = null
                                            };

                                            var createdSubscription = await _dataContext.Subscriptions.AddAsync(newSubscription);
                                            await _dataContext.SaveChangesAsync();

                                            // Update organization with subscription ID
                                            var org = await _dataContext.Organizations.FindAsync(orgResponse.Data.Id);
                                            if (org != null)
                                            {
                                                org.SubscriptionId = createdSubscription.Entity.Id;
                                                await _dataContext.SaveChangesAsync();
                                            }

                                            // Add subscription history
                                            await _dataContext.SubscriptionHistories.AddAsync(new Models.SubscriptionHistory
                                            {
                                                SubscriptionId = createdSubscription.Entity.Id,
                                                EventType = "Created",
                                                Timestamp = DateTime.UtcNow,
                                                Metadata = $"{{\"planType\": \"Free\", \"autoCreated\": true}}"
                                            });
                                            await _dataContext.SaveChangesAsync();

                                            _logger.LogInformation("Free plan subscription created successfully for organization {OrganizationId} (Subscription ID: {SubscriptionId})",
                                                orgResponse.Data.Id, createdSubscription.Entity.Id);
                                        }
                                        else
                                        {
                                            _logger.LogWarning("Free plan not found - skipping free subscription creation for organization {OrganizationId}", orgResponse.Data.Id);
                                        }
                                    }
                                    else
                                    {
                                        _logger.LogInformation("Organization {OrganizationId} already has a subscription - skipping free plan creation", orgResponse.Data.Id);
                                    }
                                }
                                catch (Exception ex)
                                {
                                    _logger.LogError(ex, "Exception occurred while creating trial subscription for organization {OrganizationId} during registration",
                                        orgResponse.Data.Id);
                                    // Don't fail registration if subscription creation fails
                                }
                            }
                        }
                        else
                        {
                            _logger.LogWarning("Failed to create organization for user {UserId} during registration. Success: {Success}, Message: {Message}",
                                loadedUser.Id, orgResponse.Success, orgResponse.Message);
                            // Don't fail registration if organization creation fails - user is created, they can create manually later
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Exception occurred while creating organization for user {UserId} during registration", loadedUser.Id);
                        // Don't fail registration if organization creation fails
                    }
                }
                else
                {
                    // Log why organization creation was skipped
                    if (!string.IsNullOrEmpty(organizationInviteToken))
                    {
                        _logger.LogInformation("Skipping organization creation for user {UserId} - organization invite token provided", loadedUser.Id);
                    }
                    else if (string.IsNullOrWhiteSpace(newUser.BusinessName))
                    {
                        _logger.LogInformation("Skipping organization creation for user {UserId} - no business name provided", loadedUser.Id);
                    }
                    else if (_organizationService == null)
                    {
                        _logger.LogWarning("Skipping organization creation for user {UserId} - organization service is not available", loadedUser.Id);
                    }
                    else if (newUser.Roles != null && newUser.Roles.Contains("Tenant", StringComparer.OrdinalIgnoreCase))
                    {
                        _logger.LogInformation("Skipping organization creation for user {UserId} - user has Tenant role", loadedUser.Id);
                    }
                }

                var settings = await _userRepository.AddUserSettings(loadedUser.Id, newUser.Timezone);

                response.Data = new LoadUserDto();
                response.Data = await _userRepository.GetUser(loadedUser.Email); // Reload the user to get the latest data
                response.Data.JWTToken = token;

                // If organization was created, ensure organization info is set in response
                if (response.Data?.CurrentOrganizationId.HasValue == true &&
                    (string.IsNullOrEmpty(response.Data.CurrentOrganizationName) || string.IsNullOrEmpty(response.Data.CurrentOrganizationRole)) &&
                    _organizationService != null)
                {
                    try
                    {
                        var orgResponse = await _organizationService.GetOrganizationByIdAsync(
                            response.Data.CurrentOrganizationId.Value,
                            response.Data.CurrentOrganizationId.Value,
                            loadedUser.Id);
                        if (orgResponse.Success && orgResponse.Data != null)
                        {
                            response.Data.CurrentOrganizationName = orgResponse.Data.Name;
                            // Get user's role in the organization
                            // Use UserRole from DTO if available, otherwise query directly
                            if (!string.IsNullOrEmpty(orgResponse.Data.UserRole))
                            {
                                response.Data.CurrentOrganizationRole = orgResponse.Data.UserRole;
                            }
                            else
                            {
                                // Query member directly from database
                                var orgMember = await _dataContext.OrganizationMembers
                                    .FirstOrDefaultAsync(m => m.OrganizationId == response.Data.CurrentOrganizationId.Value && m.UserId == loadedUser.Id);
                                if (orgMember != null)
                                {
                                    response.Data.CurrentOrganizationRole = orgMember.Role;
                                }
                                else
                                {
                                    // Fallback: if user is owner, set role to Owner
                                    if (orgResponse.Data.OwnerId.HasValue && orgResponse.Data.OwnerId.Value == loadedUser.Id)
                                    {
                                        response.Data.CurrentOrganizationRole = "Owner";
                                    }
                                }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to load organization details for user {UserId}", loadedUser.Id);
                    }
                }

                // Notify admins about new user registration
                if (response.Success && response.Data != null)
                {
                    await NotifyAdminsAboutNewUserAsync(response.Data);

                    // Send welcome email to new users (only for Landlord users, not Tenants)
                    // Fire and forget - email sending is non-critical and shouldn't block registration
                    if (response.Data.Roles != null && response.Data.Roles.Any(r => r.Equals("Landlord", StringComparison.OrdinalIgnoreCase)))
                    {
                        _logger.LogInformation("Attempting to send welcome email to new Landlord user: {UserEmail}", response.Data.Email);
                        // Use Task.Run to ensure exceptions are caught and logged
                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                await SendWelcomeEmailAsync(response.Data);
                            }
                            catch (Exception ex)
                            {
                                _logger.LogError(ex, "Unhandled exception in welcome email task for {UserEmail}", response.Data.Email);
                            }
                        });
                    }
                    else
                    {
                        _logger.LogInformation("Skipping welcome email - user is not a Landlord. Roles: {Roles}",
                            response.Data.Roles != null ? string.Join(", ", response.Data.Roles) : "(null)");
                    }
                }

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred while registering user");
                response.Success = false;
                response.StatusCode = StatusCodes.Status500InternalServerError;
                response.Message = "Registration could not be completed. Please try again.";
            }

            return response;
        }

        private async Task<long?> GetValidEmailVerificationIdAsync(string email, string? proof)
        {
            var nowUtc = DateTime.UtcNow;
            var proofSecret = _configuration["JwtSettings:SecretKey"] ?? string.Empty;
            if (!EmailVerificationProof.TryValidate(
                    proof,
                    email,
                    nowUtc,
                    TimeSpan.FromMinutes(10),
                    proofSecret,
                    out var verifiedRecordId))
            {
                return null;
            }

            var verificationCutoff = nowUtc.AddMinutes(-10);
            var hasMatchingVerification = await _dataContext.EmailVerifications
                .AsNoTracking()
                .AnyAsync(verification =>
                    verification.Id == verifiedRecordId &&
                    verification.Email == email &&
                    verification.IsVerified &&
                    verification.VerifiedAt.HasValue &&
                    verification.VerifiedAt.Value >= verificationCutoff &&
                    verification.VerifiedAt.Value <= nowUtc.AddMinutes(1) &&
                    verification.ExpiresAt >= nowUtc);

            return hasMatchingVerification ? verifiedRecordId : null;
        }

        public async Task<ServiceResponse<LoadUserDto>> Login(string email, string password)
        {
            ServiceResponse<LoadUserDto> response = new();


            try
            {
                var user = await _userRepository.GetRegisteredUser(email);

                var validUser = await _userRepository.ValidateUser(user, password);

                if (validUser is null)
                {
                    response.Success = false;
                    response.Message = "Invalid email or password";
                    return response;
                }

                // Check if user account is suspended
                var dbUser = await _userRepository.GetUser(validUser.Id);
                if (dbUser != null && dbUser.IsSuspended)
                {
                    response.Success = false;
                    response.Message = "Your account has been suspended. Please contact support for assistance.";
                    response.StatusCode = 403;
                    return response;
                }

                // Update LastLogin to current local time and increment LoginCount
                if (dbUser != null)
                {
                    dbUser.LastLogin = DateTime.Now;
                    dbUser.LoginCount++;
                    await _dataContext.SaveChangesAsync();
                }

                // Create AddUserDto with roles from validUser for token creation
                var userForToken = new AddUserDto
                {
                    Email = validUser.Email,
                    Firstname = validUser.Firstname,
                    Lastname = validUser.Lastname,
                    Roles = validUser.Roles ?? new List<string>() // Use roles from validated user
                };

                validUser.JWTToken = CreateToken(userForToken);

                response.Data = validUser;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred in User Service");
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<LoadUserDto> CreateAccessToken(long userId)
        {
            var user = await _userRepository.GetUser(userId)
                ?? throw new InvalidOperationException("User not found");

            if (user.IsDeleted || user.IsSuspended)
            {
                throw new InvalidOperationException("User is not allowed to start a session");
            }

            var loadedUser = await _userRepository.GetUserByEmailAsync(user.Email)
                ?? throw new InvalidOperationException("User not found");
            loadedUser.JWTToken = CreateToken(ToTokenUser(loadedUser));
            return loadedUser;
        }

        public async Task<RefreshSessionDto> CreateRefreshSession(long userId)
        {
            var user = await _userRepository.GetUser(userId)
                ?? throw new InvalidOperationException("User not found");

            if (user.IsDeleted || user.IsSuspended)
            {
                throw new InvalidOperationException("User is not allowed to start a session");
            }

            var loadedUser = await _userRepository.GetUserByEmailAsync(user.Email)
                ?? throw new InvalidOperationException("User not found");
            var refreshToken = GenerateRefreshToken();
            var expiresAt = DateTime.UtcNow.AddDays(_configuration.GetValue<double?>("JwtSettings:RefreshTokenExpiresInDays") ?? 30);

            _dataContext.UserRefreshTokens.Add(new Models.UserRefreshToken
            {
                UserId = userId,
                TokenHash = HashRefreshToken(refreshToken),
                ExpiresAt = expiresAt
            });

            var expiredTokens = await _dataContext.UserRefreshTokens
                .Where(token => token.UserId == userId && token.ExpiresAt <= DateTime.UtcNow)
                .ToListAsync();
            _dataContext.UserRefreshTokens.RemoveRange(expiredTokens);
            await _dataContext.SaveChangesAsync();

            loadedUser.JWTToken = CreateToken(ToTokenUser(loadedUser));
            return new RefreshSessionDto
            {
                User = loadedUser,
                RefreshToken = refreshToken,
                RefreshTokenExpiresAt = expiresAt
            };
        }

        public Task<RefreshSessionDto?> RefreshSession(string refreshToken) =>
            RotateRefreshSessionForUser(refreshToken, 0);

        public async Task<RefreshSessionDto?> RotateRefreshSessionForUser(string refreshToken, long expectedUserId)
        {
            if (string.IsNullOrWhiteSpace(refreshToken)) return null;

            var tokenHash = HashRefreshToken(refreshToken);
            var storedToken = await _dataContext.UserRefreshTokens
                .AsNoTracking()
                .Include(token => token.User)
                .SingleOrDefaultAsync(token => token.TokenHash == tokenHash);

            var now = DateTime.UtcNow;
            if (storedToken == null || storedToken.RevokedAt != null || storedToken.ExpiresAt <= now ||
                storedToken.User.IsDeleted || storedToken.User.IsSuspended ||
                (expectedUserId != 0 && storedToken.UserId != expectedUserId))
            {
                return null;
            }

            var loadedUser = await _userRepository.GetUserByEmailAsync(storedToken.User.Email);
            if (loadedUser == null) return null;

            var replacementToken = GenerateRefreshToken();
            var replacementHash = HashRefreshToken(replacementToken);
            var expiresAt = now.AddDays(_configuration.GetValue<double?>("JwtSettings:RefreshTokenExpiresInDays") ?? 30);

            var ownsTransaction = _dataContext.Database.CurrentTransaction == null;
            await using var transaction = ownsTransaction ? await _dataContext.Database.BeginTransactionAsync() : null;
            var rotated = await _dataContext.UserRefreshTokens
                .Where(token => token.Id == storedToken.Id && token.RevokedAt == null && token.ExpiresAt > now)
                .ExecuteUpdateAsync(update => update
                    .SetProperty(token => token.RevokedAt, now)
                    .SetProperty(token => token.ReplacedByTokenHash, replacementHash));
            if (rotated != 1)
            {
                if (transaction != null) await transaction.RollbackAsync();
                return null;
            }

            _dataContext.UserRefreshTokens.Add(new Models.UserRefreshToken
            {
                UserId = storedToken.UserId,
                TokenHash = replacementHash,
                ExpiresAt = expiresAt
            });
            await _dataContext.SaveChangesAsync();
            if (transaction != null) await transaction.CommitAsync();

            loadedUser.JWTToken = CreateToken(ToTokenUser(loadedUser));
            return new RefreshSessionDto
            {
                User = loadedUser,
                RefreshToken = replacementToken,
                RefreshTokenExpiresAt = expiresAt
            };
        }

        public async Task RevokeRefreshToken(string refreshToken)
        {
            if (string.IsNullOrWhiteSpace(refreshToken)) return;

            var tokenHash = HashRefreshToken(refreshToken);
            var storedToken = await _dataContext.UserRefreshTokens.SingleOrDefaultAsync(token => token.TokenHash == tokenHash);
            if (storedToken == null || storedToken.RevokedAt != null) return;

            storedToken.RevokedAt = DateTime.UtcNow;
            await _dataContext.SaveChangesAsync();
        }

        private static string GenerateRefreshToken() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32));

        private static string HashRefreshToken(string refreshToken) =>
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(refreshToken)));

        private static AddUserDto ToTokenUser(LoadUserDto user) => new()
        {
            Id = user.Id,
            Email = user.Email,
            Firstname = user.Firstname,
            Lastname = user.Lastname,
            Roles = user.Roles ?? new List<string>()
        };

        public async Task<(ServiceResponse<LoadUserDto> Response, bool IsNewUser)> GoogleLogin(string? idToken, string? registrationCode = null, string? accessToken = null, string? timezone = null)
        {
            ServiceResponse<LoadUserDto> response = new();
            bool isNewUser = false;

            try
            {
                GoogleUserInfo? googleUser = null;

                // If access token is provided, use it; otherwise try ID token
                if (!string.IsNullOrEmpty(accessToken))
                {
                    googleUser = await _googleAuthService.VerifyGoogleAccessTokenAsync(accessToken);
                }
                else if (!string.IsNullOrEmpty(idToken))
                {
                    // Try to verify as ID token first, then as access token
                    googleUser = await _googleAuthService.VerifyGoogleTokenAsync(idToken);
                    if (googleUser == null)
                    {
                        // If ID token verification fails, try as access token
                        googleUser = await _googleAuthService.VerifyGoogleAccessTokenAsync(idToken);
                    }
                }

                if (googleUser == null || !googleUser.EmailVerified || string.IsNullOrWhiteSpace(googleUser.Email))
                {
                    response.Success = false;
                    response.Message = "Google did not provide a verified email address.";
                    response.StatusCode = StatusCodes.Status403Forbidden;
                    return (response, false);
                }

                googleUser.Email = googleUser.Email.Trim().ToLowerInvariant();

                // Check if user exists by Google ID
                var existingUser = await _userRepository.GetUserByGoogleIdAsync(googleUser.Id);

                if (existingUser != null)
                {
                    // Check if user account is suspended
                    var dbUser = await _userRepository.GetUser(existingUser.Id);
                    if (dbUser != null && dbUser.IsSuspended)
                    {
                        response.Success = false;
                        response.Message = "Your account has been suspended. Please contact support for assistance.";
                        response.StatusCode = 403;
                        return (response, false);
                    }

                    // User exists - log them in
                    // Update profile image from Google on each login. Preserve Email,Google if they have a password.
                    if (dbUser != null)
                    {
                        dbUser.AuthProvider = (dbUser.PasswordHash != null && dbUser.PasswordHash.Length > 0)
                            ? "Email,Google"
                            : "Google";
                        // Update profile image when Google sends a new one; otherwise keep what we have in DB
                        if (!string.IsNullOrEmpty(googleUser.Picture))
                        {
                            dbUser.ProfileImageUrl = await SaveGoogleProfileImageToStorageAsync(googleUser.Picture, dbUser.Id);
                        }
                        dbUser.UpdatedDate = DateTime.Now;
                        dbUser.LastLogin = DateTime.Now;
                        dbUser.LoginCount++;
                        await _dataContext.SaveChangesAsync();
                    }

                    var userForToken = new AddUserDto
                    {
                        Email = existingUser.Email,
                        Firstname = existingUser.Firstname,
                        Lastname = existingUser.Lastname,
                        Roles = existingUser.Roles ?? new List<string>() // Use roles from existing user
                    };
                    existingUser.JWTToken = CreateToken(userForToken);
                    var user = await _userRepository.GetRegisteredUser(existingUser.Email);
                    existingUser.HasSeenTutorial = user.HasSeenTutorial;
                    // Update the ProfileImageUrl in the response if it was updated
                    if (dbUser != null && !string.IsNullOrEmpty(dbUser.ProfileImageUrl))
                    {
                        existingUser.ProfileImageUrl = dbUser.ProfileImageUrl;
                    }
                    response.Data = existingUser;
                    response.Success = true;
                    return (response, false);
                }

                // Check if user exists by email (account linking)
                var userByEmail = await _userRepository.GetUserByEmailAsync(googleUser.Email);
                if (userByEmail != null)
                {
                    // Check if user account is suspended
                    var dbUser = await _userRepository.GetUser(userByEmail.Id);
                    if (dbUser != null && dbUser.IsSuspended)
                    {
                        response.Success = false;
                        response.Message = "Your account has been suspended. Please contact support for assistance.";
                        response.StatusCode = 403;
                        return (response, false);
                    }

                    // Link Google account to existing email account. Keep password so they can use either email/password or Google.
                    if (dbUser != null)
                    {
                        dbUser.GoogleId = googleUser.Id;
                        dbUser.AuthProvider = (dbUser.PasswordHash != null && dbUser.PasswordHash.Length > 0)
                            ? "Email,Google"
                            : "Google";
                        // Save Google profile image when linking account; otherwise keep what we have in DB
                        if (!string.IsNullOrEmpty(googleUser.Picture))
                        {
                            dbUser.ProfileImageUrl = await SaveGoogleProfileImageToStorageAsync(googleUser.Picture, dbUser.Id);
                        }
                        dbUser.UpdatedDate = DateTime.Now;
                        dbUser.LastLogin = DateTime.Now;
                        dbUser.LoginCount++;
                        await _dataContext.SaveChangesAsync();

                        var updatedUser = await _userRepository.GetUserByGoogleIdAsync(googleUser.Id);
                        if (updatedUser != null)
                        {
                            var userForToken = new AddUserDto
                            {
                                Email = updatedUser.Email,
                                Firstname = updatedUser.Firstname,
                                Lastname = updatedUser.Lastname,
                                Roles = updatedUser.Roles ?? new List<string>() // Use roles from updated user
                            };
                            updatedUser.JWTToken = CreateToken(userForToken);
                            // Update the ProfileImageUrl in the response if it was updated
                            if (!string.IsNullOrEmpty(dbUser.ProfileImageUrl))
                            {
                                updatedUser.ProfileImageUrl = dbUser.ProfileImageUrl;
                            }
                            response.Data = updatedUser;
                            response.Success = true;
                            return (response, false);
                        }
                    }
                }

                // Create new user
                var newUser = new AddUserDto
                {
                    Email = googleUser.Email,
                    Firstname = googleUser.FirstName,
                    Lastname = googleUser.LastName,
                    RegistrationCode = registrationCode ?? string.Empty, // Optional for Google auth
                    Password = string.Empty, // No password for OAuth users
                    PasswordHash = null,
                    PasswordSalt = null,
                    Roles = new List<string>(),
                    HasSeenTutorial = false,
                    Timezone = timezone
                };

                // Automatically assign Landlord role for Google auth users
                // If registration code is provided, use it to determine role (for Admin access)
                // Otherwise, default to Landlord
                if (!string.IsNullOrEmpty(registrationCode))
                {
                    var role = GetUserRole(newUser);
                    if (role != EUserRole.Invalid)
                    {
                        newUser.Roles.Add(role.ToString());
                    }
                    else
                    {
                        // Invalid registration code, default to Landlord
                        newUser.Roles.Add(EUserRole.Landlord.ToString());
                    }
                }
                else
                {
                    // No registration code provided, default to Landlord for Google auth
                    newUser.Roles.Add(EUserRole.Landlord.ToString());
                }

                // Handle tenant invite if provided
                long? tenantId = null;
                if (!string.IsNullOrEmpty(newUser.InviteToken) && _tenantInviteService != null && _tenantRepository != null)
                {
                    var inviteValidation = await _tenantInviteService.ValidateInviteToken(newUser.InviteToken);
                    if (inviteValidation.Success && inviteValidation.Data != null && inviteValidation.Data.IsValid)
                    {
                        if (string.Equals(newUser.Email, inviteValidation.Data.Email, StringComparison.OrdinalIgnoreCase))
                        {
                            tenantId = inviteValidation.Data.TenantId;
                            if (!newUser.Roles.Contains("Tenant", StringComparer.OrdinalIgnoreCase))
                            {
                                newUser.Roles.Add("Tenant");
                            }
                        }
                    }
                }

                // Set Google OAuth fields before adding user
                // Note: AddUser will create the user, then we update it with Google ID
                var loadedUser = await _userRepository.AddUser(newUser);

                // Update user with Google ID, profile image, LastLogin, and LoginCount directly in database
                var dbUserToUpdate = await _userRepository.GetUser(loadedUser.Id);
                if (dbUserToUpdate != null)
                {
                    dbUserToUpdate.GoogleId = googleUser.Id;
                    dbUserToUpdate.AuthProvider = "Google";
                    // Save Google profile image to our storage (or keep Google URL as fallback)
                    if (!string.IsNullOrEmpty(googleUser.Picture))
                    {
                        dbUserToUpdate.ProfileImageUrl = await SaveGoogleProfileImageToStorageAsync(googleUser.Picture, loadedUser.Id);
                    }
                    // Set LastLogin to creation date and LoginCount to 1 for new users
                    dbUserToUpdate.LastLogin = DateTime.Now;
                    dbUserToUpdate.LoginCount = 1;
                    await _dataContext.SaveChangesAsync();
                }

                // Assign roles
                foreach (var roleName in newUser.Roles)
                {
                    var roleEntity = await _roleRepository.GetRoleByNameAsync(roleName.Trim());
                    if (roleEntity != null)
                    {
                        var userRole = new AddUserRoleDto
                        {
                            UserId = loadedUser.Id,
                            RoleId = roleEntity.Id
                        };
                        await _userRepository.AddUserRole(userRole);
                    }
                }

                // Handle tenant invite
                if (tenantId.HasValue && _tenantRepository != null)
                {
                    var tenant = await _tenantRepository.GetTenantById(tenantId.Value);
                    if (tenant != null)
                    {
                        // Get the tenant entity directly to access OrganizationId
                        var tenantEntity = await _dataContext.Tenants.FindAsync(tenantId.Value);
                        var organizationId = tenantEntity?.OrganizationId;

                        var updateTenant = new brownstone_hub_api.Dtos.Tenant.AddTenantDto
                        {
                            Id = tenantId.Value,
                            UserId = loadedUser.Id,
                            Firstname = tenant.Firstname,
                            Lastname = tenant.Lastname,
                            Email = tenant.Email,
                            PhoneNumber = tenant.PhoneNumber,
                            LeaseId = tenant.LeaseId,
                            UnitId = tenant.UnitId,
                            IsActive = tenant.IsActive,
                            OrganizationId = organizationId // Preserve the tenant's OrganizationId
                        };
                        await _tenantRepository.UpdateTenant(tenantId.Value, updateTenant);
                    }
                    if (_tenantInviteService != null && !string.IsNullOrEmpty(newUser.InviteToken))
                    {
                        await _tenantInviteService.MarkInviteAsUsed(newUser.InviteToken);
                    }
                }

                // Add user settings
                await _userRepository.AddUserSettings(loadedUser.Id, timezone);

                // Create organization for new Google users (if they're a Landlord and don't have an organization)
                // Note: This is a new user since existingUser was null and userByEmail was null
                if (_organizationService != null &&
                    !newUser.Roles.Contains("Tenant", StringComparer.OrdinalIgnoreCase))
                {
                    try
                    {
                        // Check if user already has an organization
                        var dbUserCheck = await _userRepository.GetUser(loadedUser.Id);
                        if (dbUserCheck != null && !dbUserCheck.CurrentOrganizationId.HasValue)
                        {
                            // Create a default organization for the user
                            // Use their name or email as the organization name
                            var orgName = !string.IsNullOrWhiteSpace(googleUser.FirstName) && !string.IsNullOrWhiteSpace(googleUser.LastName)
                                ? $"{googleUser.FirstName} {googleUser.LastName}'s Organization"
                                : $"{googleUser.Email}'s Organization";

                            _logger.LogInformation("Creating default organization '{OrganizationName}' for new Google user {UserId}",
                                orgName, loadedUser.Id);

                            var createOrgDto = new brownstone_hub_api.Dtos.Organization.CreateOrganizationDto
                            {
                                Name = orgName,
                                Description = null
                            };

                            var orgResponse = await _organizationService.CreateOrganizationAsync(createOrgDto, loadedUser.Id);
                            if (orgResponse.Success && orgResponse.Data != null)
                            {
                                _logger.LogInformation("Organization '{OrganizationName}' (ID: {OrganizationId}) created successfully for new Google user {UserId}",
                                    orgName, orgResponse.Data.Id, loadedUser.Id);

                                // OrganizationService.CreateOrganizationAsync already creates the trial subscription
                                // and sets it as the current organization, so we're good here
                            }
                            else
                            {
                                _logger.LogWarning("Failed to create organization for new Google user {UserId}: {Message}",
                                    loadedUser.Id, orgResponse.Message);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Exception occurred while creating organization for new Google user {UserId}",
                            loadedUser.Id);
                        // Don't fail login if organization creation fails
                    }
                }

                // Reload user and create token
                var finalUser = await _userRepository.GetUserByGoogleIdAsync(googleUser.Id);
                if (finalUser != null)
                {
                    var userForToken = new AddUserDto
                    {
                        Email = finalUser.Email,
                        Firstname = finalUser.Firstname,
                        Lastname = finalUser.Lastname,
                        Roles = finalUser.Roles ?? new List<string>() // Use roles from final user
                    };
                    finalUser.JWTToken = CreateToken(userForToken);
                    response.Data = finalUser;
                    response.Success = true;
                    isNewUser = true; // This is a newly created user
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred in Google Login");
                response.Success = false;
                response.Message = ex.Message;
            }

            return (response, isNewUser);
        }

        public async Task<(ServiceResponse<LoadUserDto> Response, bool IsNewUser)> AppleLogin(
            string identityToken,
            string nonce,
            string? firstName = null,
            string? lastName = null,
            string? timezone = null,
            CancellationToken cancellationToken = default)
        {
            var response = new ServiceResponse<LoadUserDto>();
            var appleUser = await _appleAuthService.VerifyIdentityTokenAsync(identityToken, nonce, cancellationToken);
            if (appleUser == null)
            {
                response.Success = false;
                response.Message = "Invalid Apple identity token.";
                response.StatusCode = 401;
                return (response, false);
            }

            var existingByAppleId = await _userRepository.GetUserByAppleIdAsync(appleUser.Subject);
            if (existingByAppleId != null)
            {
                var dbUser = await _userRepository.GetUser(existingByAppleId.Id);
                if (dbUser.IsSuspended)
                {
                    response.Success = false;
                    response.Message = "Your account has been suspended. Please contact support for assistance.";
                    response.StatusCode = 403;
                    return (response, false);
                }

                dbUser.AuthProvider = MergeAuthProvider(dbUser.AuthProvider, "Apple", dbUser.PasswordHash != null);
                dbUser.LastLogin = DateTime.Now;
                dbUser.LoginCount++;
                dbUser.UpdatedDate = DateTime.Now;
                await _dataContext.SaveChangesAsync(cancellationToken);
                response.Data = existingByAppleId;
                response.Success = true;
                return (response, false);
            }

            var existingByEmail = await _userRepository.GetUserByEmailAsync(appleUser.Email);
            if (existingByEmail != null)
            {
                var dbUser = await _userRepository.GetUser(existingByEmail.Id);
                if (dbUser.IsSuspended)
                {
                    response.Success = false;
                    response.Message = "Your account has been suspended. Please contact support for assistance.";
                    response.StatusCode = 403;
                    return (response, false);
                }
                if (!string.IsNullOrEmpty(dbUser.AppleId) && dbUser.AppleId != appleUser.Subject)
                {
                    response.Success = false;
                    response.Message = "This account is already linked to another Apple ID.";
                    response.StatusCode = 409;
                    return (response, false);
                }

                dbUser.AppleId = appleUser.Subject;
                dbUser.AuthProvider = MergeAuthProvider(dbUser.AuthProvider, "Apple", dbUser.PasswordHash != null);
                dbUser.LastLogin = DateTime.Now;
                dbUser.LoginCount++;
                dbUser.UpdatedDate = DateTime.Now;
                await _dataContext.SaveChangesAsync(cancellationToken);
                response.Data = await _userRepository.GetUserByAppleIdAsync(appleUser.Subject);
                response.Success = response.Data != null;
                return (response, false);
            }

            var registration = await Register(new AddUserDto
            {
                Email = appleUser.Email,
                Firstname = firstName?.Trim() ?? string.Empty,
                Lastname = lastName?.Trim() ?? string.Empty,
                Password = string.Empty,
                Roles = [],
                Timezone = timezone
            }, emailVerifiedByTrustedProvider: true);
            if (!registration.Success || registration.Data == null)
            {
                return (registration, false);
            }

            var newDbUser = await _userRepository.GetUser(registration.Data.Id);
            newDbUser.AppleId = appleUser.Subject;
            newDbUser.AuthProvider = "Apple";
            newDbUser.UpdatedDate = DateTime.Now;
            await _dataContext.SaveChangesAsync(cancellationToken);

            response.Data = await _userRepository.GetUserByAppleIdAsync(appleUser.Subject);
            response.Success = response.Data != null;
            response.Message = response.Success ? "Apple account created." : "Unable to load the new Apple account.";
            return (response, true);
        }

        private static string MergeAuthProvider(string? current, string provider, bool hasPassword)
        {
            var providers = (current ?? string.Empty)
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(value => !string.Equals(value, "Email", StringComparison.OrdinalIgnoreCase) || hasPassword)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            if (hasPassword) providers.Add("Email");
            providers.Add(provider);
            return string.Join(',', providers.OrderBy(value => value == "Email" ? 0 : 1).ThenBy(value => value));
        }

        public async Task<ServiceResponse<LoadUserDto>> LoadUser()
        {
            ServiceResponse<LoadUserDto> response = new();

            try
            {
                var user = await _userRepository.GetCurrentUser();

                if (user == null)
                {
                    response.Success = false;
                    response.Message = "User not found.";
                    return response;
                }

                response.Data = user;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred in User Service");
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<string>> DeleteUser(long userId)
        {
            ServiceResponse<string> response = new();

            try
            {
                User user = await _userRepository.GetUser(userId);

                if (user == null)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    return response;
                }

                if (user.IsDeleted)
                {
                    response.Success = false;
                    response.Message = "User account is already deleted";
                    return response;
                }

                var isTenantOnly = user.UserRoles.Any(userRole =>
                    string.Equals(userRole.Role?.RoleName, "Tenant", StringComparison.OrdinalIgnoreCase))
                    && !user.UserRoles.Any(userRole =>
                        string.Equals(userRole.Role?.RoleName, "Landlord", StringComparison.OrdinalIgnoreCase)
                        || string.Equals(userRole.Role?.RoleName, "Admin", StringComparison.OrdinalIgnoreCase));

                if (!isTenantOnly)
                {
                    // Tenant users do not own their landlord's leases, organization, or subscription.
                    // Keep the ownership safeguards for landlord/admin accounts only.
                    var hasActiveLeases = await _dataContext.Leases
                        .Include(l => l.Unit)
                            .ThenInclude(u => u.Property)
                        .AnyAsync(l => l.Unit.Property.LandlordId == userId && !l.IsDeleted);

                    if (hasActiveLeases)
                    {
                        response.Success = false;
                        response.Message = "Cannot delete account: User has active leases. Please end all leases before deleting your account.";
                        return response;
                    }

                    var hasActiveSubscription = user.CurrentOrganizationId.HasValue
                        && await _dataContext.Subscriptions.AnyAsync(s =>
                            s.OrganizationId == user.CurrentOrganizationId.Value
                            && (s.Status == "Active" || s.Status == "Trial"));

                    if (hasActiveSubscription)
                    {
                        response.Success = false;
                        response.Message = "Cannot delete account: Your organization has an active subscription. Please cancel the organization's subscription or leave the organization before deleting your account.";
                        return response;
                    }
                }

                // Check if user owns any organizations
                var ownedOrganizations = await _dataContext.Organizations
                    .Where(o => o.OwnerId.HasValue && o.OwnerId.Value == userId && !o.IsDeleted)
                    .ToListAsync();

                if (ownedOrganizations.Any())
                {
                    // Resolve and validate every ownership operation before mutating anything.
                    // OwnerId is legacy metadata, not sufficient authorization to promote a member.
                    var ownershipPlans = new List<(Models.Organization Organization, Models.OrganizationMember? Successor)>();
                    foreach (var org in ownedOrganizations)
                    {
                        var deletingOwnerMembership = await _dataContext.OrganizationMembers
                            .AsNoTracking()
                            .SingleOrDefaultAsync(m => m.OrganizationId == org.Id && m.UserId == userId);
                        if (!org.IsActive || org.IsDeleted ||
                            deletingOwnerMembership is not { IsActive: true } ||
                            !string.Equals(deletingOwnerMembership.Role, "Owner", StringComparison.OrdinalIgnoreCase))
                        {
                            response.Success = false;
                            response.Message = "Cannot delete account: Organization ownership could not be verified.";
                            return response;
                        }

                        var otherMember = await _dataContext.OrganizationMembers
                            .Include(m => m.User)
                            .Where(m => m.OrganizationId == org.Id
                                && m.UserId != userId
                                && m.UserId.HasValue
                                && m.IsActive
                                && m.User != null
                                && !m.User.IsDeleted)
                            .OrderBy(m => m.JoinedAt)
                            .FirstOrDefaultAsync();

                        ownershipPlans.Add((org, otherMember));
                    }

                    // All organizations passed the authority/precondition checks. Apply the plans.
                    foreach (var (org, otherMember) in ownershipPlans)
                    {
                        if (otherMember != null)
                        {
                            // Transfer ownership to another member and canonicalize the role.
                            org.OwnerId = otherMember.UserId!.Value;
                            org.UpdatedAt = DateTime.Now;
                            otherMember.Role = "Owner";
                            otherMember.CanManageMembers = true;

                            _logger.LogInformation("Transferred ownership of organization {OrgId} from user {UserId} to user {NewOwnerId}",
                                org.Id, userId, otherMember.UserId);
                        }
                        else
                        {
                            // No other members, soft delete the organization.
                            org.IsDeleted = true;
                            org.DeletedAt = DateTime.Now;
                            org.UpdatedAt = DateTime.Now;

                            _logger.LogInformation("Deleted organization {OrgId} owned by user {UserId} (no other members)",
                                org.Id, userId);
                        }
                    }

                    await _dataContext.SaveChangesAsync();
                }

                // Clear CurrentOrganizationId if it points to a deleted organization
                if (user.CurrentOrganizationId.HasValue)
                {
                    var currentOrg = await _dataContext.Organizations
                        .FirstOrDefaultAsync(o => o.Id == user.CurrentOrganizationId.Value);

                    if (currentOrg == null || currentOrg.IsDeleted)
                    {
                        user.CurrentOrganizationId = null;
                    }
                }

                // Soft delete the user
                await _userRepository.DeleteUser(user);

                // Prevent any existing browser/device refresh session from creating a new access token.
                var activeRefreshTokens = await _dataContext.UserRefreshTokens
                    .Where(token => token.UserId == userId && token.RevokedAt == null)
                    .ToListAsync();
                if (activeRefreshTokens.Count > 0)
                {
                    var revokedAt = DateTime.UtcNow;
                    foreach (var token in activeRefreshTokens)
                    {
                        token.RevokedAt = revokedAt;
                    }
                    await _dataContext.SaveChangesAsync();
                }

                response.Success = true;
                response.Data = "User account has been deactivated successfully";
                response.Message = "Your account has been deactivated. All personal information has been anonymized.";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred in User Service while deleting user {UserId}", userId);
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<SettingsDto>> GetSettings()
        {
            var response = new ServiceResponse<SettingsDto>
            {
                Data = new SettingsDto() { DarkMode = false, SidenavMini = false }
            };

            try
            {
                var user = await _userRepository.GetCurrentUser();

                SettingsDto? userSettings = new();

                if (user is not null)
                {
                    userSettings = await _userRepository.GetUserSettings(user.Id);

                    userSettings ??= await _userRepository.AddUserSettings(user.Id);

                    response.Data = userSettings;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred in User Service");
                response.Success = false;
                response.Message = ex.Message;
                return response;
            }
            return response;
        }

        public async Task<ServiceResponse<SettingsDto>> SaveSettings(SettingsDto newSettings)
        {
            var response = new ServiceResponse<SettingsDto>();

            try
            {
                var user = await _userRepository.GetCurrentUser();

                if (user == null)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    return response;
                }

                // Ensure UserId is set from current user
                newSettings.UserId = user.Id;

                var settings = await _userRepository.UpdateUserSettings(newSettings);

                if (settings == null)
                {
                    response.Success = false;
                    response.Message = "Failed to save settings";
                    return response;
                }

                response.Data = settings;
                response.Success = true;
                response.Message = "Settings saved successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred in User Service");
                response.Success = false;
                response.Message = ex.Message;
                return response;
            }
            return response;
        }

        public async Task<Dictionary<long, bool>> CheckUsersHaveAccounts(List<long> userIds)
        {
            return await _userRepository.CheckUsersHaveAccounts(userIds);
        }

        public async Task<ServiceResponse<string>> ChangePassword(string currentPassword, string newPassword)
        {
            ServiceResponse<string> response = new();

            try
            {
                // Validate new password strength
                var passwordValidation = Helpers.PasswordValidator.ValidatePassword(newPassword);
                if (!passwordValidation.IsValid)
                {
                    response.Success = false;
                    response.Message = passwordValidation.ErrorMessage;
                    return response;
                }

                var success = await _userRepository.ChangePassword(currentPassword, newPassword);

                if (!success)
                {
                    response.Success = false;
                    response.Message = "Current password is incorrect or user not found.";
                    return response;
                }

                response.Data = "Password changed successfully.";
                response.Message = "Password changed successfully.";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred in User Service while changing password");
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<string>> AdminSetPassword(long userId, string newPassword)
        {
            ServiceResponse<string> response = new();

            try
            {
                var passwordValidation = Helpers.PasswordValidator.ValidatePassword(newPassword);
                if (!passwordValidation.IsValid)
                {
                    response.Success = false;
                    response.Message = passwordValidation.ErrorMessage;
                    return response;
                }

                var success = await _userRepository.SetPasswordForUser(userId, newPassword);
                if (!success)
                {
                    response.Success = false;
                    response.Message = "User not found.";
                    return response;
                }

                response.Success = true;
                response.Data = "Password set successfully.";
                response.Message = "Password has been set. The user can sign in with email and this password, or continue using Google/Apple if they signed up that way.";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred in User Service while setting password for user {UserId}", userId);
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<bool>> UpdateHasSeenTutorial(long userId, bool hasSeenTutorial)
        {
            var response = new ServiceResponse<bool>();

            try
            {
                var success = await _userRepository.UpdateHasSeenTutorial(userId, hasSeenTutorial);

                if (!success)
                {
                    response.Success = false;
                    response.Message = "User not found.";
                    return response;
                }

                response.Data = success;
                response.Message = "Tutorial status updated successfully.";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred in User Service");
                response.Success = false;
                response.Message = ex.Message;
                return response;
            }
            return response;
        }

        private void CreatePasswordHash(
            string password,
            out byte[] passwordHash,
            out byte[] passwordSalt
        )
        {
            using (var hmac = new System.Security.Cryptography.HMACSHA512())
            {
                passwordSalt = hmac.Key;
                passwordHash = hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(password));
            }
        }

        private static bool VerifyPasswordHash(string password, byte[] passwordHash, byte[] passwordSalt)
        {
            using var hmac = new System.Security.Cryptography.HMACSHA512(passwordSalt);
            var computeHash = hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(password));
            return computeHash.SequenceEqual(passwordHash);
        }

        private string CreateToken(AddUserDto user)
        {
            var claims = new List<Claim>
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Email),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new Claim(JwtRegisteredClaimNames.Iat, DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64)
            };

            if (user.Id > 0)
            {
                claims.Add(new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()));
                claims.Add(new Claim("userId", user.Id.ToString()));
            }

            // Add a separate role claim for each role in the list
            // This is required for [Authorize(Roles = "Admin")] to work correctly
            if (user.Roles != null && user.Roles.Count > 0)
            {
                foreach (var role in user.Roles)
                {
                    if (!string.IsNullOrWhiteSpace(role))
                    {
                        claims.Add(new Claim(ClaimTypes.Role, role.Trim()));
                    }
                }
            }

            var secret = _configuration["JwtSettings:SecretKey"] ?? "";
            var keyBytes = Convert.FromBase64String(secret);   // your key decodes to 32 bytes
            if (keyBytes.Length < 32) throw new InvalidOperationException($"Secret too short: {keyBytes.Length} bytes");

            var creds = new SigningCredentials(new SymmetricSecurityKey(keyBytes), SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _configuration["JwtSettings:Issuer"],
                audience: _configuration["JwtSettings:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(_configuration.GetValue<double>("JwtSettings:ExpiresInMinutes")),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        private EUserRole GetUserRole(AddUserDto user)
        {

            if (user.RegistrationCode == _configuration["AdminKey"])
            {
                return EUserRole.Admin;
            }
            else if (user.RegistrationCode == _configuration["LandlordKey"])
            {
                return EUserRole.Landlord;
            }
            else if (user.RegistrationCode == _configuration["TenantKey"])
            {
                return EUserRole.Tenant;
            }

            return EUserRole.Invalid;
        }

        public async Task<ServiceResponse<LoadUserDto>> GetUserByEmailAsync(string email)
        {
            var response = new ServiceResponse<LoadUserDto>();
            try
            {
                var user = await _userRepository.GetUserByEmailAsync(email);
                if (user == null)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    response.StatusCode = 404;
                    return response;
                }

                response.Data = user;
                response.Message = "User retrieved successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting user by email {Email}", email);
                response.Success = false;
                response.Message = $"Error retrieving user: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<LoadUserDto>> GetUserByIdAsync(long userId)
        {
            var response = new ServiceResponse<LoadUserDto>();
            try
            {
                var user = await _userRepository.GetUser(userId);
                if (user == null)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    response.StatusCode = 404;
                    return response;
                }

                var userDto = new LoadUserDto
                {
                    Id = user.Id,
                    Firstname = user.FirstName,
                    Lastname = user.LastName,
                    Email = user.Email,
                    PhoneNumber = user.PhoneNumber,
                    Company = user.Company,
                    DateOfBirth = user.DateOfBirth,
                    HasSeenTutorial = user.HasSeenTutorial,
                    NotificationPreferencesConfigured = user.NotificationPreferencesConfigured,
                    LastVisited = user.LastVisited,
                    GoogleId = user.GoogleId,
                    AuthProvider = user.AuthProvider,
                    StripeAccountId = user.StripeAccountId,
                    StripeAccountStatus = user.StripeAccountStatus,
                    StripeAccountEnabled = user.StripeAccountEnabled,
                    // SubscriptionId removed - subscriptions are now organization-only
                    StripeCustomerId = user.StripeCustomerId,
                    IsSuspended = user.IsSuspended,
                    SuspendedAt = user.SuspendedAt,
                    IsDeleted = user.IsDeleted,
                    DeletedAt = user.DeletedAt,
                    CreateDate = user.CreateDate,
                    Roles = user.UserRoles?.Select(ur => ur.Role.RoleName).ToList() ?? new List<string>(),
                    HasPassword = user.PasswordHash != null && user.PasswordHash.Length > 0
                };

                response.Data = userDto;
                response.Message = "User retrieved successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting user by ID {UserId}", userId);
                response.Success = false;
                response.Message = $"Error retrieving user: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<long?>> GetCurrentUserIdAsync()
        {
            var response = new ServiceResponse<long?>();
            try
            {
                var user = await _userRepository.GetCurrentUser();
                if (user == null)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    response.StatusCode = 401;
                    return response;
                }

                response.Data = user.Id;
                response.Message = "User ID retrieved successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting current user ID");
                response.Success = false;
                response.Message = $"Error retrieving user ID: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<LoadUserDto>> UpdateUserAccountInfo(UpdateUserDto updateUserDto)
        {
            var response = new ServiceResponse<LoadUserDto>();

            try
            {
                var currentUser = await _userRepository.GetCurrentUser();
                if (currentUser == null)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    response.StatusCode = 401;
                    return response;
                }

                var updatedUser = await _userRepository.UpdateUserAccountInfo(currentUser.Id, updateUserDto);

                if (updatedUser == null)
                {
                    response.Success = false;
                    response.Message = "Failed to update user account information";
                    return response;
                }

                response.Data = updatedUser;
                response.Message = "Account information updated successfully";
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogError(ex, "Error updating user account info");
                response.Success = false;
                response.Message = ex.Message;
                response.StatusCode = 400;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating user account info");
                response.Success = false;
                response.Message = $"Error updating account information: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<LoadUserDto>> UpdateUserAccountInfoById(long userId, UpdateUserDto updateUserDto)
        {
            var response = new ServiceResponse<LoadUserDto>();

            try
            {
                var updatedUser = await _userRepository.UpdateUserAccountInfo(userId, updateUserDto);

                if (updatedUser == null)
                {
                    response.Success = false;
                    response.Message = "User not found or failed to update user account information";
                    response.StatusCode = 404;
                    return response;
                }

                response.Data = updatedUser;
                response.Message = "User account information updated successfully";
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogError(ex, "Error updating user account info for user {UserId}", userId);
                response.Success = false;
                response.Message = ex.Message;
                response.StatusCode = 400;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating user account info for user {UserId}", userId);
                response.Success = false;
                response.Message = $"Error updating account information: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<bool>> CheckEmailExists(string email)
        {
            ServiceResponse<bool> response = new();

            try
            {
                var exists = await _userRepository.UserExists(email);
                response.Data = exists;
                response.Success = true;
                response.Message = exists ? "Email already exists" : "Email is available";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking if email exists");
                response.Success = false;
                response.Message = $"Error checking email: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<List<LoadUserDto>>> GetAllUsers(bool includeDeleted = false)
        {
            var response = new ServiceResponse<List<LoadUserDto>>();

            try
            {
                var users = await _userRepository.GetAllUsers(includeDeleted);
                response.Data = users;
                response.Success = true;
                response.Message = "Users retrieved successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred in User Service while getting all users");
                response.Success = false;
                response.Message = ex.Message;
            }

            return response;
        }

        public async Task<ServiceResponse<string>> DeleteUserById(long userId, bool adminOverride = false)
        {
            ServiceResponse<string> response = new();

            try
            {
                User user;
                if (adminOverride)
                {
                    // Admin can delete including already deleted users (for viewing deleted users)
                    user = await _userRepository.GetUserByIdIncludingDeleted(userId);
                }
                else
                {
                    user = await _userRepository.GetUser(userId);
                }

                if (user == null)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    return response;
                }

                if (user.IsDeleted)
                {
                    response.Success = false;
                    response.Message = "User account is already deleted";
                    return response;
                }

                if (!adminOverride)
                {
                    // Check if user has active leases (as landlord)
                    var hasActiveLeases = await _dataContext.Leases
                        .Include(l => l.Unit)
                            .ThenInclude(u => u.Property)
                        .AnyAsync(l => l.Unit.Property.LandlordId == userId && !l.IsDeleted);

                    if (hasActiveLeases)
                    {
                        response.Success = false;
                        response.Message = "Cannot delete account: User has active leases. Please end all leases before deleting your account.";
                        return response;
                    }

                    // Check if user's organization has active subscription (subscriptions are organization-only)
                    var hasActiveSubscription = false;
                    if (user.CurrentOrganizationId.HasValue)
                    {
                        hasActiveSubscription = await _dataContext.Subscriptions
                            .AnyAsync(s => s.OrganizationId == user.CurrentOrganizationId.Value && (s.Status == "Active" || s.Status == "Trial"));
                    }

                    if (hasActiveSubscription)
                    {
                        response.Success = false;
                        response.Message = "Cannot delete account: Your organization has an active subscription. Please cancel the organization's subscription or leave the organization before deleting your account.";
                        return response;
                    }
                }

                // Soft delete the user
                await _userRepository.DeleteUser(user);

                response.Success = true;
                response.Data = "User account has been deactivated successfully";
                response.Message = "User account has been deactivated. All personal information has been anonymized.";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred in User Service while deleting user {UserId}", userId);
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<LoadUserDto>> SuspendUser(long userId)
        {
            var response = new ServiceResponse<LoadUserDto>();

            try
            {
                var user = await _userRepository.GetUser(userId);
                if (user == null)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    response.StatusCode = 404;
                    return response;
                }

                if (user.IsSuspended)
                {
                    response.Success = false;
                    response.Message = "User is already suspended";
                    response.StatusCode = 400;
                    return response;
                }

                user.IsSuspended = true;
                user.SuspendedAt = DateTime.UtcNow;
                user.UpdatedDate = DateTime.UtcNow;
                await _dataContext.SaveChangesAsync();

                var updatedUser = await _userRepository.GetUser(userId);
                if (updatedUser != null)
                {
                    var userDto = new LoadUserDto
                    {
                        Id = updatedUser.Id,
                        Firstname = updatedUser.FirstName,
                        Lastname = updatedUser.LastName,
                        Email = updatedUser.Email,
                        PhoneNumber = updatedUser.PhoneNumber,
                        Company = updatedUser.Company,
                        DateOfBirth = updatedUser.DateOfBirth,
                        HasSeenTutorial = updatedUser.HasSeenTutorial,
                        NotificationPreferencesConfigured = updatedUser.NotificationPreferencesConfigured,
                        LastVisited = updatedUser.LastVisited,
                        GoogleId = updatedUser.GoogleId,
                        AuthProvider = updatedUser.AuthProvider,
                        StripeAccountId = updatedUser.StripeAccountId,
                        StripeAccountStatus = updatedUser.StripeAccountStatus,
                        StripeAccountEnabled = updatedUser.StripeAccountEnabled,
                        // SubscriptionId removed - subscriptions are now organization-only
                        StripeCustomerId = updatedUser.StripeCustomerId,
                        ProfileImageUrl = updatedUser.ProfileImageUrl,
                        BusinessName = updatedUser.BusinessName,
                        BusinessEmail = updatedUser.BusinessEmail,
                        BusinessPhone = updatedUser.BusinessPhone,
                        IsDeleted = updatedUser.IsDeleted,
                        DeletedAt = updatedUser.DeletedAt,
                        CreateDate = updatedUser.CreateDate,
                        IsSuspended = updatedUser.IsSuspended,
                        SuspendedAt = updatedUser.SuspendedAt,
                        Roles = updatedUser.UserRoles.Select(ur => ur.Role.RoleName).ToList(),
                        HasPassword = updatedUser.PasswordHash != null && updatedUser.PasswordHash.Length > 0
                    };
                    response.Data = userDto;
                }
                response.Message = "User account has been suspended successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error suspending user {UserId}", userId);
                response.Success = false;
                response.Message = $"Error suspending user: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<LoadUserDto>> UnsuspendUser(long userId)
        {
            var response = new ServiceResponse<LoadUserDto>();

            try
            {
                var user = await _userRepository.GetUser(userId);
                if (user == null)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    response.StatusCode = 404;
                    return response;
                }

                if (!user.IsSuspended)
                {
                    response.Success = false;
                    response.Message = "User is not suspended";
                    response.StatusCode = 400;
                    return response;
                }

                user.IsSuspended = false;
                user.SuspendedAt = null;
                user.UpdatedDate = DateTime.UtcNow;
                await _dataContext.SaveChangesAsync();

                var updatedUser = await _userRepository.GetUser(userId);
                if (updatedUser != null)
                {
                    var userDto = new LoadUserDto
                    {
                        Id = updatedUser.Id,
                        Firstname = updatedUser.FirstName,
                        Lastname = updatedUser.LastName,
                        Email = updatedUser.Email,
                        PhoneNumber = updatedUser.PhoneNumber,
                        Company = updatedUser.Company,
                        DateOfBirth = updatedUser.DateOfBirth,
                        HasSeenTutorial = updatedUser.HasSeenTutorial,
                        NotificationPreferencesConfigured = updatedUser.NotificationPreferencesConfigured,
                        LastVisited = updatedUser.LastVisited,
                        GoogleId = updatedUser.GoogleId,
                        AuthProvider = updatedUser.AuthProvider,
                        StripeAccountId = updatedUser.StripeAccountId,
                        StripeAccountStatus = updatedUser.StripeAccountStatus,
                        StripeAccountEnabled = updatedUser.StripeAccountEnabled,
                        // SubscriptionId removed - subscriptions are now organization-only
                        StripeCustomerId = updatedUser.StripeCustomerId,
                        ProfileImageUrl = updatedUser.ProfileImageUrl,
                        BusinessName = updatedUser.BusinessName,
                        BusinessEmail = updatedUser.BusinessEmail,
                        BusinessPhone = updatedUser.BusinessPhone,
                        IsDeleted = updatedUser.IsDeleted,
                        DeletedAt = updatedUser.DeletedAt,
                        CreateDate = updatedUser.CreateDate,
                        IsSuspended = updatedUser.IsSuspended,
                        SuspendedAt = updatedUser.SuspendedAt,
                        Roles = updatedUser.UserRoles.Select(ur => ur.Role.RoleName).ToList(),
                        HasPassword = updatedUser.PasswordHash != null && updatedUser.PasswordHash.Length > 0
                    };
                    response.Data = userDto;
                }
                response.Message = "User account has been unsuspended successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error unsuspending user {UserId}", userId);
                response.Success = false;
                response.Message = $"Error unsuspending user: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<string>> HardDeleteUserCompletely(long userId)
        {
            ServiceResponse<string> response = new();

            try
            {
                // Get user including deleted
                var user = await _userRepository.GetUserByIdIncludingDeleted(userId);
                if (user == null)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    return response;
                }

                _logger.LogWarning("Starting complete hard delete for user {UserId} ({Email})", userId, user.Email);

                // Get all organizations owned by this user
                var ownedOrganizations = await _dataContext.Organizations
                    .Where(o => o.OwnerId.HasValue && o.OwnerId.Value == userId)
                    .ToListAsync();

                foreach (var org in ownedOrganizations)
                {
                    _logger.LogInformation("Deleting organization {OrgId} owned by user {UserId}", org.Id, userId);
                    await HardDeleteOrganizationCompletely(org.Id);
                }

                // Get all organizations where user is a member
                var organizationMemberIds = await _dataContext.OrganizationMembers
                    .Where(m => m.UserId == userId)
                    .Select(m => m.OrganizationId)
                    .ToListAsync();

                // Remove user from all organization memberships
                var organizationMembers = await _dataContext.OrganizationMembers
                    .Where(m => m.UserId == userId)
                    .ToListAsync();
                _dataContext.OrganizationMembers.RemoveRange(organizationMembers);

                // Delete all properties owned by this user (even if not in an organization)
                var userProperties = await _dataContext.Properties
                    .Where(p => p.LandlordId == userId)
                    .ToListAsync();

                foreach (var property in userProperties)
                {
                    await HardDeletePropertyCompletely(property.Id);
                }

                // Delete all tenants linked to this user. Tenant accounts can have related tenant rows,
                // documents, invites, conversations, and converted applications that otherwise keep FKs alive.
                var userTenants = await _dataContext.Tenants
                    .Where(t => t.UserId == userId)
                    .ToListAsync();
                var userTenantIds = userTenants.Select(t => t.Id).ToList();
                if (userTenantIds.Any())
                {
                    var tenantDocuments = await _dataContext.TenantDocuments
                        .Where(td => td.TenantId.HasValue && userTenantIds.Contains(td.TenantId.Value))
                        .ToListAsync();
                    _dataContext.TenantDocuments.RemoveRange(tenantDocuments);

                    var tenantInvitesForTenants = await _dataContext.TenantInvites
                        .Where(ti => userTenantIds.Contains(ti.TenantId))
                        .ToListAsync();
                    _dataContext.TenantInvites.RemoveRange(tenantInvitesForTenants);

                    var tenantLeases = await _dataContext.TenantLeases
                        .Where(tl => userTenantIds.Contains(tl.TenantId))
                        .ToListAsync();
                    _dataContext.TenantLeases.RemoveRange(tenantLeases);

                    var tenantChecklists = await _dataContext.Checklists
                        .Where(c => c.TenantId.HasValue && userTenantIds.Contains(c.TenantId.Value))
                        .ToListAsync();
                    foreach (var checklist in tenantChecklists)
                    {
                        checklist.TenantId = null;
                    }

                    var tenantConversations = await _dataContext.Conversations
                        .Where(c => c.TenantId.HasValue && userTenantIds.Contains(c.TenantId.Value))
                        .ToListAsync();
                    foreach (var conversation in tenantConversations)
                    {
                        conversation.TenantId = null;
                    }

                    var convertedApplications = await _dataContext.RentalApplications
                        .Where(ra => ra.ConvertedToTenantId.HasValue && userTenantIds.Contains(ra.ConvertedToTenantId.Value))
                        .ToListAsync();
                    foreach (var application in convertedApplications)
                    {
                        application.ConvertedToTenantId = null;
                    }
                }
                _dataContext.Tenants.RemoveRange(userTenants);

                // Delete all conversations where user is the landlord
                var conversations = await _dataContext.Conversations
                    .Where(c => c.LandlordId == userId)
                    .ToListAsync();
                _dataContext.Conversations.RemoveRange(conversations);

                // Delete all conversation participants
                var conversationParticipants = await _dataContext.ConversationParticipants
                    .Where(cp => cp.UserId == userId)
                    .ToListAsync();
                _dataContext.ConversationParticipants.RemoveRange(conversationParticipants);

                // Delete all messages sent by this user. Clear replies to those messages first because
                // Message.ReplyToMessageId uses NoAction to avoid self-referencing cascade cycles.
                var messages = await _dataContext.Messages
                    .Where(m => m.SenderId == userId)
                    .ToListAsync();
                var messageIds = messages.Select(m => m.Id).ToList();
                if (messageIds.Any())
                {
                    var repliesToDeletedMessages = await _dataContext.Messages
                        .Where(m => m.ReplyToMessageId.HasValue && messageIds.Contains(m.ReplyToMessageId.Value))
                        .ToListAsync();
                    foreach (var reply in repliesToDeletedMessages)
                    {
                        reply.ReplyToMessageId = null;
                    }
                }
                _dataContext.Messages.RemoveRange(messages);

                // Delete all message reads
                var messageReads = await _dataContext.MessageReads
                    .Where(mr => mr.UserId == userId)
                    .ToListAsync();
                _dataContext.MessageReads.RemoveRange(messageReads);

                // Delete all notifications for this user and clear actor references from other notifications
                var notifications = await _dataContext.Notifications
                    .Where(n => n.UserId == userId)
                    .ToListAsync();
                _dataContext.Notifications.RemoveRange(notifications);

                var performedNotifications = await _dataContext.Notifications
                    .Where(n => n.PerformedByUserId == userId)
                    .ToListAsync();
                foreach (var notification in performedNotifications)
                {
                    notification.PerformedByUserId = null;
                }

                // Delete all rental applications where user is landlord
                var rentalApplications = await _dataContext.RentalApplications
                    .Where(ra => ra.LandlordId == userId)
                    .ToListAsync();
                _dataContext.RentalApplications.RemoveRange(rentalApplications);

                // Delete all application invites created by this user
                var applicationInvites = await _dataContext.ApplicationInvites
                    .Where(ai => ai.CreatedBy == userId)
                    .ToListAsync();
                _dataContext.ApplicationInvites.RemoveRange(applicationInvites);

                // Delete all tenant invites created by this user
                var tenantInvites = await _dataContext.TenantInvites
                    .Where(ti => ti.CreatedBy == userId)
                    .ToListAsync();
                _dataContext.TenantInvites.RemoveRange(tenantInvites);

                // Delete all organization invites created by this user
                var organizationInvites = await _dataContext.OrganizationInvites
                    .Where(oi => oi.InvitedBy == userId)
                    .ToListAsync();
                _dataContext.OrganizationInvites.RemoveRange(organizationInvites);

                // Delete all expenses where user is the landlord
                var expenses = await _dataContext.Expenses
                    .Where(e => e.LandlordId == userId)
                    .ToListAsync();
                _dataContext.Expenses.RemoveRange(expenses);

                // Delete all bank accounts for organizations owned by this user
                var organizationIds = ownedOrganizations.Select(o => o.Id).ToList();
                var bankAccounts = await _dataContext.BankAccounts
                    .Where(ba => organizationIds.Contains(ba.OrganizationId))
                    .ToListAsync();
                _dataContext.BankAccounts.RemoveRange(bankAccounts);

                // Cancel and delete all subscriptions for organizations owned by this user
                var subscriptions = await _dataContext.Subscriptions
                    .Where(s => s.OrganizationId.HasValue && organizationIds.Contains(s.OrganizationId.Value))
                    .ToListAsync();

                // Cancel Stripe subscriptions before deleting from database
                foreach (var subscription in subscriptions)
                {
                    if (!string.IsNullOrEmpty(subscription.StripeSubscriptionId) && _stripeService != null)
                    {
                        try
                        {
                            _logger.LogInformation("Cancelling Stripe subscription {StripeSubscriptionId} for organization {OrganizationId} before user deletion",
                                subscription.StripeSubscriptionId, subscription.OrganizationId);

                            // Cancel immediately (not at period end) since we're deleting the user
                            var cancelResponse = await _stripeService.CancelSubscriptionAsync(subscription.StripeSubscriptionId, cancelAtPeriodEnd: false);

                            if (cancelResponse.Success)
                            {
                                _logger.LogInformation("Successfully cancelled Stripe subscription {StripeSubscriptionId}", subscription.StripeSubscriptionId);
                            }
                            else
                            {
                                _logger.LogWarning("Failed to cancel Stripe subscription {StripeSubscriptionId}: {Message}. Continuing with deletion.",
                                    subscription.StripeSubscriptionId, cancelResponse.Message);
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Error cancelling Stripe subscription {StripeSubscriptionId} for organization {OrganizationId}. Continuing with deletion.",
                                subscription.StripeSubscriptionId, subscription.OrganizationId);
                            // Continue with deletion even if Stripe cancellation fails
                        }
                    }
                }

                // Delete all subscription history for these subscriptions
                var subscriptionIds = subscriptions.Select(s => s.Id).ToList();
                if (subscriptionIds.Any())
                {
                    var subscriptionHistories = await _dataContext.SubscriptionHistories
                        .Where(sh => subscriptionIds.Contains(sh.SubscriptionId))
                        .ToListAsync();
                    _dataContext.SubscriptionHistories.RemoveRange(subscriptionHistories);
                }

                _dataContext.Subscriptions.RemoveRange(subscriptions);

                // Delete all support and feedback entries
                var supportAndFeedback = await _dataContext.SupportAndFeedbacks
                    .Where(sf => sf.UserId == userId)
                    .ToListAsync();
                _dataContext.SupportAndFeedbacks.RemoveRange(supportAndFeedback);

                // Delete all email verifications
                var emailVerifications = await _dataContext.EmailVerifications
                    .Where(ev => ev.Email == user.Email)
                    .ToListAsync();
                _dataContext.EmailVerifications.RemoveRange(emailVerifications);

                // Clear/delete remaining direct User foreign-key references that are not covered by
                // property/organization deletion. Tenant-only users commonly hit these paths.
                await RemoveRemainingUserReferencesBeforeHardDelete(userId);

                // Save changes before deleting user
                await _dataContext.SaveChangesAsync();

                // Hard delete the user (this will also delete UserRoles, UserSettings, NotificationSettings via cascade)
                await _userRepository.HardDeleteUser(user);

                _logger.LogWarning("Completed hard delete for user {UserId} ({Email})", userId, user.Email);

                response.Success = true;
                response.Data = "User and all associated data have been completely removed from the system";
                response.Message = "User and all associated data have been completely removed from the system";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred while hard deleting user {UserId}", userId);
                response.Success = false;
                response.Message = $"Error deleting user: {ex.Message}";
            }

            return response;
        }

        private async Task RemoveRemainingUserReferencesBeforeHardDelete(long userId)
        {
            // Required/no-action User FKs. These are not necessarily tied to an owned organization/property,
            // so they must be handled before the final Users delete.
            var actionSuppressions = await _dataContext.ActionSuppressions
                .Where(a => a.CreatedBy == userId)
                .ToListAsync();
            _dataContext.ActionSuppressions.RemoveRange(actionSuppressions);

            var announcements = await _dataContext.Announcements
                .Where(a => a.CreatedByUserId == userId)
                .ToListAsync();
            if (announcements.Any())
            {
                var announcementIds = announcements.Select(a => a.Id).ToList();
                var announcementRecipients = await _dataContext.AnnouncementRecipients
                    .Where(ar => announcementIds.Contains(ar.AnnouncementId))
                    .ToListAsync();
                _dataContext.AnnouncementRecipients.RemoveRange(announcementRecipients);
                _dataContext.Announcements.RemoveRange(announcements);
            }

            var bankReconciliations = await _dataContext.BankReconciliations
                .Where(br => br.ReconciledByUserId == userId)
                .ToListAsync();
            _dataContext.BankReconciliations.RemoveRange(bankReconciliations);

            var landlordChecklists = await _dataContext.Checklists
                .Where(c => c.LandlordId == userId)
                .ToListAsync();
            if (landlordChecklists.Any())
            {
                var checklistIds = landlordChecklists.Select(c => c.Id).ToList();
                var checklistItems = await _dataContext.ChecklistItems
                    .Where(ci => checklistIds.Contains(ci.ChecklistId))
                    .ToListAsync();
                _dataContext.ChecklistItems.RemoveRange(checklistItems);
                _dataContext.Checklists.RemoveRange(landlordChecklists);
            }

            var clients = await _dataContext.Clients
                .Where(c => c.UserId == userId)
                .ToListAsync();
            foreach (var client in clients)
            {
                client.UserId = null;
            }

            var clientInvites = await _dataContext.ClientInvites
                .Where(ci => ci.CreatedBy == userId)
                .ToListAsync();
            _dataContext.ClientInvites.RemoveRange(clientInvites);

            var customAmenityIds = await _dataContext.CustomAmenities
                .Where(a => a.CreatedBy == userId)
                .Select(a => a.Id)
                .ToListAsync();
            if (customAmenityIds.Any())
            {
                var listingAmenities = await _dataContext.ListingAmenities
                    .Where(la => la.CustomAmenityId.HasValue && customAmenityIds.Contains(la.CustomAmenityId.Value))
                    .ToListAsync();
                _dataContext.ListingAmenities.RemoveRange(listingAmenities);

                var customAmenities = await _dataContext.CustomAmenities
                    .Where(a => customAmenityIds.Contains(a.Id))
                    .ToListAsync();
                _dataContext.CustomAmenities.RemoveRange(customAmenities);
            }

            var customFeatureIds = await _dataContext.CustomFeatures
                .Where(f => f.CreatedBy == userId)
                .Select(f => f.Id)
                .ToListAsync();
            if (customFeatureIds.Any())
            {
                var listingFeatures = await _dataContext.ListingFeatures
                    .Where(lf => lf.CustomFeatureId.HasValue && customFeatureIds.Contains(lf.CustomFeatureId.Value))
                    .ToListAsync();
                _dataContext.ListingFeatures.RemoveRange(listingFeatures);

                var customFeatures = await _dataContext.CustomFeatures
                    .Where(f => customFeatureIds.Contains(f.Id))
                    .ToListAsync();
                _dataContext.CustomFeatures.RemoveRange(customFeatures);
            }

            // Legacy Feedback rows were replaced by SupportAndFeedbacks and the old table is no longer
            // present in current databases. Do not query Set<Feedback>() here, otherwise hard delete fails
            // with "Invalid object name 'Feedback'" before the user can be removed.

            var createdFiles = await _dataContext.Files
                .Where(f => f.CreatedBy == userId || f.UpdatedBy == userId)
                .ToListAsync();
            foreach (var file in createdFiles)
            {
                if (file.CreatedBy == userId)
                {
                    file.CreatedBy = null;
                }
                if (file.UpdatedBy == userId)
                {
                    file.UpdatedBy = null;
                }
            }

            var landlordInvites = await _dataContext.LandlordInvites
                .Where(li => li.CreatedBy == userId)
                .ToListAsync();
            _dataContext.LandlordInvites.RemoveRange(landlordInvites);

            var leaseDocuments = await _dataContext.LeaseDocuments
                .Where(ld => ld.GeneratedBy == userId)
                .ToListAsync();
            _dataContext.LeaseDocuments.RemoveRange(leaseDocuments);

            var leaseInstances = await _dataContext.LeaseInstances
                .Where(li => li.GeneratedBy == userId)
                .ToListAsync();
            if (leaseInstances.Any())
            {
                var leaseInstanceIds = leaseInstances.Select(li => li.Id).ToList();
                var generatedLeaseDocuments = await _dataContext.LeaseDocuments
                    .Where(ld => leaseInstanceIds.Contains(ld.LeaseInstanceId))
                    .ToListAsync();
                _dataContext.LeaseDocuments.RemoveRange(generatedLeaseDocuments);

                var leaseVariables = await _dataContext.LeaseVariables
                    .Where(lv => leaseInstanceIds.Contains(lv.LeaseInstanceId))
                    .ToListAsync();
                _dataContext.LeaseVariables.RemoveRange(leaseVariables);

                var leasePolicySections = await _dataContext.LeasePolicySections
                    .Where(lps => leaseInstanceIds.Contains(lps.LeaseInstanceId))
                    .ToListAsync();
                _dataContext.LeasePolicySections.RemoveRange(leasePolicySections);

                _dataContext.LeaseInstances.RemoveRange(leaseInstances);
            }

            var aiLeasePolicySections = await _dataContext.LeasePolicySections
                .Where(lps => lps.AiModifiedBy == userId)
                .ToListAsync();
            foreach (var section in aiLeasePolicySections)
            {
                section.AiModifiedBy = null;
            }

            var leaseShieldConversations = await _dataContext.LeaseShieldConversations
                .Where(c => c.UserId == userId)
                .ToListAsync();
            _dataContext.LeaseShieldConversations.RemoveRange(leaseShieldConversations);

            var listingContacts = await _dataContext.Listings
                .Where(l => l.ListingContactId == userId)
                .ToListAsync();
            foreach (var listing in listingContacts)
            {
                listing.ListingContactId = null;
            }

            var listings = await _dataContext.Listings
                .Where(l => l.CreatedBy == userId)
                .ToListAsync();
            if (listings.Any())
            {
                var listingIds = listings.Select(l => l.Id).ToList();
                var listingImages = await _dataContext.ListingImages
                    .Where(li => listingIds.Contains(li.RefId))
                    .ToListAsync();
                _dataContext.ListingImages.RemoveRange(listingImages);

                var listingBasicAmenities = await _dataContext.ListingBasicAmenities
                    .Where(lba => listingIds.Contains(lba.ListingId))
                    .ToListAsync();
                _dataContext.ListingBasicAmenities.RemoveRange(listingBasicAmenities);

                var listingAmenities = await _dataContext.ListingAmenities
                    .Where(la => listingIds.Contains(la.ListingId))
                    .ToListAsync();
                _dataContext.ListingAmenities.RemoveRange(listingAmenities);

                var listingFeatures = await _dataContext.ListingFeatures
                    .Where(lf => listingIds.Contains(lf.ListingId))
                    .ToListAsync();
                _dataContext.ListingFeatures.RemoveRange(listingFeatures);

                _dataContext.Listings.RemoveRange(listings);
            }

            var organizationInvites = await _dataContext.OrganizationInvites
                .Where(oi => oi.InvitedBy == userId)
                .ToListAsync();
            _dataContext.OrganizationInvites.RemoveRange(organizationInvites);

            var acceptedOrganizationInvites = await _dataContext.OrganizationInvites
                .Where(oi => oi.AcceptedBy == userId)
                .ToListAsync();
            foreach (var invite in acceptedOrganizationInvites)
            {
                invite.AcceptedBy = null;
            }

            var invitedOrganizationMembers = await _dataContext.OrganizationMembers
                .Where(om => om.InvitedBy == userId)
                .ToListAsync();
            foreach (var member in invitedOrganizationMembers)
            {
                member.InvitedBy = null;
            }

            var organizationMemberships = await _dataContext.OrganizationMembers
                .Where(om => om.UserId == userId)
                .ToListAsync();
            _dataContext.OrganizationMembers.RemoveRange(organizationMemberships);

            var organizations = await _dataContext.Organizations
                .Where(o => o.OwnerId == userId)
                .ToListAsync();
            foreach (var organization in organizations)
            {
                organization.OwnerId = null;
            }

            var purchasedSmsNumbers = await _dataContext.OrganizationSmsNumbers
                .Where(n => n.PurchasedByUserId == userId)
                .ToListAsync();
            foreach (var smsNumber in purchasedSmsNumbers)
            {
                smsNumber.PurchasedByUserId = null;
            }

            var staffMembers = await _dataContext.StaffMembers
                .Where(sm => sm.UserId == userId)
                .ToListAsync();
            foreach (var staffMember in staffMembers)
            {
                staffMember.UserId = null;
            }

            var staffMemberInvites = await _dataContext.StaffMemberInvites
                .Where(si => si.CreatedBy == userId)
                .ToListAsync();
            _dataContext.StaffMemberInvites.RemoveRange(staffMemberInvites);

            var subscriptions = await _dataContext.Subscriptions
                .Where(s => s.UserId == userId || s.OwnerUserId == userId)
                .ToListAsync();
            if (subscriptions.Any())
            {
                foreach (var subscription in subscriptions)
                {
                    if (!string.IsNullOrEmpty(subscription.StripeSubscriptionId) && _stripeService != null)
                    {
                        try
                        {
                            var cancelResponse = await _stripeService.CancelSubscriptionAsync(subscription.StripeSubscriptionId, cancelAtPeriodEnd: false);
                            if (!cancelResponse.Success)
                            {
                                _logger.LogWarning("Failed to cancel Stripe subscription {StripeSubscriptionId}: {Message}. Continuing with user deletion.",
                                    subscription.StripeSubscriptionId, cancelResponse.Message);
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Error cancelling Stripe subscription {StripeSubscriptionId}. Continuing with user deletion.",
                                subscription.StripeSubscriptionId);
                        }
                    }
                }

                var subscriptionIds = subscriptions.Select(s => s.Id).ToList();
                var subscriptionHistories = await _dataContext.SubscriptionHistories
                    .Where(sh => subscriptionIds.Contains(sh.SubscriptionId))
                    .ToListAsync();
                _dataContext.SubscriptionHistories.RemoveRange(subscriptionHistories);
                _dataContext.Subscriptions.RemoveRange(subscriptions);
            }

            var supportAndFeedback = await _dataContext.SupportAndFeedbacks
                .Where(sf => sf.UserId == userId)
                .ToListAsync();
            _dataContext.SupportAndFeedbacks.RemoveRange(supportAndFeedback);

            var tenantInvites = await _dataContext.TenantInvites
                .Where(ti => ti.CreatedBy == userId)
                .ToListAsync();
            _dataContext.TenantInvites.RemoveRange(tenantInvites);

            var timeEntries = await _dataContext.TimeEntries
                .Where(te => te.ApprovedById == userId)
                .ToListAsync();
            foreach (var timeEntry in timeEntries)
            {
                timeEntry.ApprovedById = null;
            }

            var vendors = await _dataContext.Vendors
                .Where(v => v.LandlordId == userId)
                .ToListAsync();
            _dataContext.Vendors.RemoveRange(vendors);

            var clauseLibraries = await _dataContext.ClauseLibraries
                .Where(c => c.LandlordId == userId)
                .ToListAsync();
            foreach (var clause in clauseLibraries)
            {
                clause.LandlordId = null;
            }

            var leaseTemplates = await _dataContext.LeaseTemplates
                .Where(t => t.LandlordId == userId)
                .ToListAsync();
            foreach (var template in leaseTemplates)
            {
                template.LandlordId = null;
            }

            var policyPacks = await _dataContext.PolicyPacks
                .Where(p => p.LandlordId == userId)
                .ToListAsync();
            foreach (var policyPack in policyPacks)
            {
                policyPack.LandlordId = null;
            }
        }

        private async Task HardDeleteOrganizationCompletely(long organizationId)
        {
            // Delete all properties in this organization
            var properties = await _dataContext.Properties
                .Where(p => p.OrganizationId == organizationId)
                .ToListAsync();

            foreach (var property in properties)
            {
                await HardDeletePropertyCompletely(property.Id);
            }

            // Delete all bank accounts
            var bankAccounts = await _dataContext.BankAccounts
                .Where(ba => ba.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.BankAccounts.RemoveRange(bankAccounts);

            // Cancel and delete all subscriptions
            var subscriptions = await _dataContext.Subscriptions
                .Where(s => s.OrganizationId == organizationId)
                .ToListAsync();

            // Cancel Stripe subscriptions before deleting from database
            foreach (var subscription in subscriptions)
            {
                if (!string.IsNullOrEmpty(subscription.StripeSubscriptionId) && _stripeService != null)
                {
                    try
                    {
                        _logger.LogInformation("Cancelling Stripe subscription {StripeSubscriptionId} for organization {OrganizationId} during organization deletion",
                            subscription.StripeSubscriptionId, organizationId);

                        // Cancel immediately (not at period end) since we're deleting the organization
                        var cancelResponse = await _stripeService.CancelSubscriptionAsync(subscription.StripeSubscriptionId, cancelAtPeriodEnd: false);

                        if (cancelResponse.Success)
                        {
                            _logger.LogInformation("Successfully cancelled Stripe subscription {StripeSubscriptionId}", subscription.StripeSubscriptionId);
                        }
                        else
                        {
                            _logger.LogWarning("Failed to cancel Stripe subscription {StripeSubscriptionId}: {Message}. Continuing with deletion.",
                                subscription.StripeSubscriptionId, cancelResponse.Message);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error cancelling Stripe subscription {StripeSubscriptionId} for organization {OrganizationId}. Continuing with deletion.",
                            subscription.StripeSubscriptionId, organizationId);
                        // Continue with deletion even if Stripe cancellation fails
                    }
                }
            }

            // Delete all subscription history for these subscriptions
            var subscriptionIds = subscriptions.Select(s => s.Id).ToList();
            if (subscriptionIds.Any())
            {
                var subscriptionHistories = await _dataContext.SubscriptionHistories
                    .Where(sh => subscriptionIds.Contains(sh.SubscriptionId))
                    .ToListAsync();
                _dataContext.SubscriptionHistories.RemoveRange(subscriptionHistories);
            }

            _dataContext.Subscriptions.RemoveRange(subscriptions);

            // Delete all organization members
            var organizationMembers = await _dataContext.OrganizationMembers
                .Where(om => om.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.OrganizationMembers.RemoveRange(organizationMembers);

            // Delete all organization invites
            var organizationInvites = await _dataContext.OrganizationInvites
                .Where(oi => oi.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.OrganizationInvites.RemoveRange(organizationInvites);

            // Delete all announcements and their recipients (must be deleted before organization)
            var announcements = await _dataContext.Announcements
                .Where(a => a.OrganizationId == organizationId)
                .ToListAsync();

            if (announcements.Any())
            {
                var announcementIds = announcements.Select(a => a.Id).ToList();

                // Delete announcement recipients first (they reference announcements)
                var announcementRecipients = await _dataContext.AnnouncementRecipients
                    .Where(ar => announcementIds.Contains(ar.AnnouncementId))
                    .ToListAsync();
                _dataContext.AnnouncementRecipients.RemoveRange(announcementRecipients);

                // Delete announcements
                _dataContext.Announcements.RemoveRange(announcements);
            }

            // Delete all conversations
            var conversations = await _dataContext.Conversations
                .Where(c => c.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.Conversations.RemoveRange(conversations);

            // Delete all checklist items
            var checklistItems = await _dataContext.OrganizationChecklistItems
                .Where(ci => ci.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.OrganizationChecklistItems.RemoveRange(checklistItems);

            // Delete all files
            var files = await _dataContext.Files
                .Where(f => f.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.Files.RemoveRange(files);

            // Delete all file categories
            var fileCategories = await _dataContext.FileCategories
                .Where(fc => fc.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.FileCategories.RemoveRange(fileCategories);

            // Delete all action suppressions (must be deleted before organization)
            var actionSuppressions = await _dataContext.ActionSuppressions
                .Where(a => a.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.ActionSuppressions.RemoveRange(actionSuppressions);

            // Delete bank reconciliation data (must be deleted before accounts and general ledger)
            // First, delete bank statement transactions that reference general ledger entries
            var bankStatements = await _dataContext.BankStatements
                .Where(bs => bs.OrganizationId == organizationId)
                .ToListAsync();

            if (bankStatements.Any())
            {
                var bankStatementIds = bankStatements.Select(bs => bs.Id).ToList();

                // Delete bank statement transactions (they reference general ledger entries)
                var bankStatementTransactions = await _dataContext.BankStatementTransactions
                    .Where(bst => bankStatementIds.Contains(bst.BankStatementId))
                    .ToListAsync();
                _dataContext.BankStatementTransactions.RemoveRange(bankStatementTransactions);

                // Delete bank reconciliations
                var bankReconciliations = await _dataContext.BankReconciliations
                    .Where(br => bankStatementIds.Contains(br.BankStatementId))
                    .ToListAsync();
                _dataContext.BankReconciliations.RemoveRange(bankReconciliations);

                // Delete bank statements
                _dataContext.BankStatements.RemoveRange(bankStatements);
            }

            // Delete general ledger entries (they reference accounts)
            var generalLedgerEntries = await _dataContext.GeneralLedgerEntries
                .Where(gle => gle.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.GeneralLedgerEntries.RemoveRange(generalLedgerEntries);

            // Delete accounts (they reference organization)
            var accounts = await _dataContext.Accounts
                .Where(a => a.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.Accounts.RemoveRange(accounts);

            // Delete client invites and clients (Clients reference Organization)
            var organizationClients = await _dataContext.Clients
                .Where(c => c.OrganizationId == organizationId)
                .ToListAsync();
            if (organizationClients.Any())
            {
                var clientIds = organizationClients.Select(c => c.Id).ToList();
                var clientInvites = await _dataContext.ClientInvites
                    .Where(ci => clientIds.Contains(ci.ClientId))
                    .ToListAsync();
                _dataContext.ClientInvites.RemoveRange(clientInvites);
                _dataContext.Clients.RemoveRange(organizationClients);
            }

            // Delete the organization
            var organization = await _dataContext.Organizations.FindAsync(organizationId);
            if (organization != null)
            {
                _dataContext.Organizations.Remove(organization);
            }

            await _dataContext.SaveChangesAsync();
        }

        private async Task HardDeletePropertyCompletely(long propertyId)
        {
            // Delete all units in this property
            var units = await _dataContext.Units
                .Where(u => u.PropertyId == propertyId)
                .ToListAsync();

            foreach (var unit in units)
            {
                // Delete all leases for this unit
                var leases = await _dataContext.Leases
                    .Where(l => l.UnitId == unit.Id)
                    .ToListAsync();

                foreach (var lease in leases)
                {
                    // Delete all payments
                    var payments = await _dataContext.Payments
                        .Where(p => p.LeaseId == lease.Id)
                        .ToListAsync();
                    _dataContext.Payments.RemoveRange(payments);

                    // Delete all deposits
                    var deposits = await _dataContext.Deposits
                        .Where(d => d.LeaseId == lease.Id)
                        .ToListAsync();
                    _dataContext.Deposits.RemoveRange(deposits);

                    // Delete all tenant documents
                    var tenantDocuments = await _dataContext.TenantDocuments
                        .Where(td => td.LeaseId == lease.Id)
                        .ToListAsync();
                    _dataContext.TenantDocuments.RemoveRange(tenantDocuments);

                    // Delete lease history
                    var leaseHistories = await _dataContext.LeaseHistories
                        .Where(lh => lh.OriginalLeaseId == lease.Id)
                        .ToListAsync();
                    _dataContext.LeaseHistories.RemoveRange(leaseHistories);

                    // Delete lease documents (via LeaseInstance)
                    var leaseInstances = await _dataContext.LeaseInstances
                        .Where(li => li.LeaseId == lease.Id)
                        .ToListAsync();

                    foreach (var leaseInstance in leaseInstances)
                    {
                        var leaseDocuments = await _dataContext.LeaseDocuments
                            .Where(ld => ld.LeaseInstanceId == leaseInstance.Id)
                            .ToListAsync();
                        _dataContext.LeaseDocuments.RemoveRange(leaseDocuments);
                    }

                    // Delete lease instances
                    _dataContext.LeaseInstances.RemoveRange(leaseInstances);

                    // Delete all files for this lease (must be deleted before lease)
                    var leaseFiles = await _dataContext.Files
                        .Where(f => f.LeaseId == lease.Id)
                        .ToListAsync();
                    _dataContext.Files.RemoveRange(leaseFiles);

                    // Delete the lease
                    _dataContext.Leases.Remove(lease);
                }

                // Delete all tenants for this unit
                var tenants = await _dataContext.Tenants
                    .Where(t => t.UnitId == unit.Id)
                    .ToListAsync();

                foreach (var tenant in tenants)
                {
                    // Delete tenant documents
                    var tenantDocs = await _dataContext.TenantDocuments
                        .Where(td => td.TenantId == tenant.Id)
                        .ToListAsync();
                    _dataContext.TenantDocuments.RemoveRange(tenantDocs);
                }

                _dataContext.Tenants.RemoveRange(tenants);

                // Delete all application invites for this unit (must be deleted before unit)
                var applicationInvites = await _dataContext.ApplicationInvites
                    .Where(ai => ai.UnitId == unit.Id)
                    .ToListAsync();
                _dataContext.ApplicationInvites.RemoveRange(applicationInvites);

                // Delete all files for this unit (must be deleted before unit)
                var unitFiles = await _dataContext.Files
                    .Where(f => f.UnitId == unit.Id)
                    .ToListAsync();
                _dataContext.Files.RemoveRange(unitFiles);

                // Delete the unit
                _dataContext.Units.Remove(unit);
            }

            // Delete all maintenance requests for this property
            var maintenanceRequests = await _dataContext.MaintenanceRequests
                .Where(mr => mr.PropertyId == propertyId)
                .ToListAsync();

            foreach (var mr in maintenanceRequests)
            {
                // Delete maintenance images
                var maintenanceImages = await _dataContext.MaintenanceImages
                    .Where(mi => mi.RefId == mr.Id)
                    .ToListAsync();
                _dataContext.MaintenanceImages.RemoveRange(maintenanceImages);

                // Delete maintenance events
                var maintenanceEvents = await _dataContext.MaintenanceEvents
                    .Where(me => me.MaintenanceId == mr.Id)
                    .ToListAsync();
                _dataContext.MaintenanceEvents.RemoveRange(maintenanceEvents);
            }

            _dataContext.MaintenanceRequests.RemoveRange(maintenanceRequests);

            // Delete all expenses for this property (get IDs first before deleting)
            var expenseIds = await _dataContext.Expenses
                .Where(e => e.PropertyId == propertyId)
                .Select(e => e.Id)
                .ToListAsync();

            // Delete all expense receipts first (they reference expenses via RefId)
            if (expenseIds.Any())
            {
                var expenseReceipts = await _dataContext.ExpenseReceipts
                    .Where(er => expenseIds.Contains(er.RefId))
                    .ToListAsync();
                _dataContext.ExpenseReceipts.RemoveRange(expenseReceipts);
            }

            // Now delete the expenses
            var expenses = await _dataContext.Expenses
                .Where(e => e.PropertyId == propertyId)
                .ToListAsync();
            _dataContext.Expenses.RemoveRange(expenses);

            // Delete all recurring expenses
            var recurringExpenses = await _dataContext.RecurringExpenses
                .Where(re => re.PropertyId == propertyId)
                .ToListAsync();
            _dataContext.RecurringExpenses.RemoveRange(recurringExpenses);

            // Delete all property images
            var propertyImages = await _dataContext.PropertyImages
                .Where(pi => pi.RefId == propertyId)
                .ToListAsync();
            _dataContext.PropertyImages.RemoveRange(propertyImages);

            // Delete all checklists for this property
            var checklists = await _dataContext.Checklists
                .Where(c => c.PropertyId == propertyId)
                .ToListAsync();

            foreach (var checklist in checklists)
            {
                // Delete checklist items
                var checklistItems = await _dataContext.ChecklistItems
                    .Where(ci => ci.ChecklistId == checklist.Id)
                    .ToListAsync();
                _dataContext.ChecklistItems.RemoveRange(checklistItems);
            }

            _dataContext.Checklists.RemoveRange(checklists);

            // Delete all rental applications for this property
            var rentalApplications = await _dataContext.RentalApplications
                .Where(ra => ra.PropertyId == propertyId)
                .ToListAsync();
            _dataContext.RentalApplications.RemoveRange(rentalApplications);

            // Delete all application invites for this property (must be deleted before property)
            var propertyApplicationInvites = await _dataContext.ApplicationInvites
                .Where(ai => ai.PropertyId == propertyId)
                .ToListAsync();
            _dataContext.ApplicationInvites.RemoveRange(propertyApplicationInvites);

            // Delete all files for this property (must be deleted before property)
            var propertyFiles = await _dataContext.Files
                .Where(f => f.PropertyId == propertyId)
                .ToListAsync();
            _dataContext.Files.RemoveRange(propertyFiles);

            // Delete the property
            var property = await _dataContext.Properties.FindAsync(propertyId);
            if (property != null)
            {
                _dataContext.Properties.Remove(property);
            }

            await _dataContext.SaveChangesAsync();
        }

        private async Task NotifyAdminsAboutNewUserAsync(LoadUserDto newUser)
        {
            try
            {
                if (_notificationService == null || _notificationSettingRepository == null || _userRepository == null)
                {
                    _logger.LogWarning("Notification services not available, skipping admin notification for new user");
                    return;
                }

                var adminUsers = await _userRepository.GetAdminUsersAsync();
                if (adminUsers == null || !adminUsers.Any())
                {
                    _logger.LogInformation("No admin users found to notify about new user registration");
                    return;
                }

                var userRoles = newUser.Roles != null && newUser.Roles.Any()
                    ? string.Join(", ", newUser.Roles)
                    : "No roles assigned";
                var title = $"New User Registration: {newUser.Email}";
                var message = $"A new user account has been created:\n\n" +
                             $"Email: {newUser.Email}\n" +
                             $"Name: {newUser.Firstname} {newUser.Lastname}\n" +
                             $"Roles: {userRoles}\n" +
                             $"Registration Date: {DateTime.Now:yyyy-MM-dd HH:mm:ss}";

                foreach (var admin in adminUsers)
                {
                    try
                    {
                        // Get notification settings for admin
                        var settings = await _notificationSettingRepository.GetNotificationSettings(admin.Id);
                        if (settings == null)
                        {
                            // Create default settings if they don't exist
                            settings = await _notificationSettingRepository.AddNotificationSettings(admin.Id);
                            if (string.IsNullOrEmpty(settings.EmailAddress) && !string.IsNullOrEmpty(admin.Email))
                            {
                                settings.EmailAddress = admin.Email;
                                await _notificationSettingRepository.UpdateNotificationSettings(settings);
                            }
                        }

                        // Check if admin has enabled new user notifications
                        bool shouldNotify = settings.AdminNewUserNotifications.Email || settings.AdminNewUserNotifications.Phone;
                        if (!shouldNotify)
                        {
                            _logger.LogInformation("Admin {AdminId} has disabled new user notifications, skipping", admin.Id);
                            continue;
                        }

                        var notificationDto = new CreateNotificationDto
                        {
                            UserId = admin.Id,
                            Type = ENotificationType.System,
                            Title = title,
                            Message = message,
                            RelatedId = newUser.Id,
                            SendEmail = settings.AdminNewUserNotifications.Email,
                            SendSMS = settings.AdminNewUserNotifications.Phone
                        };

                        await _notificationService.CreateNotification(notificationDto);
                        _logger.LogInformation("Sent new user notification to admin {AdminId} ({AdminEmail})", admin.Id, admin.Email);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error sending new user notification to admin {AdminId}", admin.Id);
                        // Continue with other admins even if one fails
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error notifying admins about new user registration");
                // Don't throw - this is a non-critical operation
            }
        }

        private (string htmlBody, string plainTextBody) GenerateWelcomeEmailContent(string firstName, string signature, bool isPersonal)
        {
            string plainTextBody;
            string htmlBody;

            if (isPersonal)
            {
                // Personal message from Thomas Brown (when using owner sender address)
                plainTextBody = $@"Hi {firstName},

Thanks for signing up — really glad you're here.

I'm the founder. I built Property Peace after watching too many landlords manage everything across spreadsheets, text threads, and sticky notes. It doesn't have to be that complicated.

If something isn't working right or you want to see a feature added, just reach out. I handle technical issues directly and I'm always listening on the product side. A lot of what's in the platform came from conversations with landlords just like you.

Feel free to reach out using the contact details in the signature below — I read everything.

{signature}";

                htmlBody = $@"<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
</head>
<body style='font-family: -apple-system, BlinkMacSystemFont, ""Segoe UI"", Roboto, ""Helvetica Neue"", Arial, sans-serif; line-height: 1.6; color: #333333; background-color: #f5f5f5; margin: 0; padding: 20px;'>
    <div style='max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);'>
        <div style='background-color: #ffffff; padding: 24px 30px; text-align: center; border-bottom: 1px solid #e8e8e8;'>
            <img src='https://propertypeace.io/images/logos/property-peace-dark.png' alt='Property Peace' style='height: 44px; width: auto; display: block; margin: 0 auto;' />
        </div>
        <div style='padding: 36px 30px; background-color: #ffffff;'>
            <p style='font-size: 15px; color: #4a4a4a; margin-bottom: 16px;'>Hi {firstName},</p>
            <p style='font-size: 15px; color: #4a4a4a; margin-bottom: 16px;'>Thanks for signing up — really glad you're here.</p>
            <p style='font-size: 15px; color: #4a4a4a; margin-bottom: 16px;'>I'm the founder. I built Property Peace after watching too many landlords manage everything across spreadsheets, text threads, and sticky notes. It doesn't have to be that complicated.</p>
            <p style='font-size: 15px; color: #4a4a4a; margin-bottom: 16px;'>If something isn't working right or you want to see a feature added, just reach out. I handle technical issues directly and I'm always listening on the product side. A lot of what's in the platform came from conversations with landlords just like you.</p>
            <p style='font-size: 15px; color: #4a4a4a; margin-bottom: 16px;'>Feel free to reach out using the contact details in the signature below — I read everything.</p>
            <div style='margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 14px; color: #666666; white-space: pre-line;'>{signature}</div>
        </div>
        <div style='background-color: #042238; padding: 28px 30px; text-align: center;'>
            <div style='margin-bottom: 14px;'>
                <a href='https://propertypeace.io' style='color: #ffffff; text-decoration: none; font-size: 13px; margin: 0 12px; opacity: 0.9;'>Website</a>
                <a href='https://x.com/BrownstoneHubCo' style='color: #ffffff; text-decoration: none; font-size: 13px; margin: 0 12px; opacity: 0.9;'>Twitter / X</a>
                <a href='https://www.instagram.com/propertypeace.io/' style='color: #ffffff; text-decoration: none; font-size: 13px; margin: 0 12px; opacity: 0.9;'>Instagram</a>
            </div>
            <p style='color: rgba(255,255,255,0.5); font-size: 11px; margin: 0;'>© 2026 Property Peace. All rights reserved.</p>
        </div>
    </div>
</body>
</html>";
            }
            else
            {
                // Generic message (when using fallback/default sender address)
                plainTextBody = $@"Hi {firstName},

Thanks for signing up for Property Peace.

We built this for landlords who are tired of managing everything across spreadsheets and group chats. The goal is to keep it simple — properties, tenants, leases, maintenance, and finances all in one place.

If something isn't working the way you expect, or you have an idea for something you'd like to see, let us know. We work directly with landlords on technical issues and take feature requests seriously. A lot of what's already in the platform started as a request from someone in your position.

You can use the Feedback page inside the portal or reach out using the contact details in the signature below.

{signature}";

                htmlBody = $@"<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
</head>
<body style='font-family: -apple-system, BlinkMacSystemFont, ""Segoe UI"", Roboto, ""Helvetica Neue"", Arial, sans-serif; line-height: 1.6; color: #333333; background-color: #f5f5f5; margin: 0; padding: 20px;'>
    <div style='max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);'>
        <div style='background-color: #ffffff; padding: 24px 30px; text-align: center; border-bottom: 1px solid #e8e8e8;'>
            <img src='https://propertypeace.io/images/logos/property-peace-dark.png' alt='Property Peace' style='height: 44px; width: auto; display: block; margin: 0 auto;' />
        </div>
        <div style='padding: 36px 30px; background-color: #ffffff;'>
            <p style='font-size: 15px; color: #4a4a4a; margin-bottom: 16px;'>Hi {firstName},</p>
            <p style='font-size: 15px; color: #4a4a4a; margin-bottom: 16px;'>Thanks for signing up for Property Peace.</p>
            <p style='font-size: 15px; color: #4a4a4a; margin-bottom: 16px;'>We built this for landlords who are tired of managing everything across spreadsheets and group chats. The goal is to keep it simple — properties, tenants, leases, maintenance, and finances all in one place.</p>
            <p style='font-size: 15px; color: #4a4a4a; margin-bottom: 16px;'>If something isn't working the way you expect, or you have an idea for something you'd like to see, let us know. We work directly with landlords on technical issues and take feature requests seriously. A lot of what's already in the platform started as a request from someone in your position.</p>
            <p style='font-size: 15px; color: #4a4a4a; margin-bottom: 16px;'>You can use the <strong>Feedback</strong> page inside the portal or reach out using the contact details in the signature below.</p>
            <div style='margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 14px; color: #666666; white-space: pre-line;'>{signature}</div>
        </div>
        <div style='background-color: #042238; padding: 28px 30px; text-align: center;'>
            <div style='margin-bottom: 14px;'>
                <a href='https://propertypeace.io' style='color: #ffffff; text-decoration: none; font-size: 13px; margin: 0 12px; opacity: 0.9;'>Website</a>
                <a href='https://x.com/BrownstoneHubCo' style='color: #ffffff; text-decoration: none; font-size: 13px; margin: 0 12px; opacity: 0.9;'>Twitter / X</a>
                <a href='https://www.instagram.com/propertypeace.io/' style='color: #ffffff; text-decoration: none; font-size: 13px; margin: 0 12px; opacity: 0.9;'>Instagram</a>
            </div>
            <p style='color: rgba(255,255,255,0.5); font-size: 11px; margin: 0;'>© 2026 Property Peace. All rights reserved.</p>
        </div>
    </div>
</body>
</html>";
            }

            return (htmlBody, plainTextBody);
        }

        private async Task SendWelcomeEmailAsync(LoadUserDto newUser)
        {
            try
            {
                _logger.LogInformation("SendWelcomeEmailAsync called for user: {UserEmail}", newUser.Email);

                if (_emailService == null)
                {
                    _logger.LogWarning("Email service not available, skipping welcome email for {UserEmail}", newUser.Email);
                    return;
                }

                if (string.IsNullOrWhiteSpace(newUser.Email))
                {
                    _logger.LogWarning("User email is empty, skipping welcome email");
                    return;
                }

                var firstName = newUser.Firstname ?? "there";
                var subject = "Thanks for checking out Property Peace";

                var signature = @"Thanks,

Thomas Brown
Founder & CEO
tbrown@propertypeace.io
https://propertypeace.io";

                // Get owner sender address from configuration, fall back to default if not configured
                var ownerSenderAddress = _configuration["AzureCommunication:SenderAddress:Owner"];

                // Try to send with owner sender address first, fall back to default if it fails
                bool emailSent = false;

                if (!string.IsNullOrWhiteSpace(ownerSenderAddress))
                {
                    // Generate personal message for owner sender
                    var (personalHtmlBody, personalPlainTextBody) = GenerateWelcomeEmailContent(firstName, signature, isPersonal: true);

                    _logger.LogInformation("Attempting to send welcome email using owner sender address: {SenderAddress}", ownerSenderAddress);
                    emailSent = await _emailService.SendEmailAsync(
                        newUser.Email,
                        subject,
                        personalHtmlBody,
                        personalPlainTextBody,
                        ownerSenderAddress
                    );

                    // If sending with owner address failed, try with default sender address using generic message
                    if (!emailSent)
                    {
                        _logger.LogWarning("Failed to send welcome email with owner sender address {OwnerAddress}, retrying with default sender address and generic message", ownerSenderAddress);

                        // Generate generic message for fallback
                        var (genericHtmlBody, genericPlainTextBody) = GenerateWelcomeEmailContent(firstName, signature, isPersonal: false);

                        emailSent = await _emailService.SendEmailAsync(
                            newUser.Email,
                            subject,
                            genericHtmlBody,
                            genericPlainTextBody,
                            null // Use default sender address
                        );
                    }
                }
                else
                {
                    // No owner address configured, use generic message
                    _logger.LogInformation("Owner sender address not configured, using default sender address with generic message");

                    var (genericHtmlBody, genericPlainTextBody) = GenerateWelcomeEmailContent(firstName, signature, isPersonal: false);

                    emailSent = await _emailService.SendEmailAsync(
                        newUser.Email,
                        subject,
                        genericHtmlBody,
                        genericPlainTextBody,
                        null // Use default sender address
                    );
                }

                if (emailSent)
                {
                    _logger.LogInformation("Welcome email sent successfully to {UserEmail}", newUser.Email);
                }
                else
                {
                    _logger.LogWarning("Failed to send welcome email to {UserEmail} after all attempts", newUser.Email);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending welcome email to {UserEmail}", newUser.Email);
                // Don't throw - this is a non-critical operation
            }
        }
    }
}
