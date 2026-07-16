using AutoMapper;
using brownstone_hub_api.Dtos.Subscription;
using brownstone_hub_api.Models;
using System.Collections.Generic;
using brownstone_hub_api.Repositories.Subscriptions;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Services.StripeService;
using Microsoft.AspNetCore.Http;
using Stripe;
using System.Text.Json;

namespace brownstone_hub_api.Services.SubscriptionService
{
    public class SubscriptionService : ISubscriptionService
    {
        private readonly ISubscriptionRepository _subscriptionRepository;
        private readonly ISubscriptionPlanRepository _planRepository;
        private readonly ISubscriptionHistoryRepository _historyRepository;
        private readonly IUserRepository _userRepository;
        private readonly IOrganizationMemberRepository _memberRepository;
        private readonly IOrganizationRepository _organizationRepository;
        private readonly IStripeService _stripeService;
        private readonly IFeatureGateService _featureGateService;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly IMapper _mapper;
        private readonly ILogger<SubscriptionService> _logger;

        public SubscriptionService(
            ISubscriptionRepository subscriptionRepository,
            ISubscriptionPlanRepository planRepository,
            ISubscriptionHistoryRepository historyRepository,
            IUserRepository userRepository,
            IOrganizationMemberRepository memberRepository,
            IOrganizationRepository organizationRepository,
            IStripeService stripeService,
            IFeatureGateService featureGateService,
            IHttpContextAccessor httpContextAccessor,
            IMapper mapper,
            ILogger<SubscriptionService> logger)
        {
            _subscriptionRepository = subscriptionRepository;
            _planRepository = planRepository;
            _historyRepository = historyRepository;
            _userRepository = userRepository;
            _memberRepository = memberRepository;
            _organizationRepository = organizationRepository;
            _stripeService = stripeService;
            _featureGateService = featureGateService;
            _httpContextAccessor = httpContextAccessor;
            _mapper = mapper;
            _logger = logger;
        }

        private async Task<long?> GetCurrentUserIdAsync()
        {
            var user = await _userRepository.GetCurrentUser();
            return user?.Id;
        }

        /// <summary>
        /// True if the current user has only the Tenant role (no Landlord or Admin).
        /// </summary>
        private async Task<bool> IsCurrentUserTenantOnlyAsync()
        {
            var user = await _userRepository.GetCurrentUser();
            if (user?.Roles == null) return false;
            var roles = user.Roles.Select(r => r.Trim()).ToList();
            var hasTenant = roles.Any(r => string.Equals(r, "Tenant", StringComparison.OrdinalIgnoreCase));
            var hasLandlord = roles.Any(r => string.Equals(r, "Landlord", StringComparison.OrdinalIgnoreCase));
            var hasAdmin = roles.Any(r => string.Equals(r, "Admin", StringComparison.OrdinalIgnoreCase));
            return hasTenant && !hasLandlord && !hasAdmin;
        }

        private long? GetCurrentOrganizationId()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }

        private const string LifetimePlanName = "Lifetime Plan";

        /// <summary>
        /// Checks if a plan is a free/paymentless plan (no payment required).
        /// This intentionally includes admin-assigned zero-dollar plans so they do not
        /// get marked as orphaned Stripe subscriptions.
        /// </summary>
        private bool IsFreePlan(Models.SubscriptionPlan plan)
        {
            return plan.Name.Equals("Free", StringComparison.OrdinalIgnoreCase) ||
                   (plan.MonthlyPrice == 0 && plan.AnnualPrice == 0);
        }

