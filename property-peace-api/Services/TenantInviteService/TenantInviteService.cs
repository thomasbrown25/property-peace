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

        public async Task<ServiceResponse<LoadTenantInviteDto>> CreateInvite(AddTenantInviteDto invite, long userId, long organizationId)
        {
            try
            {
                if (!await CanManageTenantsAsync(userId, organizationId))
                    return ServiceResponse<LoadTenantInviteDto>.CreateError("You do not have permission to manage tenants for this organization", statusCode: 403);

                var tenant = await _dataContext.Tenants.AsNoTracking()
                    .FirstOrDefaultAsync(t => t.Id == invite.TenantId && t.OrganizationId == organizationId && !t.IsDeleted);
                if (tenant == null)
                    return ServiceResponse<LoadTenantInviteDto>.CreateError("Tenant not found", statusCode: 404);

                if (string.IsNullOrWhiteSpace(tenant.Email) || string.IsNullOrWhiteSpace(invite.Email)
                    || !string.Equals(tenant.Email.Trim(), invite.Email.Trim(), StringComparison.OrdinalIgnoreCase))
                    return ServiceResponse<LoadTenantInviteDto>.CreateError("Invite email must match the tenant's saved email address", statusCode: 400);

                var existingInvites = await _tenantInviteRepository.GetInvitesByTenantId(invite.TenantId, organizationId);
                if (existingInvites.Any(i => !i.IsUsed && i.ExpiresAt > DateTime.UtcNow))
                    return ServiceResponse<LoadTenantInviteDto>.CreateError("A valid invite already exists for this tenant", statusCode: 409);

                var token = GenerateSecureToken();
                var created = await _tenantInviteRepository.CreateInvite(invite, userId, organizationId, token, DateTime.UtcNow.AddDays(7));
                if (!await SendInviteEmailAsync(created, token))
                {
                    await _tenantInviteRepository.DeleteInvite(created.Id);
                    return ServiceResponse<LoadTenantInviteDto>.CreateError("Portal invite could not be delivered. Verify the tenant email and try again.", statusCode: 502);
                }

                var existingUser = await _userRepository.GetUserByEmailAsync(invite.Email.Trim());
                if (existingUser != null)
                {
                    try
                    {
                        await _notificationService.CreateNotification(new CreateNotificationDto
                        {
                            UserId = existingUser.Id, Type = ENotificationType.TenantInvite,
                            Title = "Portal invitation", Message = "You've been invited to connect your account to a lease.",
                            RelatedId = created.Id, SendEmail = false, SendSMS = false
                        });
                    }
                    catch (Exception ex) { _logger.LogWarning(ex, "Failed to create in-app notification for tenant invite"); }
                }

                SanitizeManagementInvite(created);
                return ServiceResponse<LoadTenantInviteDto>.CreateSuccess(created, "Portal invite sent");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating tenant invite");
                return ServiceResponse<LoadTenantInviteDto>.CreateError("Error creating invite");
            }
        }

        public async Task<ServiceResponse<ValidateInviteTokenDto>> ValidateInviteToken(string token)
        {
            try
            {
                var invite = await _tenantInviteRepository.GetInviteByToken(token);

                if (invite == null || invite.OrganizationId <= 0
                    || !await InviteMatchesCurrentTenantEmailAsync(invite))
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
                        .FirstOrDefaultAsync(t => t.Id == tenantId && t.OrganizationId == invite.OrganizationId);

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
                return ServiceResponse<ValidateInviteTokenDto>.CreateError("Error validating invite");
            }
        }

        public async Task<ServiceResponse<List<LoadTenantInviteDto>>> GetInvitesByTenantId(long tenantId, long userId, long organizationId)
        {
            try
            {
                if (!await CanManageTenantsAsync(userId, organizationId))
                    return ServiceResponse<List<LoadTenantInviteDto>>.CreateError("You do not have permission to manage tenants for this organization", statusCode: 403);
                if (!await TenantBelongsToOrganizationAsync(tenantId, organizationId))
                    return ServiceResponse<List<LoadTenantInviteDto>>.CreateError("Tenant not found", statusCode: 404);
                var invites = await _tenantInviteRepository.GetInvitesByTenantId(tenantId, organizationId);
                foreach (var invite in invites) SanitizeManagementInvite(invite);
                return ServiceResponse<List<LoadTenantInviteDto>>.CreateSuccess(invites);
            }
            catch (Exception ex) { _logger.LogError(ex, "Error getting tenant invites"); return ServiceResponse<List<LoadTenantInviteDto>>.CreateError("Error getting invites"); }
        }

        public async Task<ServiceResponse<List<LoadTenantInviteDto>>> GetInvitesByLandlordId(long userId, long organizationId)
        {
            try
            {
                if (!await CanManageTenantsAsync(userId, organizationId))
                    return ServiceResponse<List<LoadTenantInviteDto>>.CreateError("You do not have permission to manage tenants for this organization", statusCode: 403);
                var invites = await _tenantInviteRepository.GetInvitesByLandlordId(userId, organizationId);
                foreach (var invite in invites) SanitizeManagementInvite(invite);
                return ServiceResponse<List<LoadTenantInviteDto>>.CreateSuccess(invites);
            }
            catch (Exception ex) { _logger.LogError(ex, "Error getting tenant invites"); return ServiceResponse<List<LoadTenantInviteDto>>.CreateError("Error getting invites"); }
        }

        public async Task<ServiceResponse<bool>> DeleteInvite(long inviteId, long userId, long organizationId)
        {
            try
            {
                if (!await CanManageTenantsAsync(userId, organizationId))
                    return ServiceResponse<bool>.CreateError("You do not have permission to manage tenants for this organization", statusCode: 403);
                var invite = await _tenantInviteRepository.GetInviteById(inviteId, organizationId);
                if (invite == null || invite.OrganizationId != organizationId || !await TenantBelongsToOrganizationAsync(invite.TenantId, organizationId))
                    return ServiceResponse<bool>.CreateError("Invite not found", statusCode: 404);
                return ServiceResponse<bool>.CreateSuccess(await _tenantInviteRepository.DeleteInvite(inviteId));
            }
            catch (Exception ex) { _logger.LogError(ex, "Error deleting tenant invite"); return ServiceResponse<bool>.CreateError("Error deleting invite"); }
        }

        public async Task<ServiceResponse<bool>> ResendInvite(long inviteId, long userId, long organizationId)
        {
            try
            {
                if (!await CanManageTenantsAsync(userId, organizationId))
                    return ServiceResponse<bool>.CreateError("You do not have permission to manage tenants for this organization", statusCode: 403);
                var invite = await _tenantInviteRepository.GetInviteById(inviteId, organizationId);
                if (invite == null || invite.OrganizationId != organizationId || !await InviteMatchesCurrentTenantEmailAsync(invite))
                    return ServiceResponse<bool>.CreateError("Invite not found", statusCode: 404);

                var request = new AddTenantInviteDto { TenantId = invite.TenantId, Email = invite.Email };
                var token = GenerateSecureToken();
                var replacement = await _tenantInviteRepository.CreateInvite(request, userId, organizationId, token, DateTime.UtcNow.AddDays(7));
                if (!await SendInviteEmailAsync(replacement, token))
                {
                    await _tenantInviteRepository.DeleteInvite(replacement.Id);
                    return ServiceResponse<bool>.CreateError("Portal invite could not be delivered. The existing invite remains valid.", statusCode: 502);
                }
                await _tenantInviteRepository.DeleteInvite(invite.Id);
                return ServiceResponse<bool>.CreateSuccess(true);
            }
            catch (Exception ex) { _logger.LogError(ex, "Error resending tenant invite"); return ServiceResponse<bool>.CreateError("Error resending invite"); }
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
                return ServiceResponse<bool>.CreateError("Error marking invite as used");
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
                return ServiceResponse<LoadTenantInviteDto?>.CreateError("Error getting pending invite");
            }
        }

        private async Task<bool> CanManageTenantsAsync(long userId, long organizationId)
        {
            var member = await _dataContext.OrganizationMembers.AsNoTracking()
                .Where(m => m.UserId == userId && m.OrganizationId == organizationId && m.IsActive
                    && m.Organization.IsActive && !m.Organization.IsDeleted)
                .Select(m => new { m.Role, m.CanManageTenants })
                .SingleOrDefaultAsync();
            return member is not null && (string.Equals(member.Role, "Owner", StringComparison.OrdinalIgnoreCase)
                || string.Equals(member.Role, "Admin", StringComparison.OrdinalIgnoreCase) || member.CanManageTenants);
        }

        private Task<bool> TenantBelongsToOrganizationAsync(long tenantId, long organizationId) =>
            _dataContext.Tenants.AsNoTracking().AnyAsync(t => t.Id == tenantId && t.OrganizationId == organizationId && !t.IsDeleted);

        private async Task<bool> InviteMatchesCurrentTenantEmailAsync(LoadTenantInviteDto invite)
        {
            if (invite.OrganizationId <= 0 || string.IsNullOrWhiteSpace(invite.Email)) return false;
            var currentEmail = await _dataContext.Tenants.AsNoTracking()
                .Where(t => t.Id == invite.TenantId && t.OrganizationId == invite.OrganizationId && !t.IsDeleted)
                .Select(t => t.Email)
                .SingleOrDefaultAsync();
            return !string.IsNullOrWhiteSpace(currentEmail)
                && string.Equals(currentEmail.Trim(), invite.Email.Trim(), StringComparison.OrdinalIgnoreCase);
        }

        private static void SanitizeManagementInvite(LoadTenantInviteDto invite)
        {
            invite.InviteToken = string.Empty;
            invite.CreatedBy = 0;
            invite.Tenant = null;
        }

        private async Task<bool> SendInviteEmailAsync(LoadTenantInviteDto invite, string token)
        {
            _logger.LogInformation("[TenantInviteService] Preparing tenant invite delivery");

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
                    .FirstOrDefaultAsync(t => t.Id == invite.Tenant.Id && t.OrganizationId == invite.OrganizationId && !t.IsDeleted);

                // Try to get property/unit from TenantLeases first (for existing tenants being added to leases)
                if (tenantEntity?.TenantLeases != null && tenantEntity.TenantLeases.Any())
                {
                    var tenantLease = tenantEntity.TenantLeases
                        .Where(tl => tl.Lease?.Unit?.Property?.OrganizationId == invite.OrganizationId)
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
                else if (tenantEntity?.Unit?.Property != null && tenantEntity.Unit.Property.OrganizationId == invite.OrganizationId)
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

            _logger.LogInformation("[TenantInviteService] Tenant invite email content prepared");

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

                if (emailSent) _logger.LogInformation("Tenant invite email sent successfully");
                else _logger.LogWarning("Tenant invite email delivery failed");
                return emailSent;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending tenant invite email");
                return false;
            }
        }

        public Task<ServiceResponse<bool>> AcceptInviteForExistingUser(AcceptTenantInviteDto dto, long userId) =>
            AcceptInviteCoreAsync(dto, userId);

        public Task<ServiceResponse<bool>> AcceptInviteByEmail(AcceptTenantInviteDto dto) =>
            AcceptInviteCoreAsync(dto, null);

        private async Task<ServiceResponse<bool>> AcceptInviteCoreAsync(AcceptTenantInviteDto dto, long? authenticatedUserId)
        {
            try
            {
                var validation = await ValidateInviteToken(dto.InviteToken);
                if (!validation.Success || validation.Data?.IsValid != true)
                    return ServiceResponse<bool>.CreateError(validation.Data?.Message ?? "Invalid or expired invite token");

                var invite = await _tenantInviteRepository.GetInviteByToken(dto.InviteToken);
                if (invite == null || invite.OrganizationId <= 0 || !await InviteMatchesCurrentTenantEmailAsync(invite))
                    return ServiceResponse<bool>.CreateError("Invite not found");
                var organizationId = invite.OrganizationId;

                if (!string.Equals(dto.Email?.Trim(), invite.Email?.Trim(), StringComparison.OrdinalIgnoreCase))
                    return ServiceResponse<bool>.CreateError("Email does not match the invite");

                long acceptingUserId;
                string? acceptingUserEmail;
                if (authenticatedUserId.HasValue)
                {
                    var authenticatedUser = await _userRepository.GetUser(authenticatedUserId.Value);
                    if (authenticatedUser == null)
                        return ServiceResponse<bool>.CreateError("Account required", "Log in before accepting the invite.");
                    acceptingUserId = authenticatedUser.Id;
                    acceptingUserEmail = authenticatedUser.Email;
                }
                else
                {
                    var emailUser = await _userRepository.GetUserByEmailAsync(dto.Email);
                    if (emailUser == null)
                        return ServiceResponse<bool>.CreateError("Account required", "Create or log in to a tenant account with this email before accepting the invite.");
                    acceptingUserId = emailUser.Id;
                    acceptingUserEmail = emailUser.Email;
                }
                if (!string.Equals(acceptingUserEmail?.Trim(), dto.Email?.Trim(), StringComparison.OrdinalIgnoreCase))
                    return ServiceResponse<bool>.CreateError("Email does not match your account");

                var invitedTenant = await _dataContext.Tenants
                    .Include(t => t.TenantLeases)
                    .FirstOrDefaultAsync(t => t.Id == invite.TenantId && t.OrganizationId == organizationId && !t.IsDeleted);
                if (invitedTenant == null)
                    return ServiceResponse<bool>.CreateError("Tenant not found");

                var existing = await _tenantRepository.GetTenantByEmail(dto.Email, organizationId);
                var targetId = existing?.Id ?? invitedTenant.Id;
                var target = existing ?? await _tenantRepository.GetTenantById(invitedTenant.Id, organizationId);
                if (target == null) return ServiceResponse<bool>.CreateError("Tenant not found");
                if (target.UserId.HasValue && target.UserId.Value != acceptingUserId)
                    return ServiceResponse<bool>.CreateError("This tenant is already connected to another account");

                var leaseId = invitedTenant.TenantLeases.OrderByDescending(tl => tl.CreatedAt).Select(tl => (long?)tl.LeaseId).FirstOrDefault();
                var updated = await _tenantRepository.UpdateTenant(targetId, new AddTenantDto
                {
                    Id = targetId, UserId = acceptingUserId, Firstname = target.Firstname, Lastname = target.Lastname,
                    Email = target.Email, PhoneNumber = target.PhoneNumber, IsActive = target.IsActive,
                    LeaseId = leaseId ?? target.LeaseId, UnitId = invitedTenant.UnitId ?? target.UnitId,
                    OrganizationId = organizationId
                });
                if (updated == null) return ServiceResponse<bool>.CreateError("Unable to connect tenant account");

                if (targetId != invitedTenant.Id && !invitedTenant.UserId.HasValue)
                    await _tenantRepository.DeleteTenant(invitedTenant.Id);
                await _userRepository.UpdateCurrentOrganizationIdAsync(acceptingUserId, organizationId);
                await _tenantInviteRepository.MarkInviteAsUsed(dto.InviteToken);
                return ServiceResponse<bool>.CreateSuccess(true, "Invite accepted successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error accepting tenant invite");
                return ServiceResponse<bool>.CreateError("Error accepting invite");
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
