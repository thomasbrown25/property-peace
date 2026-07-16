

using brownstone_hub_api.Dtos.Role;

namespace brownstone_hub_api.Repositories.Roles
{
    public interface IRoleRepository
    {
        Task<List<string>> GetAllRoleNamesAsync();
        Task<LoadRoleDto> GetRoleByNameAsync(string roleName);
    }
}