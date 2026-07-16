using brownstone_hub_api.Data;
using brownstone_hub_api.Repositories.AdminSettings;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Subscriptions;
using brownstone_hub_api.Repositories.Users;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.SubscriptionService
{
    public class FeatureGateService : IFeatureGateService
    {
        private readonly ISubscriptionRepository _subscriptionRepository;
        private readonly IPropertyRepository _propertyRepository;
        private readonly IUserRepository _userRepository;
        private readonly IAdminSettingsRepository _adminSettingsRepository;
        private readonly DataContext _context;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly ILogger<FeatureGateService> _logger;

        public FeatureGateService(
            ISubscriptionRepository subscriptionRepository,
            IPropertyRepository propertyRepository,
            IUserRepository userRepository,
            IAdminSettingsRepository adminSettingsRepository,
            DataContext context,
            IHttpContextAccessor httpContextAccessor,
            ILogger<FeatureGateService> logger)
        {
            _subscriptionRepository = subscriptionRepository;
            _propertyRepository = propertyRepository;
            _userRepository = userRepository;
            _adminSettingsRepository = adminSettingsRepository;
            _context = context;
            _httpContextAccessor = httpContextAccessor;
            _logger = logger;
        }

        private async Task<long?> GetOrganizationIdForUserAsync(long userId)
        {
            try
            {
                if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
                {
                    return orgId;
                }

                var user = await _userRepository.GetUser(userId);
                return user?.CurrentOrganizationId;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting organization ID for user {UserId}", userId);
                return null;
            }
        }

        /// <summary>
        /// Returns the landlord's subscription by owner user ID (covers all their orgs).
        /// Falls back to org-based lookup for members who are not the owner.
        /// </summary>
        private async Task<Subscription?> GetLandlordSubscriptionAsync(long userId)
        {
            // Primary: subscription owned by this user (works across all their orgs)
            var ownerSub = await _subscriptionRepository.GetSubscriptionByOwnerUserIdAsync(userId);
            if (ownerSub != null) return ownerSub;

            // Fallback: org-based (for managers who are not the subscription owner)
            var organizationId = await GetOrganizationIdForUserAsync(userId);
            if (!organizationId.HasValue) return null;
            return await _subscriptionRepository.GetSubscriptionByOrganizationIdAsync(organizationId.Value);
        }

        public async Task<bool> CanAddPropertyAsync(long userId)
        {
            try
            {
                Subscription? subscription = await GetLandlordSubscriptionAsync(userId);

                if (subscription == null)
                {
                    return true;
                }

                // Check subscription status
                // Allow access for Active, Trial, and PaymentPending (payment being processed)
                if (subscription.Status != "Active" && subscription.Status != "Trial" && subscription.Status != "PaymentPending")
                {
                    return false;
                }

                // Check if subscription is paused and period has ended
                if (subscription.Status == "Paused" ||
                    (subscription.PausedAtPeriodEnd && subscription.CurrentPeriodEnd.HasValue && subscription.CurrentPeriodEnd.Value <= DateTime.UtcNow))
                {
                    return false;
                }

                // Property limits are removed - everything is based on unit limits now
                // Unit limits are checked when actually adding units to properties
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking if user {UserId} can add property", userId);
                return false; // Fail closed for security
            }
        }

        public async Task<bool> CanAddTenantAsync(long userId)
        {
            try
            {
                Subscription? subscription = await GetLandlordSubscriptionAsync(userId);

                if (subscription == null)
                {
                    return true;
                }

                // Check if paused and period ended
                var isPaused = subscription.Status == "Paused" ||
                    (subscription.PausedAtPeriodEnd && subscription.CurrentPeriodEnd.HasValue && subscription.CurrentPeriodEnd.Value <= DateTime.UtcNow);

                // Allow access for Active, Trial, and PaymentPending (payment being processed)
                return (subscription.Status == "Active" || subscription.Status == "Trial" || subscription.Status == "PaymentPending") && !isPaused;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking if user {UserId} can add tenant", userId);
                return false;
            }
        }

        public async Task<bool> HasFeatureAccessAsync(long userId, string featureName)
        {
            try
            {
                // Tenant-only users gate on their own subscription, not the landlord's.
                // Landlord/Admin users gate on the landlord's org subscription.
                var currentUser = await _userRepository.GetCurrentUser();
                var roles = currentUser?.Roles ?? [];
                var isTenantOnly = roles.Any(r => string.Equals(r?.Trim(), "Tenant", StringComparison.OrdinalIgnoreCase))
                    && !roles.Any(r => string.Equals(r?.Trim(), "Landlord", StringComparison.OrdinalIgnoreCase))
                    && !roles.Any(r => string.Equals(r?.Trim(), "Admin", StringComparison.OrdinalIgnoreCase));

                Subscription? subscription;
                if (isTenantOnly)
                {
                    subscription = await _subscriptionRepository.GetSubscriptionByUserIdAsync(userId);
                }
                else
                {
                    // Try landlord subscription first; fall back to tenant subscription
                    subscription = await GetLandlordSubscriptionAsync(userId)
                        ?? await _subscriptionRepository.GetSubscriptionByUserIdAsync(userId);
                }

                if (subscription == null)
                {
                    return featureName == "basic";
                }

                if (subscription.Status != "Active" && subscription.Status != "Trial")
                {
                    return false;
                }

                var planName = subscription.SubscriptionPlan?.Name?.Trim() ?? string.Empty;
                var billingCycle = subscription.BillingCycle?.Trim() ?? string.Empty;
                var isPremium = string.Equals(planName, "Premium", StringComparison.OrdinalIgnoreCase) ||
                    planName.Contains("premium", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(planName, "Lifetime Plan", StringComparison.OrdinalIgnoreCase) ||
                    planName.Contains("lifetime", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(billingCycle, "Lifetime", StringComparison.OrdinalIgnoreCase);

                // These features are Premium-only
                if (string.Equals(featureName, "LeaseShield", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(featureName, "RentEstimate", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(featureName, "Reports", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(featureName, "OnlineRentCollection", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(featureName, "DedicatedSmsNumber", StringComparison.OrdinalIgnoreCase))
                {
                    if (isPremium) return true;

                    // Admin override: allow all premium features on free plan
                    var adminSettings = await _adminSettingsRepository.GetAdminSettings();
                    if (adminSettings?.AllPremiumFeaturesOnFreePlan == true) return true;

                    return false;
                }

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking feature access for user {UserId}, feature {FeatureName}", userId, featureName);
                return false;
            }
        }

        public async Task<bool> HasLeaseShieldAccessAsync(long userId)
        {
            return await HasFeatureAccessAsync(userId, "LeaseShield");
        }

        public async Task<int?> GetRemainingPropertySlotsAsync(long userId)
        {
            // DEPRECATED: Property limits are removed. This method returns null to indicate unlimited properties.
            // All limits are now based on units only. Use GetRemainingUnitSlotsAsync instead.
            return null;
        }

        public async Task<int> GetCurrentPropertyCountAsync(long userId)
        {
            try
            {
                var organizationId = await GetOrganizationIdForUserAsync(userId);
                if (organizationId.HasValue)
                    return await _propertyRepository.GetTotalPropertyCountAsync(organizationId.Value);
                return await _propertyRepository.GetTotalPropertyCountByLandlordAsync(userId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting property count for user {UserId}", userId);
                return 0;
            }
        }

        public async Task<bool> CanAddUnitToPropertyAsync(long userId, long propertyId)
        {
            try
            {
                var property = await _propertyRepository.GetPropertyById(propertyId);
                if (property == null) return false;

                Subscription? subscription = await GetLandlordSubscriptionAsync(userId);

                if (subscription == null)
                {
                    return property.LandlordId == userId;
                }

                // Check subscription status
                if (subscription.Status != "Active" && subscription.Status != "Trial")
                {
                    return false;
                }

                // Check if subscription is paused and period has ended
                if (subscription.Status == "Paused" ||
                    (subscription.PausedAtPeriodEnd && subscription.CurrentPeriodEnd.HasValue && subscription.CurrentPeriodEnd.Value <= DateTime.UtcNow))
                {
                    return false;
                }

                // Get the property and verify ownership
                if (property == null)
                {
                    return false;
                }

                // Verify property belongs to user
                if (property.LandlordId != userId)
                {
                    return false;
                }

                // Check total units across all properties
                var currentTotalUnits = await GetCurrentTotalUnitsAsync(userId);
                var maxTotalUnits = subscription.SubscriptionPlan.MaxTotalUnits;

                // If MaxTotalUnits is null, it means unlimited (Business tier)
                if (maxTotalUnits == null)
                {
                    return true;
                }

                // Check if adding one more unit would exceed the limit
                return currentTotalUnits < maxTotalUnits.Value;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking if user {UserId} can add unit to property {PropertyId}", userId, propertyId);
                return false; // Fail closed for security
            }
        }

        public async Task<int> GetCurrentTotalUnitsAsync(long userId)
        {
            try
            {
                var organizationId = await GetOrganizationIdForUserAsync(userId);
                if (organizationId.HasValue)
                    return await _propertyRepository.GetTotalUnitCountAsync(organizationId.Value);
                return await _propertyRepository.GetTotalUnitCountByLandlordAsync(userId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting total units count for user {UserId}", userId);
                return 0;
            }
        }

        public async Task<int?> GetRemainingUnitSlotsAsync(long userId)
        {
            try
            {
                Subscription? subscription = await GetLandlordSubscriptionAsync(userId);

                if (subscription == null)
                {
                    var trialTotalUnits = await GetCurrentTotalUnitsAsync(userId);
                    return trialTotalUnits == 0 ? 1 : 0;
                }

                if (subscription.Status != "Active" && subscription.Status != "Trial")
                {
                    return 0;
                }

                var currentTotalUnits = await GetCurrentTotalUnitsAsync(userId);
                var maxTotalUnits = subscription.SubscriptionPlan.MaxTotalUnits;

                // Unlimited
                if (maxTotalUnits == null)
                {
                    return null;
                }

                var remaining = maxTotalUnits.Value - currentTotalUnits;
                return remaining > 0 ? remaining : 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting remaining unit slots for user {UserId}", userId);
                return 0;
            }
        }
    }
}

