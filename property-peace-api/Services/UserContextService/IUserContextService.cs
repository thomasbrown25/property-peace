using brownstone_hub_api.Dtos.User;

namespace brownstone_hub_api.Services.UserContextService
{
    public interface IUserContextService
    {
        Task<long?> GetCurrentUserIdAsync();
        Task<LoadUserDto?> GetCurrentUserAsync();
    }
}
