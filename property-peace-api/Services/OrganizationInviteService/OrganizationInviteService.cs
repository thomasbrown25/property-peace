using brownstone_hub_api.Dtos.OrganizationInvite;
using brownstone_hub_api.Dtos.OrganizationMember;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.OrganizationMemberService;
using brownstone_hub_api.Services.EmailService;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using System.Security.Cryptography;
using System.Text;
using System.Net.Mail;

namespace brownstone_hub_api.Services.OrganizationInviteService
{
    public class OrganizationInviteService : IOrganizationInviteService
    {
        private readonly IOrganizationInviteRepository _inviteRepository;
        private readonly IOrganizationRepository _organizationRepository;
        private readonly IOrganizationMemberRepository _memberRepository;
        private readonly IOrganizationMemberService _memberService;
        private readonly IUserRepository _userRepository;
        private readonly IEmailService _emailService;
        private readonly IConfiguration _configuration;
        private readonly IWebHostEnvironment _environment;
        private readonly ILogger<OrganizationInviteService> _logger;

        public OrganizationInviteService(
            IOrganizationInviteRepository inviteRepository,
            IOrganizationRepository organizationRepository,
            IOrganizationMemberRepository memberRepository,
            IOrganizationMemberService memberService,
            IUserRepository userRepository,
            IEmailService emailService,
            IConfiguration configuration,
            IWebHostEnvironment environment,
            ILogger<OrganizationInviteService> logger)
        {
            _inviteRepository = inviteRepository;
            _organizationRepository = organizationRepository;
            _memberRepository = memberRepository;
            _memberService = memberService;
            _userRepository = userRepository;
            _emailService = emailService;
            _configuration = configuration;
            _environment = environment;
            _logger = logger;
        }

