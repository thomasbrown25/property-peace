using System.Security.Cryptography;
using brownstone_hub_api.Dtos.ApplicationInvite;
using brownstone_hub_api.Dtos.Application;
using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Repositories.ApplicationInvites;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Repositories.Applications;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Services.ApplicationPdfService;
using brownstone_hub_api.Services.NotificationService;
using Azure.Storage.Blobs;
using brownstone_hub_api.Services.AzureBlobService;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting;

namespace brownstone_hub_api.Services.ApplicationInviteService
{
    public class ApplicationInviteService(
        IApplicationInviteRepository applicationInviteRepository,
        IPropertyRepository propertyRepository,
        IUserRepository userRepository,
        IApplicationRepository applicationRepository,
        IApplicationPdfService applicationPdfService,
        BlobServiceClient blobServiceClient,
        IAzureBlobService azureBlobService,
        IConfiguration configuration,
        IEmailService emailService,
        INotificationService notificationService,
        IHttpContextAccessor httpContextAccessor,
        IWebHostEnvironment environment,
        ILogger<ApplicationInviteService> logger) : IApplicationInviteService
    {
        private readonly IApplicationInviteRepository _applicationInviteRepository = applicationInviteRepository;
        private readonly IPropertyRepository _propertyRepository = propertyRepository;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly IApplicationRepository _applicationRepository = applicationRepository;
        private readonly IApplicationPdfService _applicationPdfService = applicationPdfService;
        private readonly BlobServiceClient _blobServiceClient = blobServiceClient;
        private readonly IAzureBlobService _azureBlobService = azureBlobService;
        private readonly IConfiguration _configuration = configuration;
        private readonly IEmailService _emailService = emailService;
        private readonly INotificationService _notificationService = notificationService;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly IWebHostEnvironment _environment = environment;
        private readonly ILogger<ApplicationInviteService> _logger = logger;

        private async Task<long?> GetCurrentUserIdAsync()
        {
            var user = await _userRepository.GetCurrentUser();
            return user?.Id;
        }

        private long? GetOrganizationIdFromContext()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }

