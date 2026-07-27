using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using brownstone_hub_api.Dtos.User;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using brownstone_hub_api.Dtos.UserSetting;
using brownstone_hub_api.Services.UserService;
using brownstone_hub_api.Dtos.NotificationSetting;
using brownstone_hub_api.Services.NotificationSettingService;
using brownstone_hub_api.Models;
using brownstone_hub_api.Dtos.SupportAndFeedback;
using brownstone_hub_api.Dtos.Feedback;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Data;
using Microsoft.EntityFrameworkCore;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using brownstone_hub_api.Services.AzureBlobService;
using brownstone_hub_api.Services.EmailVerificationService;
using brownstone_hub_api.Services.GoogleAuthService;
using brownstone_hub_api.Repositories.Conversations;
using brownstone_hub_api.Repositories.Messages;
using brownstone_hub_api.Repositories.AdminSettings;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Dtos.Conversation;
using brownstone_hub_api.Dtos.Message;
using brownstone_hub_api.Services.SubscriptionService;
using brownstone_hub_api.Repositories.NotificationSettings;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UserController(
        IUserService userService,
        INotificationSettingService notificationSettingService,
        DataContext dataContext,
        BlobServiceClient blobServiceClient,
        IAzureBlobService azureBlobService,
        IEmailVerificationService emailVerificationService,
        IGoogleAuthService googleAuthService,
        IConversationRepository conversationRepository,
        IMessageRepository messageRepository,
        IAdminSettingsRepository adminSettingsRepository,
        IEmailService emailService,
        ISubscriptionService subscriptionService,
        INotificationSettingRepository notificationSettingRepository,
        ILogger<UserController> logger
        ) : ControllerBase
    {
        private readonly IUserService _userService = userService;
        private readonly INotificationSettingService _notificationSettingService = notificationSettingService;
        private readonly DataContext _dataContext = dataContext;
        private readonly BlobServiceClient _blobServiceClient = blobServiceClient;
        private readonly IAzureBlobService _azureBlobService = azureBlobService;
        private readonly IEmailVerificationService _emailVerificationService = emailVerificationService;
        private readonly IGoogleAuthService _googleAuthService = googleAuthService;
        private readonly IConversationRepository _conversationRepository = conversationRepository;
        private readonly IMessageRepository _messageRepository = messageRepository;
        private readonly IAdminSettingsRepository _adminSettingsRepository = adminSettingsRepository;
        private readonly IEmailService _emailService = emailService;
        private readonly ISubscriptionService _subscriptionService = subscriptionService;
        private readonly INotificationSettingRepository _notificationSettingRepository = notificationSettingRepository;
        private readonly ILogger<UserController> _logger = logger;

        [HttpPost("register")]
        public async Task<ActionResult<ServiceResponse<LoadUserDto>>> Register(AddUserDto request)
        {
            var response = await _userService.Register(request);

            if (!response.Success)
            {
                return BadRequest(response);
            }
            if (response.Data != null)
            {
                var session = await _userService.CreateRefreshSession(response.Data.Id);
                SetRefreshTokenCookie(session.RefreshToken, session.RefreshTokenExpiresAt);
                response.Data.JWTToken = session.User.JWTToken;
            }
            return Ok(response);
        }

        [HttpPost("login")]
        public async Task<ActionResult<ServiceResponse<LoadUserDto>>> Login(UserLoginDto request)
        {
            var response = await _userService.Login(request.Email, request.Password);

            if (!response.Success)
            {
                return BadRequest(response);
            }
            if (response.Data != null)
            {
                var session = await _userService.CreateRefreshSession(response.Data.Id);
                SetRefreshTokenCookie(session.RefreshToken, session.RefreshTokenExpiresAt);
                response.Data.JWTToken = session.User.JWTToken;
            }
            return Ok(response);
        }

        [HttpPost("google-login")]
        public async Task<ActionResult> GoogleLogin(GoogleLoginDto request)
        {
            // Log the incoming request for debugging
            _logger.LogInformation("Google login request received: HasIdToken={HasIdToken}, HasAccessToken={HasAccessToken}, HasRegistrationCode={HasRegistrationCode}",
                !string.IsNullOrEmpty(request.IdToken),
                !string.IsNullOrEmpty(request.AccessToken),
                !string.IsNullOrEmpty(request.RegistrationCode));

            var (response, isNewUser) = await _userService.GoogleLogin(request.IdToken, request.RegistrationCode, request.AccessToken, request.Timezone);

            if (!response.Success)
            {
                _logger.LogWarning("Google login failed: {Message}", response.Message);
                return BadRequest(response);
            }

            if (response.Data != null)
            {
                var session = await _userService.CreateRefreshSession(response.Data.Id);
                SetRefreshTokenCookie(session.RefreshToken, session.RefreshTokenExpiresAt);
                response.Data.JWTToken = session.User.JWTToken;
            }

            // Return response with isNewUser flag
            return Ok(new
            {
                success = response.Success,
                message = response.Message,
                data = response.Data,
                isNewUser = isNewUser
            });
        }

        [AllowAnonymous]
        [HttpPost("refresh")]
        public async Task<ActionResult<ServiceResponse<LoadUserDto>>> Refresh()
        {
            if (!Request.Cookies.TryGetValue("refreshToken", out var refreshToken))
            {
                ClearRefreshTokenCookie();
                return Unauthorized(new ServiceResponse<LoadUserDto> { Success = false, Message = "Refresh session is unavailable" });
            }

            var session = await _userService.RefreshSession(refreshToken);
            if (session == null)
            {
                ClearRefreshTokenCookie();
                return Unauthorized(new ServiceResponse<LoadUserDto> { Success = false, Message = "Refresh session is invalid or expired" });
            }

            SetRefreshTokenCookie(session.RefreshToken, session.RefreshTokenExpiresAt);
            return Ok(new ServiceResponse<LoadUserDto> { Success = true, Data = session.User });
        }

        [AllowAnonymous]
        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            if (Request.Cookies.TryGetValue("refreshToken", out var refreshToken))
            {
                await _userService.RevokeRefreshToken(refreshToken);
            }

            ClearRefreshTokenCookie();
            return NoContent();
        }

        private void SetRefreshTokenCookie(string refreshToken, DateTime expiresAt)
        {
            var secure = !HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment() || Request.IsHttps;
            Response.Cookies.Append("refreshToken", refreshToken, new CookieOptions
            {
                HttpOnly = true,
                Secure = secure,
                SameSite = secure ? SameSiteMode.None : SameSiteMode.Lax,
                Expires = expiresAt,
                Path = "/"
            });
        }

        private void ClearRefreshTokenCookie()
        {
            var secure = !HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment() || Request.IsHttps;
            Response.Cookies.Delete("refreshToken", new CookieOptions
            {
                HttpOnly = true,
                Secure = secure,
                SameSite = secure ? SameSiteMode.None : SameSiteMode.Lax,
                Path = "/"
            });
        }

        [HttpPost("check-email")]
        public async Task<ActionResult<ServiceResponse<bool>>> CheckEmailExists([FromBody] CheckEmailDto request)
        {
            var response = await _userService.CheckEmailExists(request.Email);

            if (!response.Success)
            {
                return BadRequest(response);
            }
            return Ok(response);
        }

        [HttpPost("get-by-email")]
        [Authorize(Roles = "Landlord,Admin")]
        public async Task<ActionResult<ServiceResponse<LoadUserDto>>> GetUserByEmail([FromBody] CheckEmailDto request)
        {
            var response = await _userService.GetUserByEmailAsync(request.Email);

            if (!response.Success)
            {
                return StatusCode(response.StatusCode, response);
            }
            return Ok(response);
        }

        [AllowAnonymous] // Public endpoint - no authentication required
        [HttpPost("invite-landlord")]
        public async Task<ActionResult<ServiceResponse<bool>>> InviteLandlord([FromBody] InviteLandlordDto request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request?.LandlordEmail))
                {
                    return BadRequest(new ServiceResponse<bool> { Success = false, Message = "Landlord email is required" });
                }

                if (string.IsNullOrWhiteSpace(request?.TenantEmail))
                {
                    return BadRequest(new ServiceResponse<bool> { Success = false, Message = "Tenant email is required" });
                }

                if (string.IsNullOrWhiteSpace(request?.TenantName))
                {
                    return BadRequest(new ServiceResponse<bool> { Success = false, Message = "Tenant name is required" });
                }

                // Get frontend base URL from configuration
                var config = HttpContext.RequestServices.GetRequiredService<IConfiguration>();
                var frontendBaseUrl = config["FrontendBaseUrl"] ?? "https://brownstonehub.com";

                var registerUrl = $"{frontendBaseUrl.TrimEnd('/')}/register";

                var subject = "Your Tenant Invited You to Join Property Peace";
                var tenantName = request.TenantName;
                var landlordEmail = request.LandlordEmail.Trim().ToLower();

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
            background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
            color: #ffffff;
            padding: 30px 30px;
            text-align: center;
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
        }}
        .button:hover {{
            background: linear-gradient(135deg, #1565c0 0%, #0d47a1 100%);
        }}
        .info-box {{
            background-color: #f8f9fa;
            border-left: 4px solid #1976d2;
            padding: 16px 20px;
            margin: 24px 0;
            border-radius: 4px;
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
            background-color: #f8f9fa;
            padding: 24px 30px;
            text-align: center;
            border-top: 1px solid #e0e0e0;
        }}
        .footer p {{
            font-size: 12px;
            color: #999999;
            margin: 0;
        }}
    </style>
</head>
<body>
    <div class='email-wrapper'>
        <div class='header'>
            <h1>Property Peace</h1>
        </div>
        <div class='content'>
            <h2>Your Tenant Invited You to Join</h2>
            <p class='greeting'>Hello,</p>
            <p><strong>{tenantName}</strong> has invited you to join <strong>Property Peace</strong>, a modern property management platform.</p>
            <p>Join today to streamline your property management, communicate with tenants, and manage leases all in one place.</p>

            <div class='button-container'>
                <a href='{registerUrl}' class='button'>Create Your Account</a>
            </div>

            <div class='info-box'>
                <p><strong>What you can do with Property Peace:</strong></p>
                <p style='margin-top: 8px;'>• Manage properties and units<br>
                • Track leases and payments<br>
                • Handle maintenance requests<br>
                • Communicate with tenants<br>
                • Generate reports and analytics</p>
            </div>

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

                var plainTextContent = $@"
Hello,

{tenantName} has invited you to join Property Peace, a modern property management platform.

Join today to streamline your property management, communicate with tenants, and manage leases all in one place.

Create your account: {registerUrl}

What you can do with Property Peace:
• Manage properties and units
• Track leases and payments
• Handle maintenance requests
• Communicate with tenants
• Generate reports and analytics

Best regards,
Property Peace Team

This is an automated email from Property Peace. Please do not reply to this message.
";

                var emailSent = await _emailService.SendEmailAsync(
                    to: landlordEmail,
                    subject: subject,
                    htmlContent: htmlContent,
                    plainTextContent: plainTextContent
                );

                if (emailSent)
                {
                    _logger.LogInformation("Landlord invite email sent successfully to {LandlordEmail} from tenant {TenantEmail}",
                        landlordEmail, request.TenantEmail);
                    return Ok(new ServiceResponse<bool> { Success = true, Data = true, Message = "Invitation sent successfully" });
                }
                else
                {
                    _logger.LogWarning("Failed to send landlord invite email to {LandlordEmail} from tenant {TenantEmail}",
                        landlordEmail, request.TenantEmail);
                    return StatusCode(500, new ServiceResponse<bool> { Success = false, Message = "Failed to send invitation email" });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending landlord invite email");
                return StatusCode(500, new ServiceResponse<bool> { Success = false, Message = "An error occurred while sending the invitation" });
            }
        }

        [AllowAnonymous] // Public endpoint - no authentication required
        [HttpPost("send-verification-code")]
        public async Task<ActionResult<ServiceResponse<string>>> SendVerificationCode([FromBody] SendVerificationCodeDto request)
        {
            // Validate model state
            if (!ModelState.IsValid)
            {
                _logger.LogWarning("Invalid model state for SendVerificationCode. Errors: {Errors}",
                    string.Join(", ", ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage)));
                return BadRequest(ModelState);
            }

            // Validate email is provided
            if (string.IsNullOrWhiteSpace(request?.Email))
            {
                _logger.LogWarning("SendVerificationCode called with null or empty email");
                return BadRequest(new { Message = "Email is required" });
            }

            _logger.LogInformation("Sending verification code to {Email}", request.Email);
            var response = await _emailVerificationService.SendVerificationCodeAsync(request.Email);

            if (!response.Success)
            {
                _logger.LogWarning("Failed to send verification code to {Email}. Error: {Error}, Details: {Details}",
                    request.Email, response.Errors?.Message, response.Errors?.Details);
                return BadRequest(response);
            }

            _logger.LogInformation("Verification code sent successfully to {Email}", request.Email);
            return Ok(response);
        }

        [HttpPost("verify-code")]
        public async Task<ActionResult<ServiceResponse<bool>>> VerifyCode([FromBody] VerifyCodeDto request)
        {
            var response = await _emailVerificationService.VerifyCodeAsync(request.Email, request.Code);

            if (!response.Success)
            {
                return BadRequest(response);
            }
            return Ok(response);
        }

        [HttpPost("google-user-info")]
        public async Task<ActionResult<ServiceResponse<GoogleUserInfoDto>>> GetGoogleUserInfo([FromBody] GoogleUserInfoRequestDto request)
        {
            try
            {
                var userInfo = await _googleAuthService.VerifyGoogleAccessTokenAsync(request.AccessToken);

                if (userInfo == null)
                {
                    return BadRequest(new ServiceResponse<GoogleUserInfoDto>
                    {
                        Success = false,
                        Message = "Failed to verify Google access token"
                    });
                }

                var dto = new GoogleUserInfoDto
                {
                    Id = userInfo.Id,
                    Email = userInfo.Email,
                    FirstName = userInfo.FirstName,
                    LastName = userInfo.LastName,
                    Picture = userInfo.Picture,
                    EmailVerified = userInfo.EmailVerified
                };

                return Ok(ServiceResponse<GoogleUserInfoDto>.CreateSuccess(dto));
            }
            catch (Exception ex)
            {
                return BadRequest(ServiceResponse<GoogleUserInfoDto>.CreateError(
                    "Error getting Google user info",
                    ex.Message,
                    ex.InnerException?.Message));
            }
        }

        // Load current user
        [Authorize]
        [HttpGet("load-user")]
        public async Task<ActionResult<ServiceResponse<LoadUserDto>>> LoadUser()
        {
            var response = await _userService.LoadUser();

            if (!response.Success)
            {
                return Unauthorized(response);
            }
            return Ok(response);
        }

        [Authorize]
        [HttpDelete]
        public async Task<ActionResult<ServiceResponse<string>>> DeleteUser()
        {
            var user = await _userService.LoadUser();
            if (user?.Data == null)
            {
                return Unauthorized(new { Message = "User not found" });
            }
            var response = await _userService.DeleteUser(user.Data.Id);

            if (!response.Success)
            {
                return BadRequest(response);
            }

            ClearRefreshTokenCookie();
            return Ok(response);
        }

        [HttpGet("settings")]
        public async Task<ActionResult<ServiceResponse<SettingsDto>>> GetSettings()
        {
            var response = await _userService.GetSettings();

            if (!response.Success)
            { // need to set this to server error
                return BadRequest(response);
            }
            return Ok(response);
        }

        [Authorize]
        [HttpPost("settings")]
        public async Task<ActionResult<ServiceResponse<SettingsDto>>> SaveSettings(SettingsDto newSettings)
        {
            var response = await _userService.SaveSettings(newSettings);

            if (!response.Success)
            { // need to set this to server error
                return BadRequest(response);
            }
            return Ok(response);
        }

        [Authorize]
        [HttpPut("tutorial-status")]
        public async Task<ActionResult<ServiceResponse<bool>>> UpdateHasSeenTutorial([FromBody] UpdateTutorialStatusDto request)
        {
            var user = await _userService.LoadUser();
            if (user?.Data == null)
            {
                return Unauthorized(new { Message = "User not found" });
            }
            var response = await _userService.UpdateHasSeenTutorial(user.Data.Id, request.HasSeenTutorial);

            if (!response.Success)
            {
                return BadRequest(response);
            }
            return Ok(response);
        }

        [Authorize]
        [HttpGet("notification-settings")]
        public async Task<ActionResult<ServiceResponse<NotificationSettingDto>>> GetNotificationSettings()
        {
            var response = await _notificationSettingService.GetNotificationSettings();

            if (!response.Success)
            {
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });
            }

            return Ok(response);
        }

        [Authorize]
        [HttpPost("notification-settings")]
        public async Task<ActionResult<ServiceResponse<NotificationSettingDto>>> SaveNotificationSettings([FromBody] NotificationSettingDto notificationSettingDto)
        {
            var response = await _notificationSettingService.SaveNotificationSettings(notificationSettingDto);

            if (!response.Success)
            {
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });
            }

            return Ok(response);
        }

        [Authorize]
        [HttpPost("check-accounts")]
        public async Task<ActionResult<ServiceResponse<Dictionary<long, bool>>>> CheckUsersHaveAccounts([FromBody] List<long> userIds)
        {
            if (userIds == null || userIds.Count == 0)
            {
                return Ok(new ServiceResponse<Dictionary<long, bool>>
                {
                    Success = true,
                    Data = new Dictionary<long, bool>()
                });
            }

            var result = await _userService.CheckUsersHaveAccounts(userIds);
            return Ok(new ServiceResponse<Dictionary<long, bool>>
            {
                Success = true,
                Data = result
            });
        }

        [Authorize]
        [HttpPost("change-password")]
        public async Task<ActionResult<ServiceResponse<string>>> ChangePassword([FromBody] ChangePasswordDto request)
        {
            var response = await _userService.ChangePassword(request.CurrentPassword, request.NewPassword);

            if (!response.Success)
            {
                return BadRequest(response);
            }
            return Ok(response);
        }

        [Authorize]
        [HttpPut("update-account")]
        public async Task<ActionResult<ServiceResponse<LoadUserDto>>> UpdateAccount([FromBody] UpdateUserDto request)
        {
            var response = await _userService.UpdateUserAccountInfo(request);

            if (!response.Success)
            {
                return StatusCode(response.StatusCode == 0 ? 400 : response.StatusCode, response);
            }
            return Ok(response);
        }

        [Authorize]
        [HttpPost("feedback")]
        public async Task<ActionResult<ServiceResponse<LoadSupportAndFeedbackDto>>> SubmitFeedback([FromBody] AddFeedbackDto request)
        {
            try
            {
                var user = await _userService.LoadUser();
                if (user?.Data == null)
                {
                    return Unauthorized(new { Message = "User not found" });
                }

                // Save to SupportAndFeedback table
                var supportAndFeedback = new SupportAndFeedback
                {
                    UserId = user.Data.Id,
                    Type = ESupportAndFeedbackType.Feedback,
                    SubType = request.Type.ToLower(), // "feedback", "bug", or "feature"
                    Subject = request.Subject,
                    Message = request.Message,
                    CreatedAt = DateTime.UtcNow,
                    IsResolved = false
                };

                _dataContext.SupportAndFeedbacks.Add(supportAndFeedback);
                await _dataContext.SaveChangesAsync();

                // Create conversation and message for admin (similar to support requests)
                try
                {
                    // Find an admin user
                    var adminUser = await _dataContext.Users
                        .Include(u => u.UserRoles)
                            .ThenInclude(ur => ur.Role)
                        .Where(u => !u.IsDeleted &&
                                    u.UserRoles.Any(ur => ur.Role.RoleName.ToLower() == "admin"))
                        .FirstOrDefaultAsync();

                    if (adminUser != null)
                    {
                        // Determine feedback type label
                        var feedbackTypeLabel = request.Type.ToLower() switch
                        {
                            "bug" => "Bug Report",
                            "feature" => "Feature Request",
                            _ => "Feedback"
                        };

                        // Create conversation title
                        var conversationTitle = $"Feedback: {request.Subject}";

                        // Create new conversation
                        var addConversationDto = new AddConversationDto
                        {
                            Title = conversationTitle,
                            Description = feedbackTypeLabel,
                            IsGroupChat = false,
                            ParticipantUserIds = new List<long> { adminUser.Id }
                        };

                        LoadConversationDto conversationResult;
                        try
                        {
                            // Get organization ID from context if available
                            long? organizationId = null;
                            if (HttpContext.Items.TryGetValue("OrganizationId", out var orgIdObj) && orgIdObj is long orgId)
                            {
                                organizationId = orgId;
                            }

                            conversationResult = await _conversationRepository.AddConversation(
                                addConversationDto,
                                user.Data.Id,
                                organizationId);

                            if (conversationResult != null)
                            {
                                var conversationId = conversationResult.Id;

                                // Create message with feedback details
                                var messageContent = $"**Type:** {feedbackTypeLabel}\n\n" +
                                                    $"**Subject:** {request.Subject}\n\n" +
                                                    $"**Message:**\n{request.Message}";

                                var addMessageDto = new AddMessageDto
                                {
                                    ConversationId = conversationId,
                                    Content = messageContent
                                };

                                await _messageRepository.AddMessage(addMessageDto, user.Data.Id);

                                // Send email notification to admin (optional, same as support requests)
                                // Always send to admin@brownstonehub.com, and also to configured admin email if different
                                var adminEmail = "admin@brownstonehub.com";
                                var additionalEmails = new List<string>();

                                var adminSettings = await _adminSettingsRepository.GetAdminSettings();
                                if (adminSettings != null && !string.IsNullOrWhiteSpace(adminSettings.NotificationEmail))
                                {
                                    var configuredEmail = adminSettings.NotificationEmail.Trim();
                                    if (!string.Equals(configuredEmail, adminEmail, StringComparison.OrdinalIgnoreCase))
                                    {
                                        additionalEmails.Add(configuredEmail);
                                    }
                                }

                                var emailSubject = $"{feedbackTypeLabel}: {request.Subject}";
                                var emailBody = $@"
<html>
<body>
    <h2>New {feedbackTypeLabel}</h2>
    <p><strong>From:</strong> {user.Data.Firstname} {user.Data.Lastname} ({user.Data.Email})</p>
    <p><strong>Subject:</strong> {request.Subject}</p>
    <p><strong>Message:</strong></p>
    <p>{request.Message.Replace("\n", "<br>")}</p>
    <hr>
    <p><small>This feedback has been added to your admin inbox. You can view and respond to it there.</small></p>
</body>
</html>";

                                var plainTextContent = $@"New {feedbackTypeLabel}

From: {user.Data.Firstname} {user.Data.Lastname} ({user.Data.Email})
Subject: {request.Subject}

Message:
{request.Message}

This feedback has been added to your admin inbox. You can view and respond to it there.";

                                // Send to admin@brownstonehub.com
                                try
                                {
                                    await _emailService.SendEmailAsync(
                                        to: adminEmail,
                                        subject: emailSubject,
                                        htmlContent: emailBody,
                                        plainTextContent: plainTextContent
                                    );
                                    _logger.LogInformation("Feedback email sent to {Email}", adminEmail);
                                }
                                catch (Exception emailEx)
                                {
                                    // Log but don't fail the feedback submission
                                    _logger.LogError(emailEx, "Error sending feedback email to {Email}", adminEmail);
                                }

                                // Also send to additional configured email if different
                                foreach (var additionalEmail in additionalEmails)
                                {
                                    try
                                    {
                                        await _emailService.SendEmailAsync(
                                            to: additionalEmail,
                                            subject: emailSubject,
                                            htmlContent: emailBody,
                                            plainTextContent: plainTextContent
                                        );
                                        _logger.LogInformation("Feedback email sent to {Email}", additionalEmail);
                                    }
                                    catch (Exception emailEx)
                                    {
                                        // Log but don't fail the feedback submission
                                        _logger.LogError(emailEx, "Error sending feedback email to {Email}", additionalEmail);
                                    }
                                }
                            }
                        }
                        catch (Exception convEx)
                        {
                            // Log but don't fail the feedback submission
                            _logger.LogError(convEx, "Error creating conversation for feedback: {Message}", convEx.Message);
                        }
                    }
                    else
                    {
                        _logger.LogWarning("No admin user found in the system. Feedback saved but no conversation created.");
                    }
                }
                catch (Exception ex)
                {
                    // Log but don't fail the feedback submission
                    _logger.LogError(ex, "Error creating conversation for feedback: {Message}", ex.Message);
                }

                var supportAndFeedbackDto = new LoadSupportAndFeedbackDto
                {
                    Id = supportAndFeedback.Id,
                    UserId = supportAndFeedback.UserId,
                    Type = supportAndFeedback.Type,
                    SubType = supportAndFeedback.SubType,
                    Subject = supportAndFeedback.Subject,
                    Message = supportAndFeedback.Message,
                    CreatedAt = supportAndFeedback.CreatedAt,
                    IsResolved = supportAndFeedback.IsResolved
                };

                return Ok(new ServiceResponse<LoadSupportAndFeedbackDto>
                {
                    Success = true,
                    Message = "Thank you for your feedback! We'll review it and get back to you if needed.",
                    Data = supportAndFeedbackDto
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error submitting feedback: {Message}", ex.Message);
                return BadRequest(ServiceResponse<LoadSupportAndFeedbackDto>.CreateError(
                    "Error submitting feedback",
                    ex.Message,
                    ex.InnerException?.Message));
            }
        }

        [Authorize]
        [HttpPost("upload-profile-image")]
        public async Task<ActionResult<ServiceResponse<object>>> UploadProfileImage(IFormFile file)
        {
            try
            {
                var userResponse = await _userService.LoadUser();
                if (userResponse?.Data == null)
                {
                    return Unauthorized(new { Message = "User not found" });
                }

                if (file == null || file.Length == 0)
                {
                    return BadRequest(new ServiceResponse<object>
                    {
                        Success = false,
                        Message = "No file provided"
                    });
                }

                // Validate file type
                if (!file.ContentType.StartsWith("image/"))
                {
                    return BadRequest(new ServiceResponse<object>
                    {
                        Success = false,
                        Message = "File must be an image"
                    });
                }

                // Validate file size (max 5MB)
                if (file.Length > 5 * 1024 * 1024)
                {
                    return BadRequest(new ServiceResponse<object>
                    {
                        Success = false,
                        Message = "Image size must be less than 5MB"
                    });
                }

                // Get or create container
                var containerName = "profile-images";
                var containerClient = _blobServiceClient.GetBlobContainerClient(containerName);
                await containerClient.CreateIfNotExistsAsync(PublicAccessType.None);

                // Generate unique blob name
                var blobName = $"{userResponse.Data.Id}/{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
                var blobClient = containerClient.GetBlobClient(blobName);

                // Upload file
                using (var stream = file.OpenReadStream())
                {
                    await blobClient.UploadAsync(stream, overwrite: true);
                }

                // Generate SAS URL (valid for 1 year for profile images)
                var sasUri = _azureBlobService.GenerateBlobSasUri(
                    _blobServiceClient,
                    blobClient,
                    TimeSpan.FromDays(365)
                );

                // Update user's profile image URL
                var dbUser = await _dataContext.Users.FindAsync(userResponse.Data.Id);
                if (dbUser != null)
                {
                    // Delete old image if it exists
                    if (!string.IsNullOrEmpty(dbUser.ProfileImageUrl))
                    {
                        try
                        {
                            var oldBlobName = dbUser.ProfileImageUrl.Split('/').Last().Split('?').First();
                            var oldBlobClient = containerClient.GetBlobClient(oldBlobName);
                            await oldBlobClient.DeleteIfExistsAsync();
                        }
                        catch
                        {
                            // Ignore errors when deleting old image
                        }
                    }

                    dbUser.ProfileImageUrl = sasUri;
                    dbUser.UpdatedDate = DateTime.Now;
                    await _dataContext.SaveChangesAsync();
                }

                return Ok(new ServiceResponse<object>
                {
                    Success = true,
                    Message = "Profile image uploaded successfully",
                    Data = new { imageUrl = sasUri, profileImageUrl = sasUri }
                });
            }
            catch (Exception ex)
            {
                return BadRequest(ServiceResponse<object>.CreateError(
                    "Error uploading profile image",
                    ex.Message,
                    ex.InnerException?.Message));
            }
        }

        /// <summary>
        /// Disable account - suspends user, disables notifications, and pauses subscription
        /// </summary>
        [HttpPost("disable-account")]
        [Authorize(Roles = "Landlord,Admin")]
        public async Task<IActionResult> DisableAccount()
        {
            try
            {
                var currentUserResponse = await _userService.GetCurrentUserIdAsync();
                if (!currentUserResponse.Success || !currentUserResponse.Data.HasValue)
                {
                    return Unauthorized(new ServiceResponse<object>
                    {
                        Success = false,
                        Message = "User not authenticated"
                    });
                }

                var userId = currentUserResponse.Data.Value;

                // 1. Suspend the user account
                var suspendResponse = await _userService.SuspendUser(userId);
                if (!suspendResponse.Success)
                {
                    return BadRequest(new ServiceResponse<object>
                    {
                        Success = false,
                        Message = suspendResponse.Message
                    });
                }

                // 2. Disable all notifications
                var notificationSettings = await _notificationSettingRepository.GetNotificationSettings(userId);
                if (notificationSettings != null)
                {
                    notificationSettings.EmailEnabled = false;
                    notificationSettings.PhoneEnabled = false;
                    await _notificationSettingRepository.UpdateNotificationSettings(notificationSettings);
                }

                // 3. Pause subscription (if exists)
                var pauseResponse = await _subscriptionService.PauseSubscriptionAsync(pauseAtPeriodEnd: false);
                // Don't fail if subscription doesn't exist or is already paused
                if (!pauseResponse.Success && !pauseResponse.Message.Contains("already paused") && !pauseResponse.Message.Contains("No subscription found"))
                {
                    _logger.LogWarning("Failed to pause subscription for user {UserId}: {Message}", userId, pauseResponse.Message);
                }

                return Ok(new ServiceResponse<object>
                {
                    Success = true,
                    Message = "Account has been disabled successfully. Notifications are disabled and subscription is paused."
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error disabling account");
                return StatusCode(500, ServiceResponse<object>.CreateError(
                    "An error occurred while disabling account",
                    ex.Message,
                    ex.InnerException?.Message,
                    500));
            }
        }

    }
}
