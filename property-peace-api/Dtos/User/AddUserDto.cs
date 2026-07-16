
using System.Text.Json.Serialization;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.User
{
    public class AddUserDto
    {
        public string RegistrationCode { get; set; } = string.Empty;
        public string Firstname { get; set; } = string.Empty;
        public string Lastname { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string? PhoneNumber { get; set; }
        public string Company { get; set; } = string.Empty;
        public DateOnly? DateOfBirth { get; set; } = null;
        public bool HasSeenTutorial { get; set; } = false;
        public bool NotificationPreferencesConfigured { get; set; } = false;
        public List<string> Roles { get; set; } = [];
        public byte[]? PasswordHash { get; set; }
        public byte[]? PasswordSalt { get; set; }
        public string? InviteToken { get; set; } // For tenant registration via invite
        public string? OrganizationInviteToken { get; set; } // For organization member registration via invite
        public string? BusinessName { get; set; }
        public string? BusinessEmail { get; set; }
        public string? BusinessPhone { get; set; }
        public string? GoogleAccessToken { get; set; } // For Google sign-up flow
        public string? Timezone { get; set; } // IANA timezone detected by the browser during signup
        public long? OrganizationId { get; set; } // Optional organization ID for tenant accounts created by landlords
    }
}