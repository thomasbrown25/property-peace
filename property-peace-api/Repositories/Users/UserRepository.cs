
using System.Security.Claims;
using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.User;
using brownstone_hub_api.Dtos.UserSetting;
using Microsoft.EntityFrameworkCore;
using brownstone_hub_api.Dtos.Role;

namespace brownstone_hub_api.Repositories.Users
{
    public class UserRepository(DataContext context, IHttpContextAccessor httpContextAccessor, ILogger<UserRepository> logger, IMapper mapper) : IUserRepository
    {
        private readonly DataContext _context = context;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly ILogger<UserRepository> _logger = logger;
        private readonly IMapper _mapper = mapper;

        public async Task<bool> UserExists(string email)
        {
            if (await _context.Users.AnyAsync(x => x.Email.ToLower().Equals(email.ToLower()) && !x.IsDeleted))
            {
                return true;
            }
            return false;
        }

        public async Task<LoadUserDto?> AddUser(AddUserDto user)
        {
            await _context.Users.AddAsync(_mapper.Map<User>(user));

            await _context.SaveChangesAsync();

            var dbUser = await _context.Users
                    .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                    .FirstOrDefaultAsync(u => u.Email.ToLower().Equals(user.Email.ToLower()));

            return _mapper.Map<LoadUserDto>(dbUser);
        }

        public async Task AddUserRole(AddUserRoleDto userRoleDto)
        {
            await _context.UserRoles.AddAsync(_mapper.Map<UserRole>(userRoleDto));

            await _context.SaveChangesAsync();
        }

        public async Task<LoadUserDto?> UpdateUser(LoadUserDto user)
        {
            var dbUser = await _context.Users
                    .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                    .FirstOrDefaultAsync(u => u.Email.ToLower().Equals(user.Email.ToLower()));

            _context.Entry(dbUser).CurrentValues.SetValues(user);

            await _context.SaveChangesAsync();

            return user;
        }

        public async Task<LoadUserDto> GetCurrentUser()
        {
            try
            {
                var httpContext = _httpContextAccessor.HttpContext;
                if (httpContext?.User == null)
                    return null;

                // Try to get user ID directly from claims first
                var userIdClaim = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (!string.IsNullOrEmpty(userIdClaim) && long.TryParse(userIdClaim, out var userId))
                {
                    // If NameIdentifier contains a numeric ID, get user by ID
                    var user = await _context.Users
                        .Include(u => u.UserRoles)
                        .ThenInclude(ur => ur.Role)
                        .Where(u => u.Id == userId && !u.IsDeleted)
                        .FirstOrDefaultAsync();

                    if (user != null)
                        return _mapper.Map<LoadUserDto>(user);
                }

                // Try alternative claim names for user ID
                userIdClaim = httpContext.User.FindFirst("userId")?.Value;
                if (!string.IsNullOrEmpty(userIdClaim) && long.TryParse(userIdClaim, out userId))
                {
                    var user = await _context.Users
                        .Include(u => u.UserRoles)
                        .ThenInclude(ur => ur.Role)
                        .Where(u => u.Id == userId && !u.IsDeleted)
                        .FirstOrDefaultAsync();

                    if (user != null)
                        return _mapper.Map<LoadUserDto>(user);
                }

                // If user ID not in claims, get email from "sub" claim (JWT standard)
                string email = httpContext.User.FindFirst("sub")?.Value;
                if (string.IsNullOrEmpty(email))
                {
                    // Fallback to NameIdentifier (might be email in some cases)
                    email = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                }
                if (string.IsNullOrEmpty(email))
                {
                    email = httpContext.User.FindFirst(ClaimTypes.Name)?.Value;
                }
                if (string.IsNullOrEmpty(email))
                {
                    email = httpContext.User.FindFirst(ClaimTypes.Email)?.Value;
                }

                if (string.IsNullOrEmpty(email))
                    return null;

                // Get current user from sql db (exclude deleted users)
                var userByEmail = await _context.Users
                        .Include(u => u.UserRoles)
                        .ThenInclude(ur => ur.Role)
                        .Where(u => u.Email.ToLower().Equals(email.ToLower()) && !u.IsDeleted)
                        .FirstOrDefaultAsync();

                if (userByEmail is null)
                    return null;

                return _mapper.Map<LoadUserDto>(userByEmail);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting current user from claims");
                return null;
            }
        }

