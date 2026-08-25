
using brownstone_hub_api.Dtos.User;
using brownstone_hub_api.Dtos.UserSetting;

namespace brownstone_hub_api.Services.UserService
{
    public interface IUserService
    {
        Task<ServiceResponse<LoadUserDto>> Register(AddUserDto user);
        Task<ServiceResponse<LoadUserDto>> Login(string email, string password);
        Task<LoadUserDto> CreateAccessToken(long userId);
        Task<RefreshSessionDto> CreateRefreshSession(long userId);
        Task<RefreshSessionDto> CreateRefreshSession(long userId, bool isPersistent);
        Task<RefreshSessionDto?> RefreshSession(string refreshToken);
        Task<RefreshSessionDto?> RotateRefreshSessionForUser(string refreshToken, long expectedUserId);
        Task RevokeRefreshToken(string refreshToken);
        Task<ServiceResponse<LoadUserDto>> LoadUser();
        Task<ServiceResponse<string>> DeleteUser(long userId);
        Task<ServiceResponse<SettingsDto>> GetSettings();
        Task<ServiceResponse<SettingsDto>> SaveSettings(SettingsDto newSettings);
        Task<ServiceResponse<bool>> UpdateHasSeenTutorial(long userId, bool hasSeenTutorial);
        Task<Dictionary<long, bool>> CheckUsersHaveAccounts(List<long> userIds);
        Task<ServiceResponse<string>> ChangePassword(string currentPassword, string newPassword);
        /// <summary>
        /// Admin-only: set a user's password by ID without requiring current password.
        /// User can then login with email+password or continue using Google/Apple.
        /// </summary>
        Task<ServiceResponse<string>> AdminSetPassword(long userId, string newPassword);
        Task<(ServiceResponse<LoadUserDto> Response, bool IsNewUser)> GoogleLogin(string? idToken, string? registrationCode = null, string? accessToken = null, string? timezone = null);
        Task<(ServiceResponse<LoadUserDto> Response, bool IsNewUser)> AppleLogin(string identityToken, string nonce, string? firstName = null, string? lastName = null, string? timezone = null, CancellationToken cancellationToken = default);
        Task<ServiceResponse<LoadUserDto>> GetUserByEmailAsync(string email);
        Task<ServiceResponse<LoadUserDto>> GetUserByIdAsync(long userId);
        Task<ServiceResponse<long?>> GetCurrentUserIdAsync();
        Task<ServiceResponse<LoadUserDto>> UpdateUserAccountInfo(UpdateUserDto updateUserDto);
        Task<ServiceResponse<LoadUserDto>> UpdateUserAccountInfoById(long userId, UpdateUserDto updateUserDto);
        Task<ServiceResponse<bool>> CheckEmailExists(string email);
        Task<ServiceResponse<List<LoadUserDto>>> GetAllUsers(bool includeDeleted = false);
        Task<ServiceResponse<string>> DeleteUserById(long userId, bool adminOverride = false);
        Task<ServiceResponse<LoadUserDto>> SuspendUser(long userId);
        Task<ServiceResponse<LoadUserDto>> UnsuspendUser(long userId);
        Task<ServiceResponse<string>> HardDeleteUserCompletely(long userId);
    }
}