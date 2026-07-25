

namespace brownstone_hub_api.Models
{
    public class User
    {
        public long Id { get; set; }
        public long SettingId { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? PhoneNumber { get; set; }
        public string Company { get; set; } = string.Empty;
        public DateOnly? DateOfBirth { get; set; }
        public bool HasSeenTutorial { get; set; } = false;
        public bool NotificationPreferencesConfigured { get; set; } = false;
        public ICollection<UserRole> UserRoles { get; set; } = [];
        public ICollection<PasskeyCredential> PasskeyCredentials { get; set; } = [];
        public byte[]? PasswordHash { get; set; } // Nullable for OAuth users
        public byte[]? PasswordSalt { get; set; } // Nullable for OAuth users
        public string? GoogleId { get; set; } // Google OAuth ID
        public string AuthProvider { get; set; } = "Email"; // Email, Google, Apple, or "Email,Google" when both are linked
        public DateTime CreateDate { get; set; } = DateTime.Now;
        public DateTime UpdatedDate { get; set; } = DateTime.Now;
        public DateTime LastVisited { get; set; } = DateTime.Now;
        public DateTime? LastLogin { get; set; }
        public int LoginCount { get; set; } = 0;

        // Stripe Connect fields
        public string? StripeAccountId { get; set; }
        public string? StripeAccountStatus { get; set; } // e.g., "pending", "active", "restricted"
        public bool StripeAccountEnabled { get; set; } = false;

        // Stripe customer ID (kept for backward compatibility, but subscriptions are now organization-based)
        public string? StripeCustomerId { get; set; }

        // Profile image
        public string? ProfileImageUrl { get; set; }

        // Business Information
        public string? BusinessName { get; set; }
        public string? BusinessEmail { get; set; }
        public string? BusinessPhone { get; set; }

        // Soft delete
        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }

        // Account suspension
        public bool IsSuspended { get; set; } = false;
        public DateTime? SuspendedAt { get; set; }

        // Organization context
        public long? CurrentOrganizationId { get; set; } // Active organization context
        public Organization? CurrentOrganization { get; set; }

        // Seeded data flag
        public bool IsSeeded { get; set; } = false;

        // Demo account flag
        public bool IsDemo { get; set; } = false;

    }
}