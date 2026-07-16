using System.Security.Cryptography;
using System;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Tenant;
using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Repositories.Tenants;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Services.NotificationService;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.TenantInviteService
{
    public class TenantInviteService(
        ITenantInviteRepository tenantInviteRepository,
        ITenantRepository tenantRepository,
        IUserRepository userRepository,
        DataContext dataContext,
        IConfiguration configuration,
        IEmailService emailService,
        INotificationService notificationService,
        ILogger<TenantInviteService> logger) : ITenantInviteService
    {
        private readonly ITenantInviteRepository _tenantInviteRepository = tenantInviteRepository;
        private readonly ITenantRepository _tenantRepository = tenantRepository;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly DataContext _dataContext = dataContext;
        private readonly IConfiguration _configuration = configuration;
        private readonly IEmailService _emailService = emailService;
        private readonly INotificationService _notificationService = notificationService;
        private readonly ILogger<TenantInviteService> _logger = logger;

        private async Task<long?> GetCurrentUserIdAsync()
        {
            var user = await _userRepository.GetCurrentUser();
            return user?.Id;
        }

        public async Task<ServiceResponse<LoadTenantInviteDto>> CreateInvite(AddTenantInviteDto invite)
        {
            try
            {
                var landlordId = await GetCurrentUserIdAsync();
                if (!landlordId.HasValue)
                {
                    return ServiceResponse<LoadTenantInviteDto>.CreateError("User not found", "User not authenticated", "", 401);
                }

                // Verify tenant exists and belongs to this landlord
                var tenant = await _tenantRepository.GetTenantById(invite.TenantId);
                if (tenant == null)
                {
                    return ServiceResponse<LoadTenantInviteDto>.CreateError("Tenant not found");
                }

                _logger.LogInformation("[TenantInviteService] CreateInvite called for TenantId: {TenantId}, Email: {Email}", invite.TenantId, invite.Email);

                // Get tenant entity to check TenantLeases and OrganizationId
                var tenantEntity = await _dataContext.Tenants
                    .Include(t => t.TenantLeases)
                    .FirstOrDefaultAsync(t => t.Id == invite.TenantId);

                if (tenantEntity == null)
                {
                    return ServiceResponse<LoadTenantInviteDto>.CreateError("Tenant not found");
                }

                // Check if tenant already has a user account
                // If they do, we should still allow invites if they're being added to a new lease
                // The invite will allow them to accept the new lease relationship
                if (tenantEntity.UserId.HasValue)
                {
                    _logger.LogInformation("[TenantInviteService] Tenant {TenantId} already has UserId: {UserId}. Checking if invite is for new lease relationship.",
                        tenantEntity.Id, tenantEntity.UserId.Value);

                    // If tenant has UserId, they already have an account
                    // But we should still allow the invite if they're being added to a new lease
                    // The invite acceptance will create the TenantLease relationship
                    // We'll continue to create the invite below - don't block it
                    _logger.LogInformation("[TenantInviteService] Allowing invite for existing tenant account - they can accept the new lease relationship.");
                }

                // Check if this is a placeholder tenant (has email but no UserId)
                // Placeholder tenants should NOT be auto-connected - they need to accept the invite first
                bool isPlaceholderTenant = !tenantEntity.UserId.HasValue && !string.IsNullOrEmpty(tenantEntity.Email);
                _logger.LogInformation("[TenantInviteService] Tenant {TenantId} isPlaceholder: {IsPlaceholder}, Email: {Email}, UserId: {UserId}",
                    tenantEntity.Id, isPlaceholderTenant, tenantEntity.Email, tenantEntity.UserId);

                // Check if a user with that email already exists
                if (!string.IsNullOrEmpty(invite.Email))
                {
                    var existingUser = await _userRepository.GetUserByEmailAsync(invite.Email);
                    if (existingUser != null)
                    {
                        _logger.LogInformation("[TenantInviteService] Found existing user with email {Email}, UserId: {UserId}, Roles: {Roles}",
                            invite.Email, existingUser.Id, string.Join(", ", existingUser.Roles ?? new List<string>()));

                        // If this is a placeholder tenant, DO NOT auto-connect - just create and send the invite
                        // The user will accept the invite and connect themselves
                        if (isPlaceholderTenant)
                        {
                            _logger.LogInformation("[TenantInviteService] Placeholder tenant detected - skipping auto-connect. Will create invite for user to accept.");
                            // Continue to create invite below - don't auto-connect
                        }
                        else
                        {
                            // User exists - check if they have Tenant role
                            if (existingUser.Roles != null && existingUser.Roles.Contains("Tenant", StringComparer.OrdinalIgnoreCase))
                            {
                                _logger.LogInformation("[TenantInviteService] Auto-connecting existing tenant user {UserId} to tenant {TenantId}",
                                    existingUser.Id, tenant.Id);

                                // User is a Tenant - link tenant record to user and connect to org/property/lease/unit
                                // Use the tenantEntity already loaded above to access OrganizationId
                                var tenantOrganizationId = tenantEntity.OrganizationId;

                                var updateTenantDto = new brownstone_hub_api.Dtos.Tenant.AddTenantDto
                                {
                                    Id = tenant.Id,
                                    UserId = existingUser.Id,
                                    Firstname = tenant.Firstname,
                                    Lastname = tenant.Lastname,
                                    Email = tenant.Email,
                                    PhoneNumber = tenant.PhoneNumber,
                                    LeaseId = tenant.LeaseId,
                                    UnitId = tenant.UnitId,
                                    IsActive = tenant.IsActive,
                                    OrganizationId = tenantOrganizationId
                                };

                                await _tenantRepository.UpdateTenant(tenant.Id, updateTenantDto);

                                // Set user's CurrentOrganizationId to tenant's OrganizationId if tenant has one
                                if (tenantOrganizationId.HasValue)
                                {
                                    await _userRepository.UpdateCurrentOrganizationIdAsync(existingUser.Id, tenantOrganizationId.Value);
                                    _logger.LogInformation("Linked existing tenant user {UserId} to tenant record {TenantId} and set CurrentOrganizationId to {OrganizationId}",
                                        existingUser.Id, tenant.Id, tenantOrganizationId.Value);
                                }
                                else
                                {
                                    _logger.LogInformation("Linked existing tenant user {UserId} to tenant record {TenantId}",
                                        existingUser.Id, tenant.Id);
                                }

                                // Return success with message indicating account already exists
                                // Return null for Data since no invite was created
                                return new ServiceResponse<LoadTenantInviteDto>
                                {
                                    Success = true,
                                    Message = $"Tenant account already exists. {invite.Email} has been connected to this tenant.",
                                    Data = null,
                                    StatusCode = 200
                                };
                            }
                            else
                            {
                                // User exists but is not a Tenant
                                _logger.LogWarning("[TenantInviteService] User {UserId} exists but is not a Tenant", existingUser.Id);
                                return ServiceResponse<LoadTenantInviteDto>.CreateError(
                                    "A user with that email already exists",
                                    "The email address belongs to a user who is not a tenant. Please use a different email address.",
                                    statusCode: 400
                                );
                            }
                        }
                    }
                    else
                    {
                        _logger.LogInformation("[TenantInviteService] No existing user found with email {Email}", invite.Email);
                    }
                }

                // Check if there's already a valid (unused, not expired) invite for this tenant
                var existingInvites = await _tenantInviteRepository.GetInvitesByTenantId(invite.TenantId);
                var validInvite = existingInvites.FirstOrDefault(i => !i.IsUsed && i.ExpiresAt > DateTime.Now);

                // For placeholder tenants (existing users who haven't joined yet), allow creating a new invite
                // even if a valid one exists - this allows sending fresh reminder invites
                // For tenants who already have accounts (UserId), allow new invites when being added to new leases
                // For new users without accounts, prevent duplicate invites
                bool shouldAllowNewInvite = isPlaceholderTenant || tenantEntity.UserId.HasValue;

                if (validInvite != null && !shouldAllowNewInvite)
                {
                    return ServiceResponse<LoadTenantInviteDto>.CreateError("A valid invite already exists for this tenant");
                }

                // If we're allowing a new invite even though one exists, log it
                if (validInvite != null && shouldAllowNewInvite)
                {
                    if (isPlaceholderTenant)
                    {
                        _logger.LogInformation("[TenantInviteService] Placeholder tenant has existing invite, but creating new invite for reminder. TenantId: {TenantId}", invite.TenantId);
                    }
                    else if (tenantEntity.UserId.HasValue)
                    {
                        _logger.LogInformation("[TenantInviteService] Tenant with existing account has invite, but creating new invite for new lease relationship. TenantId: {TenantId}", invite.TenantId);
                    }
                }

                // Generate secure token
                var inviteToken = GenerateSecureToken();
                var expiresAt = DateTime.Now.AddDays(7); // Invite expires in 7 days

                _logger.LogInformation("[TenantInviteService] Creating invite for TenantId: {TenantId}, Email: {Email}, Token: {Token}",
                    invite.TenantId, invite.Email, inviteToken);

                var createdInvite = await _tenantInviteRepository.CreateInvite(invite, landlordId.Value, inviteToken, expiresAt);

                _logger.LogInformation("[TenantInviteService] Invite created successfully. InviteId: {InviteId}", createdInvite.Id);

                // Send invite email
                try
                {
                    _logger.LogInformation("[TenantInviteService] Sending invite email to {Email}", invite.Email);
                    await SendInviteEmailAsync(createdInvite, inviteToken);
                    _logger.LogInformation("[TenantInviteService] Invite email sent successfully to {Email}", invite.Email);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to send invite email, but invite was created. Invite ID: {InviteId}", createdInvite.Id);
                    // Don't fail the request if email fails - invite is still created
                }

                // If invite was sent to an existing user (placeholder tenant), send in-app notification
                if (!string.IsNullOrWhiteSpace(invite.Email))
                {
                    var existingUser = await _userRepository.GetUserByEmailAsync(invite.Email.Trim());
                    if (existingUser != null)
                    {
                        try
                        {
                            string propertyName = "a property";
                            var tenantWithProperty = await _dataContext.Tenants
                                .Include(t => t.Unit).ThenInclude(u => u.Property)
                                .Include(t => t.TenantLeases).ThenInclude(tl => tl.Lease).ThenInclude(l => l.Unit).ThenInclude(u => u.Property)
                                .FirstOrDefaultAsync(t => t.Id == createdInvite.TenantId);
                            if (tenantWithProperty?.Unit?.Property != null)
                                propertyName = tenantWithProperty.Unit.Property.Name ?? propertyName;
                            else if (tenantWithProperty?.TenantLeases?.FirstOrDefault()?.Lease?.Unit?.Property != null)
                                propertyName = tenantWithProperty.TenantLeases!.First().Lease.Unit.Property.Name ?? propertyName;

                            var notificationDto = new CreateNotificationDto
                            {
                                UserId = existingUser.Id,
                                Type = ENotificationType.TenantInvite,
                                Title = "Portal invitation",
                                Message = $"You've been invited to join {propertyName}. Accept the invitation to connect your account to the lease.",
                                RelatedId = createdInvite.Id,
                                SendEmail = false,
                                SendSMS = false
                            };
                            await _notificationService.CreateNotification(notificationDto);
                            _logger.LogInformation("[TenantInviteService] Sent in-app tenant invite notification to user {UserId}", existingUser.Id);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Failed to create in-app notification for tenant invite");
                        }
                    }
                }

                _logger.LogInformation("[TenantInviteService] CreateInvite completed successfully for TenantId: {TenantId}", invite.TenantId);
                return new ServiceResponse<LoadTenantInviteDto> { Data = createdInvite };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating tenant invite");
                return ServiceResponse<LoadTenantInviteDto>.CreateError("Error creating invite", ex.Message);
            }
        }

        public async Task<ServiceResponse<ValidateInviteTokenDto>> ValidateInviteToken(string token)
        {
            try
            {
                var invite = await _tenantInviteRepository.GetInviteByToken(token);

                if (invite == null)
                {
                    return new ServiceResponse<ValidateInviteTokenDto>
                    {
                        Data = new ValidateInviteTokenDto
                        {
                            IsValid = false,
                            Message = "Invalid invite token"
                        }
                    };
                }

                if (invite.IsUsed)
                {
                    return new ServiceResponse<ValidateInviteTokenDto>
                    {
                        Data = new ValidateInviteTokenDto
                        {
                            IsValid = false,
                            Message = "This invite has already been used"
                        }
                    };
                }

                if (invite.ExpiresAt < DateTime.Now)
                {
                    return new ServiceResponse<ValidateInviteTokenDto>
                    {
                        Data = new ValidateInviteTokenDto
                        {
                            IsValid = false,
                            Message = "This invite has expired"
                        }
                    };
                }

                // Get property and landlord information
                string? propertyName = null;
                string? propertyAddress = null;
                string? landlordName = null;

                var inviteTenant = invite.Tenant;
                if (inviteTenant != null)
                {
                    var tenantId = inviteTenant.Id;
                    // Get tenant entity with full relationships
                    var tenantWithRelations = await _dataContext.Tenants
                        .Include(t => t.Unit)
                            .ThenInclude(u => u.Property)
                        .FirstOrDefaultAsync(t => t.Id == tenantId);

                    if (tenantWithRelations?.Unit?.Property != null)
                    {
                        propertyName = tenantWithRelations.Unit.Property.Name ?? "the property";
                        propertyAddress = tenantWithRelations.Unit.Property.StreetAddress ?? "";
                    }

                    // Get landlord name from CreatedBy
                    var landlord = await _userRepository.GetUser(invite.CreatedBy);
                    if (landlord != null)
                    {
                        landlordName = $"{landlord.FirstName} {landlord.LastName}".Trim();
                        if (string.IsNullOrEmpty(landlordName))
                        {
                            landlordName = landlord.Email ?? "Your Landlord";
                        }
                    }
                }

                return new ServiceResponse<ValidateInviteTokenDto>
                {
                    Data = new ValidateInviteTokenDto
                    {
                        IsValid = true,
                        Email = invite.Email,
                        TenantId = invite.TenantId,
                        Tenant = invite.Tenant,
                        PropertyName = propertyName,
                        PropertyAddress = propertyAddress,
                        LandlordName = landlordName,
                        Message = "Invite is valid"
                    }
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating invite token");
                return ServiceResponse<ValidateInviteTokenDto>.CreateError("Error validating invite", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadTenantInviteDto>>> GetInvitesByTenantId(long tenantId)
        {
            try
            {
                var invites = await _tenantInviteRepository.GetInvitesByTenantId(tenantId);
                return new ServiceResponse<List<LoadTenantInviteDto>> { Data = invites };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting invites by tenant id");
                return ServiceResponse<List<LoadTenantInviteDto>>.CreateError("Error getting invites", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadTenantInviteDto>>> GetInvitesByLandlordId()
        {
            try
            {
                var landlordId = await GetCurrentUserIdAsync();
                if (!landlordId.HasValue)
                {
                    return ServiceResponse<List<LoadTenantInviteDto>>.CreateError("User not found", "User not authenticated", "", 401);
                }

                var invites = await _tenantInviteRepository.GetInvitesByLandlordId(landlordId.Value);
                return new ServiceResponse<List<LoadTenantInviteDto>> { Data = invites };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting invites by landlord id");
                return ServiceResponse<List<LoadTenantInviteDto>>.CreateError("Error getting invites", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> DeleteInvite(long inviteId)
        {
            try
            {
                var landlordId = await GetCurrentUserIdAsync();
                if (!landlordId.HasValue)
                {
                    return ServiceResponse<bool>.CreateError("User not found", "User not authenticated", "", 401);
                }

                var invite = await _tenantInviteRepository.GetInviteById(inviteId);
                if (invite == null)
                {
                    return ServiceResponse<bool>.CreateError("Invite not found");
                }

                if (invite.CreatedBy != landlordId.Value)
                {
                    return ServiceResponse<bool>.CreateError("You don't have permission to delete this invite");
                }

                var result = await _tenantInviteRepository.DeleteInvite(inviteId);
                return new ServiceResponse<bool> { Data = result };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting invite");
                return ServiceResponse<bool>.CreateError("Error deleting invite", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> ResendInvite(long inviteId)
        {
            try
            {
                var landlordId = await GetCurrentUserIdAsync();
                if (!landlordId.HasValue)
                {
                    return ServiceResponse<bool>.CreateError("User not found", "User not authenticated", "", 401);
                }

                var invite = await _tenantInviteRepository.GetInviteById(inviteId);
                if (invite == null)
                {
                    return ServiceResponse<bool>.CreateError("Invite not found");
                }

                if (invite.CreatedBy != landlordId.Value)
                {
                    return ServiceResponse<bool>.CreateError("You don't have permission to resend this invite");
                }

                // Mark old invite as used and create a new one
                await _tenantInviteRepository.MarkInviteAsUsed(invite.InviteToken);

                var newInvite = new AddTenantInviteDto
                {
                    TenantId = invite.TenantId,
                    Email = invite.Email
                };

                var newToken = GenerateSecureToken();
                var expiresAt = DateTime.Now.AddDays(7);

                await _tenantInviteRepository.CreateInvite(newInvite, landlordId.Value, newToken, expiresAt);

                return new ServiceResponse<bool> { Data = true };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resending invite");
                return ServiceResponse<bool>.CreateError("Error resending invite", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> MarkInviteAsUsed(string token)
        {
            try
            {
                var result = await _tenantInviteRepository.MarkInviteAsUsed(token);
                return new ServiceResponse<bool> { Data = result };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error marking invite as used");
                return ServiceResponse<bool>.CreateError("Error marking invite as used", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadTenantInviteDto?>> GetPendingInviteForCurrentUser()
        {
            try
            {
                var userId = await GetCurrentUserIdAsync();
                if (!userId.HasValue)
                    return ServiceResponse<LoadTenantInviteDto?>.CreateError("User not found", "User not authenticated", "", 401);

                var user = await _userRepository.GetUser(userId.Value);
                if (user?.Email == null)
                    return new ServiceResponse<LoadTenantInviteDto?> { Data = null, Success = true };

                var invite = await _tenantInviteRepository.GetPendingInviteByEmail(user.Email);
                return new ServiceResponse<LoadTenantInviteDto?> { Data = invite, Success = true };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting pending invite for current user");
                return ServiceResponse<LoadTenantInviteDto?>.CreateError("Error getting pending invite", ex.Message);
            }
        }

        private async Task SendInviteEmailAsync(LoadTenantInviteDto invite, string token)
        {
            _logger.LogInformation("[TenantInviteService] Preparing to send invite email to {Email}", invite.Email);

            // Get frontend base URL from configuration or use default
            var frontendBaseUrl = _configuration["FrontendBaseUrl"] ?? "http://localhost:3000";
            var inviteUrl = $"{frontendBaseUrl.TrimEnd('/')}/tenant/invite/{token}";

            var tenantName = invite.Tenant != null
                ? $"{invite.Tenant.Firstname} {invite.Tenant.Lastname}"
                : "Tenant";

            // Check if this is a placeholder tenant (existing user being invited to join property)
            bool isExistingUserInvite = invite.Tenant != null && !invite.Tenant.UserId.HasValue && !string.IsNullOrEmpty(invite.Tenant.Email);

            // Get landlord and property information
            string landlordName = "Your Landlord";
            string propertyName = "the property";
            string unitName = "";
            string propertyAddress = "";
            string propertyType = "";

            if (invite.Tenant != null)
            {
                // Get tenant entity with full relationships including TenantLeases
                var tenantEntity = await _dataContext.Tenants
                    .Include(t => t.Unit)
                        .ThenInclude(u => u.Property)
                    .Include(t => t.TenantLeases)
                        .ThenInclude(tl => tl.Lease)
                            .ThenInclude(l => l.Unit)
                                .ThenInclude(u => u.Property)
                    .Include(t => t.Organization)
                    .FirstOrDefaultAsync(t => t.Id == invite.Tenant.Id);

                // Try to get property/unit from TenantLeases first (for existing tenants being added to leases)
                if (tenantEntity?.TenantLeases != null && tenantEntity.TenantLeases.Any())
                {
                    var tenantLease = tenantEntity.TenantLeases
                        .OrderByDescending(tl => tl.CreatedAt)
                        .FirstOrDefault();

                    if (tenantLease?.Lease?.Unit?.Property != null)
                    {
                        var property = tenantLease.Lease.Unit.Property;
                        propertyName = property.Name ?? "the property";
                        propertyAddress = property.StreetAddress ?? "";
                        propertyType = property.PropertyType.ToString();

                        // Get unit name if multi-unit property
                        if (tenantLease.Lease.Unit != null &&
                            (propertyType.Equals("MultiUnit", StringComparison.OrdinalIgnoreCase) ||
                             propertyType.Equals("Multi-Unit", StringComparison.OrdinalIgnoreCase)))
                        {
                            unitName = tenantLease.Lease.Unit.Name ?? "";
                        }
                    }
                }
                // Fallback to tenant's direct Unit relationship
                else if (tenantEntity?.Unit?.Property != null)
                {
                    var property = tenantEntity.Unit.Property;
                    propertyName = property.Name ?? "the property";
                    propertyAddress = property.StreetAddress ?? "";
                    propertyType = property.PropertyType.ToString();

                    // Get unit name if multi-unit property
                    if (tenantEntity.Unit != null &&
                        (propertyType.Equals("MultiUnit", StringComparison.OrdinalIgnoreCase) ||
                         propertyType.Equals("Multi-Unit", StringComparison.OrdinalIgnoreCase)))
                    {
                        unitName = tenantEntity.Unit.Name ?? "";
                    }
                }

                // Get landlord name from CreatedByUser
                var landlord = await _userRepository.GetUser(invite.CreatedBy);
                if (landlord != null)
                {
                    landlordName = $"{landlord.FirstName} {landlord.LastName}".Trim();
                    if (string.IsNullOrEmpty(landlordName))
                    {
                        landlordName = landlord.Email ?? "Your Landlord";
                    }
                }
            }

            _logger.LogInformation("[TenantInviteService] Email details - isExistingUserInvite: {IsExisting}, Landlord: {Landlord}, Property: {Property}",
                isExistingUserInvite, landlordName, propertyName);

            string subject;
            string body;

            if (isExistingUserInvite)
            {
                // Format property reference with unit name if multi-unit
                string propertyRef;
                if (!string.IsNullOrEmpty(unitName))
                {
                    propertyRef = $"{propertyName} - {unitName}";
                }
                else
                {
                    propertyRef = propertyName;
                }

                // Email for existing users - invite to join property
                subject = $"Invitation to Join {propertyRef} on Property Peace";
                var propertyInfo = !string.IsNullOrEmpty(propertyAddress)
                    ? $"{propertyRef} at {propertyAddress}"
                    : propertyRef;

                body = $@"
Hello {tenantName},

{landlordName} has invited you to join {propertyInfo} on Property Peace, a property management platform.

Click the link below to accept the invitation and connect your account to this property:
{inviteUrl}

Once you accept, you'll be able to:
• View lease details and payment history for this property
• Submit and track maintenance requests
• Communicate with {landlordName}
• Access important documents and updates

This invitation will expire on {invite.ExpiresAt:MMMM dd, yyyy}.

If you did not expect this invitation, please ignore this email.

Best regards,
Property Peace Team
";
            }
            else
            {
                // Email for new users - create account
                var propertyInfo = !string.IsNullOrEmpty(propertyAddress)
                    ? $"{propertyName} at {propertyAddress}"
                    : propertyName;

                subject = $"Invitation to Create Your Account for {propertyName} on Property Peace";
                body = $@"
Hello {tenantName},

{landlordName} has invited you to create an account on Property Peace for {propertyInfo}.

Click the link below to create your account:
{inviteUrl}

Once you create your account, you'll be able to:
• View lease details and payment history for this property
• Submit and track maintenance requests
• Communicate with {landlordName}
• Access important documents and updates

This invitation will expire on {invite.ExpiresAt:MMMM dd, yyyy}.

If you did not expect this invitation, please ignore this email.

Best regards,
Property Peace Team
";
            }

            try
            {
                // Build content based on whether this is for existing user or new user
                string emailTitle;
                string emailGreeting;
                string emailMessage;
                string buttonText;
                string infoBoxTitle;
                string infoBoxContent;

                if (isExistingUserInvite)
                {
                    // Format property reference with unit name if multi-unit
                    string propertyRef;
                    if (!string.IsNullOrEmpty(unitName))
                    {
                        propertyRef = $"{propertyName} - {unitName}";
                    }
                    else
                    {
                        propertyRef = propertyName;
                    }

                    var propertyInfo = !string.IsNullOrEmpty(propertyAddress)
                        ? $"{propertyRef} at {propertyAddress}"
                        : propertyRef;

                    emailTitle = $"Invitation to Join {propertyRef}";
                    emailGreeting = $"Hello {tenantName},";
                    emailMessage = $"<strong>{landlordName}</strong> has invited you to join <strong>{propertyRef}</strong>{(string.IsNullOrEmpty(propertyAddress) ? "" : $" at {propertyAddress}")} on <strong>Property Peace</strong>, a modern property management platform.";
                    buttonText = "Accept Invitation";
                    infoBoxTitle = "Once you accept, you'll be able to:";
                    infoBoxContent = $"• View lease details and payment history for this property<br>• Submit and track maintenance requests<br>• Communicate with {landlordName}<br>• Access important documents and updates";
                }
                else
                {
                    var propertyInfo = !string.IsNullOrEmpty(propertyAddress)
                        ? $"{propertyName} at {propertyAddress}"
                        : propertyName;

                    emailTitle = $"Invitation to Create Your Account for {propertyName}";
                    emailGreeting = $"Hello {tenantName},";
                    emailMessage = $"<strong>{landlordName}</strong> has invited you to create an account on <strong>Property Peace</strong> for <strong>{propertyInfo}</strong>. A modern property management platform designed to simplify your rental experience.";
                    buttonText = "Create Your Account";
                    infoBoxTitle = "Once you create your account, you'll be able to:";
                    infoBoxContent = $"• View lease details and payment history for this property<br>• Submit and track maintenance requests<br>• Communicate with {landlordName}<br>• Access important documents and updates";
                }

                // Create HTML email content with enhanced styling
                var htmlContent = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f5f5f5;
            padding: 20px;
        }}
        .email-wrapper {{
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }}
        .header {{
            background-color: #ffffff;
            color: #333333;
            padding: 24px 30px;
            text-align: center;
            border-bottom: 1px solid #e8e8e8;
        }}
        .logo-container {{
            margin-bottom: 15px;
        }}
        .logo {{
            max-width: 180px;
            height: auto;
            display: block;
            margin: 0 auto;
        }}
        .content {{
            padding: 40px 30px;
            background-color: #ffffff;
        }}
        .content h2 {{
            font-size: 24px;
            font-weight: 600;
            color: #1a1a1a;
            margin-bottom: 20px;
            line-height: 1.3;
        }}
        .content p {{
            font-size: 16px;
            color: #4a4a4a;
            margin-bottom: 16px;
            line-height: 1.6;
        }}
        .greeting {{
            font-size: 18px;
            color: #1a1a1a;
            font-weight: 500;
            margin-bottom: 20px;
        }}
        .button-container {{
            text-align: center;
            margin: 32px 0;
        }}
        .button {{
            display: inline-block;
            padding: 16px 40px;
            background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            letter-spacing: 0.5px;
            box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
            transition: all 0.3s ease;
            text-align: center;
        }}
        .button:hover {{
            background: linear-gradient(135deg, #1565c0 0%, #0d47a1 100%);
            box-shadow: 0 6px 16px rgba(25, 118, 210, 0.4);
            transform: translateY(-2px);
        }}
        .info-box {{
            background-color: #f8f9fa;
            border-left: 4px solid #1976d2;
            padding: 16px 20px;
            margin: 24px 0;
            border-radius: 4px;
        }}
        .info-box p {{
            margin: 0;
            font-size: 14px;
            color: #666666;
        }}
        .expiry-notice {{
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 14px 18px;
            margin: 24px 0;
            border-radius: 4px;
        }}
        .expiry-notice p {{
            margin: 0;
            font-size: 14px;
            color: #856404;
            font-weight: 500;
        }}
        .signature {{
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid #e0e0e0;
        }}
        .signature p {{
            margin: 4px 0;
            color: #4a4a4a;
        }}
        .signature .team-name {{
            font-weight: 600;
            color: #1976d2;
        }}
        .footer {{
            background-color: #042238;
            padding: 28px 30px;
            text-align: center;
        }}
        .footer p {{
            font-size: 12px;
            color: rgba(255,255,255,0.65);
            margin: 0;
        }}
        @media only screen and (max-width: 600px) {{
            body {{
                padding: 10px;
            }}
            .header {{
                padding: 30px 20px;
            }}
            .header h1 {{
                font-size: 28px;
            }}
            .content {{
                padding: 30px 20px;
            }}
            .content h2 {{
                font-size: 22px;
            }}
            .button {{
                padding: 14px 32px;
                font-size: 15px;
            }}
        }}
    </style>
</head>
<body>
    <div class='email-wrapper'>
        <div class='header'>
            <div class='logo-container'>
                <img src='https://propertypeace.io/images/logos/property-peace-dark.png' alt='Property Peace' class='logo' style='max-width: 180px; height: auto; display: block; margin: 0 auto;' />
            </div>
        </div>
        <div class='content'>
            <h2>{emailTitle}</h2>
            <p class='greeting'>{emailGreeting}</p>
            <p>{emailMessage}</p>

            <div class='button-container'>
                <a href='{inviteUrl}' class='button'>{buttonText}</a>
            </div>

            <div class='info-box'>
                <p><strong>{infoBoxTitle}</strong></p>
                <p style='margin-top: 8px;'>{infoBoxContent}</p>
            </div>

            <div class='expiry-notice'>
                <p>⏰ This invitation will expire on <strong>{invite.ExpiresAt:MMMM dd, yyyy}</strong></p>
            </div>

            <p style='color: #666666; font-size: 14px;'>If you did not expect this invitation, please ignore this email.</p>

            <div class='signature'>
                <p>Best regards,</p>
                <p class='team-name'>Property Peace Team</p>
            </div>
        </div>
        <div class='footer'>
            <p>This is an automated email from Property Peace. Please do not reply to this message.</p>
        </div>
    </div>
</body>
</html>";

                var emailSent = await _emailService.SendEmailAsync(
                    to: invite.Email,
                    subject: subject,
                    htmlContent: htmlContent,
                    plainTextContent: body
                );

                if (emailSent)
                {
                    _logger.LogInformation("Tenant invite email sent successfully to {Email}", invite.Email);
                }
                else
                {
                    _logger.LogWarning("Failed to send tenant invite email to {Email}", invite.Email);
                }
            }
            catch (Exception ex)
            {
                // Log error but don't fail invite creation
                _logger.LogError(ex, "Error sending tenant invite email to {Email}: {Error}", invite.Email, ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> AcceptInviteForExistingUser(AcceptTenantInviteDto dto, long userId)
        {
            try
            {
                _logger.LogInformation("[TenantInviteService] AcceptInviteForExistingUser called for UserId: {UserId}, Email: {Email}, Token: {Token}",
                    userId, dto.Email, dto.InviteToken);

                // Validate invite token
                var inviteValidation = await ValidateInviteToken(dto.InviteToken);
                if (!inviteValidation.Success || inviteValidation.Data == null || !inviteValidation.Data.IsValid)
                {
                    _logger.LogWarning("[TenantInviteService] Invalid invite token: {Token}", dto.InviteToken);
                    return ServiceResponse<bool>.CreateError(
                        inviteValidation.Data?.Message ?? "Invalid or expired invite token"
                    );
                }

                var invite = await _tenantInviteRepository.GetInviteByToken(dto.InviteToken);
                if (invite == null)
                {
                    return ServiceResponse<bool>.CreateError("Invite not found");
                }

                var providedEmail = dto.Email?.Trim() ?? string.Empty;
                var inviteEmail = invite.Email?.Trim() ?? string.Empty;

                // Verify email matches invite
                if (!string.Equals(providedEmail, inviteEmail, StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogWarning("[TenantInviteService] Email mismatch. Invite email: {InviteEmail}, Provided email: {Email}",
                        invite.Email, dto.Email);
                    return ServiceResponse<bool>.CreateError("Email does not match the invite");
                }

                // Verify user exists and email matches
                var user = await _userRepository.GetUser(userId);
                if (user == null)
                {
                    return ServiceResponse<bool>.CreateError("User not found");
                }

                if (!string.Equals(user.Email, dto.Email, StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogWarning("[TenantInviteService] User email mismatch. User email: {UserEmail}, Provided email: {Email}",
                        user.Email, dto.Email);
                    return ServiceResponse<bool>.CreateError("Email does not match your account");
                }

                // Get tenant from invite
                var inviteTenant = await _tenantRepository.GetTenantById(invite.TenantId);
                if (inviteTenant == null)
                {
                    return ServiceResponse<bool>.CreateError("Tenant not found");
                }

                // Get tenant entity to access OrganizationId, UnitId, and LeaseId
                var inviteTenantEntity = await _dataContext.Tenants
                    .Include(t => t.Unit)
                        .ThenInclude(u => u.Lease)
                    .Include(t => t.TenantLeases)
                        .ThenInclude(tl => tl.Lease)
                    .FirstOrDefaultAsync(t => t.Id == inviteTenant.Id);

                if (inviteTenantEntity == null)
                {
                    return ServiceResponse<bool>.CreateError("Tenant entity not found");
                }

                var organizationId = inviteTenantEntity.OrganizationId;
                var unitId = inviteTenantEntity.UnitId;
                // Get leaseId from TenantLeases - if tenant is being added to a new lease,
                // the TenantLease might not exist yet, so fall back to Unit.Lease
                var leaseId = inviteTenantEntity.TenantLeases?.FirstOrDefault()?.LeaseId;
                if (!leaseId.HasValue && inviteTenantEntity.Unit?.Lease != null)
                {
                    leaseId = inviteTenantEntity.Unit.Lease.Id;
                }

                // Check if a tenant with this email already exists
                var existingTenant = await _tenantRepository.GetTenantByEmail(dto.Email);
                long finalTenantId;

                if (existingTenant != null)
                {
                    // Update existing tenant with new unitId, orgId, and leaseId
                    _logger.LogInformation("[TenantInviteService] Found existing tenant {TenantId} with email {Email}, updating with new unit/org/lease",
                        existingTenant.Id, dto.Email);

                    var updateTenantDto = new AddTenantDto
                    {
                        Id = existingTenant.Id,
                        UserId = userId, // Link to the user accepting the invite
                        Firstname = existingTenant.Firstname,
                        Lastname = existingTenant.Lastname,
                        Email = existingTenant.Email,
                        PhoneNumber = existingTenant.PhoneNumber,
                        LeaseId = leaseId, // Update with lease from invite
                        UnitId = unitId, // Update with unit from invite
                        OrganizationId = organizationId // Update with org from invite
                    };

                    var updatedTenant = await _tenantRepository.UpdateTenant(existingTenant.Id, updateTenantDto);
                    finalTenantId = existingTenant.Id;

                    // Delete the placeholder tenant from the invite (if it's different)
                    if (inviteTenant.Id != existingTenant.Id && !inviteTenant.UserId.HasValue)
                    {
                        await _tenantRepository.DeleteTenant(inviteTenant.Id);
                        _logger.LogInformation("[TenantInviteService] Deleted placeholder tenant {PlaceholderTenantId}", inviteTenant.Id);
                    }
                }
                else
                {
                    // No existing tenant found - check if invite tenant is a placeholder
                    if (inviteTenant.UserId.HasValue)
                    {
                        _logger.LogWarning("[TenantInviteService] Tenant {TenantId} already has UserId: {UserId}",
                            inviteTenant.Id, inviteTenant.UserId.Value);
                        return ServiceResponse<bool>.CreateError("This tenant is already connected to an account");
                    }

                    // Update the placeholder tenant with the user's ID
                    var updateTenantDto = new AddTenantDto
                    {
                        Id = inviteTenant.Id,
                        UserId = userId,
                        Firstname = inviteTenant.Firstname,
                        Lastname = inviteTenant.Lastname,
                        Email = inviteTenant.Email,
                        PhoneNumber = inviteTenant.PhoneNumber,
                        LeaseId = leaseId,
                        UnitId = unitId,
                        OrganizationId = organizationId
                    };

                    var updatedTenant = await _tenantRepository.UpdateTenant(inviteTenant.Id, updateTenantDto);
                    finalTenantId = inviteTenant.Id;
                }

                // Set user's CurrentOrganizationId to tenant's OrganizationId if tenant has one
                if (organizationId.HasValue)
                {
                    await _userRepository.UpdateCurrentOrganizationIdAsync(userId, organizationId.Value);
                    _logger.LogInformation("[TenantInviteService] Set CurrentOrganizationId to {OrganizationId} for user {UserId}",
                        organizationId.Value, userId);
                }

                // Mark invite as used
                await MarkInviteAsUsed(dto.InviteToken);

                _logger.LogInformation("[TenantInviteService] Successfully accepted invite for existing user {UserId}, connected to tenant {TenantId}",
                    userId, finalTenantId);

                return new ServiceResponse<bool> { Data = true, Success = true };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[TenantInviteService] Error accepting invite for existing user");
                return ServiceResponse<bool>.CreateError("Error accepting invite", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> AcceptInviteByEmail(AcceptTenantInviteDto dto)
        {
            try
            {
                _logger.LogInformation("[TenantInviteService] AcceptInviteByEmail called for Email: {Email}, Token: {Token}",
                    dto.Email, dto.InviteToken);

                // Validate invite token
                var inviteValidation = await ValidateInviteToken(dto.InviteToken);
                if (!inviteValidation.Success || inviteValidation.Data == null || !inviteValidation.Data.IsValid)
                {
                    _logger.LogWarning("[TenantInviteService] Invalid invite token: {Token}", dto.InviteToken);
                    return ServiceResponse<bool>.CreateError(
                        inviteValidation.Data?.Message ?? "Invalid or expired invite token"
                    );
                }

                var invite = await _tenantInviteRepository.GetInviteByToken(dto.InviteToken);
                if (invite == null)
                {
                    return ServiceResponse<bool>.CreateError("Invite not found");
                }

                var providedEmail = dto.Email?.Trim() ?? string.Empty;
                var inviteEmail = invite.Email?.Trim() ?? string.Empty;

                // Verify email matches invite
                if (!string.Equals(providedEmail, inviteEmail, StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogWarning("[TenantInviteService] Email mismatch. Invite email: {InviteEmail}, Provided email: {Email}",
                        invite.Email, dto.Email);
                    return ServiceResponse<bool>.CreateError("Email does not match the invite");
                }

                // Check if invite is already accepted
                if (invite.IsUsed)
                {
                    return ServiceResponse<bool>.CreateError("This invite has already been accepted");
                }

                // Get tenant from invite
                var inviteTenant = await _tenantRepository.GetTenantById(invite.TenantId);
                if (inviteTenant == null)
                {
                    return ServiceResponse<bool>.CreateError("Tenant not found");
                }

                // Get tenant entity to access OrganizationId, UnitId, and LeaseId
                var inviteTenantEntity = await _dataContext.Tenants
                    .Include(t => t.Unit)
                    .Include(t => t.TenantLeases)
                    .FirstOrDefaultAsync(t => t.Id == inviteTenant.Id);

                if (inviteTenantEntity == null)
                {
                    return ServiceResponse<bool>.CreateError("Tenant entity not found");
                }

                var organizationId = inviteTenantEntity.OrganizationId;
                var unitId = inviteTenantEntity.UnitId;
                var leaseId = inviteTenantEntity.TenantLeases?.FirstOrDefault()?.LeaseId;

                // Try to find user by email (user may or may not exist)
                var user = await _userRepository.GetUserByEmailAsync(dto.Email);

                if (user != null)
                {
                    // User exists - check if a tenant with this email already exists
                    var existingTenant = await _tenantRepository.GetTenantByEmail(dto.Email);

                    if (existingTenant != null)
                    {
                        // Update existing tenant with new unitId, orgId, and leaseId
                        _logger.LogInformation("[TenantInviteService] Found existing tenant {TenantId} with email {Email}, updating with new unit/org/lease",
                            existingTenant.Id, dto.Email);

                        var updateTenantDto = new AddTenantDto
                        {
                            Id = existingTenant.Id,
                            UserId = user.Id, // Link to the user accepting the invite
                            Firstname = existingTenant.Firstname,
                            Lastname = existingTenant.Lastname,
                            Email = existingTenant.Email,
                            PhoneNumber = existingTenant.PhoneNumber,
                            LeaseId = leaseId, // Update with lease from invite
                            UnitId = unitId, // Update with unit from invite
                            OrganizationId = organizationId // Update with org from invite
                        };

                        var updatedTenant = await _tenantRepository.UpdateTenant(existingTenant.Id, updateTenantDto);

                        // Delete the placeholder tenant from the invite (if it's different)
                        if (inviteTenant.Id != existingTenant.Id && !inviteTenant.UserId.HasValue)
                        {
                            await _tenantRepository.DeleteTenant(inviteTenant.Id);
                            _logger.LogInformation("[TenantInviteService] Deleted placeholder tenant {PlaceholderTenantId}", inviteTenant.Id);
                        }

                        // Set user's CurrentOrganizationId to tenant's OrganizationId if tenant has one
                        if (organizationId.HasValue)
                        {
                            await _userRepository.UpdateCurrentOrganizationIdAsync(user.Id, organizationId.Value);
                            _logger.LogInformation("[TenantInviteService] Set CurrentOrganizationId to {OrganizationId} for user {UserId}",
                                organizationId.Value, user.Id);
                        }

                        _logger.LogInformation("[TenantInviteService] Successfully accepted invite and updated existing tenant {TenantId} for user {UserId}",
                            existingTenant.Id, user.Id);
                    }
                    else
                    {
                        // No existing tenant found - check if invite tenant is a placeholder
                        if (inviteTenant.UserId.HasValue)
                        {
                            _logger.LogWarning("[TenantInviteService] Tenant {TenantId} already has UserId: {UserId}",
                                inviteTenant.Id, inviteTenant.UserId.Value);
                            // Still mark invite as used even if already linked
                            await MarkInviteAsUsed(dto.InviteToken);
                            return ServiceResponse<bool>.CreateSuccess(true, "Invite accepted. Tenant is already connected to an account.");
                        }

                        // Update the placeholder tenant with the user's ID
                        var updateTenantDto = new AddTenantDto
                        {
                            Id = inviteTenant.Id,
                            UserId = user.Id,
                            Firstname = inviteTenant.Firstname,
                            Lastname = inviteTenant.Lastname,
                            Email = inviteTenant.Email,
                            PhoneNumber = inviteTenant.PhoneNumber,
                            LeaseId = leaseId,
                            UnitId = unitId,
                            OrganizationId = organizationId
                        };

                        var updatedTenant = await _tenantRepository.UpdateTenant(inviteTenant.Id, updateTenantDto);

                        // Set user's CurrentOrganizationId to tenant's OrganizationId if tenant has one
                        if (organizationId.HasValue)
                        {
                            await _userRepository.UpdateCurrentOrganizationIdAsync(user.Id, organizationId.Value);
                            _logger.LogInformation("[TenantInviteService] Set CurrentOrganizationId to {OrganizationId} for user {UserId}",
                                organizationId.Value, user.Id);
                        }

                        _logger.LogInformation("[TenantInviteService] Successfully accepted invite and linked to existing user {UserId}, connected to tenant {TenantId}",
                            user.Id, updatedTenant?.Id ?? 0);
                    }
                }
                else
                {
                    // User must exist before the invite can be consumed. Leaving the token unused lets the signup/login flow complete acceptance after account creation.
                    _logger.LogInformation("[TenantInviteService] User not found for email {Email}; leaving invite unused until the tenant creates an account.",
                        providedEmail);
                    return ServiceResponse<bool>.CreateError(
                        "Account required",
                        "Create or log in to a tenant account with this email before accepting the invite."
                    );
                }

                // Mark invite as used
                await MarkInviteAsUsed(dto.InviteToken);

                return new ServiceResponse<bool> { Data = true, Success = true, Message = "Invite accepted successfully" };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[TenantInviteService] Error accepting invite by email");
                return ServiceResponse<bool>.CreateError("Error accepting invite", ex.Message);
            }
        }

        private static string GenerateSecureToken()
        {
            // Generate a secure random token
            var bytes = new byte[32];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(bytes);
            }
            // Convert to Base64 URL-safe string
            return Convert.ToBase64String(bytes)
                .TrimEnd('=') // Remove padding
                .Replace('+', '-')
                .Replace('/', '_');
        }
    }
}
