using brownstone_hub_api.Dtos.Role;
using brownstone_hub_api.Dtos.User;
using brownstone_hub_api.Dtos.UserSetting;

namespace brownstone_hub_api.Repositories.Users
{
    public interface IUserRepository
    {
        Task<bool> UserExists(string email);
        Task<LoadUserDto?> AddUser(AddUserDto user);
        Task AddUserRole(AddUserRoleDto userRoleDto);
        Task<LoadUserDto?> UpdateUser(LoadUserDto user);
        Task<LoadUserDto> GetCurrentUser();
        Task<LoadUserDto> GetUser(string email);
        Task<User> GetUser(long id);
        Task<AddUserDto> GetRegisteredUser(string email);
        Task<LoadUserDto> ValidateUser(AddUserDto user, string password);
        Task DeleteUser(User user);
        Task HardDeleteUser(User user);
        Task<SettingsDto> AddUserSettings(long? userId, string? timezone = null);
        Task<SettingsDto> UpdateUserSettings(SettingsDto settingsDto);
        Task<SettingsDto> GetUserSettings(long? userId);
        Task<bool> UpdateHasSeenTutorial(long? userId, bool hasSeenTutorial);
        Task<bool> UpdateNotificationPreferencesConfigured(long? userId, bool configured);
        Task<Dictionary<long, bool>> CheckUsersHaveAccounts(List<long> userIds);
        Task<bool> ChangePassword(string currentPassword, string newPassword);
        /// <summary>
        /// Set password for a user by ID (admin only). Does not require current password.
        /// Does not affect Google/Apple login — user can use either password or OAuth after this.
        /// </summary>
        Task<bool> SetPasswordForUser(long userId, string newPassword);
        Task<bool> UpdateStripeAccountAsync(long? userId, string accountId, string status);
        Task<bool> UpdateStripeCustomerIdAsync(long? userId, string customerId);
        Task<bool> UpdateSubscriptionIdAsync(long? userId, long subscriptionId);
        Task<LoadUserDto?> GetUserByGoogleIdAsync(string googleId);
        Task<LoadUserDto?> GetUserByAppleIdAsync(string appleId);
        Task<LoadUserDto?> GetUserByEmailAsync(string email);
        Task<LoadUserDto?> UpdateUserAccountInfo(long userId, UpdateUserDto updateUserDto);
        Task<List<LoadUserDto>> GetAllUsers(bool includeDeleted = false);
        Task<User> GetUserByIdIncludingDeleted(long id);
        Task<bool> UpdateCurrentOrganizationIdAsync(long userId, long? organizationId);
        Task<List<Models.User>> GetAdminUsersAsync();
    }
}