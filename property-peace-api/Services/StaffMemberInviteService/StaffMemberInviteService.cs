using System.Security.Cryptography;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.StaffMember;
using brownstone_hub_api.Repositories.StaffMembers;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.EmailService;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.StaffMemberInviteService
{
    public class StaffMemberInviteService(
        IStaffMemberInviteRepository staffMemberInviteRepository,
        IStaffMemberRepository staffMemberRepository,
        IUserRepository userRepository,
        DataContext dataContext,
        IConfiguration configuration,
        IEmailService emailService,
        ILogger<StaffMemberInviteService> logger) : IStaffMemberInviteService
    {
        private readonly IStaffMemberInviteRepository _staffMemberInviteRepository = staffMemberInviteRepository;
        private readonly IStaffMemberRepository _staffMemberRepository = staffMemberRepository;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly DataContext _dataContext = dataContext;
        private readonly IConfiguration _configuration = configuration;
        private readonly IEmailService _emailService = emailService;
        private readonly ILogger<StaffMemberInviteService> _logger = logger;

        private async Task<long?> GetCurrentUserIdAsync()
        {
            var user = await _userRepository.GetCurrentUser();
            return user?.Id;
        }

        public async Task<ServiceResponse<LoadStaffMemberInviteDto>> CreateInvite(AddStaffMemberInviteDto invite)
        {
            try
            {
                var landlordId = await GetCurrentUserIdAsync();
                if (!landlordId.HasValue)
                {
                    return ServiceResponse<LoadStaffMemberInviteDto>.CreateError("User not found", "User not authenticated", "", 401);
                }

                // Verify staff member exists and is a placeholder (no UserId)
                var staffMember = await _staffMemberRepository.GetStaffMemberById(invite.StaffMemberId);
                if (staffMember == null)
                {
                    return ServiceResponse<LoadStaffMemberInviteDto>.CreateError("Staff member not found");
                }

                if (staffMember.UserId.HasValue)
                {
                    return ServiceResponse<LoadStaffMemberInviteDto>.CreateError("Staff member already has an account");
                }

                // Check if a user with that email already exists
                var existingUser = await _userRepository.GetUserByEmailAsync(invite.Email);
                if (existingUser != null)
                {
                    // Return a special response indicating user exists - frontend will show confirmation dialog
                    return new ServiceResponse<LoadStaffMemberInviteDto>
                    {
                        Success = false,
                        Message = "USER_EXISTS",
                        Data = null,
                        StatusCode = 409 // Conflict
                    };
                }

                // Check if there's already a valid invite
                var existingInvites = await _staffMemberInviteRepository.GetInvitesByStaffMemberId(invite.StaffMemberId);
                var validInvite = existingInvites.FirstOrDefault(i => !i.IsUsed && i.ExpiresAt > DateTime.Now);
                if (validInvite != null)
                {
                    return ServiceResponse<LoadStaffMemberInviteDto>.CreateError("A valid invite already exists for this staff member");
                }

                // Generate secure token
                var inviteToken = GenerateSecureToken();
                var expiresAt = DateTime.Now.AddDays(7);

                var createdInvite = await _staffMemberInviteRepository.CreateInvite(invite, landlordId.Value, inviteToken, expiresAt);

                // Send invite email (simplified - can be expanded later)
                try
                {
                    await SendInviteEmailAsync(createdInvite, inviteToken);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to send invite email, but invite was created. Invite ID: {InviteId}", createdInvite.Id);
                }

                return new ServiceResponse<LoadStaffMemberInviteDto> { Data = createdInvite };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating staff member invite");
                return ServiceResponse<LoadStaffMemberInviteDto>.CreateError("Error creating invite", ex.Message);
            }
        }

        public async Task<ServiceResponse<ValidateStaffMemberInviteTokenDto>> ValidateInviteToken(string token)
        {
            try
            {
                var invite = await _staffMemberInviteRepository.GetInviteByToken(token);

                if (invite == null)
                {
                    return new ServiceResponse<ValidateStaffMemberInviteTokenDto>
                    {
                        Data = new ValidateStaffMemberInviteTokenDto
                        {
                            IsValid = false,
                            Message = "Invalid invite token"
                        }
                    };
                }

                if (invite.IsUsed)
                {
                    return new ServiceResponse<ValidateStaffMemberInviteTokenDto>
                    {
                        Data = new ValidateStaffMemberInviteTokenDto
                        {
                            IsValid = false,
                            Message = "This invite has already been used"
                        }
                    };
                }

                if (invite.ExpiresAt < DateTime.Now)
                {
                    return new ServiceResponse<ValidateStaffMemberInviteTokenDto>
                    {
                        Data = new ValidateStaffMemberInviteTokenDto
                        {
                            IsValid = false,
                            Message = "This invite has expired"
                        }
                    };
                }

                // Get organization and landlord information
                string? organizationName = null;
                string? landlordName = null;

                if (invite.StaffMember != null)
                {
                    organizationName = invite.StaffMember.OrganizationName;
                }

                var landlord = await _userRepository.GetUser(invite.CreatedBy);
                if (landlord != null)
                {
                    landlordName = $"{landlord.FirstName} {landlord.LastName}".Trim();
                    if (string.IsNullOrEmpty(landlordName))
                    {
                        landlordName = landlord.Email ?? "Your Organization";
                    }
                }

                return new ServiceResponse<ValidateStaffMemberInviteTokenDto>
                {
                    Data = new ValidateStaffMemberInviteTokenDto
                    {
                        IsValid = true,
                        Email = invite.Email,
                        StaffMemberId = invite.StaffMemberId,
                        StaffMember = invite.StaffMember,
                        OrganizationName = organizationName,
                        LandlordName = landlordName,
                        Message = "Invite is valid"
                    }
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating invite token");
                return ServiceResponse<ValidateStaffMemberInviteTokenDto>.CreateError("Error validating invite", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> AcceptInviteForExistingUser(AcceptStaffMemberInviteDto dto, long userId)
        {
            try
            {
                var inviteValidation = await ValidateInviteToken(dto.InviteToken);
                if (!inviteValidation.Success || inviteValidation.Data == null || !inviteValidation.Data.IsValid)
                {
                    return ServiceResponse<bool>.CreateError(
                        inviteValidation.Data?.Message ?? "Invalid or expired invite token"
                    );
                }

                var invite = await _staffMemberInviteRepository.GetInviteByToken(dto.InviteToken);
                if (invite == null)
                {
                    return ServiceResponse<bool>.CreateError("Invite not found");
                }

                if (!string.Equals(dto.Email, invite.Email, StringComparison.OrdinalIgnoreCase))
                {
                    return ServiceResponse<bool>.CreateError("Email does not match the invite");
                }

                var user = await _userRepository.GetUser(userId);
                if (user == null || !string.Equals(user.Email, dto.Email, StringComparison.OrdinalIgnoreCase))
                {
                    return ServiceResponse<bool>.CreateError("User email does not match");
                }

                // Get staff member entity
                var staffMemberEntity = await _dataContext.StaffMembers
                    .FirstOrDefaultAsync(sm => sm.Id == invite.StaffMemberId);

                if (staffMemberEntity == null)
                {
                    return ServiceResponse<bool>.CreateError("Staff member not found");
                }

                // Link user to staff member
                staffMemberEntity.UserId = userId;
                staffMemberEntity.UpdatedAt = DateTime.UtcNow;
                await _dataContext.SaveChangesAsync();

                // Mark invite as used
                await _staffMemberInviteRepository.MarkInviteAsUsed(dto.InviteToken);

                return new ServiceResponse<bool> { Data = true, Success = true };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error accepting invite for existing user");
                return ServiceResponse<bool>.CreateError("Error accepting invite", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> AcceptInviteByEmail(AcceptStaffMemberInviteDto dto)
        {
            try
            {
                var inviteValidation = await ValidateInviteToken(dto.InviteToken);
                if (!inviteValidation.Success || inviteValidation.Data == null || !inviteValidation.Data.IsValid)
                {
                    return ServiceResponse<bool>.CreateError(
                        inviteValidation.Data?.Message ?? "Invalid or expired invite token"
                    );
                }

                var invite = await _staffMemberInviteRepository.GetInviteByToken(dto.InviteToken);
                if (invite == null)
                {
                    return ServiceResponse<bool>.CreateError("Invite not found");
                }

                if (!string.Equals(dto.Email, invite.Email, StringComparison.OrdinalIgnoreCase))
                {
                    return ServiceResponse<bool>.CreateError("Email does not match the invite");
                }

                if (invite.IsUsed)
                {
                    return ServiceResponse<bool>.CreateError("This invite has already been accepted");
                }

                // Check if user exists
                var user = await _userRepository.GetUserByEmailAsync(dto.Email);
                if (user != null)
                {
                    // User exists - link to staff member
                    var staffMemberEntity = await _dataContext.StaffMembers
                        .FirstOrDefaultAsync(sm => sm.Id == invite.StaffMemberId);

                    if (staffMemberEntity == null)
                    {
                        return ServiceResponse<bool>.CreateError("Staff member not found");
                    }

                    staffMemberEntity.UserId = user.Id;
                    staffMemberEntity.UpdatedAt = DateTime.UtcNow;
                    await _dataContext.SaveChangesAsync();
                }
                // If user doesn't exist yet, they'll create account later and link then

                // Mark invite as used
                await _staffMemberInviteRepository.MarkInviteAsUsed(dto.InviteToken);

                return new ServiceResponse<bool> { Data = true, Success = true };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error accepting invite by email");
                return ServiceResponse<bool>.CreateError("Error accepting invite", ex.Message);
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

                var invite = await _staffMemberInviteRepository.GetInviteById(inviteId);
                if (invite == null)
                {
                    return ServiceResponse<bool>.CreateError("Invite not found");
                }

                if (invite.CreatedBy != landlordId.Value)
                {
                    return ServiceResponse<bool>.CreateError("You don't have permission to resend this invite");
                }

                // Mark old invite as used and create new one
                await _staffMemberInviteRepository.MarkInviteAsUsed(invite.InviteToken);

                var newInvite = new AddStaffMemberInviteDto
                {
                    StaffMemberId = invite.StaffMemberId,
                    Email = invite.Email
                };

                var newToken = GenerateSecureToken();
                var expiresAt = DateTime.Now.AddDays(7);

                var createdInvite = await _staffMemberInviteRepository.CreateInvite(newInvite, landlordId.Value, newToken, expiresAt);

                try
                {
                    await SendInviteEmailAsync(createdInvite, newToken);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to send resend email, but invite was created");
                }

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
                var result = await _staffMemberInviteRepository.MarkInviteAsUsed(token);
                return new ServiceResponse<bool> { Data = result };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error marking invite as used");
                return ServiceResponse<bool>.CreateError("Error marking invite as used", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadStaffMemberInviteDto>>> GetInvitesByStaffMemberId(long staffMemberId)
        {
            try
            {
                var invites = await _staffMemberInviteRepository.GetInvitesByStaffMemberId(staffMemberId);
                return new ServiceResponse<List<LoadStaffMemberInviteDto>> { Data = invites };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting invites by staff member id");
                return ServiceResponse<List<LoadStaffMemberInviteDto>>.CreateError("Error getting invites", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadStaffMemberInviteDto>>> GetInvitesByLandlordId()
        {
            try
            {
                var landlordId = await GetCurrentUserIdAsync();
                if (!landlordId.HasValue)
                {
                    return ServiceResponse<List<LoadStaffMemberInviteDto>>.CreateError("User not found", "User not authenticated", "", 401);
                }

                var invites = await _staffMemberInviteRepository.GetInvitesByLandlordId(landlordId.Value);
                return new ServiceResponse<List<LoadStaffMemberInviteDto>> { Data = invites };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting invites by landlord id");
                return ServiceResponse<List<LoadStaffMemberInviteDto>>.CreateError("Error getting invites", ex.Message);
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

                var invite = await _staffMemberInviteRepository.GetInviteById(inviteId);
                if (invite == null)
                {
                    return ServiceResponse<bool>.CreateError("Invite not found");
                }

                if (invite.CreatedBy != landlordId.Value)
                {
                    return ServiceResponse<bool>.CreateError("You don't have permission to delete this invite");
                }

                var result = await _staffMemberInviteRepository.DeleteInvite(inviteId);
                return new ServiceResponse<bool> { Data = result };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting invite");
                return ServiceResponse<bool>.CreateError("Error deleting invite", ex.Message);
            }
        }

        private async Task SendInviteEmailAsync(LoadStaffMemberInviteDto invite, string token)
        {
            var frontendBaseUrl = _configuration["FrontendBaseUrl"] ?? "http://localhost:3000";
            var inviteUrl = $"{frontendBaseUrl.TrimEnd('/')}/staff/invite/{token}";

            var staffMemberName = invite.StaffMember != null
                ? $"{invite.StaffMember.FirstName} {invite.StaffMember.LastName}".Trim()
                : "Staff Member";

            string landlordName = "Your Organization";
            string organizationName = invite.StaffMember?.OrganizationName ?? "the organization";

            var landlord = await _userRepository.GetUser(invite.CreatedBy);
            if (landlord != null)
            {
                landlordName = $"{landlord.FirstName} {landlord.LastName}".Trim();
                if (string.IsNullOrEmpty(landlordName))
                {
                    landlordName = landlord.Email ?? "Your Organization";
                }
            }

            var subject = $"Invitation to Join {organizationName} as Staff Member on Property Peace";
            var body = $@"
Hello {staffMemberName},

{landlordName} has invited you to join {organizationName} as a staff member on Property Peace.

Click the link below to accept the invitation:
{inviteUrl}

This invitation will expire on {invite.ExpiresAt:MMMM dd, yyyy}.

Best regards,
The Property Peace Team
";

            await _emailService.SendEmailAsync(invite.Email, subject, body);
        }

        private static string GenerateSecureToken()
        {
            var bytes = new byte[32];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(bytes);
            }
            return Convert.ToBase64String(bytes)
                .TrimEnd('=')
                .Replace('+', '-')
                .Replace('/', '_');
        }
    }
}
