

using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Role;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.Roles
{
    public class RoleRepository(DataContext context, IMapper mapper,
        ILogger<RoleRepository> logger) : IRoleRepository
    {
        private readonly DataContext _context = context;
        private readonly IMapper _mapper = mapper;
        private readonly ILogger<RoleRepository> _logger = logger;

        public async Task<List<string>> GetAllRoleNamesAsync()
        {
            // Fetch all roles from the database and return their names
            var roleNames = await _context.Roles
                .Select(role => role.RoleName)
                .ToListAsync();

            return roleNames;

        }

        public async Task<LoadRoleDto> GetRoleByNameAsync(string roleName)
        {
            // Find a role by its name
            var role = await _context.Roles
                .FirstOrDefaultAsync(r => r.RoleName.ToLower() == roleName.ToLower());

            if (role != null)
            {
                return _mapper.Map<LoadRoleDto>(role);
            }

            // If the role is not found, return null or throw an exception based on your design choice
            throw new KeyNotFoundException($"Role '{roleName}' not found.");
        }
    }
}