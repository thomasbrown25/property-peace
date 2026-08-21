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

        public async Task<ServiceResponse<LoadOrganizationInviteDto>> CreateInviteAsync(CreateOrganizationInviteDto dto, long selectedOrganizationId, long invitedByUserId)
        {
            try
            {
                if (selectedOrganizationId <= 0 || dto.OrganizationId != selectedOrganizationId)
                {
                    return ServiceResponse<LoadOrganizationInviteDto>.CreateError("Unauthorized", "Organization access denied.", "", 403);
                }

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
                if (organization == null || !organization.IsActive || organization.IsDeleted)
                {
                    return ServiceResponse<LoadOrganizationInviteDto>.CreateError("Organization not found", "The specified organization does not exist.");
                }

                // Check if inviter has permission
                var inviterMember = await _memberRepository.GetMemberAsync(dto.OrganizationId, invitedByUserId);
                if (inviterMember == null || !inviterMember.IsActive ||
                    inviterMember.OrganizationId != dto.OrganizationId || inviterMember.UserId != invitedByUserId ||
                    (!inviterMember.CanManageMembers && !string.Equals(inviterMember.Role, "Owner", StringComparison.OrdinalIgnoreCase)))
                {
                    return ServiceResponse<LoadOrganizationInviteDto>.CreateError("Unauthorized", "You do not have permission to invite members.", "", 403);
                }

                if (dto.Role == "Owner" && !string.Equals(inviterMember.Role, "Owner", StringComparison.OrdinalIgnoreCase))
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

                // Owner authority is revalidated when the role is actually activated, not only
                // when the invitation was originally created.
                var organization = await _organizationRepository.GetOrganizationByIdAsync(invite.OrganizationId);
                if (organization == null || !organization.IsActive || organization.IsDeleted)
                {
                    return ServiceResponse<bool>.CreateError("Invite unavailable", "This invite cannot be accepted.", "", 403);
                }
                if (string.Equals(invite.Role, "Owner", StringComparison.OrdinalIgnoreCase))
                {
                    var grantingOwner = await _memberRepository.GetMemberAsync(invite.OrganizationId, invite.InvitedBy);
                    if (grantingOwner == null || !grantingOwner.IsActive ||
                        grantingOwner.OrganizationId != invite.OrganizationId || grantingOwner.UserId != invite.InvitedBy ||
                        !string.Equals(grantingOwner.Role, "Owner", StringComparison.OrdinalIgnoreCase))
                    {
                        return ServiceResponse<bool>.CreateError("Invite unavailable", "This invite cannot be accepted.", "", 403);
                    }
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

                    var addMemberResponse = await _memberService.AddMemberAsync(addMemberDto, invite.OrganizationId, invite.InvitedBy);
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
        body {{ margin:0; padding:0; background:#f4f4f3; color:#3f454d; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; }}
        .outer {{ width:100%; background:#f4f4f3; padding:28px 0; }}
        .wrap {{ max-width:680px; margin:0 auto; background:#ffffff; border-radius:10px; overflow:hidden; }}
        .logo {{ padding:34px 28px 30px; text-align:center; background:#ffffff; border-bottom:1px solid #e8ecef; }}
        .logo img {{ width:190px; max-width:70%; height:auto; display:inline-block; }}
        .content {{ padding:34px 42px 38px; font-size:16px; line-height:1.65; }}
        .eyebrow {{ margin:0 0 8px; color:#64707c; font-size:13px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }}
        h1 {{ margin:0 0 18px; color:#15212d; font-size:26px; line-height:1.25; font-weight:700; }}
        h2 {{ margin:0 0 10px; color:#15212d; font-size:18px; line-height:1.35; }}
        p {{ margin:0 0 18px; }}
        .button-container {{ margin:26px 0 28px; }}
        .button {{ display:inline-block; padding:14px 28px; background:#1464cc; color:#ffffff !important; text-decoration:none; border-radius:8px; font-size:16px; font-weight:700; }}
        .info-box {{ background:#f8faf9; border:1px solid #e5ebe8; border-radius:10px; padding:18px 20px; margin:0 0 18px; }}
        .info-box ul {{ padding-left:20px; margin:8px 0 0; }}
        .info-box li {{ margin:7px 0; }}
        .expiry-note {{ background:#fff8e6; border:1px solid #f1d38a; color:#5f4508; border-radius:10px; padding:14px 16px; margin:0 0 26px; }}
        .expiry-note strong {{ color:#493505; }}
        .muted {{ color:#64707c; font-size:14px; }}
        hr {{ border:0; border-top:1px solid #e1e5e8; margin:28px 0; }}
        .footer {{ background:#062d42; color:#d8e2e7; padding:30px 28px; text-align:center; font-size:13px; line-height:1.6; }}
        .footer a {{ color:#ffffff; font-weight:700; text-decoration:none; margin:0 12px; }}
        .footer .reason {{ color:#d8e2e7; margin:18px auto 0; max-width:520px; font-size:12px; }}
        .copyright {{ color:#a9bbc4; margin-top:18px; }}
        @media only screen and (max-width: 640px) {{
            .outer {{ padding:0; }}
            .wrap {{ border-radius:0; }}
            .content {{ padding:28px 24px 32px; }}
            .button {{ display:block; text-align:center; }}
        }}
    </style>
</head>
<body>
    <div class='outer'>
        <div class='wrap'>
            <div class='logo'>
                <img src='https://propertypeace.io/images/logos/property-peace-dark.png' alt='Property Peace'>
            </div>
            <div class='content'>
                <p class='eyebrow'>Team invitation</p>
                <h1>You've been invited to join {organizationName}</h1>
                <p>Hello,</p>
                <p><strong>{inviterName}</strong> invited you to join <strong>{organizationName}</strong> on Property Peace.</p>
                <div class='button-container'>
                    <a href='{inviteUrl}' class='button'>Accept Invitation</a>
                </div>
                <div class='info-box'>
                    <h2>What you can do as a team member</h2>
                    <ul>
                        <li>Manage properties and units</li>
                        <li>Handle tenant applications and leases</li>
                        <li>Track maintenance requests</li>
                        <li>Process rent payments</li>
                        <li>Communicate with tenants and team members</li>
                    </ul>
                </div>
                <div class='expiry-note'>This invitation expires on <strong>{invite.ExpiresAt:MMMM dd, yyyy}</strong>.</div>
                <p class='muted'>If you did not expect this invitation, you can safely ignore this email.</p>
                <hr>
                <p>Thanks,<br>Property Peace</p>
            </div>
            <div class='footer'>
                <div><a href='https://propertypeace.io'>Website</a><a href='https://x.com/PropertyPeace'>Twitter / X</a><a href='https://www.instagram.com/propertypeace'>Instagram</a></div>
                <div class='reason'>This automated invitation was sent by a Property Peace organization member. Please do not reply to this message.</div>
                <div class='copyright'>© 2026 Property Peace. All rights reserved.</div>
            </div>
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