        public async Task<LoadUserDto> GetUser(string email)
        {
            var dbUser = await _context.Users
                    .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                    .Where(u => u.Email.ToLower().Equals(email.ToLower()) && !u.IsDeleted)
                    .FirstOrDefaultAsync();


            return _mapper.Map<LoadUserDto>(dbUser);
        }

        public async Task<User> GetUser(long id)
        {
            return await _context.Users
                    .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                    .Where(x => x.Id == id && !x.IsDeleted)
                    .FirstOrDefaultAsync();
        }

        public async Task<AddUserDto> GetRegisteredUser(string email)
        {
            var dbUser = await _context.Users
                .Where(u => u.Email.ToLower().Equals(email.ToLower()) && !u.IsDeleted)
                .FirstOrDefaultAsync();

            return _mapper.Map<AddUserDto>(dbUser);
        }

        public async Task<LoadUserDto?> ValidateUser(AddUserDto user, string password)
        {
            // OAuth users don't have passwords
            if (user is null || user.PasswordHash is null || user.PasswordSalt is null)
                return null;

            if (!VerifyPasswordHash(password, user.PasswordHash, user.PasswordSalt))
                return null;

            var dbUser = await _context.Users
                    .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                    .FirstOrDefaultAsync(u => u.Email.ToLower().Equals(user.Email.ToLower()));

            return _mapper.Map<LoadUserDto>(dbUser);
        }

        public async Task DeleteUser(User user)
        {
            // Soft delete: mark as deleted instead of removing
            user.IsDeleted = true;
            user.DeletedAt = DateTime.UtcNow;
            // Anonymize PII while preserving financial records
            user.Email = $"deleted_{user.Id}_{DateTime.UtcNow.Ticks}@deleted.local";
            user.FirstName = "Deleted";
            user.LastName = "User";
            user.PhoneNumber = null;
            user.ProfileImageUrl = null;
            user.GoogleId = null;
            user.AppleId = null;
            user.PasswordHash = null;
            user.PasswordSalt = null;
            await _context.SaveChangesAsync();
        }

        public async Task HardDeleteUser(User user)
        {
            // Hard delete: completely remove the user record from the database
            // UserRoles will be deleted automatically via cascade delete (configured in UserRoleConfig)
            // Other relationships use SetNull, so they'll be set to null automatically

            // Load user with related data to ensure proper deletion
            var userToDelete = await _context.Users
                .Include(u => u.UserRoles)
                .FirstOrDefaultAsync(u => u.Id == user.Id);

            if (userToDelete == null)
                return;

            // Remove user roles (they will cascade delete, but we can be explicit)
            _context.UserRoles.RemoveRange(userToDelete.UserRoles);

            // Remove user settings if they exist
            var userSettings = await _context.UserSettings.FirstOrDefaultAsync(us => us.UserId == userToDelete.Id);
            if (userSettings != null)
            {
                _context.UserSettings.Remove(userSettings);
            }

            // Remove notification settings if they exist
            var notificationSettings = await _context.NotificationSettings.FirstOrDefaultAsync(ns => ns.UserId == userToDelete.Id);
            if (notificationSettings != null)
            {
                _context.NotificationSettings.Remove(notificationSettings);
            }

            // Remove the user
            _context.Users.Remove(userToDelete);
            await _context.SaveChangesAsync();
        }


        public async Task<SettingsDto> AddUserSettings(long? userId, string? timezone = null)
        {
            if (!userId.HasValue)
            {
                throw new ArgumentNullException(nameof(userId), "User ID cannot be null");
            }

            var dbSettings = new UserSettings
            {
                UserId = userId.Value,
                Timezone = string.IsNullOrWhiteSpace(timezone) ? null : timezone.Trim(),
                // AI Summary Preferences - default to enabled
                AiSummaryEnabled = true,
                AiSummaryCheckTenantAccounts = true,
                AiSummaryCheckMoveInChecklist = true,
                AiSummaryCheckMoveOutChecklist = true,
                AiSummaryCheckApplicationsSentSigned = true,
                AiSummaryCheckUnpaidSecurityDeposits = true
            };

            _context.UserSettings.Add(dbSettings);
            await _context.SaveChangesAsync();

            dbSettings = await _context.UserSettings.FirstOrDefaultAsync(x => x.UserId == userId.Value);

            return _mapper.Map<SettingsDto>(dbSettings);
        }

