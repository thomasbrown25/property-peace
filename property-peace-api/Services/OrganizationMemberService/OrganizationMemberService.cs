using AutoMapper;
using brownstone_hub_api.Dtos.OrganizationMember;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Repositories.Users;

namespace brownstone_hub_api.Services.OrganizationMemberService
{
    public class OrganizationMemberService : IOrganizationMemberService
    {
        private readonly IOrganizationMemberRepository _memberRepository;
        private readonly IOrganizationRepository _organizationRepository;
        private readonly IUserRepository _userRepository;
        private readonly IMapper _mapper;
        private readonly ILogger<OrganizationMemberService> _logger;

        public OrganizationMemberService(
            IOrganizationMemberRepository memberRepository,
            IOrganizationRepository organizationRepository,
            IUserRepository userRepository,
            IMapper mapper,
            ILogger<OrganizationMemberService> logger)
        {
            _memberRepository = memberRepository;
            _organizationRepository = organizationRepository;
            _userRepository = userRepository;
            _mapper = mapper;
            _logger = logger;
        }

        public async Task<ServiceResponse<LoadOrganizationMemberDto>> AddMemberAsync(AddOrganizationMemberDto dto, long selectedOrganizationId, long invitedByUserId)
        {
            try
            {
                if (selectedOrganizationId <= 0 || dto.OrganizationId != selectedOrganizationId)
                {
                    return ServiceResponse<LoadOrganizationMemberDto>.CreateError("Unauthorized", "Organization access denied.", "", 403);
                }

                var allowedRoles = new[] { "Owner", "Manager", "Viewer" };
                var canonicalRole = allowedRoles.FirstOrDefault(role => string.Equals(role, dto.Role, StringComparison.OrdinalIgnoreCase));
                if (canonicalRole == null)
                {
                    return ServiceResponse<LoadOrganizationMemberDto>.CreateError("Invalid role", "Role must be Owner, Manager, or Viewer.", "", 400);
                }
                dto.Role = canonicalRole;

                // Verify organization exists
                var organization = await _organizationRepository.GetOrganizationByIdAsync(dto.OrganizationId);
                if (organization == null || !organization.IsActive || organization.IsDeleted)
                {
                    return ServiceResponse<LoadOrganizationMemberDto>.CreateError("Organization not found", "The specified organization does not exist.");
                }

                // Check if inviter has permission
                var inviterMember = await _memberRepository.GetMemberAsync(dto.OrganizationId, invitedByUserId);
                if (inviterMember == null || !inviterMember.IsActive ||
                    inviterMember.OrganizationId != dto.OrganizationId || inviterMember.UserId != invitedByUserId ||
                    (!inviterMember.CanManageMembers && !string.Equals(inviterMember.Role, "Owner", StringComparison.OrdinalIgnoreCase)))
                {
                    return ServiceResponse<LoadOrganizationMemberDto>.CreateError("Unauthorized", "You do not have permission to add members.", "", 403);
                }

                if (dto.Role == "Owner" && !string.Equals(inviterMember.Role, "Owner", StringComparison.OrdinalIgnoreCase))
                {
                    return ServiceResponse<LoadOrganizationMemberDto>.CreateError("Unauthorized", "Only an active organization owner can add another owner.", "", 403);
                }

                // Check if user is already a member
                var existingMember = await _memberRepository.GetMemberAsync(dto.OrganizationId, dto.UserId);
                if (existingMember != null)
                {
                    return ServiceResponse<LoadOrganizationMemberDto>.CreateError("Member already exists", "This user is already a member of the organization.");
                }

                // Set permissions based on role
                var permissions = GetPermissionsForRole(dto.Role);
                dto.CanManageProperties = permissions.CanManageProperties;
                dto.CanManageTenants = permissions.CanManageTenants;
                dto.CanManageLeases = permissions.CanManageLeases;
                dto.CanManageMaintenance = permissions.CanManageMaintenance;
                dto.CanManageBilling = permissions.CanManageBilling;
                dto.CanManageMembers = permissions.CanManageMembers;

                var member = _mapper.Map<OrganizationMember>(dto);
                member.InvitedBy = invitedByUserId;
                member.JoinedAt = DateTime.Now;
                member.IsActive = true;

                var createdMember = await _memberRepository.AddMemberAsync(member);
                var memberDto = await MapToLoadDtoAsync(createdMember);

                return ServiceResponse<LoadOrganizationMemberDto>.CreateSuccess(memberDto, "Member added successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding member");
                return ServiceResponse<LoadOrganizationMemberDto>.CreateError("Error adding member", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadOrganizationMemberDto>> UpdateMemberAsync(UpdateOrganizationMemberDto dto, long selectedOrganizationId, long userId)
        {
            try
            {
                var member = await _memberRepository.GetMemberByIdAsync(dto.Id);
                if (member == null)
                {
                    return ServiceResponse<LoadOrganizationMemberDto>.CreateError("Member not found", "The specified member does not exist.");
                }

                if (selectedOrganizationId <= 0 || member.OrganizationId != selectedOrganizationId)
                {
                    return ServiceResponse<LoadOrganizationMemberDto>.CreateError("Unauthorized", "Organization access denied.", "", 403);
                }

                var organization = await _organizationRepository.GetOrganizationByIdAsync(member.OrganizationId);
                if (organization == null || !organization.IsActive || organization.IsDeleted)
                {
                    return ServiceResponse<LoadOrganizationMemberDto>.CreateError("Unauthorized", "You do not have permission to update members.", "", 403);
                }

                // Check if user has permission to update members
                var requestingMember = await _memberRepository.GetMemberAsync(member.OrganizationId, userId);
                if (requestingMember == null || !requestingMember.IsActive ||
                    requestingMember.OrganizationId != member.OrganizationId || requestingMember.UserId != userId ||
                    (!requestingMember.CanManageMembers && !string.Equals(requestingMember.Role, "Owner", StringComparison.OrdinalIgnoreCase)))
                {
                    return ServiceResponse<LoadOrganizationMemberDto>.CreateError("Unauthorized", "You do not have permission to update members.", "", 403);
                }

                var allowedRoles = new[] { "Owner", "Manager", "Viewer" };
                var canonicalRole = allowedRoles.FirstOrDefault(role => string.Equals(role, dto.Role, StringComparison.OrdinalIgnoreCase));
                if (canonicalRole == null)
                {
                    return ServiceResponse<LoadOrganizationMemberDto>.CreateError("Invalid role", "Role must be Owner, Manager, or Viewer.", "", 400);
                }
                dto.Role = canonicalRole;

                if ((string.Equals(member.Role, "Owner", StringComparison.OrdinalIgnoreCase) || dto.Role == "Owner") &&
                    !string.Equals(requestingMember.Role, "Owner", StringComparison.OrdinalIgnoreCase))
                {
                    return ServiceResponse<LoadOrganizationMemberDto>.CreateError("Unauthorized", "Only an organization owner can grant or change owner access.", "", 403);
                }

                // Prevent changing the last owner
                if (member.Role == "Owner" && dto.Role != "Owner")
                {
                    var owners = await _memberRepository.GetMembersByOrganizationIdAsync(member.OrganizationId);
                    if (owners.Count(m => m.Role == "Owner" && m.IsActive) <= 1)
                    {
                        return ServiceResponse<LoadOrganizationMemberDto>.CreateError("Cannot remove last owner", "An organization must have at least one owner.");
                    }
                }

                member.Role = dto.Role;
                member.CanManageProperties = dto.CanManageProperties;
                member.CanManageTenants = dto.CanManageTenants;
                member.CanManageLeases = dto.CanManageLeases;
                member.CanManageMaintenance = dto.CanManageMaintenance;
                member.CanManageBilling = dto.CanManageBilling;
                member.CanManageMembers = dto.CanManageMembers;

                var updatedMember = await _memberRepository.UpdateMemberAsync(member);
                var memberDto = await MapToLoadDtoAsync(updatedMember);

                return ServiceResponse<LoadOrganizationMemberDto>.CreateSuccess(memberDto, "Member updated successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating member");
                return ServiceResponse<LoadOrganizationMemberDto>.CreateError("Error updating member", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> RemoveMemberAsync(long organizationId, long memberIdOrUserId, long requestingUserId)
        {
            try
            {
                // Try to find by member ID first (for pending members with null UserId)
                var member = await _memberRepository.GetMemberByMemberIdAsync(organizationId, memberIdOrUserId);
                
                // If not found, try by UserId (for existing members)
                if (member == null)
                {
                    member = await _memberRepository.GetMemberAsync(organizationId, memberIdOrUserId);
                }
                
                if (member == null)
                {
                    return ServiceResponse<bool>.CreateError("Member not found", "The specified member does not exist.");
                }

                // Check if requester has permission
                var requestingMember = await _memberRepository.GetMemberAsync(organizationId, requestingUserId);
                if (requestingMember == null || (!requestingMember.CanManageMembers && requestingMember.Role != "Owner"))
                {
                    return ServiceResponse<bool>.CreateError("Unauthorized", "You do not have permission to remove members.", "", 403);
                }

                if (member.Role == "Owner" && requestingMember.Role != "Owner")
                {
                    return ServiceResponse<bool>.CreateError("Unauthorized", "Only an organization owner can remove another owner.", "", 403);
                }

                // Prevent removing the last owner
                if (member.Role == "Owner")
                {
                    var owners = await _memberRepository.GetMembersByOrganizationIdAsync(organizationId);
                    if (owners.Count(m => m.Role == "Owner") <= 1)
                    {
                        return ServiceResponse<bool>.CreateError("Cannot remove last owner", "An organization must have at least one owner.");
                    }
                }

                // Remove by member ID if UserId is null, otherwise by UserId
                bool result;
                if (member.UserId.HasValue)
                {
                    result = await _memberRepository.RemoveMemberAsync(organizationId, member.UserId.Value);
                }
                else
                {
                    result = await _memberRepository.RemoveMemberByIdAsync(organizationId, member.Id);
                }
                
                return ServiceResponse<bool>.CreateSuccess(result, "Member removed successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error removing member");
                return ServiceResponse<bool>.CreateError("Error removing member", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadOrganizationMemberDto>>> GetMembersByOrganizationIdAsync(long organizationId, long userId)
        {
            try
            {
                // Verify user is a member
                var isMember = await _memberRepository.IsUserMemberOfOrganizationAsync(userId, organizationId);
                if (!isMember)
                {
                    return ServiceResponse<List<LoadOrganizationMemberDto>>.CreateError("Unauthorized", "You are not a member of this organization.", "", 403);
                }

                var members = await _memberRepository.GetMembersByOrganizationIdAsync(organizationId);
                var memberDtos = new List<LoadOrganizationMemberDto>();

                foreach (var member in members)
                {
                    // Include pending members (with null UserId) in the list
                    memberDtos.Add(await MapToLoadDtoAsync(member));
                }

                return ServiceResponse<List<LoadOrganizationMemberDto>>.CreateSuccess(memberDtos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving members");
                return ServiceResponse<List<LoadOrganizationMemberDto>>.CreateError("Error retrieving members", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadOrganizationMemberDto>> GetMemberAsync(long organizationId, long memberUserId, long userId)
        {
            try
            {
                // Verify user is a member
                var isMember = await _memberRepository.IsUserMemberOfOrganizationAsync(userId, organizationId);
                if (!isMember)
                {
                    return ServiceResponse<LoadOrganizationMemberDto>.CreateError("Unauthorized", "You are not a member of this organization.", "", 403);
                }

                var member = await _memberRepository.GetMemberAsync(organizationId, memberUserId);
                if (member == null)
                {
                    return ServiceResponse<LoadOrganizationMemberDto>.CreateError("Member not found", "The specified member does not exist.");
                }

                var memberDto = await MapToLoadDtoAsync(member);
                return ServiceResponse<LoadOrganizationMemberDto>.CreateSuccess(memberDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving member");
                return ServiceResponse<LoadOrganizationMemberDto>.CreateError("Error retrieving member", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> UserHasPermissionAsync(long userId, long organizationId, string permission)
        {
            try
            {
                var hasPermission = await _memberRepository.UserHasPermissionAsync(userId, organizationId, permission);
                return ServiceResponse<bool>.CreateSuccess(hasPermission);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking permission");
                return ServiceResponse<bool>.CreateError("Error checking permission", ex.Message);
            }
        }

        private async Task<LoadOrganizationMemberDto> MapToLoadDtoAsync(OrganizationMember member)
        {
            var organization = await _organizationRepository.GetOrganizationByIdAsync(member.OrganizationId);
            var user = member.UserId.HasValue ? await _userRepository.GetUser(member.UserId.Value) : null;
            var invitedBy = member.InvitedBy.HasValue ? await _userRepository.GetUser(member.InvitedBy.Value) : null;

            return new LoadOrganizationMemberDto
            {
                Id = member.Id,
                OrganizationId = member.OrganizationId,
                OrganizationName = organization?.Name ?? string.Empty,
                UserId = member.UserId,
                UserName = user != null ? $"{user.FirstName} {user.LastName}" : (member.Email ?? "Pending"),
                UserEmail = user?.Email ?? member.Email ?? string.Empty,
                Email = member.Email, // Email from invite (if UserId is null)
                HasAccount = member.UserId.HasValue, // True if account is created
                Role = member.Role,
                IsActive = member.IsActive,
                JoinedAt = member.JoinedAt,
                InvitedBy = member.InvitedBy,
                InvitedByName = invitedBy != null ? $"{invitedBy.FirstName} {invitedBy.LastName}" : string.Empty,
                CanManageProperties = member.CanManageProperties,
                CanManageTenants = member.CanManageTenants,
                CanManageLeases = member.CanManageLeases,
                CanManageMaintenance = member.CanManageMaintenance,
                CanManageBilling = member.CanManageBilling,
                CanManageMembers = member.CanManageMembers
            };
        }

        private (bool CanManageProperties, bool CanManageTenants, bool CanManageLeases, bool CanManageMaintenance, bool CanManageBilling, bool CanManageMembers) GetPermissionsForRole(string role)
        {
            return role switch
            {
                "Owner" => (true, true, true, true, true, true),
                "Manager" => (true, true, true, true, false, false),
                "Viewer" => (false, false, false, false, false, false),
                _ => (false, false, false, false, false, false)
            };
        }
    }
}

