using System.Text.RegularExpressions;

namespace brownstone_hub_api.Helpers
{
    /// <summary>
    /// Helper class for password validation
    /// </summary>
    public static class PasswordValidator
    {
        private const int MinLength = 8;
        private const int MaxLength = 128;

        /// <summary>
        /// Validates password strength
        /// </summary>
        /// <param name="password">Password to validate</param>
        /// <returns>Tuple with validation result and error message</returns>
        public static (bool IsValid, string ErrorMessage) ValidatePassword(string password)
        {
            if (string.IsNullOrWhiteSpace(password))
            {
                return (false, "Password is required");
            }

            if (password.Length < MinLength)
            {
                return (false, $"Password must be at least {MinLength} characters long");
            }

            if (password.Length > MaxLength)
            {
                return (false, $"Password must not exceed {MaxLength} characters");
            }

            // Check for at least one uppercase letter
            if (!Regex.IsMatch(password, @"[A-Z]"))
            {
                return (false, "Password must contain at least one uppercase letter");
            }

            // Check for at least one lowercase letter
            if (!Regex.IsMatch(password, @"[a-z]"))
            {
                return (false, "Password must contain at least one lowercase letter");
            }

            // Check for at least one digit
            if (!Regex.IsMatch(password, @"[0-9]"))
            {
                return (false, "Password must contain at least one number");
            }

            // Check for at least one special character (must match frontend PASSWORD_SPECIAL_REGEX)
            if (!Regex.IsMatch(password, @"[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]"))
            {
                return (false, "Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)");
            }

            // Check for common weak passwords
            var commonPasswords = new[]
            {
                "password", "password123", "12345678", "qwerty", "abc123",
                "letmein", "welcome", "monkey", "1234567890", "password1"
            };

            if (commonPasswords.Any(common => password.Equals(common, StringComparison.OrdinalIgnoreCase)))
            {
                return (false, "Password is too common. Please choose a more unique password");
            }

            return (true, string.Empty);
        }

        /// <summary>
        /// Gets password requirements as a formatted string
        /// </summary>
        public static string GetPasswordRequirements()
        {
            return $"Password must be {MinLength}-{MaxLength} characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.";
        }
    }
}

