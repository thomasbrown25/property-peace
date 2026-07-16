
using brownstone_hub_api.Dtos.Client;
using brownstone_hub_api.Repositories.Clients;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;

namespace brownstone_hub_api.Services.ClientService
{
    public class ClientService(
        IClientRepository clientRepository,
        IPropertyRepository propertyRepository,
        IHttpContextAccessor httpContextAccessor,
        IEmailService emailService,
        IConfiguration configuration,
        DataContext dataContext,
        IUserRepository userRepository,
        ILogger<ClientService> logger) : IClientService
    {
        private readonly IClientRepository _clientRepository = clientRepository;
        private readonly IPropertyRepository _propertyRepository = propertyRepository;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly IEmailService _emailService = emailService;
        private readonly IConfiguration _configuration = configuration;
        private readonly DataContext _dataContext = dataContext;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly ILogger<ClientService> _logger = logger;

        private long? GetOrganizationIdFromContext()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }

        public async Task<ServiceResponse<List<LoadClientDto>>> GetClientsByOrganization(long organizationId)
        {
            try
            {
                var clients = await _clientRepository.GetClientsByOrganizationId(organizationId);
                return new ServiceResponse<List<LoadClientDto>>
                {
                    Success = true,
                    Data = clients,
                    Message = "Clients retrieved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving clients for organization {OrganizationId}", organizationId);
                return ServiceResponse<List<LoadClientDto>>.CreateError("Error retrieving clients", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadClientDto>> GetClientById(long id)
        {
            try
            {
                var client = await _clientRepository.GetClientById(id);
                if (client == null)
                {
                    return ServiceResponse<LoadClientDto>.CreateError("Client not found", "The specified client does not exist.");
                }

                return new ServiceResponse<LoadClientDto>
                {
                    Success = true,
                    Data = client,
                    Message = "Client retrieved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving client {ClientId}", id);
                return ServiceResponse<LoadClientDto>.CreateError("Error retrieving client", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadClientDto>> AddOrUpdateClient(AddOrUpdateClientDto dto)
        {
            try
            {
                // Get organization ID from context
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadClientDto>.CreateError(
                        "Organization context is required",
                        "Organization context is required to create or update clients.",
                        "",
                        403
                    );
                }

                // Ensure organization ID matches
                if (dto.OrganizationId != organizationId.Value)
                {
                    return ServiceResponse<LoadClientDto>.CreateError(
                        "Invalid organization",
                        "Client must belong to the current organization.",
                        "",
                        403
                    );
                }

                LoadClientDto result;
                if (dto.Id.HasValue)
                {
                    // Update existing client
                    result = await _clientRepository.UpdateClient(dto.Id.Value, dto);
                    if (result == null)
                    {
                        return ServiceResponse<LoadClientDto>.CreateError("Client not found", "The specified client does not exist.");
                    }
                }
                else
                {
                    // Create new client
                    result = await _clientRepository.AddClient(dto);
                    
                    // Send invite email if requested
                    if (dto.SendInvite && !string.IsNullOrEmpty(dto.Email) && result != null)
                    {
                        try
                        {
                            await SendClientInviteAsync(result, dto.Email, organizationId.Value);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Failed to send client invite email, but client was created. Client ID: {ClientId}", result.Id);
                            // Don't fail the request if email fails - client is still created
                        }
                    }
                }

                return new ServiceResponse<LoadClientDto>
                {
                    Success = true,
                    Data = result,
                    Message = dto.Id.HasValue ? "Client updated successfully" : "Client created successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding/updating client");
                return ServiceResponse<LoadClientDto>.CreateError("Error saving client", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> DeleteClient(long id)
        {
            try
            {
                var result = await _clientRepository.DeleteClient(id);
                if (!result)
                {
                    return ServiceResponse<bool>.CreateError("Client not found", "The specified client does not exist.");
                }

                return new ServiceResponse<bool>
                {
                    Success = true,
                    Data = true,
                    Message = "Client deleted successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting client {ClientId}", id);
                return ServiceResponse<bool>.CreateError("Error deleting client", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> LinkPropertyToClient(long propertyId, long clientId)
        {
            try
            {
                // Verify client exists
                var client = await _clientRepository.GetClientById(clientId);
                if (client == null)
                {
                    return ServiceResponse<bool>.CreateError("Client not found", "The specified client does not exist.");
                }

                // Get property and update
                var property = await _propertyRepository.GetPropertyById(propertyId);
                if (property == null)
                {
                    return ServiceResponse<bool>.CreateError("Property not found", "The specified property does not exist.");
                }

                // Update property with client ID
                var updateDto = new Dtos.Property.UpdatePropertyDto
                {
                    Id = property.Id,
                    Name = property.Name,
                    Description = property.Description,
                    PropertyType = property.PropertyType,
                    StreetAddress = property.StreetAddress,
                    City = property.City,
                    State = property.State,
                    ZipCode = property.ZipCode,
                    YearBuilt = property.YearBuilt,
                    LotSize = property.LotSize,
                    LandlordId = property.LandlordId,
                    OrganizationId = property.OrganizationId,
                    PrimaryManagerId = property.PrimaryManagerId,
                    OperatingAccountId = property.OperatingAccountId,
                    ContactEmail = property.ContactEmail,
                    ContactPhone = property.ContactPhone,
                    MainImageUrl = property.MainImageUrl,
                    DateListed = property.DateListed,
                    IsActive = !property.IsDeleted,
                    IsOccupied = property.IsOccupied,
                    ClientId = clientId
                };
                await _propertyRepository.UpdateProperty(updateDto);

                return new ServiceResponse<bool>
                {
                    Success = true,
                    Data = true,
                    Message = "Property linked to client successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error linking property {PropertyId} to client {ClientId}", propertyId, clientId);
                return ServiceResponse<bool>.CreateError("Error linking property to client", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> UnlinkPropertyFromClient(long propertyId)
        {
            try
            {
                var property = await _propertyRepository.GetPropertyById(propertyId);
                if (property == null)
                {
                    return ServiceResponse<bool>.CreateError("Property not found", "The specified property does not exist.");
                }

                var updateDto = new Dtos.Property.UpdatePropertyDto
                {
                    Id = property.Id,
                    Name = property.Name,
                    Description = property.Description,
                    PropertyType = property.PropertyType,
                    StreetAddress = property.StreetAddress,
                    City = property.City,
                    State = property.State,
                    ZipCode = property.ZipCode,
                    YearBuilt = property.YearBuilt,
                    LotSize = property.LotSize,
                    LandlordId = property.LandlordId,
                    OrganizationId = property.OrganizationId,
                    PrimaryManagerId = property.PrimaryManagerId,
                    OperatingAccountId = property.OperatingAccountId,
                    ContactEmail = property.ContactEmail,
                    ContactPhone = property.ContactPhone,
                    MainImageUrl = property.MainImageUrl,
                    DateListed = property.DateListed,
                    IsActive = !property.IsDeleted,
                    IsOccupied = property.IsOccupied,
                    ClientId = null
                };
                await _propertyRepository.UpdateProperty(updateDto);

                return new ServiceResponse<bool>
                {
                    Success = true,
                    Data = true,
                    Message = "Property unlinked from client successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error unlinking property {PropertyId} from client", propertyId);
                return ServiceResponse<bool>.CreateError("Error unlinking property from client", ex.Message);
            }
        }

        private async Task SendClientInviteAsync(LoadClientDto client, string email, long organizationId)
        {
            try
            {
                _logger.LogInformation("[ClientService] Preparing to send client invite email to {Email}", email);

                // Get current user (landlord/PM who is sending the invite)
                var currentUser = await _userRepository.GetCurrentUser();
                if (currentUser == null)
                {
                    _logger.LogWarning("[ClientService] Cannot send invite - current user not found");
                    return;
                }

                // Generate secure token
                var inviteToken = GenerateSecureToken();
                var expiresAt = DateTime.Now.AddDays(7); // Invite expires in 7 days

                // Create client invite record
                var clientInvite = new ClientInvite
                {
                    ClientId = client.Id,
                    Email = email,
                    InviteToken = inviteToken,
                    ExpiresAt = expiresAt,
                    CreatedBy = currentUser.Id,
                    OrganizationId = organizationId,
                    IsUsed = false,
                    CreatedAt = DateTime.Now
                };

                await _dataContext.ClientInvites.AddAsync(clientInvite);
                await _dataContext.SaveChangesAsync();

                _logger.LogInformation("[ClientService] Client invite created. InviteId: {InviteId}", clientInvite.Id);

                // Get frontend base URL from configuration
                var frontendBaseUrl = _configuration["FrontendBaseUrl"] ?? "http://localhost:3000";
                var inviteUrl = $"{frontendBaseUrl.TrimEnd('/')}/client/invite/{inviteToken}";

                var clientName = $"{client.FirstName} {client.LastName}".Trim();
                if (string.IsNullOrEmpty(clientName))
                {
                    clientName = "Client";
                }

                var landlordName = $"{currentUser.Firstname} {currentUser.Lastname}".Trim();
                if (string.IsNullOrEmpty(landlordName))
                {
                    landlordName = currentUser.Email ?? "Your Property Manager";
                }

                // Email content
                var subject = $"Invitation to Create Your Client Portal Account on Property Peace";
                var body = $@"
Hello {clientName},

{landlordName} has invited you to create a client portal account on Property Peace.

Click the link below to create your account:
{inviteUrl}

Once you create your account, you'll be able to:
• View your property portfolio and statements
• Access financial reports and documents
• Communicate with {landlordName}
• Track property management activities

This invitation will expire on {expiresAt:MMMM dd, yyyy}.

If you did not expect this invitation, please ignore this email.

Best regards,
Property Peace Team
";

                // HTML email content
                var htmlContent = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>{subject}</title>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }}
        .email-wrapper {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; }}
        .header {{ background-color: #1890ff; color: white; padding: 20px; text-align: center; }}
        .content {{ padding: 30px; }}
        .button {{ display: inline-block; padding: 12px 30px; background-color: #1890ff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
        .footer {{ background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; color: #666; }}
    </style>
</head>
<body>
    <div class='email-wrapper'>
        <div class='header'>
            <h1>Property Peace</h1>
        </div>
        <div class='content'>
            <h2>Client Portal Invitation</h2>
            <p>Hello {clientName},</p>
            <p>{landlordName} has invited you to create a client portal account on Property Peace.</p>
            <p>Click the button below to create your account:</p>
            <a href='{inviteUrl}' class='button'>Create Account</a>
            <p>Once you create your account, you'll be able to:</p>
            <ul>
                <li>View your property portfolio and statements</li>
                <li>Access financial reports and documents</li>
                <li>Communicate with {landlordName}</li>
                <li>Track property management activities</li>
            </ul>
            <p>This invitation will expire on {expiresAt:MMMM dd, yyyy}.</p>
            <p>If you did not expect this invitation, please ignore this email.</p>
            <p>Best regards,<br>Property Peace Team</p>
        </div>
        <div class='footer'>
            <p>This is an automated email from Property Peace. Please do not reply to this message.</p>
        </div>
    </div>
</body>
</html>";

                var emailSent = await _emailService.SendEmailAsync(
                    to: email,
                    subject: subject,
                    htmlContent: htmlContent,
                    plainTextContent: body
                );

                if (emailSent)
                {
                    _logger.LogInformation("[ClientService] Client invite email sent successfully to {Email}", email);
                }
                else
                {
                    _logger.LogWarning("[ClientService] Failed to send client invite email to {Email}", email);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ClientService] Error sending client invite email to {Email}: {Error}", email, ex.Message);
                throw; // Re-throw to be caught by caller
            }
        }

        public async Task<ServiceResponse<bool>> ResendInvite(long clientId)
        {
            try
            {
                _logger.LogInformation("[ClientService] Resending invite for client {ClientId}", clientId);

                // Get current user
                var currentUser = await _userRepository.GetCurrentUser();
                if (currentUser == null)
                {
                    return ServiceResponse<bool>.CreateError("User not found", "User not authenticated", "", 401);
                }

                // Get organization ID from context
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<bool>.CreateError("Organization context is required", "Organization context is required.", "", 403);
                }

                // Get client
                var client = await _clientRepository.GetClientById(clientId);
                if (client == null)
                {
                    return ServiceResponse<bool>.CreateError("Client not found", "The specified client does not exist.");
                }

                // Check if client has an email
                if (string.IsNullOrEmpty(client.Email))
                {
                    return ServiceResponse<bool>.CreateError("Client email required", "Client must have an email address to send an invite.");
                }

                // Check if client already has an account
                if (client.UserId.HasValue)
                {
                    return ServiceResponse<bool>.CreateError("Client already has account", "This client already has a portal account.");
                }

                // Find the most recent unused invite for this client
                var existingInvite = await _dataContext.ClientInvites
                    .Where(ci => ci.ClientId == clientId && !ci.IsUsed && ci.ExpiresAt > DateTime.Now)
                    .OrderByDescending(ci => ci.CreatedAt)
                    .FirstOrDefaultAsync();

                if (existingInvite != null)
                {
                    // Resend existing invite
                    _logger.LogInformation("[ClientService] Found existing invite {InviteId}, resending email", existingInvite.Id);
                    try
                    {
                        await SendInviteEmailWithTokenAsync(client, client.Email, organizationId.Value, existingInvite.InviteToken, existingInvite.ExpiresAt);
                        return new ServiceResponse<bool> { Success = true, Data = true, Message = "Invite resent successfully" };
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "[ClientService] Failed to resend invite email. Invite ID: {InviteId}", existingInvite.Id);
                        return ServiceResponse<bool>.CreateError("Failed to resend invite email", ex.Message);
                    }
                }
                else
                {
                    // Create new invite
                    _logger.LogInformation("[ClientService] No valid invite found, creating new invite for client {ClientId}", clientId);
                    try
                    {
                        await SendClientInviteAsync(client, client.Email, organizationId.Value);
                        return new ServiceResponse<bool> { Success = true, Data = true, Message = "Invite sent successfully" };
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "[ClientService] Error sending new invite for client {ClientId}", clientId);
                        return ServiceResponse<bool>.CreateError("Error sending invite", ex.Message);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ClientService] Error resending invite for client {ClientId}", clientId);
                return ServiceResponse<bool>.CreateError("Error resending invite", ex.Message);
            }
        }

        private async Task SendInviteEmailWithTokenAsync(LoadClientDto client, string email, long organizationId, string inviteToken, DateTime expiresAt)
        {
            // Get current user (landlord/PM who is sending the invite)
            var currentUser = await _userRepository.GetCurrentUser();
            if (currentUser == null)
            {
                _logger.LogWarning("[ClientService] Cannot send invite - current user not found");
                return;
            }

            // Get frontend base URL from configuration
            var frontendBaseUrl = _configuration["FrontendBaseUrl"] ?? "http://localhost:3000";
            var inviteUrl = $"{frontendBaseUrl.TrimEnd('/')}/client/invite/{inviteToken}";

            var clientName = $"{client.FirstName} {client.LastName}".Trim();
            if (string.IsNullOrEmpty(clientName))
            {
                clientName = "Client";
            }

            var landlordName = $"{currentUser.Firstname} {currentUser.Lastname}".Trim();
            if (string.IsNullOrEmpty(landlordName))
            {
                landlordName = currentUser.Email ?? "Your Property Manager";
            }

            // Email content
            var subject = $"Invitation to Create Your Client Portal Account on Property Peace";
            var body = $@"
Hello {clientName},

{landlordName} has invited you to create a client portal account on Property Peace.

Click the link below to create your account:
{inviteUrl}

Once you create your account, you'll be able to:
• View your property portfolio and statements
• Access financial reports and documents
• Communicate with {landlordName}
• Track property management activities

This invitation will expire on {expiresAt:MMMM dd, yyyy}.

If you did not expect this invitation, please ignore this email.

Best regards,
Property Peace Team
";

            // HTML email content
            var htmlContent = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>{subject}</title>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }}
        .email-wrapper {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; }}
        .header {{ background-color: #1890ff; color: white; padding: 20px; text-align: center; }}
        .content {{ padding: 30px; }}
        .button {{ display: inline-block; padding: 12px 30px; background-color: #1890ff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
        .footer {{ background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; color: #666; }}
    </style>
</head>
<body>
    <div class='email-wrapper'>
        <div class='header'>
            <h1>Property Peace</h1>
        </div>
        <div class='content'>
            <h2>Client Portal Invitation</h2>
            <p>Hello {clientName},</p>
            <p>{landlordName} has invited you to create a client portal account on Property Peace.</p>
            <p>Click the button below to create your account:</p>
            <a href='{inviteUrl}' class='button'>Create Account</a>
            <p>Once you create your account, you'll be able to:</p>
            <ul>
                <li>View your property portfolio and statements</li>
                <li>Access financial reports and documents</li>
                <li>Communicate with {landlordName}</li>
                <li>Track property management activities</li>
            </ul>
            <p>This invitation will expire on {expiresAt:MMMM dd, yyyy}.</p>
            <p>If you did not expect this invitation, please ignore this email.</p>
            <p>Best regards,<br>Property Peace Team</p>
        </div>
        <div class='footer'>
            <p>This is an automated email from Property Peace. Please do not reply to this message.</p>
        </div>
    </div>
</body>
</html>";

            var emailSent = await _emailService.SendEmailAsync(
                to: email,
                subject: subject,
                htmlContent: htmlContent,
                plainTextContent: body
            );

            if (emailSent)
            {
                _logger.LogInformation("[ClientService] Client invite email sent successfully to {Email}", email);
            }
            else
            {
                _logger.LogWarning("[ClientService] Failed to send client invite email to {Email}", email);
            }
        }

        public async Task<ServiceResponse<ValidateClientInviteTokenDto>> ValidateInviteToken(string token)
        {
            try
            {
                var invite = await _dataContext.ClientInvites
                    .Include(ci => ci.Client)
                    .Include(ci => ci.CreatedByUser)
                    .Include(ci => ci.Organization)
                    .FirstOrDefaultAsync(ci => ci.InviteToken == token);

                if (invite == null)
                {
                    return new ServiceResponse<ValidateClientInviteTokenDto>
                    {
                        Data = new ValidateClientInviteTokenDto
                        {
                            IsValid = false,
                            Message = "Invalid invite token"
                        }
                    };
                }

                if (invite.IsUsed)
                {
                    return new ServiceResponse<ValidateClientInviteTokenDto>
                    {
                        Data = new ValidateClientInviteTokenDto
                        {
                            IsValid = false,
                            Message = "This invite has already been used"
                        }
                    };
                }

                if (invite.ExpiresAt < DateTime.Now)
                {
                    return new ServiceResponse<ValidateClientInviteTokenDto>
                    {
                        Data = new ValidateClientInviteTokenDto
                        {
                            IsValid = false,
                            Message = "This invite has expired"
                        }
                    };
                }

                // Get client information
                var client = await _clientRepository.GetClientById(invite.ClientId);
                if (client == null)
                {
                    return new ServiceResponse<ValidateClientInviteTokenDto>
                    {
                        Data = new ValidateClientInviteTokenDto
                        {
                            IsValid = false,
                            Message = "Client not found"
                        }
                    };
                }

                // Get landlord/PM name
                string? landlordName = null;
                if (invite.CreatedByUser != null)
                {
                    landlordName = $"{invite.CreatedByUser.FirstName} {invite.CreatedByUser.LastName}".Trim();
                    if (string.IsNullOrEmpty(landlordName))
                    {
                        landlordName = invite.CreatedByUser.Email;
                    }
                }

                // Get organization name
                string? organizationName = null;
                if (invite.Organization != null)
                {
                    organizationName = invite.Organization.Name;
                }

                return new ServiceResponse<ValidateClientInviteTokenDto>
                {
                    Success = true,
                    Data = new ValidateClientInviteTokenDto
                    {
                        IsValid = true,
                        Email = invite.Email,
                        ClientId = invite.ClientId,
                        Client = client,
                        OrganizationName = organizationName,
                        LandlordName = landlordName
                    }
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ClientService] Error validating invite token");
                return ServiceResponse<ValidateClientInviteTokenDto>.CreateError("Error validating invite token", ex.Message);
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