        public async Task<ServiceResponse<LoadOrganizationInviteDto>> CreateInviteAsync(CreateOrganizationInviteDto dto, long invitedByUserId)
        {
            try
            {
                dto.Email = dto.Email?.Trim().ToLowerInvariant() ?? string.Empty;
                dto.Role = dto.Role?.Trim() ?? string.Empty;

                try
                {
                    var parsedEmail = new MailAddress(dto.Email);
                    if (!string.Equals(parsedEmail.Address, dto.Email, StringComparison.OrdinalIgnoreCase))
                    {
                        throw new FormatException();
                    }
                }
                catch
                {
                    return ServiceResponse<LoadOrganizationInviteDto>.CreateError("Invalid email", "Enter a valid email address.", "", 400);
                }

                var allowedRoles = new[] { "Owner", "Manager", "Viewer" };
                var canonicalRole = allowedRoles.FirstOrDefault(role => string.Equals(role, dto.Role, StringComparison.OrdinalIgnoreCase));
                if (canonicalRole == null)
                {
                    return ServiceResponse<LoadOrganizationInviteDto>.CreateError("Invalid role", "Role must be Owner, Manager, or Viewer.", "", 400);
                }
                dto.Role = canonicalRole;

                // Verify organization exists
                var organization = await _organizationRepository.GetOrganizationByIdAsync(dto.OrganizationId);
                if (organization == null)
                {
                    return ServiceResponse<LoadOrganizationInviteDto>.CreateError("Organization not found", "The specified organization does not exist.");
                }

                // Check if inviter has permission
                var inviterMember = await _memberRepository.GetMemberAsync(dto.OrganizationId, invitedByUserId);
                if (inviterMember == null || (!inviterMember.CanManageMembers && inviterMember.Role != "Owner"))
                {
                    return ServiceResponse<LoadOrganizationInviteDto>.CreateError("Unauthorized", "You do not have permission to invite members.", "", 403);
                }

                if (dto.Role == "Owner" && inviterMember.Role != "Owner")
                {
                    return ServiceResponse<LoadOrganizationInviteDto>.CreateError("Unauthorized", "Only an organization owner can invite another owner.", "", 403);
                }

                // Check if user already has an account and is already a member
                var userByEmail = await _userRepository.GetUserByEmailAsync(dto.Email);
                if (userByEmail != null)
                {
                    // User exists - check if already a member
                    var isMember = await _memberRepository.IsUserMemberOfOrganizationAsync(userByEmail.Id, dto.OrganizationId);
                    if (isMember)
                    {
                        return ServiceResponse<LoadOrganizationInviteDto>.CreateError("User already a member", "This user is already a member of the organization.");
                    }
                    // User exists but is not a member - continue with normal invite flow
                    // They will need to accept the invite through the link
                }
                
                // Check if there's already a pending member record (by email, with null UserId)
                var existingPendingMember = await _memberRepository.GetPendingMemberByEmailAsync(dto.OrganizationId, dto.Email);
                if (existingPendingMember != null)
                {
                    return ServiceResponse<LoadOrganizationInviteDto>.CreateError("Member already invited", "A member record already exists for this email. Please check pending invites.");
                }

                // Check if there's already a pending invite
                var existingInvite = await _inviteRepository.InviteExistsAsync(dto.Email, dto.OrganizationId);
                if (existingInvite)
                {
                    return ServiceResponse<LoadOrganizationInviteDto>.CreateError("Invite already exists", "A pending invite already exists for this email.");
                }

                // Generate secure token
                var token = GenerateSecureToken();

                var invite = new OrganizationInvite
                {
                    OrganizationId = dto.OrganizationId,
                    Email = dto.Email,
                    Role = dto.Role,
                    Token = token,
                    InvitedBy = invitedByUserId,
                    ExpiresAt = DateTime.Now.AddDays(7), // Invite expires in 7 days
                    IsAccepted = false,
                    CreatedAt = DateTime.Now
                };

                var createdInvite = await _inviteRepository.CreateInviteAsync(invite);
                
                // Create OrganizationMember record with null UserId (account not created yet)
                var permissions = GetPermissionsForRole(dto.Role);
                var member = new OrganizationMember
                {
                    OrganizationId = dto.OrganizationId,
                    UserId = null, // User account will be created when invite is accepted
                    Email = dto.Email, // Store email from invite
                    Role = dto.Role,
                    InvitedBy = invitedByUserId,
                    JoinedAt = DateTime.Now,
                    IsActive = false, // Not active until account is created
                    CanManageProperties = permissions.CanManageProperties,
                    CanManageTenants = permissions.CanManageTenants,
                    CanManageLeases = permissions.CanManageLeases,
                    CanManageMaintenance = permissions.CanManageMaintenance,
                    CanManageBilling = permissions.CanManageBilling,
                    CanManageMembers = permissions.CanManageMembers
                };
                
                await _memberRepository.AddMemberAsync(member);
                
                var inviteDto = await MapToLoadDtoAsync(createdInvite);

                // Send invite email
                await SendInviteEmailAsync(createdInvite, organization);

                return ServiceResponse<LoadOrganizationInviteDto>.CreateSuccess(inviteDto, "Invite created successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating invite");
                return ServiceResponse<LoadOrganizationInviteDto>.CreateError("Error creating invite", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadOrganizationInviteDto>> GetInviteByTokenAsync(string token)
        {
            try
            {
                var invite = await _inviteRepository.GetInviteByTokenAsync(token);
                if (invite == null)
                {
                    return ServiceResponse<LoadOrganizationInviteDto>.CreateError("Invite not found", "The specified invite does not exist or has expired.");
                }

                if (invite.ExpiresAt < DateTime.Now)
                {
                    return ServiceResponse<LoadOrganizationInviteDto>.CreateError("Invite expired", "This invite has expired.");
                }

                // Check if user already has an account with this email
                var userByEmail = await _userRepository.GetUserByEmailAsync(invite.Email);
                var hasAccount = userByEmail != null;

                var inviteDto = await MapToLoadDtoAsync(invite);
                inviteDto.HasAccount = hasAccount;
                
                return ServiceResponse<LoadOrganizationInviteDto>.CreateSuccess(inviteDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving invite");
                return ServiceResponse<LoadOrganizationInviteDto>.CreateError("Error retrieving invite", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadOrganizationInviteDto>>> GetInvitesByOrganizationIdAsync(long organizationId, long userId)
        {
            try
            {
                // Verify user is a member and has permission
                // Owners and Managers can view invites (Managers should have this permission)
                var member = await _memberRepository.GetMemberAsync(organizationId, userId);
                if (member == null)
                {
                    return ServiceResponse<List<LoadOrganizationInviteDto>>.CreateError("Unauthorized", "You are not a member of this organization.", "", 403);
                }
                
                // Allow Owners, Managers, and members with CanManageMembers permission
                if (member.Role != "Owner" && member.Role != "Manager" && !member.CanManageMembers)
                {
                    return ServiceResponse<List<LoadOrganizationInviteDto>>.CreateError("Unauthorized", "You do not have permission to view invites.", "", 403);
                }

                var invites = await _inviteRepository.GetInvitesByOrganizationIdAsync(organizationId);
                var inviteDtos = new List<LoadOrganizationInviteDto>();

                foreach (var invite in invites)
                {
                    inviteDtos.Add(await MapToLoadDtoAsync(invite));
                }

                return ServiceResponse<List<LoadOrganizationInviteDto>>.CreateSuccess(inviteDtos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving invites");
                return ServiceResponse<List<LoadOrganizationInviteDto>>.CreateError("Error retrieving invites", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadOrganizationInviteDto>>> GetPendingInvitesByEmailAsync(string email)
        {
            try
            {
                var invites = await _inviteRepository.GetPendingInvitesByEmailAsync(email);
                var inviteDtos = new List<LoadOrganizationInviteDto>();

                foreach (var invite in invites)
                {
                    inviteDtos.Add(await MapToLoadDtoAsync(invite));
                }

                return ServiceResponse<List<LoadOrganizationInviteDto>>.CreateSuccess(inviteDtos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving pending invites");
                return ServiceResponse<List<LoadOrganizationInviteDto>>.CreateError("Error retrieving invites", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> AcceptInviteAsync(AcceptOrganizationInviteDto dto, long userId)
        {
            try
            {
                var invite = await _inviteRepository.GetInviteByTokenAsync(dto.Token);
                if (invite == null)
                {
                    return ServiceResponse<bool>.CreateError("Invite not found", "The specified invite does not exist or has expired.");
                }

                if (invite.IsAccepted)
                {
                    return ServiceResponse<bool>.CreateError("Invite already accepted", "This invite has already been accepted.");
                }

                if (invite.ExpiresAt < DateTime.Now)
                {
                    return ServiceResponse<bool>.CreateError("Invite expired", "This invite has expired.");
                }

                var user = await _userRepository.GetUser(userId);
                if (user == null)
                {
                    return ServiceResponse<bool>.CreateError("User not found", "The specified user does not exist.");
                }

                if (user.Email.ToLower() != invite.Email.ToLower())
                {
                    return ServiceResponse<bool>.CreateError("Email mismatch", "This invite was sent to a different email address.");
                }

                // Check if user is already a member
                var isMember = await _memberRepository.IsUserMemberOfOrganizationAsync(userId, invite.OrganizationId);
                if (isMember)
                {
                    return ServiceResponse<bool>.CreateError("Already a member", "You are already a member of this organization.");
                }

                // Find existing member record (created when invite was sent, with null UserId)
                var existingMember = await _memberRepository.GetPendingMemberByEmailAsync(invite.OrganizationId, invite.Email);
                
                if (existingMember != null)
                {
                    // Update existing member record with UserId
                    existingMember.UserId = userId;
                    existingMember.IsActive = true;
                    existingMember.Email = null; // Clear email now that UserId is set
                    await _memberRepository.UpdateMemberAsync(existingMember);
                }
                else
                {
                    // Fallback: Create new member record if one doesn't exist
                    var addMemberDto = new AddOrganizationMemberDto
                    {
                        OrganizationId = invite.OrganizationId,
                        UserId = userId,
                        Role = invite.Role,
                        InvitedBy = invite.InvitedBy
                    };

                    var addMemberResponse = await _memberService.AddMemberAsync(addMemberDto, invite.InvitedBy);
                    if (!addMemberResponse.Success)
                    {
                        return ServiceResponse<bool>.CreateError("Error adding member", addMemberResponse.Message);
                    }
                }

                // Mark invite as accepted
                invite.IsAccepted = true;
                invite.AcceptedAt = DateTime.Now;
                invite.AcceptedBy = userId;
                await _inviteRepository.UpdateInviteAsync(invite);

                // Update user's CurrentOrganizationId if they don't have one set
                if (user.CurrentOrganizationId == null)
                {
                    var updated = await _userRepository.UpdateCurrentOrganizationIdAsync(userId, invite.OrganizationId);
                    if (updated)
                    {
                        _logger.LogInformation("Set CurrentOrganizationId to {OrganizationId} for user {UserId}", invite.OrganizationId, userId);
                    }
                    else
                    {
                        _logger.LogWarning("Failed to update CurrentOrganizationId for user {UserId}", userId);
                    }
                }

                return ServiceResponse<bool>.CreateSuccess(true, "Invite accepted successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error accepting invite");
                return ServiceResponse<bool>.CreateError("Error accepting invite", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> DeleteInviteAsync(long inviteId, long userId)
        {
            try
            {
                var invite = await _inviteRepository.GetInviteByIdAsync(inviteId);
                if (invite == null)
                {
                    return ServiceResponse<bool>.CreateError("Invite not found", "The specified invite does not exist.");
                }

                // Check if user has permission
                var member = await _memberRepository.GetMemberAsync(invite.OrganizationId, userId);
                if (member == null || (!member.CanManageMembers && member.Role != "Owner"))
                {
                    return ServiceResponse<bool>.CreateError("Unauthorized", "You do not have permission to delete invites.", "", 403);
                }

                var pendingMember = !invite.IsAccepted
                    ? await _memberRepository.GetPendingMemberByEmailAsync(invite.OrganizationId, invite.Email)
                    : null;

                var result = await _inviteRepository.DeleteInviteAsync(inviteId);
                if (result && pendingMember != null)
                {
                    await _memberRepository.RemoveMemberByIdAsync(invite.OrganizationId, pendingMember.Id);
                }
                return ServiceResponse<bool>.CreateSuccess(result, "Invite deleted successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting invite");
                return ServiceResponse<bool>.CreateError("Error deleting invite", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadOrganizationInviteDto>> ResendInviteAsync(long inviteId, long userId)
        {
            try
            {
                var invite = await _inviteRepository.GetInviteByIdAsync(inviteId);
                if (invite == null)
                {
                    return ServiceResponse<LoadOrganizationInviteDto>.CreateError("Invite not found", "The specified invite does not exist.");
                }

                // Check if user has permission
                var member = await _memberRepository.GetMemberAsync(invite.OrganizationId, userId);
                if (member == null || (!member.CanManageMembers && member.Role != "Owner"))
                {
                    return ServiceResponse<LoadOrganizationInviteDto>.CreateError("Unauthorized", "You do not have permission to resend invites.", "", 403);
                }

                // Check if invite is already accepted
                if (invite.IsAccepted)
                {
                    return ServiceResponse<LoadOrganizationInviteDto>.CreateError("Invite already accepted", "Cannot resend an invite that has already been accepted.");
                }

                // Generate new secure token
                var newToken = GenerateSecureToken();
                
                // Update invite with new token and extend expiration
                invite.Token = newToken;
                invite.ExpiresAt = DateTime.Now.AddDays(7); // Reset expiration to 7 days from now
                invite.CreatedAt = DateTime.Now; // Update created date to reflect resend
                
                var updatedInvite = await _inviteRepository.UpdateInviteAsync(invite);
                var inviteDto = await MapToLoadDtoAsync(updatedInvite);

                // Send invite email with new token
                var organization = await _organizationRepository.GetOrganizationByIdAsync(invite.OrganizationId);
                await SendInviteEmailAsync(updatedInvite, organization);

                return ServiceResponse<LoadOrganizationInviteDto>.CreateSuccess(inviteDto, "Invite resent successfully with new token");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resending invite");
                return ServiceResponse<LoadOrganizationInviteDto>.CreateError("Error resending invite", ex.Message);
            }
        }

        private async Task<LoadOrganizationInviteDto> MapToLoadDtoAsync(OrganizationInvite invite)
        {
            var organization = await _organizationRepository.GetOrganizationByIdAsync(invite.OrganizationId);
            var invitedBy = await _userRepository.GetUser(invite.InvitedBy);
            var acceptedBy = invite.AcceptedBy.HasValue ? await _userRepository.GetUser(invite.AcceptedBy.Value) : null;

            return new LoadOrganizationInviteDto
            {
                Id = invite.Id,
                OrganizationId = invite.OrganizationId,
                OrganizationName = organization?.Name ?? string.Empty,
                Email = invite.Email,
                Role = invite.Role,
                Token = invite.Token,
                InvitedBy = invite.InvitedBy,
                InvitedByName = invitedBy != null ? $"{invitedBy.FirstName} {invitedBy.LastName}" : string.Empty,
                ExpiresAt = invite.ExpiresAt,
                IsAccepted = invite.IsAccepted,
                AcceptedAt = invite.AcceptedAt,
                AcceptedBy = invite.AcceptedBy,
                CreatedAt = invite.CreatedAt
            };
        }

        private string GenerateSecureToken()
        {
            using var rng = RandomNumberGenerator.Create();
            var bytes = new byte[32];
            rng.GetBytes(bytes);
            return Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").Replace("=", "");
        }
        
        private (bool CanManageProperties, bool CanManageTenants, bool CanManageLeases, bool CanManageMaintenance, bool CanManageBilling, bool CanManageMembers) GetPermissionsForRole(string role)
        {
            return role.ToLower() switch
            {
                "owner" => (true, true, true, true, true, true),
                "manager" => (true, true, true, true, false, false),
                "viewer" => (false, false, false, false, false, false),
                _ => (false, false, false, false, false, false)
            };
        }

        private async Task SendInviteEmailAsync(OrganizationInvite invite, Organization? organization)
        {
            try
            {
                var organizationName = organization?.Name ?? "the organization";
                var inviter = await _userRepository.GetUser(invite.InvitedBy);
                var inviterName = inviter != null ? $"{inviter.FirstName} {inviter.LastName}" : "Team Member";
                
                // Build invite URL - use localhost in development, otherwise use configured URL
                string frontendBaseUrl;
                if (_environment.IsDevelopment())
                {
                    frontendBaseUrl = "http://localhost:3000";
                }
                else
                {
                    frontendBaseUrl = _configuration["FrontendBaseUrl"] ?? "https://landlord.brownstonehub.com";
                }
                var inviteUrl = $"{frontendBaseUrl.TrimEnd('/')}/organization/invite/{invite.Token}";

                var subject = $"You've been invited to join {organizationName} on Property Peace";
                
                var plainTextBody = $@"Hello,

You have been invited by {inviterName} to join {organizationName} on Property Peace.

Click the link below to accept your invitation:
{inviteUrl}

This invitation will expire on {invite.ExpiresAt:MMMM dd, yyyy}.

If you did not expect this invitation, please ignore this email.

Best regards,
Property Peace Team";

                var htmlContent = $@"<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
        }}
        .email-wrapper {{
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .header {{
            background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
            color: #ffffff;
            padding: 40px 30px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            font-size: 32px;
            font-weight: 600;
        }}
        .content {{
            padding: 40px 30px;
        }}
        .content h2 {{
            color: #1976d2;
            margin-top: 0;
            font-size: 24px;
            font-weight: 600;
        }}
        .greeting {{
            font-size: 16px;
            margin-bottom: 20px;
        }}
        .button-container {{
            text-align: center;
            margin: 30px 0;
        }}
        .button {{
            display: inline-block;
            padding: 16px 40px;
            background-color: #1976d2;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            transition: background-color 0.3s;
        }}
        .button:hover {{
            background-color: #1565c0;
        }}
        .info-box {{
            background-color: #f8f9fa;
            border-left: 4px solid #1976d2;
            padding: 20px;
            margin: 30px 0;
            border-radius: 4px;
        }}
        .info-box p {{
            margin: 8px 0;
        }}
        .expiry-notice {{
            background-color: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 4px;
            padding: 15px;
            margin: 30px 0;
            text-align: center;
        }}
        .expiry-notice p {{
            margin: 0;
            color: #856404;
        }}
        .signature {{
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
        }}
        .team-name {{
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
            <h1>Property Peace</h1>
        </div>
        <div class='content'>
            <h2>You've been invited to join {organizationName}</h2>
            <p class='greeting'>Hello,</p>
            <p>You have been invited by <strong>{inviterName}</strong> to join <strong>{organizationName}</strong> on <strong>Property Peace</strong>, a modern property management platform.</p>
            
            <div class='button-container'>
                <a href='{inviteUrl}' class='button'>Accept Invitation</a>
            </div>
            
            <div class='info-box'>
                <p><strong>What you can do as a team member:</strong></p>
                <p style='margin-top: 8px;'>• Manage properties and units<br>
                • Handle tenant applications and leases<br>
                • Track maintenance requests<br>
                • Process rent payments<br>
                • Communicate with tenants and team members</p>
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
                    plainTextContent: plainTextBody
                );

                if (emailSent)
                {
                    _logger.LogInformation("Organization invite email sent successfully to {Email}", invite.Email);
                }
                else
                {
                    _logger.LogWarning("Failed to send organization invite email to {Email}", invite.Email);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending organization invite email to {Email}", invite.Email);
                // Don't throw - email failure shouldn't break the invite creation
            }
        }
    }
}

