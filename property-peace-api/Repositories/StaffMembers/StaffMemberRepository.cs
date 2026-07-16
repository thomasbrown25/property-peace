using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.StaffMember;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.StaffMembers
{
    public class StaffMemberRepository(DataContext context, ILogger<StaffMemberRepository> logger, IMapper mapper) : IStaffMemberRepository
    {
        private readonly DataContext _context = context;
        private readonly ILogger<StaffMemberRepository> _logger = logger;
        private readonly IMapper _mapper = mapper;

        public async Task<LoadStaffMemberDto> AddStaffMember(AddStaffMemberDto dto)
        {
            try
            {
                var staffMember = _mapper.Map<StaffMember>(dto);
                await _context.StaffMembers.AddAsync(staffMember);
                await _context.SaveChangesAsync();

                return await GetStaffMemberById(staffMember.Id) ?? throw new Exception("Failed to retrieve created staff member");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding staff member");
                throw;
            }
        }

        public async Task<LoadStaffMemberDto?> GetStaffMemberById(long id)
        {
            try
            {
                var staffMember = await _context.StaffMembers
                    .Include(s => s.User)
                    .Include(s => s.Organization)
                    .FirstOrDefaultAsync(s => s.Id == id);

                if (staffMember == null)
                    return null;

                return _mapper.Map<LoadStaffMemberDto>(staffMember);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving staff member with ID {StaffMemberId}", id);
                throw;
            }
        }

        public async Task<LoadStaffMemberDto?> GetStaffMemberByUserId(long userId, long organizationId)
        {
            try
            {
                var staffMember = await _context.StaffMembers
                    .Include(s => s.User)
                    .Include(s => s.Organization)
                    .FirstOrDefaultAsync(s => s.UserId == userId && s.OrganizationId == organizationId && s.IsActive);

                if (staffMember == null)
                    return null;

                return _mapper.Map<LoadStaffMemberDto>(staffMember);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving staff member for user {UserId} in organization {OrganizationId}", userId, organizationId);
                throw;
            }
        }

        public async Task<LoadStaffMemberDto?> UpdateStaffMember(UpdateStaffMemberDto dto)
        {
            try
            {
                var existing = await _context.StaffMembers
                    .FirstOrDefaultAsync(s => s.Id == dto.Id);

                if (existing == null)
                    return null;

                _mapper.Map(dto, existing);
                existing.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return await GetStaffMemberById(dto.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating staff member with ID {StaffMemberId}", dto.Id);
                throw;
            }
        }

        public async Task<bool> DeleteStaffMember(long id)
        {
            try
            {
                var staffMember = await _context.StaffMembers.FindAsync(id);
                if (staffMember == null)
                    return false;

                _context.StaffMembers.Remove(staffMember);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting staff member with ID {StaffMemberId}", id);
                throw;
            }
        }

        public async Task<List<LoadStaffMemberDto>> GetStaffMembersByOrganizationId(long organizationId)
        {
            try
            {
                var staffMembers = await _context.StaffMembers
                    .Include(s => s.User)
                    .Include(s => s.Organization)
                    .Where(s => s.OrganizationId == organizationId)
                    .OrderBy(s => s.User != null ? s.User.FirstName : s.FirstName ?? "")
                    .ThenBy(s => s.User != null ? s.User.LastName : s.LastName ?? "")
                    .ToListAsync();

                return _mapper.Map<List<LoadStaffMemberDto>>(staffMembers);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving staff members for organization {OrganizationId}", organizationId);
                throw;
            }
        }

        public async Task<bool> IsUserStaffMember(long userId, long organizationId)
        {
            try
            {
                return await _context.StaffMembers
                    .AnyAsync(s => s.UserId == userId && s.OrganizationId == organizationId && s.IsActive);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking if user {UserId} is staff member in organization {OrganizationId}", userId, organizationId);
                throw;
            }
        }
    }
}