        public async Task<SettingsDto> UpdateUserSettings(SettingsDto settingsDto)
        {
            var dbSettings = await _context.UserSettings.FirstOrDefaultAsync(x => x.UserId == settingsDto.UserId);

            if (dbSettings == null)
            {
                // Create new settings if they don't exist
                dbSettings = _mapper.Map<UserSettings>(settingsDto);
                _context.UserSettings.Add(dbSettings);
            }
            else
            {
                // Update existing settings - manually set properties to avoid modifying the Id (primary key)
                dbSettings.FontSize = settingsDto.FontSize;
                dbSettings.Language = settingsDto.Language;
                dbSettings.Messages = settingsDto.Messages;
                dbSettings.DarkMode = settingsDto.DarkMode;
                dbSettings.SidenavMini = settingsDto.SidenavMini;
                dbSettings.NavbarFixed = settingsDto.NavbarFixed;
                dbSettings.SidenavType = settingsDto.SidenavType;
                dbSettings.PropertyLayout = settingsDto.PropertyLayout;
                dbSettings.Timezone = settingsDto.Timezone;
                dbSettings.DateFormat = settingsDto.DateFormat;
                dbSettings.TimeFormat = settingsDto.TimeFormat;
                dbSettings.Currency = settingsDto.Currency;

                // AI Summary Preferences
                dbSettings.AiSummaryEnabled = settingsDto.AiSummaryEnabled;
                dbSettings.AiSummaryCheckTenantAccounts = settingsDto.AiSummaryCheckTenantAccounts;
                dbSettings.AiSummaryCheckMoveInChecklist = settingsDto.AiSummaryCheckMoveInChecklist;
                dbSettings.AiSummaryCheckMoveOutChecklist = settingsDto.AiSummaryCheckMoveOutChecklist;
                dbSettings.AiSummaryCheckApplicationsSentSigned = settingsDto.AiSummaryCheckApplicationsSentSigned;
                dbSettings.AiSummaryCheckUnpaidSecurityDeposits = settingsDto.AiSummaryCheckUnpaidSecurityDeposits;
            }

            await _context.SaveChangesAsync();

            return _mapper.Map<SettingsDto>(dbSettings);
        }

        public async Task<SettingsDto> GetUserSettings(long? userId)
        {
            if (!userId.HasValue)
            {
                return null;
            }

            var dbSettings = await _context.UserSettings
                   .FirstOrDefaultAsync(s => s.UserId == userId.Value);

            return _mapper.Map<SettingsDto>(dbSettings);
        }

        public async Task<bool> UpdateHasSeenTutorial(long? userId, bool hasSeenTutorial)
        {
            if (!userId.HasValue)
            {
                return false;
            }

            var user = await _context.Users.FindAsync(userId.Value);
            if (user == null)
                return false;

            user.HasSeenTutorial = hasSeenTutorial;
            await _context.SaveChangesAsync();

            return true;
        }

        public async Task<bool> UpdateNotificationPreferencesConfigured(long? userId, bool configured)
        {
            if (!userId.HasValue)
            {
                return false;
            }

            var user = await _context.Users.FindAsync(userId.Value);
            if (user == null)
                return false;

            if (user.NotificationPreferencesConfigured == configured)
                return true;

            user.NotificationPreferencesConfigured = configured;
            user.UpdatedDate = DateTime.Now;
            await _context.SaveChangesAsync();

            return true;
        }

        public async Task<Dictionary<long, bool>> CheckUsersHaveAccounts(List<long> userIds)
        {
            if (userIds == null || userIds.Count == 0)
                return new Dictionary<long, bool>();

            // Check which userIds have entries in UserRoles table (meaning they have accounts with roles)
            var usersWithRoles = await _context.UserRoles
                .Where(ur => userIds.Contains(ur.UserId))
                .Select(ur => ur.UserId)
                .Distinct()
                .ToListAsync();

            // Create dictionary: userId -> hasAccount (true if userId exists in UserRoles)
            return userIds.ToDictionary(
                userId => userId,
                userId => usersWithRoles.Contains(userId)
            );
        }


        public async Task<bool> ChangePassword(string currentPassword, string newPassword)
        {
            var user = await GetCurrentUser();
            if (user == null)
            {
                return false;
            }

            var dbUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == user.Id);
            if (dbUser == null)
            {
                return false;
            }

            // Google (or other OAuth) users may have no password set (null or empty 0x) — allow "set password" without current password
            bool hasExistingPassword = dbUser.PasswordHash != null && dbUser.PasswordHash.Length > 0
                && dbUser.PasswordSalt != null && dbUser.PasswordSalt.Length > 0;
            if (!hasExistingPassword)
            {
                // Set password for the first time; no current password to verify
                CreatePasswordHash(newPassword, out byte[] passwordHash, out byte[] passwordSalt);
                dbUser.PasswordHash = passwordHash;
                dbUser.PasswordSalt = passwordSalt;
                dbUser.UpdatedDate = DateTime.Now;
                await _context.SaveChangesAsync();
                return true;
            }