        public async Task<ServiceResponse<LoadApplicationInviteDto>> CreateInvite(AddApplicationInviteDto invite)
        {
            try
            {
                var landlordId = await GetCurrentUserIdAsync();
                if (!landlordId.HasValue)
                {
                    return ServiceResponse<LoadApplicationInviteDto>.CreateError("User not found", "User not authenticated", "", 401);
                }

                // Verify property exists and belongs to this landlord
                var property = await _propertyRepository.GetPropertyById(invite.PropertyId);
                if (property == null)
                {
                    return ServiceResponse<LoadApplicationInviteDto>.CreateError("Property not found or you don't have access");
                }

                // Verify unit if provided
                if (invite.UnitId.HasValue)
                {
                    var unit = property.Units?.FirstOrDefault(u => u.Id == invite.UnitId.Value);
                    if (unit == null)
                    {
                        return ServiceResponse<LoadApplicationInviteDto>.CreateError("Unit not found or doesn't belong to this property");
                    }
                }

                // Get organizationId from property (use property's organizationId instead of context for consistency)
                var organizationId = property.OrganizationId;
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadApplicationInviteDto>.CreateError("Organization ID is required", "Property does not have an organization ID", "", 400);
                }

                // Check if there's already a pending application for this email/property/unit
                var existingApplications = await _applicationRepository.GetApplicationsByOrganizationId(organizationId.Value);
                var hasPendingApplication = existingApplications.Any(app =>
                    app.Email.Equals(invite.Email, StringComparison.OrdinalIgnoreCase) &&
                    app.PropertyId == invite.PropertyId &&
                    (invite.UnitId.HasValue ? app.UnitId == invite.UnitId.Value : app.UnitId == null) &&
                    app.Status == EApplicationStatus.Pending
                );

                if (hasPendingApplication)
                {
                    return ServiceResponse<LoadApplicationInviteDto>.CreateError(
                        "An application has already been sent to this email address for this property/unit. Please use the 'Resend Invite' option from the applications page instead.",
                        null,
                        null,
                        400
                    );
                }

                // Check if a user with this email already exists
                var existingUser = await _userRepository.GetUserByEmailAsync(invite.Email);

                if (existingUser != null)
                {
                    // User exists - create draft application and send notification instead of email
                    _logger.LogInformation("User with email {Email} already exists. Creating draft application and notification.", invite.Email);

                    // Create pending application (invite sent, waiting for submission)
                    var pendingApplication = new AddRentalApplicationDto
                    {
                        PropertyId = invite.PropertyId,
                        UnitId = invite.UnitId,
                        Email = invite.Email,
                        FirstName = invite.ApplicantName?.Split(' ').FirstOrDefault() ?? "",
                        LastName = invite.ApplicantName?.Split(' ').Skip(1).FirstOrDefault() ?? "",
                        Status = EApplicationStatus.Pending // Set to Pending status since invite is sent
                    };

                    _logger.LogInformation("Creating pending application for existing user invite: PropertyId={PropertyId}, UnitId={UnitId}, Email={Email}, Status={Status}",
                        pendingApplication.PropertyId, pendingApplication.UnitId, pendingApplication.Email, pendingApplication.Status);

                    var createdApplication = await _applicationRepository.AddApplication(pendingApplication, landlordId.Value, organizationId);

                    // Create invite record linked to the application (don't mark as used yet - they still need to submit)
                    var inviteToken = GenerateSecureToken();
                    var expiresAt = DateTime.Now.AddDays(14);
                    var createdInvite = await _applicationInviteRepository.CreateInvite(invite, landlordId.Value, inviteToken, expiresAt, organizationId, createdApplication.Id);

                    // Send notification to user
                    try
                    {
                        var propertyName = property.Name;
                        var unitInfo = invite.UnitId.HasValue && invite.UnitId.Value > 0
                            ? $" - {property.Units?.FirstOrDefault(u => u.Id == invite.UnitId)?.Name ?? "Unit"}"
                            : "";

                        var notificationDto = new CreateNotificationDto
                        {
                            UserId = existingUser.Id,
                            Type = ENotificationType.Application,
                            Title = "New Rental Application Sent",
                            Message = $"Your landlord has sent you a new rental application for {propertyName}{unitInfo}. Please complete it in your tenant portal.",
                            RelatedId = createdApplication.Id,
                            SendEmail = true, // Send email notification
                            SendSMS = false
                        };

                        await _notificationService.CreateNotification(notificationDto);
                        _logger.LogInformation("Notification sent to user {UserId} for application {ApplicationId}", existingUser.Id, createdApplication.Id);
                    }
                    catch (Exception notifEx)
                    {
                        _logger.LogWarning(notifEx, "Failed to send notification to user {UserId}, but application was created. Application ID: {ApplicationId}", existingUser.Id, createdApplication.Id);
                        // Don't fail - application is created
                    }

                    return new ServiceResponse<LoadApplicationInviteDto>
                    {
                        Data = createdInvite,
                        Message = "Application sent successfully. The tenant will receive a notification."
                    };
                }
                else
                {
                    // User doesn't exist - create pending application and send email with invite link
                    var inviteToken = GenerateSecureToken();
                    var expiresAt = DateTime.Now.AddDays(14); // Invite expires in 14 days (longer than tenant invites since it's for application)

                    // Create application with Pending status so it shows in pending tab
                    var pendingApplication = new AddRentalApplicationDto
                    {
                        PropertyId = invite.PropertyId,
                        UnitId = invite.UnitId,
                        Email = invite.Email,
                        FirstName = invite.ApplicantName?.Split(' ').FirstOrDefault() ?? "",
                        LastName = invite.ApplicantName?.Split(' ').Skip(1).FirstOrDefault() ?? "",
                        Status = EApplicationStatus.Pending // Set to Pending status
                    };

                    _logger.LogInformation("Creating pending application for invite: PropertyId={PropertyId}, UnitId={UnitId}, Email={Email}, Status={Status}",
                        pendingApplication.PropertyId, pendingApplication.UnitId, pendingApplication.Email, pendingApplication.Status);

                    var createdApplication = await _applicationRepository.AddApplication(pendingApplication, landlordId.Value, organizationId);

                    // Create invite record linked to the application (don't mark as used yet - wait until they submit)
                    var createdInvite = await _applicationInviteRepository.CreateInvite(invite, landlordId.Value, inviteToken, expiresAt, organizationId, createdApplication.Id);

                    // Send invite email
                    try
                    {
                        await SendInviteEmailAsync(createdInvite, inviteToken);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to send application invite email, but invite was created. Invite ID: {InviteId}", createdInvite.Id);
                        // Don't fail the request if email fails - invite is still created
                    }

                    return new ServiceResponse<LoadApplicationInviteDto> { Data = createdInvite };
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating application invite");
                return ServiceResponse<LoadApplicationInviteDto>.CreateError("Error creating invite", ex.Message);
            }
        }

