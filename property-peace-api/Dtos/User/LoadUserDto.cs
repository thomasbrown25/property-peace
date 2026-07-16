


namespace brownstone_hub_api.Dtos.User
{
    public class LoadUserDto
    {
        public long Id { get; set; }
        public string Firstname { get; set; } = string.Empty;
        public string Lastname { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string JWTToken { get; set; } = string.Empty;
        public string? PhoneNumber { get; set; }
        public string Company { get; set; } = string.Empty;
        public DateOnly? DateOfBirth { get; set; }
        public bool HasSeenTutorial { get; set; } = false;
        public bool NotificationPreferencesConfigured { get; set; } = false;
        public List<string> Roles { get; set; } = [];
        public DateTime LastVisited { get; set; } = DateTime.MinValue;
        public DateTime? LastLogin { get; set; }
        public int LoginCount { get; set; } = 0;
        public string? GoogleId { get; set; }
        public string AuthProvider { get; set; } = "Email";
        /// <summary>
        /// True if the user has a password set (can sign in with email/password). False for Google-only users who have not set a password yet.
        /// </summary>
        public bool HasPassword { get; set; }
        
        // Stripe Connect fields
        public string? StripeAccountId { get; set; }
        public string? StripeAccountStatus { get; set; }
        public bool StripeAccountEnabled { get; set; } = false;
        
        // Stripe customer ID (kept for backward compatibility, but subscriptions are now organization-based)
        public string? StripeCustomerId { get; set; }
        
        // Profile image
        public string? ProfileImageUrl { get; set; }
        
        // Business Information
        public string? BusinessName { get; set; }
        public string? BusinessEmail { get; set; }
        public string? BusinessPhone { get; set; }
        
        // Soft delete fields (for admin)
        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
        public DateTime CreateDate { get; set; }
        
        // Account suspension fields
        public bool IsSuspended { get; set; } = false;
        public DateTime? SuspendedAt { get; set; }

        // Demo account flag
        public bool IsDemo { get; set; } = false;
        
        // Organization context
        public long? CurrentOrganizationId { get; set; }
        public string? CurrentOrganizationName { get; set; }
        public string? CurrentOrganizationRole { get; set; }
        public List<OrganizationInfoDto> Organizations { get; set; } = [];
    }

    public class OrganizationInfoDto
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
    }
}