            // Verify current password when changing an existing password
            if (!VerifyPasswordHash(currentPassword, dbUser.PasswordHash, dbUser.PasswordSalt))
            {
                return false;
            }

            CreatePasswordHash(newPassword, out byte[] newPasswordHash, out byte[] newPasswordSalt);
            dbUser.PasswordHash = newPasswordHash;
            dbUser.PasswordSalt = newPasswordSalt;
            dbUser.UpdatedDate = DateTime.Now;

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> SetPasswordForUser(long userId, string newPassword)
        {
            var dbUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (dbUser == null)
            {
                return false;
            }

            CreatePasswordHash(newPassword, out byte[] passwordHash, out byte[] passwordSalt);
            dbUser.PasswordHash = passwordHash;
            dbUser.PasswordSalt = passwordSalt;
            dbUser.UpdatedDate = DateTime.Now;

            await _context.SaveChangesAsync();
            return true;
        }

        private bool VerifyPasswordHash(string password, byte[] passwordHash, byte[] passwordSalt)
        {
            using (var hmac = new System.Security.Cryptography.HMACSHA512(passwordSalt))
            {
                var computeHash = hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(password));
                return computeHash.SequenceEqual(passwordHash);
            }
        }

        private void CreatePasswordHash(string password, out byte[] passwordHash, out byte[] passwordSalt)
        {
            using (var hmac = new System.Security.Cryptography.HMACSHA512())
            {
                passwordSalt = hmac.Key;
                passwordHash = hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(password));
            }
        }

        public async Task<bool> UpdateStripeAccountAsync(long? userId, string accountId, string status)
        {
            try
            {
                if (!userId.HasValue)
                {
                    return false;
                }

                var user = await _context.Users.FindAsync(userId.Value);
                if (user == null)
                {
                    return false;
                }

                user.StripeAccountId = accountId;
                user.StripeAccountStatus = status;
                user.StripeAccountEnabled = status == "active";
                user.UpdatedDate = DateTime.Now;

                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Stripe account for user {UserId}", userId);
                return false;
            }
        }

        public async Task<bool> UpdateStripeCustomerIdAsync(long? userId, string customerId)
        {
            try
            {
                if (!userId.HasValue)
                {
                    return false;
                }

                var user = await _context.Users.FindAsync(userId.Value);
                if (user == null)
                {
                    return false;
                }

                user.StripeCustomerId = customerId;
                user.UpdatedDate = DateTime.Now;

                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Stripe customer ID for user {UserId}", userId);
                return false;
            }
        }

        // Removed UpdateSubscriptionIdAsync - subscriptions are now organization-only
        // This method is kept for backward compatibility but does nothing
        [Obsolete("Subscriptions are now organization-only. Use organization subscription management instead.")]
        public async Task<bool> UpdateSubscriptionIdAsync(long? userId, long subscriptionId)
        {
            // Subscriptions are now organization-only, so this method does nothing
            await Task.CompletedTask;
            return true;
        }

        public async Task<LoadUserDto?> GetUserByGoogleIdAsync(string googleId)
        {
            var dbUser = await _context.Users
                .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                .Where(u => u.GoogleId == googleId && !u.IsDeleted)
                .FirstOrDefaultAsync();

            return dbUser != null ? _mapper.Map<LoadUserDto>(dbUser) : null;
        }

        public async Task<LoadUserDto?> GetUserByAppleIdAsync(string appleId)
        {
            var dbUser = await _context.Users
                .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                .Where(u => u.AppleId == appleId && !u.IsDeleted)
                .FirstOrDefaultAsync();

            return dbUser != null ? _mapper.Map<LoadUserDto>(dbUser) : null;
        }

        public async Task<LoadUserDto?> GetUserByEmailAsync(string email)
        {
            var dbUser = await _context.Users
                .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                .Where(u => u.Email.ToLower().Equals(email.ToLower()) && !u.IsDeleted)
                .FirstOrDefaultAsync();

            return dbUser != null ? _mapper.Map<LoadUserDto>(dbUser) : null;
        }

        public async Task<LoadUserDto?> UpdateUserAccountInfo(long userId, UpdateUserDto updateUserDto)
        {
            var dbUser = await _context.Users
                .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (dbUser == null)
                return null;

            // Check if email is being changed and if it's already taken
            if (!string.IsNullOrEmpty(updateUserDto.Email) &&
                !dbUser.Email.Equals(updateUserDto.Email, StringComparison.OrdinalIgnoreCase))
            {
                if (await UserExists(updateUserDto.Email))
                {
                    throw new InvalidOperationException("A user with that email already exists.");
                }
            }

            // Check if email is being changed
            bool emailChanged = !string.IsNullOrEmpty(updateUserDto.Email) &&
                               !dbUser.Email.Equals(updateUserDto.Email, StringComparison.OrdinalIgnoreCase);

            // Update user fields
            dbUser.FirstName = updateUserDto.FirstName;
            dbUser.LastName = updateUserDto.LastName;
            dbUser.Email = updateUserDto.Email;
            dbUser.PhoneNumber = updateUserDto.PhoneNumber;

            // Update company if provided
            if (updateUserDto.Company != null)
            {
                dbUser.Company = updateUserDto.Company;
            }

            // Update date of birth if provided
            if (updateUserDto.DateOfBirth.HasValue)
            {
                dbUser.DateOfBirth = updateUserDto.DateOfBirth.Value;
            }

            // Update business information if provided
            if (updateUserDto.BusinessName != null)
            {
                dbUser.BusinessName = updateUserDto.BusinessName;
            }
            if (updateUserDto.BusinessEmail != null)
            {
                dbUser.BusinessEmail = updateUserDto.BusinessEmail;
            }
            if (updateUserDto.BusinessPhone != null)
            {
                dbUser.BusinessPhone = updateUserDto.BusinessPhone;
            }

            // Update account information if provided
            if (!string.IsNullOrEmpty(updateUserDto.AuthProvider))
            {
                dbUser.AuthProvider = updateUserDto.AuthProvider;
            }
            if (updateUserDto.HasSeenTutorial.HasValue)
            {
                dbUser.HasSeenTutorial = updateUserDto.HasSeenTutorial.Value;
            }

            dbUser.UpdatedDate = DateTime.Now;

            // If email changed and user has Tenant role, sync email to Tenant table
            if (emailChanged && !string.IsNullOrEmpty(updateUserDto.Email))
            {
                var hasTenantRole = dbUser.UserRoles?.Any(ur =>
                    ur.Role != null &&
                    ur.Role.RoleName != null &&
                    ur.Role.RoleName.Equals("Tenant", StringComparison.OrdinalIgnoreCase)) ?? false;

                if (hasTenantRole)
                {
                    // Find all tenant records associated with this user and update their email
                    var tenants = await _context.Tenants
                        .Where(t => t.UserId == userId && !t.IsDeleted)
                        .ToListAsync();

                    foreach (var tenant in tenants)
                    {
                        tenant.Email = updateUserDto.Email;
                    }
                }
            }

            await _context.SaveChangesAsync();

            return _mapper.Map<LoadUserDto>(dbUser);
        }

        public async Task<List<LoadUserDto>> GetAllUsers(bool includeDeleted = false)
        {
            var query = _context.Users
                .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                .AsQueryable();

            if (!includeDeleted)
            {
                query = query.Where(u => !u.IsDeleted);
            }

            var users = await query
                .OrderByDescending(u => u.CreateDate)
                .ToListAsync();

            return _mapper.Map<List<LoadUserDto>>(users);
        }

        public async Task<User> GetUserByIdIncludingDeleted(long id)
        {
            return await _context.Users
                .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(x => x.Id == id);
        }

        public async Task<bool> UpdateCurrentOrganizationIdAsync(long userId, long? organizationId)
        {
            try
            {
                var user = await _context.Users.FindAsync(userId);
                if (user == null)
                    return false;

                user.CurrentOrganizationId = organizationId;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating CurrentOrganizationId for user {UserId}", userId);
                return false;
            }
        }

        public async Task<List<Models.User>> GetAdminUsersAsync()
        {
            try
            {
                // Get the Admin role ID
                var adminRole = await _context.Roles
                    .FirstOrDefaultAsync(r => r.RoleName.ToLower() == "admin");

                if (adminRole == null)
                {
                    _logger.LogWarning("Admin role not found in database");
                    return new List<Models.User>();
                }

                // Get all users with Admin role
                var adminUsers = await _context.Users
                    .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                    .Where(u => !u.IsDeleted &&
                                u.UserRoles.Any(ur => ur.RoleId == adminRole.Id))
                    .ToListAsync();

                return adminUsers;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting admin users");
                return new List<Models.User>();
            }
        }
    }
}