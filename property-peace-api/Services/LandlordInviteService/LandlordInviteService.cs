using System.Security.Cryptography;
using brownstone_hub_api.Dtos.LandlordInvite;
using brownstone_hub_api.Repositories.LandlordInvites;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.EmailService;
using Microsoft.Extensions.Configuration;

namespace brownstone_hub_api.Services.LandlordInviteService
{
    public class LandlordInviteService(
        ILandlordInviteRepository landlordInviteRepository,
        IUserRepository userRepository,
        IConfiguration configuration,
        IEmailService emailService,
        ILogger<LandlordInviteService> logger) : ILandlordInviteService
    {
        private readonly ILandlordInviteRepository _landlordInviteRepository = landlordInviteRepository;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly IConfiguration _configuration = configuration;
        private readonly IEmailService _emailService = emailService;
        private readonly ILogger<LandlordInviteService> _logger = logger;

        private async Task<long?> GetCurrentUserIdAsync()
        {
            var user = await _userRepository.GetCurrentUser();
            return user?.Id;
        }

        public async Task<ServiceResponse<LoadLandlordInviteDto>> CreateInvite(AddLandlordInviteDto invite)
        {
            try
            {
                var adminId = await GetCurrentUserIdAsync();
                if (!adminId.HasValue)
                {
                    return ServiceResponse<LoadLandlordInviteDto>.CreateError("User not found", "User not authenticated", "", 401);
                }

                // Check if user with that email already exists
                if (!string.IsNullOrEmpty(invite.Email))
                {
                    var existingUser = await _userRepository.GetUserByEmailAsync(invite.Email);
                    if (existingUser != null)
                    {
                        _logger.LogWarning("[LandlordInviteService] User with email {Email} already exists", invite.Email);
                        return ServiceResponse<LoadLandlordInviteDto>.CreateError("A user with this email already exists");
                    }
                }

                // Generate secure token
                var inviteToken = GenerateSecureToken();
                var expiresAt = DateTime.Now.AddDays(7); // Invite expires in 7 days

                _logger.LogInformation("[LandlordInviteService] Creating invite for Email: {Email}, Token: {Token}", 
                    invite.Email, inviteToken);

                var createdInvite = await _landlordInviteRepository.CreateInvite(invite, adminId.Value, inviteToken, expiresAt);
                
                _logger.LogInformation("[LandlordInviteService] Invite created successfully. InviteId: {InviteId}", createdInvite.Id);

                // Send invite email
                try
                {
                    _logger.LogInformation("[LandlordInviteService] Sending invite email to {Email}", invite.Email);
                    await SendInviteEmailAsync(createdInvite, inviteToken);
                    _logger.LogInformation("[LandlordInviteService] Invite email sent successfully to {Email}", invite.Email);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to send invite email, but invite was created. Invite ID: {InviteId}", createdInvite.Id);
                    // Don't fail the request if email fails - invite is still created
                }

                _logger.LogInformation("[LandlordInviteService] CreateInvite completed successfully for Email: {Email}", invite.Email);
                return new ServiceResponse<LoadLandlordInviteDto> { Data = createdInvite };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating landlord invite");
                return ServiceResponse<LoadLandlordInviteDto>.CreateError("Error creating invite", ex.Message);
            }
        }

        public async Task<ServiceResponse<ValidateLandlordInviteTokenDto>> ValidateInviteToken(string token)
        {
            try
            {
                var invite = await _landlordInviteRepository.GetInviteByToken(token);
                
                if (invite == null)
                {
                    return new ServiceResponse<ValidateLandlordInviteTokenDto>
                    {
                        Data = new ValidateLandlordInviteTokenDto
                        {
                            IsValid = false,
                            Message = "Invite not found"
                        }
                    };
                }

                if (invite.IsUsed)
                {
                    return new ServiceResponse<ValidateLandlordInviteTokenDto>
                    {
                        Data = new ValidateLandlordInviteTokenDto
                        {
                            IsValid = false,
                            Message = "This invite has already been used"
                        }
                    };
                }

                if (DateTime.Now > invite.ExpiresAt)
                {
                    return new ServiceResponse<ValidateLandlordInviteTokenDto>
                    {
                        Data = new ValidateLandlordInviteTokenDto
                        {
                            IsValid = false,
                            Message = "This invite has expired"
                        }
                    };
                }

                return new ServiceResponse<ValidateLandlordInviteTokenDto>
                {
                    Data = new ValidateLandlordInviteTokenDto
                    {
                        IsValid = true,
                        Email = invite.Email,
                        FirstName = invite.FirstName,
                        LastName = invite.LastName,
                        ExpiresAt = invite.ExpiresAt
                    }
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating invite token");
                return ServiceResponse<ValidateLandlordInviteTokenDto>.CreateError("Error validating invite token", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> MarkInviteAsUsed(string token)
        {
            try
            {
                var result = await _landlordInviteRepository.MarkInviteAsUsed(token);
                return new ServiceResponse<bool> { Data = result };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error marking invite as used");
                return ServiceResponse<bool>.CreateError("Error marking invite as used", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadLandlordInviteDto>>> GetInvitesByAdmin()
        {
            try
            {
                var adminId = await GetCurrentUserIdAsync();
                if (!adminId.HasValue)
                {
                    return ServiceResponse<List<LoadLandlordInviteDto>>.CreateError("User not found", "User not authenticated", "", 401);
                }

                var invites = await _landlordInviteRepository.GetInvitesByCreatedBy(adminId.Value);
                return new ServiceResponse<List<LoadLandlordInviteDto>> { Data = invites };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting invites by admin");
                return ServiceResponse<List<LoadLandlordInviteDto>>.CreateError("Error getting invites", ex.Message);
            }
        }

        private string GenerateSecureToken()
        {
            using var rng = RandomNumberGenerator.Create();
            var bytes = new byte[32];
            rng.GetBytes(bytes);
            return Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").Replace("=", "");
        }

        private async Task SendInviteEmailAsync(LoadLandlordInviteDto invite, string token)
        {
            _logger.LogInformation("[LandlordInviteService] Preparing to send invite email to {Email}", invite.Email);
            
            // Get frontend base URL from configuration
            var frontendBaseUrl = _configuration["FrontendBaseUrl"] ?? "http://localhost:3000";
            var inviteUrl = $"{frontendBaseUrl.TrimEnd('/')}/landlord/invite/{token}";

            var recipientName = !string.IsNullOrEmpty(invite.FirstName) && !string.IsNullOrEmpty(invite.LastName)
                ? $"{invite.FirstName} {invite.LastName}"
                : !string.IsNullOrEmpty(invite.FirstName)
                    ? invite.FirstName
                    : "Landlord";

            // Get admin name
            var admin = await _userRepository.GetUser(invite.CreatedBy);
            var adminName = admin != null 
                ? $"{admin.FirstName} {admin.LastName}".Trim()
                : "Admin";
            if (string.IsNullOrEmpty(adminName))
            {
                adminName = admin?.Email ?? "Admin";
            }

            var subject = "You've been invited to join Property Peace";
            var body = $@"
Hello {recipientName},

{adminName} has invited you to create a landlord account on Property Peace, a modern property management platform.

Click the link below to accept the invitation and create your account:
{inviteUrl}

Once you sign up, you'll be able to:
• Manage your properties and units
• Track leases and rent collection
• Handle maintenance requests
• Communicate with tenants
• Generate reports and analytics

This invitation will expire on {invite.ExpiresAt:MMMM dd, yyyy}.

If you did not expect this invitation, please ignore this email.

Best regards,
Property Peace Team
";

            try
            {
                // Create HTML email content
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
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff;
            padding: 40px 30px;
            text-align: center;
        }}
        .header h1 {{
            font-size: 28px;
            font-weight: 600;
            margin-bottom: 10px;
        }}
        .content {{
            padding: 40px 30px;
        }}
        .content h2 {{
            font-size: 22px;
            color: #333333;
            margin-bottom: 20px;
        }}
        .content p {{
            font-size: 16px;
            color: #666666;
            margin-bottom: 20px;
        }}
        .button-container {{
            text-align: center;
            margin: 30px 0;
        }}
        .button {{
            display: inline-block;
            padding: 14px 32px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
        }}
        .features {{
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            margin: 30px 0;
        }}
        .features ul {{
            list-style: none;
            padding: 0;
        }}
        .features li {{
            padding: 8px 0;
            color: #666666;
        }}
        .features li:before {{
            content: '✓ ';
            color: #667eea;
            font-weight: bold;
            margin-right: 8px;
        }}
        .footer {{
            background-color: #f8f9fa;
            padding: 20px 30px;
            text-align: center;
            color: #999999;
            font-size: 14px;
        }}
    </style>
</head>
<body>
    <div class='email-wrapper'>
        <div class='header'>
            <h1>Welcome to Property Peace</h1>
        </div>
        <div class='content'>
            <h2>Hello {recipientName},</h2>
            <p>
                <strong>{adminName}</strong> has invited you to create a landlord account on <strong>Property Peace</strong>, a modern property management platform.
            </p>
            <div class='button-container'>
                <a href='{inviteUrl}' class='button'>Accept Invitation & Create Account</a>
            </div>
            <div class='features'>
                <p style='font-weight: 600; margin-bottom: 10px; color: #333333;'>Once you sign up, you'll be able to:</p>
                <ul>
                    <li>Manage your properties and units</li>
                    <li>Track leases and rent collection</li>
                    <li>Handle maintenance requests</li>
                    <li>Communicate with tenants</li>
                    <li>Generate reports and analytics</li>
                </ul>
            </div>
            <p style='color: #999999; font-size: 14px;'>
                This invitation will expire on <strong>{invite.ExpiresAt:MMMM dd, yyyy}</strong>.
            </p>
            <p style='color: #999999; font-size: 14px;'>
                If you did not expect this invitation, please ignore this email.
            </p>
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
                    _logger.LogInformation("Landlord invite email sent successfully to {Email}", invite.Email);
                }
                else
                {
                    _logger.LogWarning("Failed to send landlord invite email to {Email}", invite.Email);
                }
            }
            catch (Exception ex)
            {
                // Log error but don't fail invite creation
                _logger.LogError(ex, "Error sending landlord invite email to {Email}: {Error}", invite.Email, ex.Message);
            }
        }
    }
}