        private static bool IsLifetimePlan(Models.SubscriptionPlan plan)
        {
            return plan.Name.Equals(LifetimePlanName, StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsPublicSubscriptionPlan(Models.SubscriptionPlan plan)
        {
            return !IsLifetimePlan(plan);
        }

        /// <summary>
        /// Links any existing subscription with the given Stripe customer ID to the organization
        /// </summary>
        private async Task LinkSubscriptionToOrganizationAsync(string stripeCustomerId, long organizationId, Organization organization)
        {
            try
            {
                var existingSubscription = await _subscriptionRepository.GetSubscriptionByStripeCustomerIdAsync(stripeCustomerId);
                if (existingSubscription != null && existingSubscription.OrganizationId != organizationId)
                {
                    existingSubscription.OrganizationId = organizationId;
                    await _subscriptionRepository.UpdateSubscriptionAsync(existingSubscription);
                    organization.SubscriptionId = existingSubscription.Id;
                    _logger.LogInformation("Linked existing subscription {SubscriptionId} to organization {OrganizationId} via Stripe customer ID {CustomerId}",
                        existingSubscription.Id, organizationId, stripeCustomerId);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error linking subscription to organization {OrganizationId} for customer {CustomerId}", organizationId, stripeCustomerId);
            }
        }

        /// <summary>
        /// Verifies that the user is an Owner or Manager of the organization that has the subscription
        /// </summary>
        private async Task<bool> CanManageSubscriptionAsync(long? userId, long? organizationId)
        {
            if (!userId.HasValue || !organizationId.HasValue)
            {
                return false;
            }

            try
            {
                var member = await _memberRepository.GetMemberAsync(organizationId.Value, userId.Value);
                if (member == null || !member.IsActive)
                {
                    return false;
                }

                // Owners and Managers can manage subscriptions
                return member.Role == "Owner" || member.Role == "Manager";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking subscription management permission for user {UserId} in organization {OrganizationId}", userId, organizationId);
                return false;
            }
        }

        /// <summary>
        /// Gets the subscription for the current user/org and verifies the user has permission to manage it.
        /// For tenants: subscription by UserId. For landlords: subscription by OrganizationId.
        /// </summary>
        private async Task<(Models.Subscription? subscription, bool hasPermission)> GetSubscriptionWithPermissionCheckAsync(long? userId)
        {
            if (!userId.HasValue)
            {
                return (null, false);
            }

            var isTenantOnly = await IsCurrentUserTenantOnlyAsync();
            if (isTenantOnly)
            {
                // Tenant: subscription is keyed by UserId; they can always manage their own
                var subscription = await _subscriptionRepository.GetSubscriptionByUserIdAsync(userId.Value);
                return (subscription, subscription != null);
            }

            // Landlord/Admin: subscription is per-user (OwnerUserId), not per-org.
            // Multiple orgs owned by the same landlord share one subscription.
            var ownerSubscription = await _subscriptionRepository.GetSubscriptionByOwnerUserIdAsync(userId.Value);
            if (ownerSubscription != null)
            {
                // Owner can always manage their own subscription
                return (ownerSubscription, true);
            }

            // Fallback: org-context check for users who are Managers (not owners) of the org
            var organizationId = GetCurrentOrganizationId();
            if (!organizationId.HasValue)
            {
                return (null, false);
            }

            var subscriptionOrg = await _subscriptionRepository.GetSubscriptionByOrganizationIdAsync(organizationId.Value);
            if (subscriptionOrg == null)
            {
                return (null, false);
            }

            var canManage = await CanManageSubscriptionAsync(userId, organizationId);
            return (subscriptionOrg, canManage);
        }

        public async Task<ServiceResponse<List<SubscriptionPlanDto>>> GetAvailablePlansAsync()
        {
            var response = new ServiceResponse<List<SubscriptionPlanDto>>();

            try
            {
                var plans = await _planRepository.GetAllPlansAsync();
                var planDtos = plans
                    .Where(IsPublicSubscriptionPlan)
                    .Select(plan =>
                {
                    var dto = _mapper.Map<SubscriptionPlanDto>(plan);
                    if (plan.MonthlyPrice > 0 && plan.AnnualPrice > 0)
                    {
                        var monthlyAnnual = plan.MonthlyPrice * 12;
                        if (monthlyAnnual > plan.AnnualPrice)
                        {
                            dto.AnnualDiscount = ((monthlyAnnual - plan.AnnualPrice) / monthlyAnnual) * 100;
                        }
                    }
                    return dto;
                }).ToList();

                response.Data = planDtos;
                response.Message = "Available plans retrieved successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting available plans");
                response.Success = false;
                response.Message = $"Error retrieving plans: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<SubscriptionDto>> GetUserSubscriptionAsync()
        {
            var response = new ServiceResponse<SubscriptionDto>();

            try
            {
                var userId = await GetCurrentUserIdAsync();
                if (!userId.HasValue)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    response.StatusCode = 401;
                    return response;
                }

                var isTenantOnly = await IsCurrentUserTenantOnlyAsync();
                Models.Subscription? subscription;

                if (isTenantOnly)
                {
                    // Tenant: subscription keyed by UserId
                    subscription = await _subscriptionRepository.GetSubscriptionByUserIdAsync(userId.Value);
                    if (subscription == null)
                    {
                        await EnsureTenantFreeSubscriptionAsync(userId.Value);
                        subscription = await _subscriptionRepository.GetSubscriptionByUserIdAsync(userId.Value);
                    }
                    if (subscription == null)
                    {
                        response.Success = false;
                        response.Message = "No subscription found for user";
                        response.StatusCode = 404;
                        return response;
                    }
                }
                else
                {
                    // Landlord/Admin: organization-based
                    var organizationId = GetCurrentOrganizationId();
                    if (!organizationId.HasValue)
                    {
                        response.Success = false;
                        response.Message = "No active organization. Subscriptions are tied to organizations.";
                        response.StatusCode = 400;
                        return response;
                    }

                    subscription = await _subscriptionRepository.GetSubscriptionByOrganizationIdAsync(organizationId.Value);

                    if (subscription == null)
                    {
                        var organization = await _organizationRepository.GetOrganizationByIdAsync(organizationId.Value);
                        if (organization != null && !string.IsNullOrEmpty(organization.StripeCustomerId))
                        {
                            subscription = await _subscriptionRepository.GetSubscriptionByStripeCustomerIdAsync(organization.StripeCustomerId);

                            if (subscription != null && subscription.OrganizationId != organizationId.Value)
                            {
                                subscription.OrganizationId = organizationId.Value;
                                await _subscriptionRepository.UpdateSubscriptionAsync(subscription);

                                organization.SubscriptionId = subscription.Id;
                                await _organizationRepository.UpdateOrganizationAsync(organization);

                                _logger.LogInformation("Linked subscription {SubscriptionId} to organization {OrganizationId} via Stripe customer ID {CustomerId}",
                                    subscription.Id, organizationId.Value, organization.StripeCustomerId);
                            }
                        }
                    }

                    if (subscription == null)
                    {
                        response.Success = false;
                        response.Message = "No subscription found for organization";
                        response.StatusCode = 404;
                        return response;
                    }
                }

                // Sync status from Stripe when we have a Stripe ID and our status may be stale
                if (!string.IsNullOrEmpty(subscription.StripeSubscriptionId))
                {
                    try
                    {
                        var stripeSubscriptionResponse = await _stripeService.GetSubscriptionAsync(subscription.StripeSubscriptionId);
                        if (stripeSubscriptionResponse.Success && stripeSubscriptionResponse.Data != null)
                        {
                            var stripeSubscription = stripeSubscriptionResponse.Data;

                            // If Stripe has pause_collection set but our DB says Active, sync to Paused (e.g. webhook overwrote us)
                            if (stripeSubscription.PauseCollection != null && subscription.Status != "Paused")
                            {
                                _logger.LogInformation("Syncing subscription {SubscriptionId} to Paused from Stripe (pause_collection set)", subscription.Id);
                                subscription.Status = "Paused";
                                subscription.PausedAtPeriodEnd = false;
                                subscription.PausedAt = DateTime.UtcNow;
                                subscription.CurrentPeriodStart = stripeSubscription.CurrentPeriodStart;
                                subscription.CurrentPeriodEnd = stripeSubscription.CurrentPeriodEnd;
                                subscription.TrialStart = stripeSubscription.TrialStart;
                                subscription.TrialEnd = stripeSubscription.TrialEnd;
                                await _subscriptionRepository.UpdateSubscriptionAsync(subscription);
                            }
                            else if (subscription.Status == "PaymentPending" || subscription.Status == "Incomplete")
                            {
                                var newStatus = MapStripeStatus(stripeSubscription.Status);
                                if (stripeSubscription.Status == "active")
                                {
                                    var oldStatus = subscription.Status;
                                    _logger.LogInformation("Syncing subscription {SubscriptionId} status from Stripe: {OldStatus} -> Active", subscription.Id, oldStatus);
                                    subscription.Status = "Active";
                                    subscription.CurrentPeriodStart = stripeSubscription.CurrentPeriodStart;
                                    subscription.CurrentPeriodEnd = stripeSubscription.CurrentPeriodEnd;
                                    subscription.TrialStart = stripeSubscription.TrialStart;
                                    subscription.TrialEnd = stripeSubscription.TrialEnd;
                                    await _subscriptionRepository.UpdateSubscriptionAsync(subscription);
                                    await _historyRepository.AddHistoryAsync(new SubscriptionHistory
                                    {
                                        SubscriptionId = subscription.Id,
                                        EventType = oldStatus == "PaymentPending" ? "TrialConverted" : "StatusSynced",
                                        Metadata = $"{{\"source\": \"status_sync\", \"oldStatus\": \"{oldStatus}\", \"stripeSubscriptionId\": \"{stripeSubscription.Id}\"}}"
                                    });
                                }
                                else if (stripeSubscription.Status != "incomplete" && newStatus != subscription.Status)
                                {
                                    _logger.LogInformation("Syncing subscription {SubscriptionId} status from Stripe: {OldStatus} -> {NewStatus}",
                                        subscription.Id, subscription.Status, newStatus);
                                    subscription.Status = newStatus;
                                    subscription.CurrentPeriodStart = stripeSubscription.CurrentPeriodStart;
                                    subscription.CurrentPeriodEnd = stripeSubscription.CurrentPeriodEnd;
                                    subscription.TrialStart = stripeSubscription.TrialStart;
                                    subscription.TrialEnd = stripeSubscription.TrialEnd;
                                    await _subscriptionRepository.UpdateSubscriptionAsync(subscription);
                                }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to sync subscription {SubscriptionId} status from Stripe", subscription.Id);
                    }
                }

                var dto = _mapper.Map<SubscriptionDto>(subscription);
                dto.Plan = _mapper.Map<SubscriptionPlanDto>(subscription.SubscriptionPlan);
                
                // Check if subscription is orphaned (has subscription but no Stripe IDs)
                // Free plans don't have Stripe IDs, so they're not orphaned
                dto.IsOrphaned = !IsFreePlan(subscription.SubscriptionPlan) && 
                                 (string.IsNullOrEmpty(subscription.StripeSubscriptionId) || string.IsNullOrEmpty(subscription.StripeCustomerId));

                response.Data = dto;
                response.Message = "Subscription retrieved successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting subscription for user");
                response.Success = false;
                response.Message = $"Error retrieving subscription: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<SubscriptionDto>> SubscribeAsync(CreateSubscriptionDto createDto)
        {
            var response = new ServiceResponse<SubscriptionDto>();

            try
            {
                var userId = await GetCurrentUserIdAsync();
                if (!userId.HasValue)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    response.StatusCode = 401;
                    return response;
                }

                var isTenantOnly = await IsCurrentUserTenantOnlyAsync();
                var organizationId = GetCurrentOrganizationId();

                // Check organization permission for landlords
                if (!isTenantOnly && organizationId.HasValue)
                {
                    var canManage = await CanManageSubscriptionAsync(userId, organizationId);
                    if (!canManage)
                    {
                        response.Success = false;
                        response.Message = "You do not have permission to manage subscriptions. Only Owners and Managers can manage subscriptions.";
                        response.StatusCode = 403;
                        return response;
                    }
                }

                // Check if user/org already has an active subscription
                Models.Subscription? existingSubscription = null;
                if (isTenantOnly)
                    existingSubscription = await _subscriptionRepository.GetSubscriptionByUserIdAsync(userId.Value);
                else if (organizationId.HasValue)
                    existingSubscription = await _subscriptionRepository.GetSubscriptionByOrganizationIdAsync(organizationId.Value);

                // Check if subscription exists but is orphaned (missing Stripe IDs)
                // Free plans don't have Stripe IDs, so they're not orphaned
                bool isOrphaned = existingSubscription != null && 
                                 (existingSubscription.Status == "Active" || existingSubscription.Status == "Trial") &&
                                 existingSubscription.SubscriptionPlan != null &&
                                 !IsFreePlan(existingSubscription.SubscriptionPlan) &&
                                 (string.IsNullOrEmpty(existingSubscription.StripeSubscriptionId) || string.IsNullOrEmpty(existingSubscription.StripeCustomerId));

                // Check if orphaned subscription plan matches the requested plan
                bool isOrphanedWithMatchingPlan = isOrphaned && existingSubscription != null && existingSubscription.SubscriptionPlanId == createDto.PlanId;

                if (existingSubscription != null && (existingSubscription.Status == "Active" || existingSubscription.Status == "Trial") && !isOrphaned)
                {
                    response.Success = false;
                    response.Message = "Organization already has an active subscription";
                    return response;
                }

                // If orphaned subscription exists but plan doesn't match, they need to use upgrade/downgrade
                if (isOrphaned && existingSubscription != null && !isOrphanedWithMatchingPlan)
                {
                    response.Success = false;
                    response.Message = "To change your plan, please fix your current subscription first or use the upgrade/downgrade feature";
                    return response;
                }

                // If subscription is orphaned with matching plan, we'll update it instead of creating a new one
                bool isUpdatingOrphaned = isOrphanedWithMatchingPlan;

                // Tenant: only Free plan can be created via SubscribeAsync; paid plans use checkout
                if (isTenantOnly)
                {
                    var tenantPlan = await _planRepository.GetPlanByIdAsync(createDto.PlanId);
                    if (tenantPlan == null) { response.Message = "Plan not found"; return response; }
                    if (!IsFreePlan(tenantPlan))
                    {
                        response.Success = false;
                        response.Message = "Use the checkout flow to upgrade to a paid plan.";
                        response.StatusCode = 400;
                        return response;
                    }
                    var freeSub = new Models.Subscription
                    {
                        UserId = userId,
                        OrganizationId = null,
                        SubscriptionPlanId = tenantPlan.Id,
                        Status = "Active",
                        BillingCycle = createDto.BillingCycle ?? "Monthly",
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    var created = await _subscriptionRepository.CreateSubscriptionAsync(freeSub);
                    response.Data = _mapper.Map<SubscriptionDto>(created);
                    response.Data.Plan = _mapper.Map<SubscriptionPlanDto>(tenantPlan);
                    response.Message = "Free plan subscription created successfully";
                    return response;
                }

                // Organization context is required for landlord subscriptions
                if (!organizationId.HasValue)
                {
                    response.Success = false;
                    response.Message = "Organization context is required to create a subscription";
                    response.StatusCode = 403;
                    return response;
                }

                // Get organization
                var organization = await _organizationRepository.GetOrganizationByIdAsync(organizationId.Value);
                if (organization == null)
                {
                    response.Success = false;
                    response.Message = "Organization not found";
                    response.StatusCode = 404;
                    return response;
                }

                // Get user for email/name if needed
                var user = await _userRepository.GetUser((long)userId);
                if (user == null)
                {
                    response.Message = "User not found";
                    return response;
                }

                // Get plan
                var plan = await _planRepository.GetPlanByIdAsync(createDto.PlanId);
                if (plan == null)
                {
                    response.Message = "Plan not found";
                    return response;
                }

                // Check if this is a free plan - if so, skip Stripe entirely
                bool isFreePlan = IsFreePlan(plan);

                Models.Subscription updatedSubscription;
                
                if (isFreePlan)
                {
                    // Free plan: Create subscription in database only, no Stripe required
                    _logger.LogInformation("Creating Free plan subscription for organization {OrganizationId} - skipping Stripe integration", organizationId.Value);
                    
                    if (isUpdatingOrphaned && existingSubscription != null)
                    {
                        // Update existing subscription to free plan
                        existingSubscription.SubscriptionPlanId = plan.Id;
                        existingSubscription.Status = "Active";
                        existingSubscription.BillingCycle = createDto.BillingCycle;
                        existingSubscription.CurrentPeriodStart = DateTime.UtcNow;
                        existingSubscription.CurrentPeriodEnd = null; // Free plan has no end date
                        existingSubscription.TrialStart = null;
                        existingSubscription.TrialEnd = null;
                        // Keep Stripe IDs as null for free plan
                        existingSubscription.StripeSubscriptionId = null;
                        existingSubscription.StripeCustomerId = null;
                        
                        updatedSubscription = await _subscriptionRepository.UpdateSubscriptionAsync(existingSubscription);

                        // Add history
                        await _historyRepository.AddHistoryAsync(new SubscriptionHistory
                        {
                            SubscriptionId = updatedSubscription.Id,
                            EventType = "PlanChanged",
                            Metadata = $"{{\"newPlan\": \"Free\", \"billingCycle\": \"{createDto.BillingCycle}\"}}"
                        });

                        response.Message = "Subscription updated to Free plan successfully";
                    }
                    else
                    {
                        // Create new free plan subscription in database
                        var subscription = new Models.Subscription
                        {
                            OrganizationId = organizationId.Value,
                            OwnerUserId = userId.Value,   // ties subscription to the landlord user
                            SubscriptionPlanId = plan.Id,
                            StripeSubscriptionId = null, // No Stripe for free plan
                            StripeCustomerId = null,      // No Stripe for free plan
                            Status = "Active",
                            BillingCycle = createDto.BillingCycle,
                            CurrentPeriodStart = DateTime.UtcNow,
                            CurrentPeriodEnd = null, // Free plan has no end date
                            TrialStart = null,
                            TrialEnd = null
                        };

                        updatedSubscription = await _subscriptionRepository.CreateSubscriptionAsync(subscription);

                        // Update organization with subscription ID
                        organization.SubscriptionId = updatedSubscription.Id;
                        
                        // Add history
                        await _historyRepository.AddHistoryAsync(new SubscriptionHistory
                        {
                            SubscriptionId = updatedSubscription.Id,
                            EventType = "Created",
                            NewPlanId = plan.Id,
                            Metadata = $"{{\"planType\": \"Free\", \"billingCycle\": \"{createDto.BillingCycle}\"}}"
                        });

                        response.Message = "Free plan subscription created successfully";
                    }
                    
                    await _organizationRepository.UpdateOrganizationAsync(organization);
                }
                else
                {
                    // Paid plan: Requires Stripe integration
                    // Get or create Stripe customer for Organization
                    string customerId;
                    if (string.IsNullOrWhiteSpace(organization.StripeCustomerId))
                    {
                        // No customer ID stored, create a new one for the organization
                        var customerResponse = await _stripeService.CreateCustomerAsync(
                            user.Email, // Use owner/manager email for billing
                            organization.Name,
                            new Dictionary<string, string>
                            {
                                { "organizationId", organizationId.Value.ToString() },
                                { "organizationName", organization.Name }
                            }
                        );

                        if (!customerResponse.Success || customerResponse.Data == null)
                        {
                            response.Success = false;
                            response.Message = $"Failed to create Stripe customer: {customerResponse.Message}";
                            return response;
                        }

                        customerId = customerResponse.Data.Id;
                        // Update organization with customer ID
                        organization.StripeCustomerId = customerId;
                        // Link any existing subscription with this customer ID
                        await LinkSubscriptionToOrganizationAsync(customerId, organizationId.Value, organization);
                        await _organizationRepository.UpdateOrganizationAsync(organization);
                    }
                    else
                    {
                        // Customer ID exists in database, verify it exists in Stripe
                        customerId = organization.StripeCustomerId;
                        var customerCheckResponse = await _stripeService.GetCustomerAsync(customerId);
                        
                        if (!customerCheckResponse.Success)
                        {
                            // Customer doesn't exist in Stripe (maybe created with different API key or deleted)
                            // Recreate the customer
                            _logger.LogWarning("Customer {CustomerId} not found in Stripe, recreating for organization {OrganizationId}",
                                customerId, organizationId.Value);
                            
                            var customerResponse = await _stripeService.CreateCustomerAsync(
                                user.Email,
                                organization.Name,
                                new Dictionary<string, string>
                                {
                                    { "organizationId", organizationId.Value.ToString() },
                                    { "organizationName", organization.Name }
                                }
                            );

                            if (!customerResponse.Success || customerResponse.Data == null)
                            {
                                response.Success = false;
                                response.Message = $"Failed to recreate Stripe customer: {customerResponse.Message}";
                                return response;
                            }

                            customerId = customerResponse.Data.Id;
                            organization.StripeCustomerId = customerId;
                            // Link any existing subscription with this customer ID
                            await LinkSubscriptionToOrganizationAsync(customerId, organizationId.Value, organization);
                            await _organizationRepository.UpdateOrganizationAsync(organization);
                        }
                    }

                    // Get price ID based on billing cycle
                    var priceId = createDto.BillingCycle == "Annual"
                        ? plan.StripePriceIdAnnual
                        : plan.StripePriceIdMonthly;

                    if (string.IsNullOrWhiteSpace(priceId))
                    {
                        response.Success = false;
                        response.Message = $"Price ID not configured for {createDto.BillingCycle} billing";
                        return response;
                    }

                    // Create Stripe subscription with trial period if eligible
                    int? trialDays = null;
                    
                    // Check if plan has trial days configured and user is eligible
                    if (plan.TrialDays.HasValue && plan.TrialDays.Value > 0)
                    {
                        // Check if user is eligible for trial (hasn't used one before)
                        var eligibilityResponse = await CheckTrialEligibilityAsync();
                        if (eligibilityResponse.Success && eligibilityResponse.Data)
                        {
                            trialDays = plan.TrialDays.Value;
                        }
                    }
                    else if (plan.IsTrial)
                    {
                        // Legacy: Free Trial plan always gets 7 days
                        trialDays = 7;
                    }

                    var subscriptionResponse = await _stripeService.CreateSubscriptionAsync(
                        customerId,
                        priceId,
                        trialDays,
                        createDto.PaymentMethodId,
                        null // No billing cycle anchor for new subscriptions
                    );

                    if (!subscriptionResponse.Success || subscriptionResponse.Data == null)
                    {
                        response.Success = false;
                        response.Message = $"Failed to create Stripe subscription: {subscriptionResponse.Message}";
                        return response;
                    }

                    var stripeSubscription = subscriptionResponse.Data;

                    if (isUpdatingOrphaned && existingSubscription != null)
                    {
                        // Check if this is a trial conversion
                        bool isTrialConversion = existingSubscription.Status == "Trial";
                        
                        // Update existing orphaned subscription with Stripe IDs
                        existingSubscription.StripeSubscriptionId = stripeSubscription.Id;
                        existingSubscription.StripeCustomerId = customerId;
                        
                        // For trial conversions: if Stripe status is "incomplete" (payment pending), 
                        // set status to "PaymentPending" so user knows payment is being processed.
                        // Once payment succeeds, subscription.updated webhook will transition it to "Active"
                        if (isTrialConversion && stripeSubscription.Status == "incomplete")
                        {
                            // Set to PaymentPending so user knows payment is being processed
                            _logger.LogInformation("Trial conversion: Stripe subscription {StripeSubscriptionId} has incomplete status (payment pending). Setting status to PaymentPending.", stripeSubscription.Id);
                            existingSubscription.Status = "PaymentPending";
                        }
                        else
                        {
                            existingSubscription.Status = stripeSubscription.Status == "trialing" ? "Trial" : MapStripeStatus(stripeSubscription.Status);
                        }
                        
                        existingSubscription.BillingCycle = createDto.BillingCycle;
                        existingSubscription.CurrentPeriodStart = stripeSubscription.CurrentPeriodStart;
                        existingSubscription.CurrentPeriodEnd = stripeSubscription.CurrentPeriodEnd;
                        existingSubscription.TrialStart = stripeSubscription.TrialStart;
                        existingSubscription.TrialEnd = stripeSubscription.TrialEnd;
                        
                        updatedSubscription = await _subscriptionRepository.UpdateSubscriptionAsync(existingSubscription);

                        // Add history
                        await _historyRepository.AddHistoryAsync(new SubscriptionHistory
                        {
                            SubscriptionId = updatedSubscription.Id,
                            EventType = "StripeCreated",
                            Metadata = $"{{\"source\": \"orphan_fix\", \"stripeSubscriptionId\": \"{stripeSubscription.Id}\", \"stripeCustomerId\": \"{customerId}\"}}"
                        });

                        response.Message = "Subscription updated with Stripe IDs successfully";
                    }
                    else
                    {
                        // Create new subscription in database
                        var subscription = new Models.Subscription
                        {
                            OrganizationId = organizationId.Value,
                            OwnerUserId = userId.Value,   // ties subscription to the landlord user
                            SubscriptionPlanId = plan.Id,
                            StripeSubscriptionId = stripeSubscription.Id,
                            StripeCustomerId = customerId,
                            Status = stripeSubscription.Status == "trialing" ? "Trial" : "Active",
                            BillingCycle = createDto.BillingCycle,
                            CurrentPeriodStart = stripeSubscription.CurrentPeriodStart,
                            CurrentPeriodEnd = stripeSubscription.CurrentPeriodEnd,
                            TrialStart = stripeSubscription.TrialStart,
                            TrialEnd = stripeSubscription.TrialEnd
                        };

                        updatedSubscription = await _subscriptionRepository.CreateSubscriptionAsync(subscription);

                        // Update organization with subscription ID and ensure StripeCustomerId is set
                        organization.SubscriptionId = updatedSubscription.Id;
                        
                        // Add history
                        await _historyRepository.AddHistoryAsync(new SubscriptionHistory
                        {
                            SubscriptionId = updatedSubscription.Id,
                            EventType = "Created",
                            NewPlanId = plan.Id
                        });

                        response.Message = "Subscription created successfully";
                    }

                    organization.StripeCustomerId = customerId;
                    await _organizationRepository.UpdateOrganizationAsync(organization);
                }

                var dto = _mapper.Map<SubscriptionDto>(updatedSubscription);
                dto.Plan = _mapper.Map<SubscriptionPlanDto>(plan);
                dto.IsOrphaned = false; // No longer orphaned after update

                response.Data = dto;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating subscription for user");
                response.Success = false;
                response.Message = $"Error creating subscription: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<SubscriptionDto>> UpgradeSubscriptionAsync(UpdateSubscriptionDto updateDto)
        {
            var response = new ServiceResponse<SubscriptionDto>();

            try
            {
                var userId = await GetCurrentUserIdAsync();
                if (!userId.HasValue)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    response.StatusCode = 401;
                    return response;
                }

                // Get subscription and verify permission
                var (subscription, hasPermission) = await GetSubscriptionWithPermissionCheckAsync(userId);
                if (subscription == null)
                {
                    response.Success = false;
                    response.Message = "No subscription found";
                    response.StatusCode = 404;
                    return response;
                }

                if (!hasPermission)
                {
                    response.Success = false;
                    response.Message = "You do not have permission to manage subscriptions. Only Owners and Managers can manage subscriptions.";
                    response.StatusCode = 403;
                    return response;
                }

                var newPlan = await _planRepository.GetPlanByIdAsync(updateDto.NewPlanId);
                if (newPlan == null)
                {
                    response.Success = false;
                    response.Message = "New plan not found";
                    response.StatusCode = 404;
                    return response;
                }

                // Prevent upgrading to the same plan
                if (subscription.SubscriptionPlanId == newPlan.Id)
                {
                    // Check if billing cycle is changing
                    var targetBillingCycle = !string.IsNullOrWhiteSpace(updateDto.BillingCycle)
                        ? updateDto.BillingCycle
                        : subscription.BillingCycle;

                    if (subscription.BillingCycle == targetBillingCycle)
                    {
                        response.Success = false;
                        response.Message = "You are already subscribed to this plan with the same billing cycle";
                        response.StatusCode = 400;
                        return response;
                    }
                }

                // Determine billing cycle: use provided value, or keep current
                var billingCycle = !string.IsNullOrWhiteSpace(updateDto.BillingCycle)
                    ? updateDto.BillingCycle
                    : subscription.BillingCycle;

                // Reactivation path: customer previously downgraded to Free but the Stripe
                // subscription is still alive (cancel_at_period_end = true, not yet expired).
                // Undo the cancellation instead of swapping the price — no charge to the customer.
                bool isReactivation = subscription.CancelAtPeriodEnd
                    && !string.IsNullOrWhiteSpace(subscription.StripeSubscriptionId);

                if (isReactivation)
                {
                    var stripeCheck = await _stripeService.GetSubscriptionAsync(subscription.StripeSubscriptionId!);
                    if (stripeCheck.Success && stripeCheck.Data != null && stripeCheck.Data.CancelAtPeriodEnd)
                    {
                        var reactivateResponse = await _stripeService.ResumeSubscriptionAsync(subscription.StripeSubscriptionId!);
                        if (!reactivateResponse.Success || reactivateResponse.Data == null)
                        {
                            response.Success = false;
                            response.Message = $"Failed to reactivate Stripe subscription: {reactivateResponse.Message}";
                            return response;
                        }

                        var reactivatedSub = reactivateResponse.Data;
                        var reactivatedOldPlanId = subscription.SubscriptionPlanId;
                        subscription.SubscriptionPlanId = newPlan.Id;
                        subscription.BillingCycle = billingCycle;
                        subscription.Status = reactivatedSub.Status == "trialing" ? "Trial" : "Active";
                        subscription.CancelAtPeriodEnd = false;
                        subscription.CurrentPeriodStart = reactivatedSub.CurrentPeriodStart;
                        subscription.CurrentPeriodEnd = reactivatedSub.CurrentPeriodEnd;

                        var reactivatedUpdated = await _subscriptionRepository.UpdateSubscriptionAsync(subscription);

                        await _historyRepository.AddHistoryAsync(new SubscriptionHistory
                        {
                            SubscriptionId = reactivatedUpdated.Id,
                            EventType = "Reactivated",
                            OldPlanId = reactivatedOldPlanId,
                            NewPlanId = newPlan.Id,
                            Metadata = JsonSerializer.Serialize(new { reason = "ReactivatedAfterDowngrade" })
                        });

                        var reactivatedDto = _mapper.Map<SubscriptionDto>(reactivatedUpdated);
                        reactivatedDto.Plan = _mapper.Map<SubscriptionPlanDto>(newPlan);
                        response.Data = reactivatedDto;
                        response.Message = "Subscription reactivated. No charge — your existing billing cycle continues.";
                        return response;
                    }
                    else
                    {
                        // Stripe subscription has already expired — clear stale IDs so the
                        // orphan check doesn't flag this, and tell the client to re-subscribe.
                        subscription.StripeSubscriptionId = null;
                        subscription.CancelAtPeriodEnd = false;
                        await _subscriptionRepository.UpdateSubscriptionAsync(subscription);

                        response.Success = false;
                        response.Message = "Your previous subscription has already expired. Please subscribe again to upgrade to Premium.";
                        response.StatusCode = 400;
                        return response;
                    }
                }

                // Get price ID based on target billing cycle
                var priceId = billingCycle == "Annual"
                    ? newPlan.StripePriceIdAnnual
                    : newPlan.StripePriceIdMonthly;

                if (string.IsNullOrWhiteSpace(priceId))
                {
                    response.Success = false;
                    response.Message = "Price ID not configured for new plan";
                    return response;
                }

                // Update in Stripe
                var stripeResponse = await _stripeService.UpdateSubscriptionAsync(
                    subscription.StripeSubscriptionId!,
                    priceId,
                    updateDto.Prorate
                );

                if (!stripeResponse.Success || stripeResponse.Data == null)
                {
                    response.Success = false;
                    response.Message = $"Failed to update Stripe subscription: {stripeResponse.Message}";
                    return response;
                }

                var stripeSubscription = stripeResponse.Data;

                // Update in database
                var oldPlanId = subscription.SubscriptionPlanId;
                var oldBillingCycle = subscription.BillingCycle;
                subscription.SubscriptionPlanId = newPlan.Id;
                subscription.BillingCycle = billingCycle; // Update billing cycle if changed
                subscription.Status = stripeSubscription.Status == "trialing" ? "Trial" : "Active";
                subscription.CurrentPeriodStart = stripeSubscription.CurrentPeriodStart;
                subscription.CurrentPeriodEnd = stripeSubscription.CurrentPeriodEnd;

                var updatedSubscription = await _subscriptionRepository.UpdateSubscriptionAsync(subscription);

                // Add history
                var historyMetadata = new Dictionary<string, object>
                {
                    { "oldPlanId", oldPlanId },
                    { "newPlanId", newPlan.Id },
                    { "oldBillingCycle", oldBillingCycle },
                    { "newBillingCycle", billingCycle }
                };
                
                await _historyRepository.AddHistoryAsync(new SubscriptionHistory
                {
                    SubscriptionId = updatedSubscription.Id,
                    EventType = "Upgraded",
                    OldPlanId = oldPlanId,
                    NewPlanId = newPlan.Id,
                    Metadata = System.Text.Json.JsonSerializer.Serialize(historyMetadata)
                });

                var dto = _mapper.Map<SubscriptionDto>(updatedSubscription);
                dto.Plan = _mapper.Map<SubscriptionPlanDto>(newPlan);

                response.Data = dto;
                response.Message = "Subscription upgraded successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error upgrading subscription for user");
                response.Success = false;
                response.Message = $"Error upgrading subscription: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<SubscriptionDto>> DowngradeSubscriptionAsync(UpdateSubscriptionDto updateDto)
        {
            var response = new ServiceResponse<SubscriptionDto>();

            try
            {
                var userId = await GetCurrentUserIdAsync();
                if (!userId.HasValue)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    response.StatusCode = 401;
                    return response;
                }

                var (subscription, hasPermission) = await GetSubscriptionWithPermissionCheckAsync(userId);
                if (subscription == null)
                {
                    response.Success = false;
                    response.Message = "No subscription found";
                    response.StatusCode = 404;
                    return response;
                }

                if (!hasPermission)
                {
                    response.Success = false;
                    response.Message = "You do not have permission to manage subscriptions. Only Owners and Managers can manage subscriptions.";
                    response.StatusCode = 403;
                    return response;
                }

                var newPlan = await _planRepository.GetPlanByIdAsync(updateDto.NewPlanId);
                if (newPlan == null)
                {
                    response.Success = false;
                    response.Message = "Plan not found";
                    response.StatusCode = 404;
                    return response;
                }

                if (subscription.SubscriptionPlanId == newPlan.Id)
                {
                    response.Success = false;
                    response.Message = "You are already on this plan";
                    response.StatusCode = 400;
                    return response;
                }

                bool isDowngradingToFree = IsFreePlan(newPlan);

                if (isDowngradingToFree)
                {
                    // Cancel Stripe subscription at period end so the customer keeps access
                    // through their paid period. We retain StripeSubscriptionId so they can
                    // reactivate without being charged again if they upgrade before the period ends.
                    if (!string.IsNullOrWhiteSpace(subscription.StripeSubscriptionId))
                    {
                        var cancelResponse = await _stripeService.CancelSubscriptionAsync(
                            subscription.StripeSubscriptionId, cancelAtPeriodEnd: true);

                        if (!cancelResponse.Success)
                        {
                            response.Success = false;
                            response.Message = $"Failed to cancel Stripe subscription: {cancelResponse.Message}";
                            return response;
                        }

                        // Capture the period-end date from Stripe for accurate display
                        if (cancelResponse.Data != null)
                            subscription.CurrentPeriodEnd = cancelResponse.Data.CurrentPeriodEnd;
                    }

                    var oldPlanId = subscription.SubscriptionPlanId;
                    subscription.SubscriptionPlanId = newPlan.Id;
                    subscription.Status = "Active";
                    subscription.CancelAtPeriodEnd = true;
                    // Intentionally keep StripeSubscriptionId and StripeCustomerId for reactivation

                    var updatedSubscription = await _subscriptionRepository.UpdateSubscriptionAsync(subscription);

                    await _historyRepository.AddHistoryAsync(new SubscriptionHistory
                    {
                        SubscriptionId = updatedSubscription.Id,
                        EventType = "Downgraded",
                        OldPlanId = oldPlanId,
                        NewPlanId = newPlan.Id,
                        Metadata = JsonSerializer.Serialize(new { reason = "DowngradedToFree", cancelAtPeriodEnd = true })
                    });

                    var dto = _mapper.Map<SubscriptionDto>(updatedSubscription);
                    dto.Plan = _mapper.Map<SubscriptionPlanDto>(newPlan);
                    response.Data = dto;
                    response.Message = "Subscription downgraded to Free. Your Stripe subscription will be cancelled at the end of the current billing period.";
                }
                else
                {
                    // Downgrading between paid tiers — use the same Stripe price-swap logic as upgrade
                    return await UpgradeSubscriptionAsync(updateDto);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error downgrading subscription for user");
                response.Success = false;
                response.Message = $"Error downgrading subscription: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<bool>> CancelSubscriptionAsync(bool cancelAtPeriodEnd = true)
        {
            var response = new ServiceResponse<bool>();

            try
            {
                var userId = await GetCurrentUserIdAsync();
                if (!userId.HasValue)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    response.StatusCode = 401;
                    return response;
                }

                // Get subscription and verify permission
                var (subscription, hasPermission) = await GetSubscriptionWithPermissionCheckAsync(userId);
                if (subscription == null)
                {
                    response.Success = false;
                    response.Message = "No subscription found";
                    response.StatusCode = 404;
                    return response;
                }

                if (!hasPermission)
                {
                    response.Success = false;
                    response.Message = "You do not have permission to manage subscriptions. Only Owners and Managers can manage subscriptions.";
                    response.StatusCode = 403;
                    return response;
                }

                if (string.IsNullOrWhiteSpace(subscription.StripeSubscriptionId))
                {
                    response.Success = false;
                    response.Message = "Stripe subscription ID not found";
                    return response;
                }

                // Cancel in Stripe
                var stripeResponse = await _stripeService.CancelSubscriptionAsync(
                    subscription.StripeSubscriptionId,
                    cancelAtPeriodEnd
                );

                if (!stripeResponse.Success)
                {
                    response.Success = false;
                    response.Message = $"Failed to cancel Stripe subscription: {stripeResponse.Message}";
                    return response;
                }

                // Update in database
                subscription.CancelAtPeriodEnd = cancelAtPeriodEnd;
                subscription.CancelledAt = cancelAtPeriodEnd ? null : DateTime.Now;
                subscription.Status = cancelAtPeriodEnd ? subscription.Status : "Cancelled";

                await _subscriptionRepository.UpdateSubscriptionAsync(subscription);

                // Add history
                await _historyRepository.AddHistoryAsync(new SubscriptionHistory
                {
                    SubscriptionId = subscription.Id,
                    EventType = cancelAtPeriodEnd ? "CancellationScheduled" : "Cancelled"
                });

                response.Data = true;
                response.Message = cancelAtPeriodEnd
                    ? "Subscription will be cancelled at end of period"
                    : "Subscription cancelled immediately";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cancelling subscription for user");
                response.Success = false;
                response.Message = $"Error cancelling subscription: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<SubscriptionDto>> ResumeSubscriptionAsync()
        {
            var response = new ServiceResponse<SubscriptionDto>();

            try
            {
                var userId = await GetCurrentUserIdAsync();
                if (!userId.HasValue)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    response.StatusCode = 401;
                    return response;
                }

                // Get subscription and verify permission
                var (subscription, hasPermission) = await GetSubscriptionWithPermissionCheckAsync(userId);
                if (subscription == null)
                {
                    response.Success = false;
                    response.Message = "No subscription found";
                    response.StatusCode = 404;
                    return response;
                }

                if (!hasPermission)
                {
                    response.Success = false;
                    response.Message = "You do not have permission to manage subscriptions. Only Owners and Managers can manage subscriptions.";
                    response.StatusCode = 403;
                    return response;
                }

                if (string.IsNullOrWhiteSpace(subscription.StripeSubscriptionId))
                {
                    response.Success = false;
                    response.Message = "Stripe subscription ID not found";
                    return response;
                }

                // Resume in Stripe
                var stripeResponse = await _stripeService.ResumeSubscriptionAsync(subscription.StripeSubscriptionId);

                if (!stripeResponse.Success || stripeResponse.Data == null)
                {
                    response.Success = false;
                    response.Message = $"Failed to resume Stripe subscription: {stripeResponse.Message}";
                    return response;
                }

                var stripeSubscription = stripeResponse.Data;

                // Update in database
                subscription.CancelAtPeriodEnd = false;
                subscription.CancelledAt = null;
                subscription.Status = stripeSubscription.Status == "trialing" ? "Trial" : "Active";

                var updatedSubscription = await _subscriptionRepository.UpdateSubscriptionAsync(subscription);

                // Add history
                await _historyRepository.AddHistoryAsync(new SubscriptionHistory
                {
                    SubscriptionId = updatedSubscription.Id,
                    EventType = "Resumed"
                });

                var dto = _mapper.Map<SubscriptionDto>(updatedSubscription);
                dto.Plan = _mapper.Map<SubscriptionPlanDto>(updatedSubscription.SubscriptionPlan);

                response.Data = dto;
                response.Message = "Subscription resumed successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resuming subscription for user");
                response.Success = false;
                response.Message = $"Error resuming subscription: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<bool>> PauseSubscriptionAsync(bool pauseAtPeriodEnd = true)
        {
            var response = new ServiceResponse<bool>();

            try
            {
                var userId = await GetCurrentUserIdAsync();
                if (!userId.HasValue)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    response.StatusCode = 401;
                    return response;
                }

                // Get subscription and verify permission
                var (subscription, hasPermission) = await GetSubscriptionWithPermissionCheckAsync(userId);
                if (subscription == null)
                {
                    response.Success = false;
                    response.Message = "No subscription found";
                    response.StatusCode = 404;
                    return response;
                }

                if (!hasPermission)
                {
                    response.Success = false;
                    response.Message = "You do not have permission to manage subscriptions. Only Owners and Managers can manage subscriptions.";
                    response.StatusCode = 403;
                    return response;
                }

                // Check if already paused
                if (subscription.PausedAtPeriodEnd || subscription.Status == "Paused")
                {
                    response.Success = false;
                    response.Message = "Subscription is already paused or scheduled to pause";
                    return response;
                }

                // Pause in Stripe when we have a Stripe subscription (paid plans)
                if (!string.IsNullOrEmpty(subscription.StripeSubscriptionId))
                {
                    var resumesAt = pauseAtPeriodEnd && subscription.CurrentPeriodEnd.HasValue
                        ? subscription.CurrentPeriodEnd.Value
                        : (DateTime?)null;
                    var stripeResponse = await _stripeService.PauseSubscriptionAsync(subscription.StripeSubscriptionId, resumesAt);
                    if (!stripeResponse.Success)
                    {
                        response.Success = false;
                        response.Message = $"Failed to pause in Stripe: {stripeResponse.Message}";
                        return response;
                    }
                }

                // Update in database
                subscription.PausedAtPeriodEnd = pauseAtPeriodEnd;
                subscription.PausedAt = pauseAtPeriodEnd ? null : DateTime.UtcNow;
                subscription.Status = "Paused";

                await _subscriptionRepository.UpdateSubscriptionAsync(subscription);

                // Add history
                await _historyRepository.AddHistoryAsync(new SubscriptionHistory
                {
                    SubscriptionId = subscription.Id,
                    EventType = pauseAtPeriodEnd ? "PauseScheduled" : "Paused"
                });

                response.Data = true;
                response.Message = pauseAtPeriodEnd
                    ? "Subscription will be paused at end of period"
                    : "Subscription paused immediately";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error pausing subscription for user");
                response.Success = false;
                response.Message = $"Error pausing subscription: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<SubscriptionDto>> ResumePausedSubscriptionAsync()
        {
            var response = new ServiceResponse<SubscriptionDto>();

            try
            {
                var userId = await GetCurrentUserIdAsync();
                if (!userId.HasValue)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    response.StatusCode = 401;
                    return response;
                }

                // Get subscription and verify permission
                var (subscription, hasPermission) = await GetSubscriptionWithPermissionCheckAsync(userId);
                if (subscription == null)
                {
                    response.Success = false;
                    response.Message = "No subscription found";
                    response.StatusCode = 404;
                    return response;
                }

                if (!hasPermission)
                {
                    response.Success = false;
                    response.Message = "You do not have permission to manage subscriptions. Only Owners and Managers can manage subscriptions.";
                    response.StatusCode = 403;
                    return response;
                }

                // Check if subscription is actually paused
                if (!subscription.PausedAtPeriodEnd && subscription.Status != "Paused")
                {
                    response.Success = false;
                    response.Message = "Subscription is not paused";
                    return response;
                }

                // Unpause in Stripe when we have a Stripe subscription (paid plans)
                if (!string.IsNullOrEmpty(subscription.StripeSubscriptionId))
                {
                    var stripeResponse = await _stripeService.UnpauseSubscriptionAsync(subscription.StripeSubscriptionId);
                    if (!stripeResponse.Success)
                    {
                        response.Success = false;
                        response.Message = $"Failed to unpause in Stripe: {stripeResponse.Message}";
                        return response;
                    }
                }

                // Update in database
                subscription.PausedAtPeriodEnd = false;
                subscription.PausedAt = null;

                // Restore to Trial status if still within trial period, otherwise Active
                if (subscription.TrialEnd.HasValue && subscription.TrialEnd.Value > DateTime.UtcNow)
                {
                    subscription.Status = "Trial";
                }
                else
                {
                    subscription.Status = "Active";
                }

                var updatedSubscription = await _subscriptionRepository.UpdateSubscriptionAsync(subscription);

                // Add history
                await _historyRepository.AddHistoryAsync(new SubscriptionHistory
                {
                    SubscriptionId = updatedSubscription.Id,
                    EventType = "PauseResumed"
                });

                var dto = _mapper.Map<SubscriptionDto>(updatedSubscription);
                dto.Plan = _mapper.Map<SubscriptionPlanDto>(subscription.SubscriptionPlan);

                response.Data = dto;
                response.Message = "Subscription resumed successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resuming paused subscription for user");
                response.Success = false;
                response.Message = $"Error resuming paused subscription: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<bool>> CheckTrialEligibilityAsync()
        {
            var response = new ServiceResponse<bool>();

            try
            {
                var userId = await GetCurrentUserIdAsync();
                if (!userId.HasValue)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    response.StatusCode = 401;
                    return response;
                }

                // Trial eligibility is per landlord-user, not per organization.
                // Check the user's subscription regardless of which org is currently active.
                var subscription = await _subscriptionRepository.GetSubscriptionByOwnerUserIdAsync(userId.Value);

                if (subscription == null)
                {
                    response.Data = true;
                    response.Message = "User is eligible for trial";
                    return response;
                }

                // User is ineligible if they have already started or completed a trial
                var history = await _historyRepository.GetHistoryBySubscriptionIdAsync(subscription.Id);
                var hasHadTrial = subscription.Status == "Trial" ||
                                  history.Any(h => h.EventType == "TrialStarted");

                response.Data = !hasHadTrial;
                response.Message = hasHadTrial
                    ? "User has already used their free trial"
                    : "User is eligible for trial";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking trial eligibility");
                response.Success = false;
                response.Message = $"Error checking trial eligibility: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<SubscriptionDto>> StartTrialAsync()
        {
            var response = new ServiceResponse<SubscriptionDto>();

            try
            {
                var userId = await GetCurrentUserIdAsync();
                if (!userId.HasValue)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    response.StatusCode = 401;
                    return response;
                }

                // Check eligibility
                var eligibilityResponse = await CheckTrialEligibilityAsync();
                if (!eligibilityResponse.Success || !eligibilityResponse.Data)
                {
                    response.Success = false;
                    response.Message = "User is not eligible for trial";
                    return response;
                }

                // Get organization
                var organizationId = GetCurrentOrganizationId();
                if (!organizationId.HasValue)
                {
                    response.Success = false;
                    response.Message = "No active organization. Subscriptions are tied to organizations.";
                    response.StatusCode = 400;
                    return response;
                }

                // Check if organization already has a subscription
                var existingSubscription = await _subscriptionRepository.GetSubscriptionByOrganizationIdAsync(organizationId.Value);
                if (existingSubscription != null && (existingSubscription.Status == "Active" || existingSubscription.Status == "Trial"))
                {
                    response.Success = false;
                    response.Message = "Organization already has an active subscription or trial";
                    return response;
                }

                // Get Free Trial plan
                var plans = await _planRepository.GetAllPlansAsync();
                var trialPlan = plans.FirstOrDefault(p => p.IsTrial);

                if (trialPlan == null)
                {
                    response.Success = false;
                    response.Message = "Trial plan not found";
                    return response;
                }

                // Create subscription in database ONLY (no Stripe)
                var subscription = new Models.Subscription
                {
                    OrganizationId = organizationId.Value,
                    OwnerUserId = userId.Value,  // ties trial to the landlord user — one trial per user
                    SubscriptionPlanId = trialPlan.Id,
                    StripeSubscriptionId = null,
                    StripeCustomerId = null,
                    Status = "Trial",
                    BillingCycle = "Monthly",
                    TrialStart = DateTime.UtcNow,
                    TrialEnd = DateTime.UtcNow.AddDays(30),
                    CurrentPeriodStart = DateTime.UtcNow,
                    CurrentPeriodEnd = DateTime.UtcNow.AddDays(30)
                };

                var createdSubscription = await _subscriptionRepository.CreateSubscriptionAsync(subscription);

                // Update organization with subscription ID
                var organization = await _organizationRepository.GetOrganizationByIdAsync(organizationId.Value);
                if (organization != null)
                {
                    organization.SubscriptionId = createdSubscription.Id;
                    await _organizationRepository.UpdateOrganizationAsync(organization);
                }

                // Add history
                await _historyRepository.AddHistoryAsync(new SubscriptionHistory
                {
                    SubscriptionId = createdSubscription.Id,
                    EventType = "TrialStarted",
                    NewPlanId = trialPlan.Id
                });

                var dto = _mapper.Map<SubscriptionDto>(createdSubscription);
                dto.Plan = _mapper.Map<SubscriptionPlanDto>(trialPlan);
                dto.IsOrphaned = false; // Not orphaned - this is intentional (database-only trial)

                response.Data = dto;
                response.Message = "Trial started successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error starting trial");
                response.Success = false;
                response.Message = $"Error starting trial: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<bool>> ValidatePropertyLimitAsync()
        {
            // DEPRECATED: Property limits are removed. This method now checks subscription status only.
            // Use unit limit checks instead (via CanAddUnitToPropertyAsync or GetRemainingUnitSlotsAsync).
            var response = new ServiceResponse<bool>();

            try
            {
                var userId = await GetCurrentUserIdAsync();
                if (!userId.HasValue)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    response.StatusCode = 401;
                    return response;
                }

                // Property limits removed - just check if subscription allows adding properties
                var canAdd = await _featureGateService.CanAddPropertyAsync(userId.Value);
                response.Data = canAdd;
                response.Message = canAdd
                    ? "User can add properties (limits are based on units)"
                    : "Subscription not active";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating subscription status for user");
                response.Success = false;
                response.Message = $"Error validating subscription status: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<SubscriptionStatusDto>> GetSubscriptionStatusAsync()
        {
            var response = new ServiceResponse<SubscriptionStatusDto>();

            try
            {
                var userId = await GetCurrentUserIdAsync();
                if (!userId.HasValue)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    response.StatusCode = 401;
                    return response;
                }

                var isTenantOnly = await IsCurrentUserTenantOnlyAsync();
                Models.Subscription? subscription;

                if (isTenantOnly)
                {
                    subscription = await _subscriptionRepository.GetSubscriptionByUserIdAsync(userId.Value);
                    var tenantIsPaused = subscription != null &&
                        (subscription.Status == "Paused" ||
                         (subscription.PausedAtPeriodEnd && subscription.CurrentPeriodEnd.HasValue && subscription.CurrentPeriodEnd.Value <= DateTime.UtcNow));
                    var                     tenantStatusDto = new SubscriptionStatusDto
                    {
                        HasActiveSubscription = subscription != null &&
                            (subscription.Status == "Active" || subscription.Status == "Trial") &&
                            !tenantIsPaused,
                        CurrentPropertyCount = 0,
                        CanAddProperty = false,
                        RemainingPropertySlots = null,
                        MaxProperties = null,
                        MaxTotalUnits = null,
                        CurrentTotalUnits = 0,
                        RemainingUnitSlots = null
                    };
                    if (subscription != null)
                    {
                        tenantStatusDto.Subscription = _mapper.Map<SubscriptionDto>(subscription);
                        tenantStatusDto.Subscription.Plan = _mapper.Map<SubscriptionPlanDto>(subscription.SubscriptionPlan);
                        tenantStatusDto.IsTrialActive = subscription.Status == "Trial";
                        if (subscription.TrialEnd.HasValue)
                        {
                            var daysRemaining = (subscription.TrialEnd.Value - DateTime.Now).Days;
                            tenantStatusDto.TrialDaysRemaining = daysRemaining > 0 ? daysRemaining : 0;
                        }
                    }
                    response.Data = tenantStatusDto;
                    response.Message = "Subscription status retrieved successfully";
                    return response;
                }

                // Landlord/Admin: organization-based
                var organizationId = GetCurrentOrganizationId();
                if (!organizationId.HasValue)
                {
                    response.Success = false;
                    response.Message = "No active organization. Subscriptions are tied to organizations.";
                    response.StatusCode = 400;
                    return response;
                }

                subscription = await _subscriptionRepository.GetSubscriptionByOrganizationIdAsync(organizationId.Value);

                var currentPropertyCount = await _featureGateService.GetCurrentPropertyCountAsync(userId.Value);
                var canAddProperty = await _featureGateService.CanAddPropertyAsync(userId.Value);

                // Check if subscription is paused and period has ended
                var isPaused = subscription != null && 
                    (subscription.Status == "Paused" || 
                     (subscription.PausedAtPeriodEnd && subscription.CurrentPeriodEnd.HasValue && subscription.CurrentPeriodEnd.Value <= DateTime.UtcNow));

                var statusDto = new SubscriptionStatusDto
                {
                    HasActiveSubscription = subscription != null && 
                        (subscription.Status == "Active" || subscription.Status == "Trial") && 
                        !isPaused,
                    CurrentPropertyCount = currentPropertyCount,
                    CanAddProperty = canAddProperty && !isPaused,
                    RemainingPropertySlots = null // Property limits removed - no longer applicable
                };

                if (subscription != null)
                {
                    statusDto.Subscription = _mapper.Map<SubscriptionDto>(subscription);
                    statusDto.Subscription.Plan = _mapper.Map<SubscriptionPlanDto>(subscription.SubscriptionPlan);
                    statusDto.MaxProperties = null; // Property limits removed
                    statusDto.MaxTotalUnits = subscription.SubscriptionPlan.MaxTotalUnits;
                    statusDto.IsTrialActive = subscription.Status == "Trial";

                    // Get current total units
                    var currentTotalUnits = await _featureGateService.GetCurrentTotalUnitsAsync(userId.Value);
                    statusDto.CurrentTotalUnits = currentTotalUnits;

                    // Get remaining unit slots
                    var remainingUnitSlots = await _featureGateService.GetRemainingUnitSlotsAsync(userId.Value);
                    statusDto.RemainingUnitSlots = remainingUnitSlots;

                    if (subscription.TrialEnd.HasValue)
                    {
                        var daysRemaining = (subscription.TrialEnd.Value - DateTime.Now).Days;
                        statusDto.TrialDaysRemaining = daysRemaining > 0 ? daysRemaining : 0;
                    }

                    // Check if upgrade is needed - only based on unit limits now
                    if (remainingUnitSlots.HasValue && remainingUnitSlots.Value == 0 && subscription.SubscriptionPlan.MaxTotalUnits.HasValue)
                    {
                        statusDto.RequiresUpgrade = true;
                        statusDto.UpgradeMessage = $"You've reached your unit limit ({currentTotalUnits}/{subscription.SubscriptionPlan.MaxTotalUnits.Value} units). Upgrade to add more units.";
                    }
                }
                else
                {
                    // No subscription - trial limits based on units, not properties
                    statusDto.MaxProperties = null; // Property limits removed
                    statusDto.MaxTotalUnits = 1; // Trial allows 1 unit
                    var currentTotalUnits = await _featureGateService.GetCurrentTotalUnitsAsync(userId.Value);
                    statusDto.CurrentTotalUnits = currentTotalUnits;
                    statusDto.RemainingUnitSlots = currentTotalUnits == 0 ? 1 : 0;
                }

                response.Data = statusDto;
                response.Message = "Subscription status retrieved successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting subscription status for user");
                response.Success = false;
                response.Message = $"Error retrieving subscription status: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<List<InvoiceDto>>> GetPaymentHistoryAsync()
        {
            var response = new ServiceResponse<List<InvoiceDto>>();

            try
            {
                var userId = await GetCurrentUserIdAsync();
                if (!userId.HasValue)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    response.StatusCode = 401;
                    return response;
                }

                // Get subscription and verify permission (viewing payment history requires Owner/Manager)
                var (subscription, hasPermission) = await GetSubscriptionWithPermissionCheckAsync(userId);
                if (subscription == null || string.IsNullOrEmpty(subscription.StripeCustomerId))
                {
                    response.Success = false;
                    response.Message = "No subscription found";
                    response.Data = new List<InvoiceDto>();
                    return response;
                }

                if (!hasPermission)
                {
                    response.Success = false;
                    response.Message = "You do not have permission to view payment history. Only Owners and Managers can view payment history.";
                    response.StatusCode = 403;
                    response.Data = new List<InvoiceDto>();
                    return response;
                }

                var options = new InvoiceListOptions
                {
                    Customer = subscription.StripeCustomerId,
                    Limit = 100
                };

                var service = new InvoiceService();
                var invoices = await service.ListAsync(options);

                var invoiceDtos = invoices.Data.Select(invoice => new InvoiceDto
                {
                    Id = invoice.Id,
                    InvoiceNumber = invoice.Number ?? string.Empty,
                    Amount = invoice.AmountPaid,
                    Currency = invoice.Currency ?? "usd",
                    Created = invoice.Created,
                    PaidAt = invoice.StatusTransitions?.PaidAt,
                    Status = invoice.Status ?? "unknown",
                    InvoicePdf = invoice.InvoicePdf,
                    HostedInvoiceUrl = invoice.HostedInvoiceUrl,
                    Description = invoice.Description ?? invoice.Lines?.Data?.FirstOrDefault()?.Description ?? "Subscription payment",
                    SubscriptionId = invoice.SubscriptionId
                }).ToList();

                response.Data = invoiceDtos;
                response.Success = true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting payment history for user");
                response.Success = false;
                response.Message = ex.Message;
                response.Data = new List<InvoiceDto>();
            }

            return response;
        }

        public async Task<ServiceResponse<string>> CreateCustomerPortalSessionAsync(string returnUrl)
        {
            var response = new ServiceResponse<string>();

            try
            {
                var userId = await GetCurrentUserIdAsync();
                if (!userId.HasValue)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    response.StatusCode = 401;
                    return response;
                }

                // Get subscription and verify permission
                var (subscription, hasPermission) = await GetSubscriptionWithPermissionCheckAsync(userId);
                if (subscription == null || string.IsNullOrEmpty(subscription.StripeCustomerId))
                {
                    response.Success = false;
                    response.Message = "No subscription found";
                    return response;
                }

                if (!hasPermission)
                {
                    response.Success = false;
                    response.Message = "You do not have permission to manage subscriptions. Only Owners and Managers can manage subscriptions.";
                    response.StatusCode = 403;
                    return response;
                }

                var options = new Stripe.BillingPortal.SessionCreateOptions
                {
                    Customer = subscription.StripeCustomerId,
                    ReturnUrl = returnUrl
                };

                var service = new Stripe.BillingPortal.SessionService();
                var session = await service.CreateAsync(options);

                response.Data = session.Url;
                response.Success = true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating customer portal session for user");
                response.Success = false;
                response.Message = ex.Message;
            }

            return response;
        }

        public async Task<ServiceResponse<string>> CreateCheckoutSessionAsync(CreateCheckoutSessionDto createDto)
        {
            var response = new ServiceResponse<string>();

            try
            {
                var userId = await GetCurrentUserIdAsync();
                if (!userId.HasValue)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    response.StatusCode = 401;
                    return response;
                }

                // Tenants manage their own subscription by UserId — skip org permission check
                var isTenantOnlySession = await IsCurrentUserTenantOnlyAsync();
                var organizationId = GetCurrentOrganizationId();
                if (!isTenantOnlySession && organizationId.HasValue)
                {
                    var canManage = await CanManageSubscriptionAsync(userId, organizationId);
                    if (!canManage)
                    {
                        response.Success = false;
                        response.Message = "You do not have permission to manage subscriptions. Only Owners and Managers can manage subscriptions.";
                        response.StatusCode = 403;
                        return response;
                    }
                }

                // Check if organization already has an active subscription
                Models.Subscription? existingSubscription = null;
                if (!isTenantOnlySession && organizationId.HasValue)
                {
                    existingSubscription = await _subscriptionRepository.GetSubscriptionByOrganizationIdAsync(organizationId.Value);
                }

                // Check if subscription exists but is orphaned (missing Stripe IDs)
                // Free plans don't have Stripe IDs, so they're not orphaned
                bool isOrphaned = existingSubscription != null && 
                                 (existingSubscription.Status == "Active" || existingSubscription.Status == "Trial") &&
                                 existingSubscription.SubscriptionPlan != null &&
                                 !IsFreePlan(existingSubscription.SubscriptionPlan) &&
                                 (string.IsNullOrEmpty(existingSubscription.StripeSubscriptionId) || string.IsNullOrEmpty(existingSubscription.StripeCustomerId));

                // Check if orphaned subscription plan matches the requested plan
                bool isOrphanedWithMatchingPlan = isOrphaned && existingSubscription != null && existingSubscription.SubscriptionPlanId == createDto.PlanId;

                // Block checkout only when they have an active/trial *paid* subscription (Free plan never required a card, so allow checkout to add one)
                if (existingSubscription != null && 
                    (existingSubscription.Status == "Active" || existingSubscription.Status == "Trial") && 
                    !isOrphaned &&
                    existingSubscription.SubscriptionPlan != null &&
                    !IsFreePlan(existingSubscription.SubscriptionPlan))
                {
                    // Organization has an active paid subscription - they should use upgrade/downgrade instead
                    response.Success = false;
                    response.Message = "Your organization already has an active subscription. Please use the upgrade/downgrade feature to change your plan.";
                    response.StatusCode = 400;
                    return response;
                }

                // Allow checkout session creation for orphaned subscriptions with matching plan (they need to fix it)
                // The webhook handler will update the existing orphaned subscription

                // Get plan
                var plan = await _planRepository.GetPlanByIdAsync(createDto.PlanId);
                if (plan == null)
                {
                    response.Success = false;
                    response.Message = "Plan not found";
                    return response;
                }

                // Check if this is a free plan - if so, create subscription directly without Stripe checkout
                bool isFreePlan = IsFreePlan(plan);
                
                if (isFreePlan)
                {
                    // Free plan: Create subscription directly, no Stripe checkout needed
                    _logger.LogInformation("Free plan selected - creating subscription directly without Stripe checkout");
                    
                    // Convert CreateCheckoutSessionDto to CreateSubscriptionDto
                    var subscribeDto = new CreateSubscriptionDto
                    {
                        PlanId = createDto.PlanId,
                        BillingCycle = createDto.BillingCycle,
                        PaymentMethodId = null // Free plan doesn't need payment method
                    };
                    
                    // Use the SubscribeAsync method to create the free plan subscription
                    var subscribeResponse = await SubscribeAsync(subscribeDto);
                    
                    if (!subscribeResponse.Success)
                    {
                        response.Success = false;
                        response.Message = subscribeResponse.Message;
                        return response;
                    }
                    
                    // For free plans, return the success URL directly (no checkout session needed)
                    var freePlanSuccessUrl = createDto.SuccessUrl ?? "/landlord/subscription?success=true";
                    response.Data = freePlanSuccessUrl;
                    response.Message = "Free plan subscription created successfully";
                    return response;
                }

                // Paid plan: Requires Stripe checkout
                if (isTenantOnlySession)
                {
                    // Tenant: create/update subscription by UserId, create Stripe customer with metadata userId, then checkout
                    var userForCheckout = await _userRepository.GetUser((long)userId);
                    if (userForCheckout == null)
                    {
                        response.Success = false;
                        response.Message = "User not found";
                        return response;
                    }
                    var tenantSubscription = await _subscriptionRepository.GetSubscriptionByUserIdAsync(userId.Value);
                    if (tenantSubscription == null)
                    {
                        tenantSubscription = new Models.Subscription
                        {
                            UserId = userId,
                            OrganizationId = null,
                            SubscriptionPlanId = plan.Id,
                            Status = "PaymentPending",
                            BillingCycle = createDto.BillingCycle ?? "Monthly",
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };
                        tenantSubscription = await _subscriptionRepository.CreateSubscriptionAsync(tenantSubscription);
                    }
                    var customerResponse = await _stripeService.CreateCustomerAsync(
                        userForCheckout.Email,
                        $"{userForCheckout.FirstName} {userForCheckout.LastName}".Trim(),
                        new Dictionary<string, string> { { "userId", userId.Value.ToString() } });
                    if (!customerResponse.Success || customerResponse.Data == null)
                    {
                        response.Success = false;
                        response.Message = customerResponse.Message ?? "Failed to create Stripe customer";
                        return response;
                    }
                    var tenantCustomerId = customerResponse.Data.Id;
                    tenantSubscription.StripeCustomerId = tenantCustomerId;
                    await _subscriptionRepository.UpdateSubscriptionAsync(tenantSubscription);
                    var tenantPriceId = (createDto.BillingCycle == "Annual" ? plan.StripePriceIdAnnual : plan.StripePriceIdMonthly);
                    if (string.IsNullOrWhiteSpace(tenantPriceId))
                    {
                        response.Success = false;
                        response.Message = $"Price ID not configured for {(createDto.BillingCycle ?? "Monthly")} billing";
                        return response;
                    }
                    var tenantCheckoutResponse = await _stripeService.CreateCheckoutSessionAsync(
                        tenantCustomerId,
                        tenantPriceId,
                        createDto.SuccessUrl ?? "/tenant/subscription?success=true",
                        createDto.CancelUrl ?? "/tenant/subscription?canceled=true",
                        trialDays: null);
                    if (!tenantCheckoutResponse.Success)
                    {
                        response.Success = false;
                        response.Message = tenantCheckoutResponse.Message ?? "Failed to create checkout session";
                        return response;
                    }
                    response.Data = tenantCheckoutResponse.Data;
                    response.Success = true;
                    return response;
                }

                if (!organizationId.HasValue)
                {
                    response.Success = false;
                    response.Message = "Organization context is required to create a checkout session";
                    response.StatusCode = 403;
                    return response;
                }

                // Get organization
                var organization = await _organizationRepository.GetOrganizationByIdAsync(organizationId.Value);
                if (organization == null)
                {
                    response.Success = false;
                    response.Message = "Organization not found";
                    response.StatusCode = 404;
                    return response;
                }

                // Get user for email if needed
                var user = await _userRepository.GetUser((long)userId);
                if (user == null)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    return response;
                }

                // Get or create Stripe customer for Organization
                string customerId;
                if (string.IsNullOrWhiteSpace(organization.StripeCustomerId))
                {
                    // No customer ID stored, create a new one for the organization
                    var customerResponse = await _stripeService.CreateCustomerAsync(
                        user.Email, // Use owner/manager email for billing
                        organization.Name,
                        new Dictionary<string, string>
                        {
                            { "organizationId", organizationId.Value.ToString() },
                            { "organizationName", organization.Name }
                        }
                    );

                    if (!customerResponse.Success || customerResponse.Data == null)
                    {
                        response.Success = false;
                        response.Message = $"Failed to create Stripe customer: {customerResponse.Message}";
                        return response;
                    }

                    customerId = customerResponse.Data.Id;
                    // Update organization with customer ID
                    organization.StripeCustomerId = customerId;
                    // Link any existing subscription with this customer ID
                    await LinkSubscriptionToOrganizationAsync(customerId, organizationId.Value, organization);
                    await _organizationRepository.UpdateOrganizationAsync(organization);
                }
                else
                {
                    // Customer ID exists in database, verify it exists in Stripe
                    customerId = organization.StripeCustomerId;
                    var customerCheckResponse = await _stripeService.GetCustomerAsync(customerId);
                    
                    if (!customerCheckResponse.Success)
                    {
                        // Customer doesn't exist in Stripe (maybe created with different API key or deleted)
                        // Recreate the customer
                        _logger.LogWarning("Customer {CustomerId} not found in Stripe, recreating for organization {OrganizationId}",
                            customerId, organizationId.Value);
                        
                        var customerResponse = await _stripeService.CreateCustomerAsync(
                            user.Email,
                            organization.Name,
                            new Dictionary<string, string>
                            {
                                { "organizationId", organizationId.Value.ToString() },
                                { "organizationName", organization.Name }
                            }
                        );

                        if (!customerResponse.Success || customerResponse.Data == null)
                        {
                            response.Success = false;
                            response.Message = $"Failed to recreate Stripe customer: {customerResponse.Message}";
                            return response;
                        }

                        customerId = customerResponse.Data.Id;
                        organization.StripeCustomerId = customerId;
                        // Link any existing subscription with this customer ID
                        await LinkSubscriptionToOrganizationAsync(customerId, organizationId.Value, organization);
                        await _organizationRepository.UpdateOrganizationAsync(organization);
                    }
                }

                // Get price ID based on billing cycle
                var priceId = createDto.BillingCycle == "Annual"
                    ? plan.StripePriceIdAnnual
                    : plan.StripePriceIdMonthly;

                if (string.IsNullOrWhiteSpace(priceId))
                {
                    response.Success = false;
                    response.Message = $"Price ID not configured for {createDto.BillingCycle} billing";
                    return response;
                }

                // Use URLs from DTO (should be provided by controller)
                var successUrl = createDto.SuccessUrl ?? "/landlord/subscription?success=true";
                var cancelUrl = createDto.CancelUrl ?? "/landlord/subscription?canceled=true";

                // Determine trial days for checkout session
                int? trialDays = null;
                
                // Check if plan has trial days configured
                if (plan.TrialDays.HasValue && plan.TrialDays.Value > 0)
                {
                    // For new subscriptions (no existing subscription), always apply trial
                    if (existingSubscription == null)
                    {
                        // No existing subscription - eligible for trial
                        trialDays = plan.TrialDays.Value;
                    }
                    else if (isOrphaned)
                    {
                        // Orphaned subscription - check eligibility (they may have already used trial)
                        var eligibilityResponse = await CheckTrialEligibilityAsync();
                        if (eligibilityResponse.Success && eligibilityResponse.Data)
                        {
                            trialDays = plan.TrialDays.Value;
                        }
                    }
                    else
                    {
                        // Existing subscription (cancelled/inactive) - check eligibility
                        var eligibilityResponse = await CheckTrialEligibilityAsync();
                        if (eligibilityResponse.Success && eligibilityResponse.Data)
                        {
                            trialDays = plan.TrialDays.Value;
                        }
                    }
                }
                else if (plan.IsTrial)
                {
                    // Legacy: Free Trial plan always gets 7 days
                    trialDays = 7;
                }

                // Create checkout session
                var checkoutResponse = await _stripeService.CreateCheckoutSessionAsync(
                    customerId,
                    priceId,
                    successUrl,
                    cancelUrl,
                    trialDays
                );

                if (!checkoutResponse.Success || string.IsNullOrWhiteSpace(checkoutResponse.Data))
                {
                    response.Success = false;
                    response.Message = $"Failed to create checkout session: {checkoutResponse.Message}";
                    return response;
                }

                response.Data = checkoutResponse.Data;
                response.Message = "Checkout session created successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating checkout session for user");
                response.Success = false;
                response.Message = $"Error creating checkout session: {ex.Message}";
            }

            return response;
        }

        /// <summary>
        /// Ensures a tenant user has a Free plan subscription. Idempotent - no-op if they already have one.
        /// </summary>
        public async Task EnsureTenantFreeSubscriptionAsync(long userId)
        {
            var existing = await _subscriptionRepository.GetSubscriptionByUserIdAsync(userId);
            if (existing != null)
                return;

            var freePlan = await _planRepository.GetPlanByNameAsync("Free");
            if (freePlan == null)
            {
                _logger.LogWarning("Free plan not found - cannot assign tenant subscription for user {UserId}. Run AddFreePlan.sql.", userId);
                return;
            }

            var subscription = new Models.Subscription
            {
                UserId = userId,
                OrganizationId = null,
                SubscriptionPlanId = freePlan.Id,
                Status = "Active",
                BillingCycle = "Monthly",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            await _subscriptionRepository.CreateSubscriptionAsync(subscription);
            _logger.LogInformation("Created Free plan subscription for tenant user {UserId}, SubscriptionId {SubscriptionId}", userId, subscription.Id);
        }

        // Admin method: Get subscription for a specific user (gets subscription for user's organization or user for tenants)
        public async Task<ServiceResponse<SubscriptionDto>> GetUserSubscriptionAsync(long userId)
        {
            var response = new ServiceResponse<SubscriptionDto>();

            try
            {
                // Try tenant subscription first (userId-based)
                var subscriptionByUser = await _subscriptionRepository.GetSubscriptionByUserIdAsync(userId);
                if (subscriptionByUser != null)
                {
                    var userSubDto = _mapper.Map<SubscriptionDto>(subscriptionByUser);
                    userSubDto.Plan = _mapper.Map<SubscriptionPlanDto>(subscriptionByUser.SubscriptionPlan);
                    userSubDto.IsOrphaned = subscriptionByUser.SubscriptionPlan != null && !IsFreePlan(subscriptionByUser.SubscriptionPlan) &&
                                     (string.IsNullOrEmpty(subscriptionByUser.StripeSubscriptionId) || string.IsNullOrEmpty(subscriptionByUser.StripeCustomerId));
                    response.Data = userSubDto;
                    response.Message = "Subscription retrieved successfully";
                    return response;
                }

                // Fallback: get user's current organization (landlord path)
                var user = await _userRepository.GetUser(userId);
                if (user == null || !user.CurrentOrganizationId.HasValue)
                {
                    response.Success = false;
                    response.Message = "User not found or has no active organization";
                    return response;
                }

                var subscription = await _subscriptionRepository.GetSubscriptionByOrganizationIdAsync(user.CurrentOrganizationId.Value);
                if (subscription == null)
                {
                    response.Message = "No subscription found for user's organization";
                    return response;
                }

                var orgSubDto = _mapper.Map<SubscriptionDto>(subscription);
                orgSubDto.Plan = _mapper.Map<SubscriptionPlanDto>(subscription.SubscriptionPlan);
                orgSubDto.IsOrphaned = !IsFreePlan(subscription.SubscriptionPlan) &&
                                 (string.IsNullOrEmpty(subscription.StripeSubscriptionId) || string.IsNullOrEmpty(subscription.StripeCustomerId));

                response.Data = orgSubDto;
                response.Message = "Subscription retrieved successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting subscription for user {UserId}", userId);
                response.Success = false;
                response.Message = $"Error retrieving subscription: {ex.Message}";
            }

            return response;
        }

        // Admin method: Subscribe a specific user's organization
        public async Task<ServiceResponse<SubscriptionDto>> SubscribeAsync(long userId, CreateSubscriptionDto createDto)
        {
            var response = new ServiceResponse<SubscriptionDto>();

            try
            {
                // Get user's current organization (subscriptions are organization-only)
                var user = await _userRepository.GetUser(userId);
                if (user == null || !user.CurrentOrganizationId.HasValue)
                {
                    response.Success = false;
                    response.Message = "User not found or has no active organization. Subscriptions are tied to organizations.";
                    return response;
                }

                var organizationId = user.CurrentOrganizationId.Value;

                // Check if organization already has an active subscription
                var existingSubscription = await _subscriptionRepository.GetSubscriptionByOrganizationIdAsync(organizationId);
                if (existingSubscription != null && (existingSubscription.Status == "Active" || existingSubscription.Status == "Trial"))
                {
                    response.Success = false;
                    response.Message = "Organization already has an active subscription";
                    return response;
                }

                // Get plan
                var plan = await _planRepository.GetPlanByIdAsync(createDto.PlanId);
                if (plan == null)
                {
                    response.Message = "Plan not found";
                    return response;
                }

                // Get organization
                var organization = await _organizationRepository.GetOrganizationByIdAsync(organizationId);
                if (organization == null)
                {
                    response.Success = false;
                    response.Message = "Organization not found";
                    return response;
                }

                // Check if this is a free plan - if so, skip Stripe entirely
                bool isFreePlan = IsFreePlan(plan);
                Models.Subscription createdSubscription;

                if (isFreePlan)
                {
                    // Free plan: Create subscription in database only, no Stripe required
                    _logger.LogInformation("Creating Free plan subscription for organization {OrganizationId} (admin) - skipping Stripe integration", organizationId);
                    
                    var newSubscription = new Models.Subscription
                    {
                        OrganizationId = organizationId,
                        SubscriptionPlanId = plan.Id,
                        StripeSubscriptionId = null, // No Stripe for free plan
                        StripeCustomerId = null,    // No Stripe for free plan
                        Status = "Active",
                        BillingCycle = createDto.BillingCycle,
                        CurrentPeriodStart = DateTime.UtcNow,
                        CurrentPeriodEnd = null, // Free plan has no end date
                        TrialStart = null,
                        TrialEnd = null,
                        CreatedAt = DateTime.Now,
                        UpdatedAt = DateTime.Now
                    };

                    createdSubscription = await _subscriptionRepository.CreateSubscriptionAsync(newSubscription);
                    
                    // Add history
                    await _historyRepository.AddHistoryAsync(new Models.SubscriptionHistory
                    {
                        SubscriptionId = createdSubscription.Id,
                        EventType = "Created",
                        Metadata = $"{{\"planType\": \"Free\", \"billingCycle\": \"{createDto.BillingCycle}\", \"createdBy\": \"admin\"}}"
                    });
                }
                else
                {
                    // Paid plan: Requires Stripe integration
                    // Get or create Stripe customer for organization
                    string customerId;
                    if (string.IsNullOrWhiteSpace(organization.StripeCustomerId))
                    {
                        var customerResponse = await _stripeService.CreateCustomerAsync(
                            user.Email, // Use user email for billing contact
                            $"{user.FirstName} {user.LastName}",
                            new Dictionary<string, string> { { "organizationId", organizationId.ToString() }, { "userId", userId.ToString() } }
                        );

                        if (!customerResponse.Success || customerResponse.Data == null)
                        {
                            response.Success = false;
                            response.Message = $"Failed to create Stripe customer: {customerResponse.Message}";
                            return response;
                        }

                        customerId = customerResponse.Data.Id;
                        organization.StripeCustomerId = customerId;
                        await _organizationRepository.UpdateOrganizationAsync(organization);
                    }
                    else
                    {
                        customerId = organization.StripeCustomerId;
                    }

                    // Get price ID based on billing cycle
                    var priceId = createDto.BillingCycle == "Annual"
                        ? plan.StripePriceIdAnnual
                        : plan.StripePriceIdMonthly;

                    if (string.IsNullOrWhiteSpace(priceId))
                    {
                        response.Success = false;
                        response.Message = $"Price ID not configured for {createDto.BillingCycle} billing";
                        return response;
                    }

                    // Create Stripe subscription with trial period if eligible
                    int? trialDays = null;
                    
                    // Check if plan has trial days configured
                    if (plan.TrialDays.HasValue && plan.TrialDays.Value > 0)
                    {
                        // Check if this user is eligible for trial (hasn't used one before)
                        // existingSubscription was already checked above - if null, user is eligible
                        bool isEligible = existingSubscription == null;
                        
                        if (!isEligible && existingSubscription != null)
                        {
                            // Check history to see if they've had a trial
                            var history = await _historyRepository.GetHistoryBySubscriptionIdAsync(existingSubscription.Id);
                            var hasHadTrial = history.Any(h => h.EventType == "TrialStarted" || existingSubscription.Status == "Trial");
                            isEligible = !hasHadTrial;
                        }
                        
                        if (isEligible)
                        {
                            trialDays = plan.TrialDays.Value;
                        }
                    }
                    else if (plan.IsTrial)
                    {
                        // Legacy: Free Trial plan always gets 7 days
                        trialDays = 7;
                    }

                    var subscriptionResponse = await _stripeService.CreateSubscriptionAsync(
                        customerId,
                        priceId,
                        trialDays
                    );

                    if (!subscriptionResponse.Success || subscriptionResponse.Data == null)
                    {
                        response.Success = false;
                        response.Message = $"Failed to create Stripe subscription: {subscriptionResponse.Message}";
                        return response;
                    }

                    var stripeSubscription = subscriptionResponse.Data;

                    // Create subscription in database
                    var newSubscription = new Models.Subscription
                    {
                        OrganizationId = organizationId,
                        SubscriptionPlanId = plan.Id,
                        StripeSubscriptionId = stripeSubscription.Id,
                        StripeCustomerId = customerId,
                        Status = MapStripeStatus(stripeSubscription.Status),
                        BillingCycle = createDto.BillingCycle,
                        CurrentPeriodStart = stripeSubscription.CurrentPeriodStart,
                        CurrentPeriodEnd = stripeSubscription.CurrentPeriodEnd,
                        TrialStart = stripeSubscription.TrialStart,
                        TrialEnd = stripeSubscription.TrialEnd,
                        CreatedAt = DateTime.Now,
                        UpdatedAt = DateTime.Now
                    };

                    createdSubscription = await _subscriptionRepository.CreateSubscriptionAsync(newSubscription);
                    
                    // Add history
                    await _historyRepository.AddHistoryAsync(new Models.SubscriptionHistory
                    {
                        SubscriptionId = createdSubscription.Id,
                        EventType = "Created",
                        Metadata = $"{{\"planId\": {plan.Id}, \"billingCycle\": \"{createDto.BillingCycle}\", \"createdBy\": \"admin\"}}"
                    });
                }

                // Update organization subscription ID
                organization.SubscriptionId = createdSubscription.Id;
                await _organizationRepository.UpdateOrganizationAsync(organization);

                var dto = _mapper.Map<SubscriptionDto>(createdSubscription);
                dto.Plan = _mapper.Map<SubscriptionPlanDto>(plan);

                response.Data = dto;
                response.Message = "Subscription created successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating subscription for user {UserId}", userId);
                response.Success = false;
                response.Message = $"Error creating subscription: {ex.Message}";
            }

            return response;
        }

        // Admin method: Get all user subscriptions
        public async Task<ServiceResponse<SubscriptionDto>> AssignLifetimePlanAsync(AdminAssignLifetimePlanDto assignDto)
        {
            var response = new ServiceResponse<SubscriptionDto>();

            try
            {
                if (!assignDto.UserId.HasValue && string.IsNullOrWhiteSpace(assignDto.Email))
                {
                    response.Success = false;
                    response.StatusCode = 400;
                    response.Message = "UserId or email is required";
                    return response;
                }

                var user = assignDto.UserId.HasValue
                    ? await _userRepository.GetUser(assignDto.UserId.Value)
                    : null;

                if (user == null && !string.IsNullOrWhiteSpace(assignDto.Email))
                {
                    var userDto = await _userRepository.GetUserByEmailAsync(assignDto.Email.Trim());
                    if (userDto != null)
                    {
                        user = await _userRepository.GetUser(userDto.Id);
                    }
                }

                if (user == null)
                {
                    response.Success = false;
                    response.StatusCode = 404;
                    response.Message = "User not found";
                    return response;
                }

                var lifetimePlan = await _planRepository.GetPlanByNameAsync(LifetimePlanName);
                if (lifetimePlan == null)
                {
                    lifetimePlan = await _planRepository.CreatePlanAsync(new Models.SubscriptionPlan
                    {
                        Name = LifetimePlanName,
                        Description = "Internal lifetime premium access plan for admin-assigned accounts.",
                        MaxProperties = null,
                        MaxTotalUnits = null,
                        MonthlyPrice = 0,
                        AnnualPrice = 0,
                        Features = "[\"Unlimited units\", \"Everything in Premium\", \"Lifetime access\"]",
                        IsActive = true,
                        IsTrial = false,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    });
                }

                var organizationId = user.CurrentOrganizationId;
                var organization = organizationId.HasValue
                    ? await _organizationRepository.GetOrganizationByIdAsync(organizationId.Value)
                    : await _organizationRepository.GetCurrentUserOrganizationAsync(user.Id);

                if (organization == null)
                {
                    response.Success = false;
                    response.StatusCode = 400;
                    response.Message = "User has no organization to attach the lifetime plan to";
                    return response;
                }

                var subscription = await _subscriptionRepository.GetSubscriptionByOwnerUserIdAsync(user.Id)
                    ?? await _subscriptionRepository.GetSubscriptionByOrganizationIdAsync(organization.Id);

                var oldPlanId = subscription?.SubscriptionPlanId;

                if (!string.IsNullOrWhiteSpace(subscription?.StripeSubscriptionId))
                {
                    var cancelResponse = await _stripeService.CancelSubscriptionAsync(subscription.StripeSubscriptionId, cancelAtPeriodEnd: false);
                    if (!cancelResponse.Success)
                    {
                        _logger.LogWarning(
                            "Unable to cancel Stripe subscription {StripeSubscriptionId} before assigning Lifetime Plan to user {UserId}: {Message}",
                            subscription.StripeSubscriptionId,
                            user.Id,
                            cancelResponse.Message);

                        response.Success = false;
                        response.StatusCode = 502;
                        response.Message = "Unable to assign Lifetime Plan because the existing paid Stripe subscription could not be cancelled";
                        return response;
                    }
                }

                if (subscription == null)
                {
                    subscription = await _subscriptionRepository.CreateSubscriptionAsync(new Models.Subscription
                    {
                        OrganizationId = organization.Id,
                        OwnerUserId = user.Id,
                        SubscriptionPlanId = lifetimePlan.Id,
                        StripeSubscriptionId = null,
                        StripeCustomerId = null,
                        Status = "Active",
                        BillingCycle = "Lifetime",
                        CurrentPeriodStart = DateTime.UtcNow,
                        CurrentPeriodEnd = null,
                        TrialStart = null,
                        TrialEnd = null,
                        CancelledAt = null,
                        CancelAtPeriodEnd = false,
                        PausedAt = null,
                        PausedAtPeriodEnd = false,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    });
                }
                else
                {
                    subscription.OrganizationId = organization.Id;
                    subscription.OwnerUserId = user.Id;
                    subscription.SubscriptionPlanId = lifetimePlan.Id;
                    subscription.StripeSubscriptionId = null;
                    subscription.StripeCustomerId = null;
                    subscription.Status = "Active";
                    subscription.BillingCycle = "Lifetime";
                    subscription.CurrentPeriodStart = DateTime.UtcNow;
                    subscription.CurrentPeriodEnd = null;
                    subscription.TrialStart = null;
                    subscription.TrialEnd = null;
                    subscription.CancelledAt = null;
                    subscription.CancelAtPeriodEnd = false;
                    subscription.PausedAt = null;
                    subscription.PausedAtPeriodEnd = false;
                    subscription = await _subscriptionRepository.UpdateSubscriptionAsync(subscription);
                }

                if (organization.SubscriptionId != subscription.Id)
                {
                    organization.SubscriptionId = subscription.Id;
                    await _organizationRepository.UpdateOrganizationAsync(organization);
                }

                await _historyRepository.AddHistoryAsync(new SubscriptionHistory
                {
                    SubscriptionId = subscription.Id,
                    EventType = "LifetimePlanAssigned",
                    OldPlanId = oldPlanId,
                    NewPlanId = lifetimePlan.Id,
                    Metadata = JsonSerializer.Serialize(new { source = "AdminPortal", userId = user.Id })
                });

                var dto = _mapper.Map<SubscriptionDto>(subscription);
                dto.Plan = _mapper.Map<SubscriptionPlanDto>(lifetimePlan);
                dto.IsOrphaned = false;

                response.Data = dto;
                response.Message = "Lifetime Plan assigned successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error assigning lifetime plan");
                response.Success = false;
                response.StatusCode = 500;
                response.Message = "An error occurred while assigning the Lifetime Plan";
            }

            return response;
        }

        public async Task<ServiceResponse<List<SubscriptionDto>>> GetAllUserSubscriptionsAsync()
        {
            var response = new ServiceResponse<List<SubscriptionDto>>();

            try
            {
                var subscriptions = await _subscriptionRepository.GetActiveSubscriptionsAsync();
                var subscriptionDtos = subscriptions.Select(s =>
                {
                    var dto = _mapper.Map<SubscriptionDto>(s);
                    dto.Plan = _mapper.Map<SubscriptionPlanDto>(s.SubscriptionPlan);
                    
                    // Check if subscription is orphaned (free plans don't have Stripe IDs, so they're not orphaned)
                    dto.IsOrphaned = s.SubscriptionPlan != null && !IsFreePlan(s.SubscriptionPlan) && 
                                    (string.IsNullOrEmpty(s.StripeSubscriptionId) || string.IsNullOrEmpty(s.StripeCustomerId));
                    
                    // Include organization name
                    dto.OrganizationName = s.Organization?.Name;
                    
                    // Get organization owner - prefer Owner navigation property, otherwise get first Owner role member
                    if (s.Organization != null)
                    {
                        // First try the Owner navigation property
                        if (s.Organization.Owner != null)
                        {
                            dto.OrganizationOwner = _mapper.Map<SubscriptionUserDto>(s.Organization.Owner);
                        }
                        else
                        {
                            // If no Owner, get first active member with Owner role
                            var ownerMember = s.Organization.Members?
                                .FirstOrDefault(m => m.Role == "Owner" && m.IsActive && m.UserId.HasValue && m.User != null);
                            if (ownerMember?.User != null)
                            {
                                dto.OrganizationOwner = _mapper.Map<SubscriptionUserDto>(ownerMember.User);
                            }
                        }
                    }
                    
                    return dto;
                }).ToList();

                response.Data = subscriptionDtos;
                response.Message = "Subscriptions retrieved successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all user subscriptions");
                response.Success = false;
                response.Message = $"Error retrieving subscriptions: {ex.Message}";
            }

            return response;
        }

        // Admin method: Extend trial period (for user's organization)
        public async Task<ServiceResponse<SubscriptionDto>> ExtendTrialAsync(long userId, int additionalDays)
        {
            var response = new ServiceResponse<SubscriptionDto>();

            try
            {
                // Get user's current organization (subscriptions are organization-only)
                var user = await _userRepository.GetUser(userId);
                if (user == null || !user.CurrentOrganizationId.HasValue)
                {
                    response.Success = false;
                    response.Message = "User not found or has no active organization";
                    response.StatusCode = 404;
                    return response;
                }

                var subscription = await _subscriptionRepository.GetSubscriptionByOrganizationIdAsync(user.CurrentOrganizationId.Value);
                if (subscription == null)
                {
                    response.Success = false;
                    response.Message = "Subscription not found for user's organization";
                    response.StatusCode = 404;
                    return response;
                }

                if (subscription.TrialEnd.HasValue)
                {
                    subscription.TrialEnd = subscription.TrialEnd.Value.AddDays(additionalDays);
                    await _subscriptionRepository.UpdateSubscriptionAsync(subscription);

                    await _historyRepository.AddHistoryAsync(new Models.SubscriptionHistory
                    {
                        SubscriptionId = subscription.Id,
                        EventType = "TrialExtended",
                        Metadata = $"{{\"additionalDays\": {additionalDays}}}"
                    });

                    var dto = _mapper.Map<SubscriptionDto>(subscription);
                    dto.Plan = _mapper.Map<SubscriptionPlanDto>(subscription.SubscriptionPlan);

                    response.Data = dto;
                    response.Message = $"Trial extended by {additionalDays} days";
                }
                else
                {
                    response.Success = false;
                    response.Message = "Subscription does not have a trial period";
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error extending trial for user {UserId}", userId);
                response.Success = false;
                response.Message = $"Error extending trial: {ex.Message}";
            }

            return response;
        }

        private string MapStripeStatus(string stripeStatus)
        {
            return stripeStatus switch
            {
                "active" => "Active",
                "trialing" => "Trial",
                "past_due" => "PastDue",
                "canceled" => "Cancelled",
                "unpaid" => "Unpaid",
                "incomplete" => "Incomplete",
                "incomplete_expired" => "IncompleteExpired",
                _ => stripeStatus
            };
        }

        public async Task<ServiceResponse<SubscriptionDto>> SyncSubscriptionFromStripeAsync(string stripeSubscriptionId)
        {
            var response = new ServiceResponse<SubscriptionDto>();

            try
            {
                var userId = await GetCurrentUserIdAsync();
                if (!userId.HasValue)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    response.StatusCode = 401;
                    return response;
                }

                var organizationId = GetCurrentOrganizationId();
                if (!organizationId.HasValue)
                {
                    response.Success = false;
                    response.Message = "Organization context is required";
                    response.StatusCode = 403;
                    return response;
                }

                // Check if subscription already exists
                var existingSubscription = await _subscriptionRepository.GetSubscriptionByStripeIdAsync(stripeSubscriptionId);
                if (existingSubscription != null)
                {
                    var existingDto = _mapper.Map<SubscriptionDto>(existingSubscription);
                    existingDto.Plan = _mapper.Map<SubscriptionPlanDto>(existingSubscription.SubscriptionPlan);
                    response.Data = existingDto;
                    response.Message = "Subscription already exists in database";
                    return response;
                }

                // Fetch subscription from Stripe
                var subscriptionService = new Stripe.SubscriptionService();
                Stripe.Subscription stripeSubscription;
                try
                {
                    stripeSubscription = await subscriptionService.GetAsync(stripeSubscriptionId);
                }
                catch (StripeException ex)
                {
                    _logger.LogError(ex, "Error fetching subscription {StripeSubscriptionId} from Stripe", stripeSubscriptionId);
                    response.Success = false;
                    response.Message = $"Subscription not found in Stripe: {ex.Message}";
                    response.StatusCode = 404;
                    return response;
                }

                // Get organization
                var organization = await _organizationRepository.GetOrganizationByIdAsync(organizationId.Value);
                if (organization == null)
                {
                    response.Success = false;
                    response.Message = "Organization not found";
                    response.StatusCode = 404;
                    return response;
                }

                // Verify the Stripe customer ID matches
                if (organization.StripeCustomerId != stripeSubscription.CustomerId)
                {
                    response.Success = false;
                    response.Message = $"Subscription customer ID ({stripeSubscription.CustomerId}) does not match organization's Stripe customer ID ({organization.StripeCustomerId})";
                    response.StatusCode = 400;
                    return response;
                }

                // Get plan by price ID
                var priceId = stripeSubscription.Items?.Data?.FirstOrDefault()?.Price?.Id;
                if (string.IsNullOrEmpty(priceId))
                {
                    response.Success = false;
                    response.Message = "Price ID not found in Stripe subscription";
                    response.StatusCode = 400;
                    return response;
                }

                var plan = await _planRepository.GetPlanByStripePriceIdAsync(priceId);
                if (plan == null)
                {
                    response.Success = false;
                    response.Message = $"Plan not found for price ID {priceId}";
                    response.StatusCode = 404;
                    return response;
                }

                // Determine billing cycle
                var billingCycle = plan.StripePriceIdMonthly == priceId ? "Monthly" : "Annual";

                // Create subscription record (subscriptions are organization-only)
                var newSubscription = new Models.Subscription
                {
                    OrganizationId = organizationId.Value,
                    SubscriptionPlanId = plan.Id,
                    StripeSubscriptionId = stripeSubscription.Id,
                    StripeCustomerId = stripeSubscription.CustomerId,
                    Status = MapStripeStatus(stripeSubscription.Status),
                    BillingCycle = billingCycle,
                    CurrentPeriodStart = stripeSubscription.CurrentPeriodStart,
                    CurrentPeriodEnd = stripeSubscription.CurrentPeriodEnd,
                    TrialStart = stripeSubscription.TrialStart,
                    TrialEnd = stripeSubscription.TrialEnd,
                    CancelAtPeriodEnd = stripeSubscription.CancelAtPeriodEnd,
                    CancelledAt = stripeSubscription.CanceledAt,
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                };

                var createdSubscription = await _subscriptionRepository.CreateSubscriptionAsync(newSubscription);

                // Update organization with subscription ID
                organization.SubscriptionId = createdSubscription.Id;
                organization.StripeCustomerId = stripeSubscription.CustomerId;
                await _organizationRepository.UpdateOrganizationAsync(organization);

                // Add history
                await _historyRepository.AddHistoryAsync(new SubscriptionHistory
                {
                    SubscriptionId = createdSubscription.Id,
                    EventType = "Created",
                    Metadata = $"{{\"source\": \"manual_sync\", \"stripeSubscriptionId\": \"{stripeSubscription.Id}\"}}"
                });

                var dto = _mapper.Map<SubscriptionDto>(createdSubscription);
                dto.Plan = _mapper.Map<SubscriptionPlanDto>(plan);

                response.Data = dto;
                response.Message = "Subscription synced successfully from Stripe";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error syncing subscription from Stripe");
                response.Success = false;
                response.Message = $"Error syncing subscription: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<MigrationResultDto>> MigrateSubscriptionsToNewPriceAsync(long planId, bool prorate = true)
        {
            var response = new ServiceResponse<MigrationResultDto>();
            var result = new MigrationResultDto();

            try
            {
                // Get the plan
                var plan = await _planRepository.GetPlanByIdAsync(planId);
                if (plan == null)
                {
                    response.Success = false;
                    response.Message = "Plan not found";
                    response.StatusCode = 404;
                    return response;
                }

                // Get all active subscriptions for this plan
                var subscriptions = await _subscriptionRepository.GetSubscriptionsByPlanIdAsync(planId);
                result.TotalSubscriptions = subscriptions.Count;

                if (subscriptions.Count == 0)
                {
                    result.SuccessMessages.Add("No active subscriptions found for this plan");
                    response.Data = result;
                    response.Success = true;
                    response.Message = "No subscriptions to migrate";
                    return response;
                }

                _logger.LogInformation("Starting migration of {Count} subscriptions for plan {PlanId} ({PlanName})", 
                    subscriptions.Count, planId, plan.Name);

                // Migrate each subscription
                foreach (var subscription in subscriptions)
                {
                    try
                    {
                        if (string.IsNullOrEmpty(subscription.StripeSubscriptionId))
                        {
                            result.Failed++;
                            result.Errors.Add($"Subscription {subscription.Id} has no Stripe subscription ID");
                            continue;
                        }

                        // Determine which price ID to use based on billing cycle
                        var newPriceId = subscription.BillingCycle == "Annual"
                            ? plan.StripePriceIdAnnual
                            : plan.StripePriceIdMonthly;

                        if (string.IsNullOrEmpty(newPriceId))
                        {
                            result.Failed++;
                            result.Errors.Add($"Subscription {subscription.Id}: No price ID found for billing cycle {subscription.BillingCycle}");
                            continue;
                        }

                        // Update subscription in Stripe
                        var stripeResponse = await _stripeService.UpdateSubscriptionAsync(
                            subscription.StripeSubscriptionId,
                            newPriceId,
                            prorate
                        );

                        if (!stripeResponse.Success)
                        {
                            result.Failed++;
                            result.Errors.Add($"Subscription {subscription.Id} (Organization: {subscription.Organization?.Name ?? "N/A"}): {stripeResponse.Message}");
                            _logger.LogWarning("Failed to migrate subscription {SubscriptionId}: {Message}", 
                                subscription.Id, stripeResponse.Message);
                            continue;
                        }

                        // Update subscription in database
                        subscription.UpdatedAt = DateTime.UtcNow;
                        await _subscriptionRepository.UpdateSubscriptionAsync(subscription);

                        // Add history
                        await _historyRepository.AddHistoryAsync(new Models.SubscriptionHistory
                        {
                            SubscriptionId = subscription.Id,
                            EventType = "PriceMigrated",
                            Metadata = $"{{\"oldPriceId\": \"{subscription.SubscriptionPlan?.StripePriceIdMonthly}\", \"newPriceId\": \"{newPriceId}\", \"billingCycle\": \"{subscription.BillingCycle}\", \"prorate\": {prorate.ToString().ToLower()}}}"
                        });

                        result.SuccessfullyMigrated++;
                        result.SuccessMessages.Add($"Subscription {subscription.Id} (Organization: {subscription.Organization?.Name ?? "N/A"}) migrated successfully");
                        _logger.LogInformation("Successfully migrated subscription {SubscriptionId} to new price {PriceId}", 
                            subscription.Id, newPriceId);
                    }
                    catch (Exception ex)
                    {
                        result.Failed++;
                        var errorMsg = $"Subscription {subscription.Id}: {ex.Message}";
                        result.Errors.Add(errorMsg);
                        _logger.LogError(ex, "Error migrating subscription {SubscriptionId}", subscription.Id);
                    }
                }

                response.Data = result;
                response.Success = true;
                response.Message = $"Migration completed: {result.SuccessfullyMigrated} succeeded, {result.Failed} failed out of {result.TotalSubscriptions} total";
                
                _logger.LogInformation("Migration completed for plan {PlanId}: {Success}/{Total} succeeded", 
                    planId, result.SuccessfullyMigrated, result.TotalSubscriptions);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error migrating subscriptions for plan {PlanId}", planId);
                response.Success = false;
                response.Message = $"Error migrating subscriptions: {ex.Message}";
                response.Data = result;
            }

            return response;
        }

        public async Task<ServiceResponse<List<OrphanedSubscriptionDto>>> GetOrphanedSubscriptionsAsync()
        {
            var response = new ServiceResponse<List<OrphanedSubscriptionDto>>();

            try
            {
                var orphanedSubscriptions = await _subscriptionRepository.GetOrphanedSubscriptionsAsync();
                
                // Filter out free plans - they don't need Stripe IDs; only org (landlord) subscriptions appear in orphaned list
                var filteredOrphaned = orphanedSubscriptions
                    .Where(s => s.OrganizationId.HasValue && s.SubscriptionPlan != null && !IsFreePlan(s.SubscriptionPlan))
                    .ToList();
                
                var orphanedDtos = filteredOrphaned.Select(s =>
                {
                    var orgOwner = s.Organization?.Owner;
                    var ownerEmail = orgOwner?.Email ?? 
                        s.Organization?.Members?
                            .FirstOrDefault(m => m.Role == "Owner" && m.IsActive && m.User != null)?.User?.Email ?? 
                        string.Empty;

                    return new OrphanedSubscriptionDto
                    {
                        SubscriptionId = s.Id,
                        OrganizationId = s.OrganizationId!.Value,
                        OrganizationName = s.Organization?.Name ?? "Unknown",
                        OwnerEmail = ownerEmail,
                        PlanId = s.SubscriptionPlanId,
                        PlanName = s.SubscriptionPlan?.Name ?? "Unknown",
                        Status = s.Status,
                        CreatedAt = s.CreatedAt,
                        TrialEnd = s.TrialEnd,
                        StripeCustomerId = s.StripeCustomerId,
                        StripeSubscriptionId = s.StripeSubscriptionId
                    };
                }).ToList();

                response.Data = orphanedDtos;
                response.Message = $"Found {orphanedDtos.Count} orphaned subscription(s)";
                _logger.LogInformation("Found {Count} orphaned subscriptions", orphanedDtos.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting orphaned subscriptions");
                response.Success = false;
                response.Message = $"Error retrieving orphaned subscriptions: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<FixOrphanedSubscriptionResponseDto>> FixOrphanedSubscriptionAsync(long subscriptionId)
        {
            var response = new ServiceResponse<FixOrphanedSubscriptionResponseDto>();
            var result = new FixOrphanedSubscriptionResponseDto { SubscriptionId = subscriptionId };

            try
            {
                var subscription = await _subscriptionRepository.GetSubscriptionByIdAsync(subscriptionId);
                if (subscription == null)
                {
                    result.Success = false;
                    result.Message = "Subscription not found";
                    response.Success = false;
                    response.StatusCode = 404;
                    response.Data = result;
                    return response;
                }

                // Check if already has Stripe IDs
                if (!string.IsNullOrEmpty(subscription.StripeSubscriptionId) && !string.IsNullOrEmpty(subscription.StripeCustomerId))
                {
                    result.Success = true;
                    result.Message = "Subscription already has Stripe IDs";
                    result.StripeCustomerId = subscription.StripeCustomerId;
                    result.StripeSubscriptionId = subscription.StripeSubscriptionId;
                    response.Data = result;
                    return response;
                }

                // Get organization (orphaned fix only applies to org subscriptions)
                if (!subscription.OrganizationId.HasValue)
                {
                    result.Success = false;
                    result.Message = "Subscription is not associated with an organization";
                    response.Success = false;
                    response.Data = result;
                    return response;
                }

                var organization = await _organizationRepository.GetOrganizationByIdWithMembersAsync(subscription.OrganizationId.Value);
                if (organization == null)
                {
                    result.Success = false;
                    result.Message = "Organization not found";
                    response.Success = false;
                    response.StatusCode = 404;
                    response.Data = result;
                    return response;
                }

                // Get plan
                var plan = await _planRepository.GetPlanByIdAsync(subscription.SubscriptionPlanId);
                if (plan == null)
                {
                    result.Success = false;
                    result.Message = "Subscription plan not found";
                    response.Success = false;
                    response.StatusCode = 404;
                    response.Data = result;
                    return response;
                }

                // Get owner email for customer creation
                var ownerEmail = organization.Owner?.Email ?? 
                    organization.Members?
                        .FirstOrDefault(m => m.Role == "Owner" && m.IsActive && m.User != null)?.User?.Email ?? 
                    string.Empty;

                if (string.IsNullOrEmpty(ownerEmail))
                {
                    result.Success = false;
                    result.Message = "Cannot find organization owner email";
                    response.Success = false;
                    response.Data = result;
                    return response;
                }

                // Get or create Stripe customer
                string customerId;
                if (!string.IsNullOrEmpty(organization.StripeCustomerId))
                {
                    // Verify customer exists in Stripe
                    var customerCheck = await _stripeService.GetCustomerAsync(organization.StripeCustomerId);
                    if (customerCheck.Success && customerCheck.Data != null)
                    {
                        customerId = organization.StripeCustomerId;
                    }
                    else
                    {
                        // Customer doesn't exist, create new one
                        _logger.LogWarning("Customer {CustomerId} not found in Stripe, creating new customer for organization {OrgId}", 
                            organization.StripeCustomerId, organization.Id);
                        var customerResponse = await _stripeService.CreateCustomerAsync(
                            ownerEmail,
                            organization.Name,
                            new Dictionary<string, string>
                            {
                                { "organizationId", organization.Id.ToString() },
                                { "organizationName", organization.Name }
                            }
                        );

                        if (!customerResponse.Success || customerResponse.Data == null)
                        {
                            result.Success = false;
                            result.Message = $"Failed to create Stripe customer: {customerResponse.Message}";
                            response.Success = false;
                            response.Data = result;
                            return response;
                        }

                        customerId = customerResponse.Data.Id;
                        organization.StripeCustomerId = customerId;
                        await _organizationRepository.UpdateOrganizationAsync(organization);
                    }
                }
                else
                {
                    // No customer ID, create new one
                    var customerResponse = await _stripeService.CreateCustomerAsync(
                        ownerEmail,
                        organization.Name,
                        new Dictionary<string, string>
                        {
                            { "organizationId", organization.Id.ToString() },
                            { "organizationName", organization.Name }
                        }
                    );

                    if (!customerResponse.Success || customerResponse.Data == null)
                    {
                        result.Success = false;
                        result.Message = $"Failed to create Stripe customer: {customerResponse.Message}";
                        response.Success = false;
                        response.Data = result;
                        return response;
                    }

                    customerId = customerResponse.Data.Id;
                    organization.StripeCustomerId = customerId;
                    await _organizationRepository.UpdateOrganizationAsync(organization);
                }

                // Get price ID based on billing cycle (default to Monthly if not set)
                var billingCycle = subscription.BillingCycle ?? "Monthly";
                var priceId = billingCycle == "Annual"
                    ? plan.StripePriceIdAnnual
                    : plan.StripePriceIdMonthly;

                if (string.IsNullOrEmpty(priceId))
                {
                    result.Success = false;
                    result.Message = $"Price ID not configured for {billingCycle} billing cycle";
                    response.Success = false;
                    response.Data = result;
                    return response;
                }

                // Calculate trial days if subscription is in trial
                int? trialDays = null;
                if (subscription.TrialStart.HasValue && subscription.TrialEnd.HasValue)
                {
                    var trialSpan = subscription.TrialEnd.Value - subscription.TrialStart.Value;
                    trialDays = (int)Math.Ceiling(trialSpan.TotalDays);
                }
                else if (subscription.Status == "Trial" && plan.TrialDays.HasValue)
                {
                    trialDays = plan.TrialDays.Value;
                }

                // Preserve original period dates by setting billing cycle anchor
                // This ensures the subscription starts at the same date as the original
                DateTime? billingCycleAnchor = null;
                if (subscription.CurrentPeriodStart.HasValue)
                {
                    billingCycleAnchor = subscription.CurrentPeriodStart.Value;
                    _logger.LogInformation("Preserving original CurrentPeriodStart {CurrentPeriodStart} for orphaned subscription {SubscriptionId}",
                        subscription.CurrentPeriodStart.Value, subscription.Id);
                }

                // Create Stripe subscription with preserved billing cycle anchor
                var subscriptionResponse = await _stripeService.CreateSubscriptionAsync(
                    customerId,
                    priceId,
                    trialDays,
                    null, // No payment method for orphaned subscriptions (they're already in trial)
                    billingCycleAnchor // Preserve original period start
                );

                if (!subscriptionResponse.Success || subscriptionResponse.Data == null)
                {
                    result.Success = false;
                    result.Message = $"Failed to create Stripe subscription: {subscriptionResponse.Message}";
                    response.Success = false;
                    response.Data = result;
                    return response;
                }

                var stripeSubscription = subscriptionResponse.Data;

                // Update subscription in database with Stripe IDs
                subscription.StripeCustomerId = customerId;
                subscription.StripeSubscriptionId = stripeSubscription.Id;
                subscription.Status = stripeSubscription.Status == "trialing" ? "Trial" : "Active";
                
                // Update period dates from Stripe
                // When billing_cycle_anchor is set, Stripe preserves CurrentPeriodStart and calculates CurrentPeriodEnd
                var originalPeriodStart = subscription.CurrentPeriodStart;
                var originalPeriodEnd = subscription.CurrentPeriodEnd;
                
                subscription.CurrentPeriodStart = stripeSubscription.CurrentPeriodStart;
                subscription.CurrentPeriodEnd = stripeSubscription.CurrentPeriodEnd;
                
                _logger.LogInformation("Updated subscription period dates - Original: Start={OriginalStart}, End={OriginalEnd}; Stripe: Start={StripeStart}, End={StripeEnd}",
                    originalPeriodStart?.ToString() ?? "null", originalPeriodEnd?.ToString() ?? "null",
                    stripeSubscription.CurrentPeriodStart, stripeSubscription.CurrentPeriodEnd);
                
                // Update trial dates from Stripe if available
                if (stripeSubscription.TrialStart.HasValue)
                    subscription.TrialStart = stripeSubscription.TrialStart.Value;
                if (stripeSubscription.TrialEnd.HasValue)
                    subscription.TrialEnd = stripeSubscription.TrialEnd.Value;

                await _subscriptionRepository.UpdateSubscriptionAsync(subscription);

                // Update organization to ensure StripeCustomerId is set
                organization.StripeCustomerId = customerId;
                await _organizationRepository.UpdateOrganizationAsync(organization);

                // Add history
                await _historyRepository.AddHistoryAsync(new SubscriptionHistory
                {
                    SubscriptionId = subscription.Id,
                    EventType = "StripeCreated",
                    Metadata = $"{{\"source\": \"orphan_fix\", \"stripeSubscriptionId\": \"{stripeSubscription.Id}\", \"stripeCustomerId\": \"{customerId}\"}}"
                });

                result.Success = true;
                result.Message = "Successfully created Stripe subscription for orphaned subscription";
                result.StripeCustomerId = customerId;
                result.StripeSubscriptionId = stripeSubscription.Id;

                _logger.LogInformation("Successfully fixed orphaned subscription {SubscriptionId} - Created Stripe subscription {StripeSubscriptionId} for customer {CustomerId}",
                    subscriptionId, stripeSubscription.Id, customerId);

                response.Data = result;
                response.Message = "Subscription fixed successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fixing orphaned subscription {SubscriptionId}", subscriptionId);
                result.Success = false;
                result.Message = $"Error fixing subscription: {ex.Message}";
                response.Success = false;
                response.Data = result;
            }

            return response;
        }

        public async Task<ServiceResponse<FixOrphanedSubscriptionsResultDto>> FixAllOrphanedSubscriptionsAsync()
        {
            var response = new ServiceResponse<FixOrphanedSubscriptionsResultDto>();
            var result = new FixOrphanedSubscriptionsResultDto();

            try
            {
                var orphanedSubscriptions = await _subscriptionRepository.GetOrphanedSubscriptionsAsync();
                result.TotalFound = orphanedSubscriptions.Count;

                _logger.LogInformation("Starting fix for {Count} orphaned subscriptions", orphanedSubscriptions.Count);

                foreach (var subscription in orphanedSubscriptions)
                {
                    var fixResponse = await FixOrphanedSubscriptionAsync(subscription.Id);
                    result.Results.Add(new FixOrphanedSubscriptionResponseDto
                    {
                        SubscriptionId = subscription.Id,
                        Success = fixResponse.Success,
                        Message = fixResponse.Message,
                        StripeCustomerId = fixResponse.Data?.StripeCustomerId,
                        StripeSubscriptionId = fixResponse.Data?.StripeSubscriptionId
                    });

                    if (fixResponse.Success)
                    {
                        result.SuccessfullyFixed++;
                    }
                    else
                    {
                        result.Failed++;
                    }
                }

                response.Data = result;
                response.Message = $"Fixed {result.SuccessfullyFixed} out of {result.TotalFound} orphaned subscriptions";
                response.Success = true;

                _logger.LogInformation("Completed fixing orphaned subscriptions: {Success}/{Total} succeeded",
                    result.SuccessfullyFixed, result.TotalFound);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fixing all orphaned subscriptions");
                response.Success = false;
                response.Message = $"Error fixing orphaned subscriptions: {ex.Message}";
                response.Data = result;
            }

            return response;
        }
    }
}

