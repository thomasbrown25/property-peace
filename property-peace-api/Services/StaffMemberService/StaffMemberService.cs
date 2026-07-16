using brownstone_hub_api.Dtos.StaffMember;
using brownstone_hub_api.Repositories.StaffMembers;
using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.StaffMemberService
{
    public class StaffMemberService(
        IStaffMemberRepository staffMemberRepository,
        IOrganizationRepository organizationRepository,
        IUserRepository userRepository,
        DataContext dataContext,
        IHttpContextAccessor httpContextAccessor,
        ILogger<StaffMemberService> logger) : IStaffMemberService
    {
        private readonly IStaffMemberRepository _staffMemberRepository = staffMemberRepository;
        private readonly IOrganizationRepository _organizationRepository = organizationRepository;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly DataContext _dataContext = dataContext;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly ILogger<StaffMemberService> _logger = logger;

        private long? GetOrganizationIdFromContext()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }

        public async Task<ServiceResponse<LoadStaffMemberDto>> AddStaffMember(AddStaffMemberDto dto)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadStaffMemberDto>.CreateError("Organization context required", "", "", 400);
                }

                dto.OrganizationId = organizationId.Value;

                // Check if user is already a staff member (only if UserId is provided)
                if (dto.UserId.HasValue)
                {
                    var existing = await _staffMemberRepository.GetStaffMemberByUserId(dto.UserId.Value, organizationId.Value);
                    if (existing != null)
                    {
                        return ServiceResponse<LoadStaffMemberDto>.CreateError("User is already a staff member", "", "", 400);
                    }
                }
                else
                {
                    // For placeholder staff members, check by email if provided
                    if (!string.IsNullOrEmpty(dto.Email))
                    {
                        // Check if placeholder staff member already exists with this email
                        var existingPlaceholder = await _staffMemberRepository.GetStaffMembersByOrganizationId(organizationId.Value);
                        var duplicate = existingPlaceholder.FirstOrDefault(sm => 
                            !sm.UserId.HasValue && 
                            !string.IsNullOrEmpty(sm.Email) && 
                            sm.Email.Equals(dto.Email, StringComparison.OrdinalIgnoreCase));
                        if (duplicate != null)
                        {
                            return ServiceResponse<LoadStaffMemberDto>.CreateError("A staff member invite already exists for this email", "", "", 400);
                        }
                    }
                }

                var result = await _staffMemberRepository.AddStaffMember(dto);
                return ServiceResponse<LoadStaffMemberDto>.CreateSuccess(result, "Staff member added successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding staff member");
                return ServiceResponse<LoadStaffMemberDto>.CreateError("Error adding staff member", ex.Message, ex.StackTrace ?? "", 500);
            }
        }

        public async Task<ServiceResponse<LoadStaffMemberDto>> UpdateStaffMember(long id, UpdateStaffMemberDto dto)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadStaffMemberDto>.CreateError("Organization context required", "", "", 400);
                }

                var existing = await _staffMemberRepository.GetStaffMemberById(id);
                if (existing == null)
                {
                    return ServiceResponse<LoadStaffMemberDto>.CreateError("Staff member not found", "", "", 404);
                }

                if (existing.OrganizationId != organizationId.Value)
                {
                    return ServiceResponse<LoadStaffMemberDto>.CreateError("Unauthorized", "", "", 403);
                }

                dto.Id = id;
                var result = await _staffMemberRepository.UpdateStaffMember(dto);
                if (result == null)
                {
                    return ServiceResponse<LoadStaffMemberDto>.CreateError("Failed to update staff member", "", "", 500);
                }

                return ServiceResponse<LoadStaffMemberDto>.CreateSuccess(result, "Staff member updated successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating staff member");
                return ServiceResponse<LoadStaffMemberDto>.CreateError("Error updating staff member", ex.Message, ex.StackTrace ?? "", 500);
            }
        }

        public async Task<ServiceResponse<bool>> DeleteStaffMember(long id)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<bool>.CreateError("Organization context required", "", "", 400);
                }

                var existing = await _staffMemberRepository.GetStaffMemberById(id);
                if (existing == null)
                {
                    return ServiceResponse<bool>.CreateError("Staff member not found", "", "", 404);
                }

                if (existing.OrganizationId != organizationId.Value)
                {
                    return ServiceResponse<bool>.CreateError("Unauthorized", "", "", 403);
                }

                // Deactivate instead of delete
                var updateDto = new UpdateStaffMemberDto
                {
                    Id = id,
                    Role = existing.Role,
                    HourlyRate = existing.HourlyRate,
                    IsActive = false
                };

                var result = await _staffMemberRepository.UpdateStaffMember(updateDto);
                return ServiceResponse<bool>.CreateSuccess(result != null, "Staff member deactivated successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting staff member");
                return ServiceResponse<bool>.CreateError("Error deleting staff member", ex.Message, ex.StackTrace ?? "", 500);
            }
        }

        public async Task<ServiceResponse<LoadStaffMemberDto>> GetStaffMemberById(long id)
        {
            try
            {
                var staffMember = await _staffMemberRepository.GetStaffMemberById(id);
                if (staffMember == null)
                {
                    return ServiceResponse<LoadStaffMemberDto>.CreateError("Staff member not found", "", "", 404);
                }

                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue || staffMember.OrganizationId != organizationId.Value)
                {
                    return ServiceResponse<LoadStaffMemberDto>.CreateError("Unauthorized", "", "", 403);
                }

                return ServiceResponse<LoadStaffMemberDto>.CreateSuccess(staffMember);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving staff member");
                return ServiceResponse<LoadStaffMemberDto>.CreateError("Error retrieving staff member", ex.Message, ex.StackTrace ?? "", 500);
            }
        }

        public async Task<ServiceResponse<List<LoadStaffMemberDto>>> GetStaffMembers()
        {
            try
            {
                // Get current user ID from context
                var userIdObj = _httpContextAccessor.HttpContext?.Items["UserId"];
                if (userIdObj == null || !(userIdObj is long userId))
                {
                    // Try to get user from repository if not in context
                    try
                    {
                        var currentUser = await _userRepository.GetCurrentUser();
                        if (currentUser == null)
                        {
                            return ServiceResponse<List<LoadStaffMemberDto>>.CreateError("User not authenticated", "", "", 401);
                        }
                        userId = currentUser.Id;
                    }
                    catch
                    {
                        return ServiceResponse<List<LoadStaffMemberDto>>.CreateError("User not authenticated", "", "", 401);
                    }
                }

                _logger.LogInformation("GetStaffMembers called for UserId: {UserId}", userId);

                // Get all organizations the user is a member of
                var memberOrgs = await _organizationRepository.GetOrganizationsByUserIdAsync(userId);
                var organizationIds = memberOrgs.Select(o => o.Id).Distinct().ToList();
                
                // Also get organizations where user is the owner (they might not have a member record)
                var ownedOrgs = await _dataContext.Organizations
                    .Where(o => o.OwnerId == userId && !o.IsDeleted)
                    .Select(o => o.Id)
                    .ToListAsync();
                
                // Combine member and owned organization IDs
                organizationIds.AddRange(ownedOrgs);
                organizationIds = organizationIds.Distinct().ToList();

                _logger.LogInformation("Found {Count} organizations for UserId: {UserId}. Organization IDs: {OrgIds}", 
                    organizationIds.Count, userId, string.Join(", ", organizationIds));

                if (!organizationIds.Any())
                {
                    _logger.LogWarning("No organizations found for UserId: {UserId}", userId);
                    return ServiceResponse<List<LoadStaffMemberDto>>.CreateSuccess(new List<LoadStaffMemberDto>());
                }

                // Get staff members from all organizations the user has access to
                var allStaffMembers = new List<LoadStaffMemberDto>();
                foreach (var orgId in organizationIds)
                {
                    try
                    {
                        var staffMembers = await _staffMemberRepository.GetStaffMembersByOrganizationId(orgId);
                        _logger.LogInformation("Found {Count} staff members for OrganizationId: {OrgId}", staffMembers.Count, orgId);
                        allStaffMembers.AddRange(staffMembers);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error retrieving staff members for OrganizationId: {OrgId}", orgId);
                    }
                }

                _logger.LogInformation("Total staff members returned: {Count}", allStaffMembers.Count);
                return ServiceResponse<List<LoadStaffMemberDto>>.CreateSuccess(allStaffMembers);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving staff members");
                return ServiceResponse<List<LoadStaffMemberDto>>.CreateError("Error retrieving staff members", ex.Message, ex.StackTrace ?? "", 500);
            }
        }

        public async Task<ServiceResponse<LoadStaffMemberDto>> GetStaffMemberByUserId(long userId)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadStaffMemberDto>.CreateError("Organization context required", "", "", 400);
                }

                var staffMember = await _staffMemberRepository.GetStaffMemberByUserId(userId, organizationId.Value);
                if (staffMember == null)
                {
                    return ServiceResponse<LoadStaffMemberDto>.CreateError("Staff member not found", "", "", 404);
                }

                return ServiceResponse<LoadStaffMemberDto>.CreateSuccess(staffMember);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving staff member by user ID");
                return ServiceResponse<LoadStaffMemberDto>.CreateError("Error retrieving staff member", ex.Message, ex.StackTrace ?? "", 500);
            }
        }
    }
}