        public async Task<ServiceResponse<ValidateApplicationInviteTokenDto>> ValidateInviteToken(string token)
        {
            try
            {
                var invite = await _applicationInviteRepository.GetInviteByToken(token);

                if (invite == null)
                {
                    return new ServiceResponse<ValidateApplicationInviteTokenDto>
                    {
                        Data = new ValidateApplicationInviteTokenDto
                        {
                            IsValid = false,
                            Message = "Invalid invite token"
                        }
                    };
                }

                if (invite.IsUsed)
                {
                    return new ServiceResponse<ValidateApplicationInviteTokenDto>
                    {
                        Data = new ValidateApplicationInviteTokenDto
                        {
                            IsValid = false,
                            Message = "This invite has already been used"
                        }
                    };
                }

                if (invite.ExpiresAt < DateTime.Now)
                {
                    return new ServiceResponse<ValidateApplicationInviteTokenDto>
                    {
                        Data = new ValidateApplicationInviteTokenDto
                        {
                            IsValid = false,
                            Message = "This invite has expired"
                        }
                    };
                }

                return new ServiceResponse<ValidateApplicationInviteTokenDto>
                {
                    Data = new ValidateApplicationInviteTokenDto
                    {
                        IsValid = true,
                        Email = invite.Email,
                        PropertyId = invite.PropertyId,
                        UnitId = invite.UnitId,
                        Property = invite.Property,
                        Message = "Invite is valid"
                    }
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating invite token");
                return ServiceResponse<ValidateApplicationInviteTokenDto>.CreateError("Error validating invite", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadApplicationInviteDto>>> GetInvitesByPropertyId(long propertyId)
        {
            try
            {
                var landlordId = await GetCurrentUserIdAsync();
                if (!landlordId.HasValue)
                {
                    return ServiceResponse<List<LoadApplicationInviteDto>>.CreateError("User not found", "User not authenticated", "", 401);
                }

                // Verify property belongs to landlord
                var property = await _propertyRepository.GetPropertyById(propertyId);
                if (property == null || property.LandlordId != landlordId.Value)
                {
                    return ServiceResponse<List<LoadApplicationInviteDto>>.CreateError("Property not found or you don't have access");
                }

                // Get organization ID from context
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<List<LoadApplicationInviteDto>>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                var invites = await _applicationInviteRepository.GetInvitesByPropertyId(propertyId, organizationId.Value);
                return new ServiceResponse<List<LoadApplicationInviteDto>> { Data = invites };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting invites by property id");
                return ServiceResponse<List<LoadApplicationInviteDto>>.CreateError("Error getting invites", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadApplicationInviteDto>>> GetInvitesByLandlordId()
        {
            try
            {
                var landlordId = await GetCurrentUserIdAsync();
                if (!landlordId.HasValue)
                {
                    return ServiceResponse<List<LoadApplicationInviteDto>>.CreateError("User not found", "User not authenticated", "", 401);
                }

                // Get organization ID from context
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<List<LoadApplicationInviteDto>>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                var invites = await _applicationInviteRepository.GetInvitesByLandlordId(landlordId.Value, organizationId.Value);
                return new ServiceResponse<List<LoadApplicationInviteDto>> { Data = invites };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting invites by landlord id");
                return ServiceResponse<List<LoadApplicationInviteDto>>.CreateError("Error getting invites", ex.Message);
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

                var invite = await _applicationInviteRepository.GetInviteById(inviteId);
                if (invite == null)
                {
                    return ServiceResponse<bool>.CreateError("Invite not found");
                }

                if (invite.CreatedBy != landlordId.Value)
                {
                    return ServiceResponse<bool>.CreateError("You don't have permission to delete this invite");
                }

                var result = await _applicationInviteRepository.DeleteInvite(inviteId);
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

                var invite = await _applicationInviteRepository.GetInviteById(inviteId);
                if (invite == null)
                {
                    return ServiceResponse<bool>.CreateError("Invite not found");
                }

                if (invite.CreatedBy != landlordId.Value)
                {
                    return ServiceResponse<bool>.CreateError("You don't have permission to resend this invite");
                }

                // For resend, we'll just send the email again (don't invalidate the old token)
                // This allows multiple attempts if email delivery fails
                try
                {
                    await SendInviteEmailAsync(invite, invite.InviteToken);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to resend application invite email. Invite ID: {InviteId}", inviteId);
                    return ServiceResponse<bool>.CreateError("Failed to resend invite email", ex.Message);
                }

                return new ServiceResponse<bool> { Data = true };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resending invite");
                return ServiceResponse<bool>.CreateError("Error resending invite", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> ResendInviteByApplicationId(long applicationId)
        {
            try
            {
                var landlordId = await GetCurrentUserIdAsync();
                if (!landlordId.HasValue)
                {
                    return ServiceResponse<bool>.CreateError("User not found", "User not authenticated", "", 401);
                }

                // Find the invite linked to this application
                var invite = await _applicationInviteRepository.GetInviteByApplicationId(applicationId);
                if (invite == null)
                {
                    return ServiceResponse<bool>.CreateError("No invite found for this application");
                }

                if (invite.CreatedBy != landlordId.Value)
                {
                    return ServiceResponse<bool>.CreateError("You don't have permission to resend this invite");
                }

                // Check if invite is still valid (not used and not expired)
                if (invite.IsUsed)
                {
                    return ServiceResponse<bool>.CreateError("This invite has already been used");
                }

                if (invite.ExpiresAt < DateTime.Now)
                {
                    return ServiceResponse<bool>.CreateError("This invite has expired");
                }

                // Resend the email
                try
                {
                    await SendInviteEmailAsync(invite, invite.InviteToken);
                    _logger.LogInformation("Resent application invite email for application {ApplicationId}", applicationId);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to resend application invite email. Application ID: {ApplicationId}", applicationId);
                    return ServiceResponse<bool>.CreateError("Failed to resend invite email", ex.Message);
                }

                return new ServiceResponse<bool> { Data = true, Message = "Invite email resent successfully" };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resending invite by application ID");
                return ServiceResponse<bool>.CreateError("Error resending invite", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> MarkInviteAsUsed(string token, long applicationId)
        {
            try
            {
                var result = await _applicationInviteRepository.MarkInviteAsUsed(token, applicationId);
                return new ServiceResponse<bool> { Data = result };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error marking invite as used");
                return ServiceResponse<bool>.CreateError("Error marking invite as used", ex.Message);
            }
        }

        private async Task SendInviteEmailAsync(LoadApplicationInviteDto invite, string token)
        {
            // Get frontend base URL based on environment - use localhost in development, otherwise use configured URL
            string frontendBaseUrl;
            if (_environment.IsDevelopment())
            {
                frontendBaseUrl = "http://localhost:3000";
            }
            else
            {
                frontendBaseUrl = _configuration["FrontendBaseUrl"] ?? "https://landlord.brownstonehub.com";
            }
            var inviteUrl = $"{frontendBaseUrl.TrimEnd('/')}/apply/{token}";

            var applicantName = invite.ApplicantName ?? "Applicant";
            var propertyName = invite.Property?.Name ?? "Property";
            var unitInfo = invite.UnitId.HasValue && invite.UnitId.Value > 0
                ? $" - {invite.Property?.Units?.FirstOrDefault(u => u.Id == invite.UnitId)?.Name ?? "Unit"}"
                : "";

            var subject = "Complete Your Rental Application - Property Peace";
            var body = $@"
Hello {applicantName},

You have been invited to complete a rental application for {propertyName}{unitInfo}.

Click the link below to fill out your application:
{inviteUrl}

This invitation will expire on {invite.ExpiresAt:MMMM dd, yyyy}.

If you did not expect this invitation, please ignore this email.

Best regards,
Property Peace Team
";

            try
            {
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
            <h2>Complete Your Rental Application</h2>
            <p class='greeting'>Hello {applicantName},</p>
            <p>You have been invited to complete a rental application for <strong>{propertyName}{unitInfo}</strong>.</p>

            <div class='button-container'>
                <a href='{inviteUrl}' class='button'>Fill Out Application</a>
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
                    _logger.LogInformation("Application invite email sent successfully to {Email}", invite.Email);
                }
                else
                {
                    _logger.LogWarning("Failed to send application invite email to {Email}", invite.Email);
                }
            }
            catch (Exception ex)
            {
                // Log error but don't fail invite creation
                _logger.LogError(ex, "Error sending application invite email to {Email}: {Error}", invite.Email, ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadRentalApplicationDto>> SubmitApplicationWithToken(string token, AddRentalApplicationDto application)
        {
            try
            {
                // Validate token first
                var validationResponse = await ValidateInviteToken(token);
                if (!validationResponse.Success || validationResponse.Data == null || !validationResponse.Data.IsValid)
                {
                    return ServiceResponse<LoadRentalApplicationDto>.CreateError(
                        validationResponse.Data?.Message ?? "Invalid or expired invite token",
                        null,
                        null,
                        400);
                }

                var inviteData = validationResponse.Data;

                // Verify email matches (if provided in invite)
                if (!string.IsNullOrWhiteSpace(inviteData.Email) &&
                    !string.IsNullOrWhiteSpace(application.Email) &&
                    !inviteData.Email.Equals(application.Email, StringComparison.OrdinalIgnoreCase))
                {
                    return ServiceResponse<LoadRentalApplicationDto>.CreateError(
                        "Email address must match the invite email",
                        null,
                        null,
                        400);
                }

                // Set property and unit from invite
                application.PropertyId = inviteData.PropertyId ?? application.PropertyId;
                application.UnitId = inviteData.UnitId ?? application.UnitId;

                // Set status to Submitted
                application.Status = EApplicationStatus.Submitted;

                // Get the invite to find landlord ID
                var invite = await _applicationInviteRepository.GetInviteByToken(token);
                if (invite == null)
                {
                    return ServiceResponse<LoadRentalApplicationDto>.CreateError("Invite not found", null, null, 404);
                }

                // Get landlord ID from invite's CreatedBy
                var landlordId = invite.CreatedBy;

                // Get organizationId from property
                var property = await _propertyRepository.GetPropertyById(application.PropertyId);
                var organizationId = property?.OrganizationId;

                LoadRentalApplicationDto createdApplication;

                // If invite already has an application linked (created when invite was sent), update it instead of creating new
                if (invite.ApplicationId.HasValue)
                {
                    var existingApplication = await _applicationRepository.GetApplicationById(invite.ApplicationId.Value);
                    if (existingApplication == null)
                    {
                        return ServiceResponse<LoadRentalApplicationDto>.CreateError("Linked application not found", null, null, 404);
                    }

                    // Update the existing application with submitted data
                    var updateDto = new UpdateRentalApplicationDto
                    {
                        Id = existingApplication.Id,
                        Status = EApplicationStatus.Submitted,
                        FirstName = application.FirstName,
                        LastName = application.LastName,
                        Email = application.Email,
                        PhoneNumber = application.PhoneNumber,
                        DateOfBirth = application.DateOfBirth,

                        CurrentAddress = application.CurrentAddress,
                        CurrentCity = application.CurrentCity,
                        CurrentState = application.CurrentState,
                        CurrentZipCode = application.CurrentZipCode,
                        EmployerName = application.EmployerName,
                        JobTitle = application.JobTitle,
                        MonthlyIncome = application.MonthlyIncome,
                        EmploymentMonths = application.EmploymentMonths,
                        EmergencyContactName = application.EmergencyContactName,
                        EmergencyContactPhone = application.EmergencyContactPhone,
                        EmergencyContactRelationship = application.EmergencyContactRelationship,
                        PreviousLandlordName = application.PreviousLandlordName,
                        PreviousLandlordPhone = application.PreviousLandlordPhone,
                        NumberOfOccupants = application.NumberOfOccupants,
                        HasPets = application.HasPets,
                        PetDetails = application.PetDetails,
                        HasVehicles = application.HasVehicles,
                        VehicleDetails = application.VehicleDetails,
                        DesiredMoveInDate = application.DesiredMoveInDate,
                        AdditionalNotes = application.AdditionalNotes
                    };

                    createdApplication = await _applicationRepository.UpdateApplication(updateDto);
                }
                else
                {
                    // Create new application (fallback for old invites that weren't linked)
                    createdApplication = await _applicationRepository.AddApplication(application, landlordId, organizationId);
                }

                // Mark invite as used
                await MarkInviteAsUsed(token, createdApplication.Id);

                // Generate PDF automatically since status is Submitted
                // This matches the behavior in ApplicationService.AddApplication
                try
                {
                    // Get the application entity for PDF generation
                    var applicationEntity = await _applicationRepository.GetApplicationEntityById(createdApplication.Id);
                    if (applicationEntity != null && application.Status == EApplicationStatus.Submitted)
                    {
                        // Generate PDF
                        var pdfBytes = await _applicationPdfService.GenerateApplicationPdfAsync(applicationEntity);

                        // Save to blob storage
                        var applicantName = $"{applicationEntity.FirstName}_{applicationEntity.LastName}";
                        var blobName = await _applicationPdfService.SaveApplicationPdfToBlobAsync(pdfBytes, createdApplication.Id, applicantName);

                        // Get blob client to generate SAS URL (valid for 7 days)
                        var containerClient = _blobServiceClient.GetBlobContainerClient("application-pdfs");
                        var blobClient = containerClient.GetBlobClient(blobName);

                        // Generate a SAS URI for secure access (valid for 7 days)
                        var blobUrl = _azureBlobService.GenerateBlobSasUri(_blobServiceClient, blobClient, TimeSpan.FromDays(7));

                        // Update application with PDF info
                        await _applicationRepository.UpdateApplicationPdfFields(createdApplication.Id, blobName, blobUrl);

                        // Reload application to get PDF fields
                        createdApplication = await _applicationRepository.GetApplicationById(createdApplication.Id) ?? createdApplication;

                        _logger.LogInformation("PDF generated and saved for application {ApplicationId} submitted via invite", createdApplication.Id);
                    }
                }
                catch (Exception pdfEx)
                {
                    // Log PDF generation failure but don't fail the submission
                    _logger.LogWarning(pdfEx, "Failed to generate PDF for application {ApplicationId} submitted via invite", createdApplication.Id);
                }

                // Send notification and email to landlord when application is completed
                try
                {
                    await SendApplicationCompletionNotificationAsync(createdApplication, landlordId, organizationId);
                }
                catch (Exception notifEx)
                {
                    // Log but don't fail application submission if notification fails
                    _logger.LogWarning(notifEx, "Failed to send application completion notification for application {ApplicationId} submitted via invite", createdApplication.Id);
                }

                _logger.LogInformation("Application {ApplicationId} submitted via invite token {Token}", createdApplication.Id, token);

                return new ServiceResponse<LoadRentalApplicationDto>
                {
                    Success = true,
                    Data = createdApplication,
                    Message = "Application submitted successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error submitting application with token");
                return ServiceResponse<LoadRentalApplicationDto>.CreateError("An error occurred while submitting the application", ex.Message);
            }
        }

        private async Task SendApplicationCompletionNotificationAsync(LoadRentalApplicationDto application, long landlordId, long? organizationId = null)
        {
            try
            {
                var propertyName = application.PropertyName ?? "Unknown Property";
                var unitName = application.UnitName;
                var applicantName = $"{application.FirstName} {application.LastName}";
                var propertyDisplay = !string.IsNullOrEmpty(unitName) ? $"{propertyName} - {unitName}" : propertyName;

                var notificationDto = new CreateNotificationDto
                {
                    UserId = landlordId,
                    OrganizationId = organizationId,
                    Type = ENotificationType.Application,
                    Title = "New Application Submitted",
                    Message = $"{applicantName} has completed and submitted an application for {propertyDisplay}",
                    RelatedId = application.Id,
                    SendEmail = true,
                    SendSMS = true
                };

                await _notificationService.CreateNotification(notificationDto);
                _logger.LogInformation("Application completion notification sent to landlord {LandlordId} for application {ApplicationId}",
                    landlordId, application.Id);
            }
            catch (Exception ex)
            {
                // Log but don't fail application submission if notification fails
                _logger.LogWarning(ex, "Failed to send application completion notification for application {ApplicationId}",
                    application.Id);
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

