using Stripe;
using brownstone_hub_api.Repositories.Subscriptions;
using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Models;
using brownstone_hub_api.Data;
using Microsoft.EntityFrameworkCore;
using brownstone_hub_api.Dtos.Subscription;
using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Repositories.NotificationSettings;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Services.StripeService;

namespace brownstone_hub_api.Services.StripeService
{
    public class StripeWebhookService : IStripeWebhookService
    {
        private readonly ISubscriptionRepository _subscriptionRepository;
        private readonly ISubscriptionPlanRepository _planRepository;
        private readonly ISubscriptionHistoryRepository _historyRepository;
        private readonly IOrganizationRepository _organizationRepository;
        private readonly DataContext _context;
        private readonly ILogger<StripeWebhookService> _logger;
        private readonly INotificationService _notificationService;
        private readonly IUserRepository _userRepository;
        private readonly INotificationSettingRepository _notificationSettingRepository;
        private readonly IStripeService _stripeService;

        public StripeWebhookService(
            ISubscriptionRepository subscriptionRepository,
            ISubscriptionPlanRepository planRepository,
            ISubscriptionHistoryRepository historyRepository,
            IOrganizationRepository organizationRepository,
            DataContext context,
            ILogger<StripeWebhookService> logger,
            INotificationService notificationService,
            IUserRepository userRepository,
            INotificationSettingRepository notificationSettingRepository,
            IStripeService stripeService)
        {
            _subscriptionRepository = subscriptionRepository;
            _planRepository = planRepository;
            _historyRepository = historyRepository;
            _organizationRepository = organizationRepository;
            _context = context;
            _logger = logger;
            _notificationService = notificationService;
            _userRepository = userRepository;
            _notificationSettingRepository = notificationSettingRepository;
            _stripeService = stripeService;
        }

        public async Task HandleSubscriptionCreatedAsync(Event stripeEvent)
        {
            var subscription = stripeEvent.Data.Object as Stripe.Subscription;
            if (subscription == null)
            {
                _logger.LogError("Subscription object is null in webhook event {EventId}", stripeEvent.Id);
                return;
            }

            _logger.LogInformation("Handling subscription created: {SubscriptionId}, Customer: {CustomerId}, Status: {Status}",
                subscription.Id, subscription.CustomerId, subscription.Status);

            try
            {
                var dbSubscription = await _subscriptionRepository.GetSubscriptionByStripeIdAsync(subscription.Id);
                if (dbSubscription != null)
                {
                    _logger.LogInformation("Subscription {SubscriptionId} already exists in database, updating", subscription.Id);
                    // Update existing subscription
                    UpdateSubscriptionFromStripe(dbSubscription, subscription);
                    await _subscriptionRepository.UpdateSubscriptionAsync(dbSubscription);
                    return;
                }

                // Try to get organization by Stripe customer ID first (subscriptions are tied to organizations)
                var organization = await _context.Organizations
                    .FirstOrDefaultAsync(o => o.StripeCustomerId == subscription.CustomerId);

                long? organizationIdFromMetadata = null;

                Stripe.Customer? customer = null;
                long? userIdFromMetadata = null;

                // Fallback: if organization not found, try to get customer from Stripe and check metadata
                if (organization == null)
                {
                    try
                    {
                        var customerService = new Stripe.CustomerService();
                        customer = await customerService.GetAsync(subscription.CustomerId);
                        if (customer.Metadata != null && customer.Metadata.ContainsKey("organizationId"))
                        {
                            var orgIdStr = customer.Metadata["organizationId"];
                            if (long.TryParse(orgIdStr, out var orgId))
                            {
                                organizationIdFromMetadata = orgId;
                                organization = await _context.Organizations.FindAsync(orgId);
                                if (organization != null)
                                {
                                    if (string.IsNullOrEmpty(organization.StripeCustomerId))
                                    {
                                        organization.StripeCustomerId = subscription.CustomerId;
                                        await _organizationRepository.UpdateOrganizationAsync(organization);
                                    }
                                    _logger.LogInformation("Found organization {OrganizationId} via customer metadata", organization.Id);
                                }
                            }
                        }
                        if (customer.Metadata != null && customer.Metadata.ContainsKey("userId") && long.TryParse(customer.Metadata["userId"], out var uid))
                        {
                            userIdFromMetadata = uid;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Could not retrieve customer {CustomerId} from Stripe to check metadata", subscription.CustomerId);
                    }
                }

                // Check if there's an orphaned subscription for this organization or tenant (userId)
                Models.Subscription? orphanedSubscription = null;
                long? organizationIdForOrphanCheck = organization?.Id ?? organizationIdFromMetadata;

                if (userIdFromMetadata.HasValue)
                {
                    orphanedSubscription = await _subscriptionRepository.GetSubscriptionByUserIdAsync(userIdFromMetadata.Value);
                    if (orphanedSubscription != null)
                        _logger.LogInformation("Found tenant subscription {SubscriptionId} for user {UserId} via customer metadata", orphanedSubscription.Id, userIdFromMetadata.Value);
                }

                if (orphanedSubscription == null && organizationIdForOrphanCheck.HasValue)
                {
                    orphanedSubscription = await _subscriptionRepository.GetSubscriptionByOrganizationIdAsync(organizationIdForOrphanCheck.Value);
                    _logger.LogInformation("Retrieved subscription for organization {OrganizationId}. Subscription found: {SubscriptionFound}, HasStripeSubscriptionId: {HasStripeSubscriptionId}, HasStripeCustomerId: {HasStripeCustomerId}, Status: {Status}",
                        organizationIdForOrphanCheck.Value, orphanedSubscription != null,
                        orphanedSubscription?.StripeSubscriptionId != null, orphanedSubscription?.StripeCustomerId != null, orphanedSubscription?.Status);
                }

                if (orphanedSubscription != null &&
                    (string.IsNullOrEmpty(orphanedSubscription.StripeSubscriptionId) || string.IsNullOrEmpty(orphanedSubscription.StripeCustomerId)))
                {
                        bool isTrialSubscription = orphanedSubscription.Status == "Trial";
                        _logger.LogInformation("Found orphaned subscription {SubscriptionId} for {Context}. PlanId: {PlanId}, Status: {Status}, IsTrial: {IsTrial}",
                            orphanedSubscription.Id, organizationIdForOrphanCheck.HasValue ? $"organization {organizationIdForOrphanCheck.Value}" : $"user {orphanedSubscription.UserId}", orphanedSubscription.SubscriptionPlanId, orphanedSubscription.Status, isTrialSubscription);

                        // Get plan by price ID to check if it matches the orphaned subscription's plan
                        var orphanedPriceId = subscription.Items?.Data?.FirstOrDefault()?.Price?.Id;
                        if (string.IsNullOrEmpty(orphanedPriceId))
                        {
                            _logger.LogWarning("Cannot fix orphaned subscription {SubscriptionId}: Price ID not found in Stripe subscription {StripeSubscriptionId}. Subscription items count: {ItemsCount}",
                                orphanedSubscription.Id, subscription.Id, subscription.Items?.Data?.Count ?? 0);
                            // Continue to create new subscription instead
                        }
                        else
                        {
                            _logger.LogInformation("Retrieved price ID {PriceId} from Stripe subscription. Looking up plan...", orphanedPriceId);
                            var orphanedPlan = await _planRepository.GetPlanByStripePriceIdAsync(orphanedPriceId);

                            if (orphanedPlan != null)
                            {
                                _logger.LogInformation("Found plan {PlanId} for price ID {PriceId}. Orphaned subscription plan ID: {OrphanedPlanId}",
                                    orphanedPlan.Id, orphanedPriceId, orphanedSubscription.SubscriptionPlanId);
                            }
                            else
                            {
                                _logger.LogWarning("No plan found for price ID {PriceId}", orphanedPriceId);
                            }

                            // Check if this is a trial subscription being converted to paid
                            bool isTrialConversion = orphanedSubscription.Status == "Trial";

                            // If plan matches, update the orphaned subscription
                            // If plan doesn't match but we have an orphaned subscription, we should still update it since
                            // the user is trying to fix their orphaned subscription (they selected their current plan)
                            if (orphanedPlan != null && orphanedPlan.Id == orphanedSubscription.SubscriptionPlanId)
                            {
                                // Plan matches - update the orphaned subscription
                                _logger.LogInformation("Plan matches! Updating orphaned subscription {SubscriptionId} with matching plan {PlanId}. IsTrialConversion: {IsTrialConversion}",
                                    orphanedSubscription.Id, orphanedPlan.Id, isTrialConversion);

                                var oldPlanId = orphanedSubscription.SubscriptionPlanId;

                                // Update the orphaned subscription with Stripe IDs
                                orphanedSubscription.StripeSubscriptionId = subscription.Id;
                                orphanedSubscription.StripeCustomerId = subscription.CustomerId;

                                // For trial conversions: if Stripe status is "incomplete" (payment pending),
                                // set status to "PaymentPending" so user knows payment is being processed.
                                // Once payment succeeds, subscription.updated webhook will transition it to "Active"
                                if (isTrialConversion && subscription.Status == "incomplete")
                                {
                                    // Set to PaymentPending so user knows payment is being processed
                                    _logger.LogInformation("Trial conversion: Stripe subscription {StripeSubscriptionId} has incomplete status (payment pending). Setting status to PaymentPending.", subscription.Id);
                                    orphanedSubscription.Status = "PaymentPending";
                                }
                                else
                                {
                                    orphanedSubscription.Status = MapStripeStatus(subscription.Status);
                                }

                                orphanedSubscription.BillingCycle = orphanedPlan.StripePriceIdMonthly == orphanedPriceId ? "Monthly" : "Annual";
                                orphanedSubscription.CurrentPeriodStart = subscription.CurrentPeriodStart;
                                orphanedSubscription.CurrentPeriodEnd = subscription.CurrentPeriodEnd;
                                orphanedSubscription.TrialStart = subscription.TrialStart;
                                orphanedSubscription.TrialEnd = subscription.TrialEnd;

                                // If this is a trial conversion, update the plan to the selected plan (not the trial plan)
                                if (isTrialConversion && orphanedPlan.Id != orphanedSubscription.SubscriptionPlanId)
                                {
                                    orphanedSubscription.SubscriptionPlanId = orphanedPlan.Id;
                                }

                                _logger.LogInformation("Updating orphaned subscription {SubscriptionId} with StripeSubscriptionId: {StripeSubscriptionId}, StripeCustomerId: {StripeCustomerId}",
                                    orphanedSubscription.Id, subscription.Id, subscription.CustomerId);

                                try
                                {
                                    var updatedSubscription = await _subscriptionRepository.UpdateSubscriptionAsync(orphanedSubscription);
                                    _logger.LogInformation("Successfully saved orphaned subscription {SubscriptionId} update to database. StripeSubscriptionId: {StripeSubscriptionId}, StripeCustomerId: {StripeCustomerId}",
                                        updatedSubscription.Id, updatedSubscription.StripeSubscriptionId, updatedSubscription.StripeCustomerId);
                                }
                                catch (Exception updateEx)
                                {
                                    _logger.LogError(updateEx, "Error updating orphaned subscription {SubscriptionId} in database", orphanedSubscription.Id);
                                    throw; // Re-throw to let the webhook handler know it failed
                                }

                                // Update organization to ensure StripeCustomerId is set (get it if we don't have it)
                                if (organization == null && organizationIdForOrphanCheck.HasValue)
                                {
                                    organization = await _context.Organizations.FindAsync(organizationIdForOrphanCheck.Value);
                                }

                                if (organization != null)
                                {
                                    organization.StripeCustomerId = subscription.CustomerId;
                                    organization.SubscriptionId = orphanedSubscription.Id;
                                    await _organizationRepository.UpdateOrganizationAsync(organization);
                                }
                                else if (organizationIdForOrphanCheck.HasValue)
                                {
                                    _logger.LogWarning("Could not update organization {OrganizationId} - organization not found", organizationIdForOrphanCheck.Value);
                                }

                                // Add history - use TrialConverted for trial conversions, StripeCreated for orphan fixes
                                await _historyRepository.AddHistoryAsync(new Models.SubscriptionHistory
                                {
                                    SubscriptionId = orphanedSubscription.Id,
                                    EventType = isTrialConversion ? "TrialConverted" : "StripeCreated",
                                    OldPlanId = isTrialConversion ? oldPlanId : null,
                                    NewPlanId = isTrialConversion ? orphanedPlan.Id : null,
                                    Metadata = $"{{\"source\": \"{(isTrialConversion ? "trial_conversion" : "webhook_orphan_fix")}\", \"stripeSubscriptionId\": \"{subscription.Id}\", \"stripeCustomerId\": \"{subscription.CustomerId}\"}}"
                                });

                                _logger.LogInformation("Successfully updated orphaned subscription {SubscriptionId} with Stripe subscription {StripeSubscriptionId}. EventType: {EventType}",
                                    orphanedSubscription.Id, subscription.Id, isTrialConversion ? "TrialConverted" : "StripeCreated");
                                return;
                            }
                            else if (orphanedPlan != null)
                            {
                                // Plan doesn't match, but we still have an orphaned subscription
                                // In this case, we should update the orphaned subscription to the new plan
                                var oldPlanId = orphanedSubscription.SubscriptionPlanId;
                                // isTrialConversion is already declared in outer scope

                                _logger.LogInformation("Orphaned subscription {SubscriptionId} plan {OrphanedPlanId} doesn't match checkout plan {CheckoutPlanId}. Updating orphaned subscription to new plan. IsTrialConversion: {IsTrialConversion}",
                                    orphanedSubscription.Id, oldPlanId, orphanedPlan.Id, isTrialConversion);

                                // Update the orphaned subscription with Stripe IDs and new plan
                                orphanedSubscription.StripeSubscriptionId = subscription.Id;
                                orphanedSubscription.StripeCustomerId = subscription.CustomerId;
                                orphanedSubscription.SubscriptionPlanId = orphanedPlan.Id; // Update to new plan

                                // For trial conversions: if Stripe status is "incomplete" (payment pending),
                                // set status to "PaymentPending" so user knows payment is being processed.
                                // Once payment succeeds, subscription.updated webhook will transition it to "Active"
                                var oldStatus = orphanedSubscription.Status;
                                if (isTrialConversion && subscription.Status == "incomplete")
                                {
                                    // Set to PaymentPending so user knows payment is being processed
                                    _logger.LogInformation("Trial conversion: Stripe subscription {StripeSubscriptionId} has incomplete status (payment pending). Setting status to PaymentPending.", subscription.Id);
                                    orphanedSubscription.Status = "PaymentPending";
                                }
                                else
                                {
                                    orphanedSubscription.Status = MapStripeStatus(subscription.Status);
                                }

                                // If subscription is reactivated (transitioning from Cancelled to Active), clear CancelledAt
                                if (oldStatus == "Cancelled" && orphanedSubscription.Status == "Active")
                                {
                                    _logger.LogInformation("Orphaned subscription {SubscriptionId} reactivated: transitioning from Cancelled to Active, clearing CancelledAt",
                                        orphanedSubscription.Id);
                                    orphanedSubscription.CancelledAt = null;
                                }
                                else if (orphanedSubscription.Status == "Active")
                                {
                                    // Ensure CancelledAt is null for Active subscriptions
                                    orphanedSubscription.CancelledAt = null;
                                }
                                else
                                {
                                    orphanedSubscription.CancelledAt = subscription.CanceledAt;
                                }

                                orphanedSubscription.BillingCycle = orphanedPlan.StripePriceIdMonthly == orphanedPriceId ? "Monthly" : "Annual";
                                orphanedSubscription.CurrentPeriodStart = subscription.CurrentPeriodStart;
                                orphanedSubscription.CurrentPeriodEnd = subscription.CurrentPeriodEnd;
                                orphanedSubscription.TrialStart = subscription.TrialStart;
                                orphanedSubscription.TrialEnd = subscription.TrialEnd;

                                await _subscriptionRepository.UpdateSubscriptionAsync(orphanedSubscription);

                                // Update organization
                                if (organization == null && organizationIdForOrphanCheck.HasValue)
                                {
                                    organization = await _context.Organizations.FindAsync(organizationIdForOrphanCheck.Value);
                                }

                                if (organization != null)
                                {
                                    organization.StripeCustomerId = subscription.CustomerId;
                                    organization.SubscriptionId = orphanedSubscription.Id;
                                    await _organizationRepository.UpdateOrganizationAsync(organization);
                                }

                                // Add history - use TrialConverted for trial conversions
                                await _historyRepository.AddHistoryAsync(new Models.SubscriptionHistory
                                {
                                    SubscriptionId = orphanedSubscription.Id,
                                    EventType = isTrialConversion ? "TrialConverted" : "StripeCreated",
                                    OldPlanId = oldPlanId,
                                    NewPlanId = orphanedPlan.Id,
                                    Metadata = $"{{\"source\": \"{(isTrialConversion ? "trial_conversion" : "webhook_orphan_fix")}\", \"stripeSubscriptionId\": \"{subscription.Id}\", \"stripeCustomerId\": \"{subscription.CustomerId}\", \"planChanged\": true}}"
                                });

                                _logger.LogInformation("Successfully updated orphaned subscription {SubscriptionId} with Stripe subscription {StripeSubscriptionId} and new plan {PlanId}. EventType: {EventType}",
                                    orphanedSubscription.Id, subscription.Id, orphanedPlan.Id, isTrialConversion ? "TrialConverted" : "StripeCreated");
                                return;
                            }
                            else
                            {
                                // Plan not found - but we still have an orphaned subscription, so update it anyway
                                _logger.LogWarning("Plan not found for price ID {PriceId}, but updating orphaned subscription {SubscriptionId} with Stripe IDs anyway",
                                    orphanedPriceId, orphanedSubscription.Id);

                                // Update the orphaned subscription with Stripe IDs (without changing plan)
                                orphanedSubscription.StripeSubscriptionId = subscription.Id;
                                orphanedSubscription.StripeCustomerId = subscription.CustomerId;

                                // For trial conversions: if Stripe status is "incomplete" (payment pending),
                                // set status to "PaymentPending" so user knows payment is being processed.
                                // Once payment succeeds, subscription.updated webhook will transition it to "Active"
                                var oldStatusForOrphan = orphanedSubscription.Status;
                                if (isTrialConversion && subscription.Status == "incomplete")
                                {
                                    // Set to PaymentPending so user knows payment is being processed
                                    _logger.LogInformation("Trial conversion: Stripe subscription {StripeSubscriptionId} has incomplete status (payment pending). Setting status to PaymentPending.", subscription.Id);
                                    orphanedSubscription.Status = "PaymentPending";
                                }
                                else
                                {
                                    orphanedSubscription.Status = MapStripeStatus(subscription.Status);
                                }

                                // If subscription is reactivated (transitioning from Cancelled to Active), clear CancelledAt
                                if (oldStatusForOrphan == "Cancelled" && orphanedSubscription.Status == "Active")
                                {
                                    _logger.LogInformation("Orphaned subscription {SubscriptionId} reactivated: transitioning from Cancelled to Active, clearing CancelledAt",
                                        orphanedSubscription.Id);
                                    orphanedSubscription.CancelledAt = null;
                                }
                                else if (orphanedSubscription.Status == "Active")
                                {
                                    // Ensure CancelledAt is null for Active subscriptions
                                    orphanedSubscription.CancelledAt = null;
                                }
                                else
                                {
                                    orphanedSubscription.CancelledAt = subscription.CanceledAt;
                                }

                                orphanedSubscription.CurrentPeriodStart = subscription.CurrentPeriodStart;
                                orphanedSubscription.CurrentPeriodEnd = subscription.CurrentPeriodEnd;
                                orphanedSubscription.TrialStart = subscription.TrialStart;
                                orphanedSubscription.TrialEnd = subscription.TrialEnd;

                                // Determine billing cycle from subscription items if available
                                if (subscription.Items?.Data?.Any() == true)
                                {
                                    var item = subscription.Items.Data.First();
                                    // Try to determine billing cycle from the price
                                    var dbPlan = await _planRepository.GetPlanByIdAsync(orphanedSubscription.SubscriptionPlanId);
                                    if (dbPlan != null)
                                    {
                                        orphanedSubscription.BillingCycle = dbPlan.StripePriceIdMonthly == item.Price?.Id ? "Monthly" : "Annual";
                                    }
                                }

                                await _subscriptionRepository.UpdateSubscriptionAsync(orphanedSubscription);

                                // Update organization
                                if (organization == null && organizationIdForOrphanCheck.HasValue)
                                {
                                    organization = await _context.Organizations.FindAsync(organizationIdForOrphanCheck.Value);
                                }

                                if (organization != null)
                                {
                                    organization.StripeCustomerId = subscription.CustomerId;
                                    organization.SubscriptionId = orphanedSubscription.Id;
                                    await _organizationRepository.UpdateOrganizationAsync(organization);
                                }

                                // Add history
                                await _historyRepository.AddHistoryAsync(new Models.SubscriptionHistory
                                {
                                    SubscriptionId = orphanedSubscription.Id,
                                    EventType = "StripeCreated",
                                    Metadata = $"{{\"source\": \"webhook_orphan_fix\", \"stripeSubscriptionId\": \"{subscription.Id}\", \"stripeCustomerId\": \"{subscription.CustomerId}\"}}"
                                });

                                _logger.LogInformation("Successfully updated orphaned subscription {SubscriptionId} with Stripe subscription {StripeSubscriptionId}",
                                    orphanedSubscription.Id, subscription.Id);
                                return;
                            }
                        }
                }

                if (organizationIdForOrphanCheck.HasValue)
                {
                    if (orphanedSubscription != null && !string.IsNullOrEmpty(orphanedSubscription.StripeSubscriptionId) && !string.IsNullOrEmpty(orphanedSubscription.StripeCustomerId))
                    {
                        _logger.LogInformation("Subscription {SubscriptionId} for organization {OrganizationId} already has Stripe IDs. StripeSubscriptionId: {StripeSubscriptionId}, StripeCustomerId: {StripeCustomerId}",
                            orphanedSubscription.Id, organizationIdForOrphanCheck.Value,
                            orphanedSubscription.StripeSubscriptionId ?? "null", orphanedSubscription.StripeCustomerId ?? "null");
                    }
                    else if (orphanedSubscription == null)
                    {
                        _logger.LogInformation("No subscription found for organization {OrganizationId}", organizationIdForOrphanCheck.Value);
                    }
                }
                else if (organization == null && !userIdFromMetadata.HasValue)
                {
                    _logger.LogWarning("No organization ID or user ID available for orphaned subscription check. Organization: {Organization}, OrganizationIdFromMetadata: {OrganizationIdFromMetadata}",
                        organization != null, organizationIdFromMetadata);
                }

                // Create new subscription from Stripe checkout
                _logger.LogInformation("Creating new subscription for Stripe subscription {StripeSubscriptionId}", subscription.Id);

                Models.User? user = null;
                long? userId = null;
                long? organizationId = null;

                if (organization != null)
                {
                    _logger.LogInformation("Found organization {OrganizationId} ({OrganizationName}) for customer {CustomerId}",
                        organization.Id, organization.Name, subscription.CustomerId);
                    organizationId = organization.Id;
                    // Get the owner or first active member for UserId
                    if (organization.OwnerId.HasValue)
                    {
                        userId = organization.OwnerId.Value;
                        user = await _context.Users.FindAsync(userId.Value);
                    }
                    else
                    {
                        // Get first active member
                        var member = await _context.OrganizationMembers
                            .Where(m => m.OrganizationId == organization.Id && m.IsActive && m.UserId.HasValue)
                            .FirstOrDefaultAsync();
                        if (member?.UserId.HasValue == true)
                        {
                            userId = member.UserId.Value;
                            user = await _context.Users.FindAsync(userId.Value);
                        }
                    }
                }
                else
                {
                    // Fallback to user lookup for backward compatibility
                    user = await _context.Users
                        .FirstOrDefaultAsync(u => u.StripeCustomerId == subscription.CustomerId);

                    if (user == null)
                    {
                        var availableOrgCustomers = await _context.Organizations
                            .Where(o => !string.IsNullOrEmpty(o.StripeCustomerId))
                            .Select(o => o.StripeCustomerId)
                            .ToListAsync();
                        var availableUserCustomers = await _context.Users
                            .Where(u => !string.IsNullOrEmpty(u.StripeCustomerId))
                            .Select(u => u.StripeCustomerId)
                            .ToListAsync();
                        _logger.LogError("Organization or User not found for Stripe customer {CustomerId}. Available org customers: {OrgCustomers}, Available user customers: {UserCustomers}",
                            subscription.CustomerId, string.Join(", ", availableOrgCustomers), string.Join(", ", availableUserCustomers));
                        return;
                    }

                    userId = user.Id;
                    _logger.LogInformation("Found user {UserId} for customer {CustomerId} (fallback - no organization)", user.Id, subscription.CustomerId);
                }

                if (user == null)
                {
                    _logger.LogError("User not found for customer {CustomerId}", subscription.CustomerId);
                    return;
                }

                // Get plan by price ID
                var priceId = subscription.Items?.Data?.FirstOrDefault()?.Price?.Id;
                if (string.IsNullOrEmpty(priceId))
                {
                    _logger.LogError("Price ID not found in subscription {SubscriptionId}. Items: {ItemsCount}",
                        subscription.Id, subscription.Items?.Data?.Count ?? 0);
                    return;
                }

                _logger.LogInformation("Looking up plan for price ID {PriceId}", priceId);
                var plan = await _planRepository.GetPlanByStripePriceIdAsync(priceId);
                if (plan == null)
                {
                    var monthlyPrices = await _context.SubscriptionPlans
                        .Where(p => !string.IsNullOrEmpty(p.StripePriceIdMonthly))
                        .Select(p => p.StripePriceIdMonthly)
                        .ToListAsync();
                    var annualPrices = await _context.SubscriptionPlans
                        .Where(p => !string.IsNullOrEmpty(p.StripePriceIdAnnual))
                        .Select(p => p.StripePriceIdAnnual)
                        .ToListAsync();
                    _logger.LogError("Plan not found for price ID {PriceId}. Available price IDs in DB - Monthly: {MonthlyPrices}, Annual: {AnnualPrices}",
                        priceId, string.Join(", ", monthlyPrices), string.Join(", ", annualPrices));
                    return;
                }

                _logger.LogInformation("Found plan {PlanId} ({PlanName}) for price ID {PriceId}", plan.Id, plan.Name, priceId);

                // Determine billing cycle
                var billingCycle = plan.StripePriceIdMonthly == priceId ? "Monthly" : "Annual";
                _logger.LogInformation("Billing cycle determined as {BillingCycle}", billingCycle);

                // Create subscription (subscriptions are organization-only)
                if (!organizationId.HasValue)
                {
                    _logger.LogError("Cannot create subscription: organization ID is required. Subscriptions are tied to organizations.");
                    return; // Early return - webhook handler returns void
                }

                var newSubscription = new Models.Subscription
                {
                    OrganizationId = organizationId.Value,
                    SubscriptionPlanId = plan.Id,
                    StripeSubscriptionId = subscription.Id,
                    StripeCustomerId = subscription.CustomerId,
                    Status = MapStripeStatus(subscription.Status),
                    BillingCycle = billingCycle,
                    CurrentPeriodStart = subscription.CurrentPeriodStart,
                    CurrentPeriodEnd = subscription.CurrentPeriodEnd,
                    TrialStart = subscription.TrialStart,
                    TrialEnd = subscription.TrialEnd,
                    CancelAtPeriodEnd = subscription.CancelAtPeriodEnd,
                    CancelledAt = subscription.CanceledAt,
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                };

                _logger.LogInformation("Saving subscription to database...");
                dbSubscription = await _subscriptionRepository.CreateSubscriptionAsync(newSubscription);
                _logger.LogInformation("Subscription saved with ID {SubscriptionId}", dbSubscription.Id);

                // Update organization with subscription ID and ensure StripeCustomerId is set
                if (organization != null)
                {
                    organization.SubscriptionId = dbSubscription.Id;
                    organization.StripeCustomerId = subscription.CustomerId;
                    await _organizationRepository.UpdateOrganizationAsync(organization);
                    _logger.LogInformation("Updated organization {OrganizationId} with subscription ID {SubscriptionId}", organization.Id, dbSubscription.Id);
                }
                // Subscriptions are now organization-only, so no user fallback needed

                // Add history
                await _historyRepository.AddHistoryAsync(new SubscriptionHistory
                {
                    SubscriptionId = dbSubscription.Id,
                    EventType = "Created",
                    Metadata = $"{{\"source\": \"checkout\", \"stripeSubscriptionId\": \"{subscription.Id}\"}}"
                });

                _logger.LogInformation("Successfully created subscription {SubscriptionId} from Stripe checkout for user {UserId}",
                    dbSubscription.Id, user.Id);

                // Notify admins about new subscription
                await NotifyAdminsAboutSubscriptionAsync(user, organization, dbSubscription, plan, isNewSubscription: true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error handling subscription created event for subscription {SubscriptionId}. Error: {ErrorMessage}, StackTrace: {StackTrace}",
                    subscription.Id, ex.Message, ex.StackTrace);
                throw; // Re-throw to ensure webhook retries
            }
        }

        public async Task HandleSubscriptionUpdatedAsync(Event stripeEvent)
        {
            var subscription = stripeEvent.Data.Object as Stripe.Subscription;
            if (subscription == null) return;

            _logger.LogInformation("Handling subscription updated: {SubscriptionId}", subscription.Id);

            try
            {
                var dbSubscription = await _subscriptionRepository.GetSubscriptionByStripeIdAsync(subscription.Id);
                if (dbSubscription == null)
                {
                    _logger.LogWarning("Subscription {SubscriptionId} not found in database", subscription.Id);
                    return;
                }

                var oldStatus = dbSubscription.Status;

                // Special handling for trial conversions: if subscription was in PaymentPending status and
                // Stripe status transitions from incomplete to active, properly complete the conversion
                bool isTrialConversionCompletion = (oldStatus == "Trial" || oldStatus == "PaymentPending") &&
                                                   subscription.Status == "active" &&
                                                   !string.IsNullOrEmpty(dbSubscription.StripeSubscriptionId);

                UpdateSubscriptionFromStripe(dbSubscription, subscription);

                // If this is completing a trial conversion (Trial/PaymentPending -> Active after payment),
                // ensure we add history for trial conversion completion
                if (isTrialConversionCompletion)
                {
                    _logger.LogInformation("Trial conversion completed: Subscription {SubscriptionId} transitioned from {OldStatus} to Active after payment succeeded.",
                        dbSubscription.Id, oldStatus);

                    await _historyRepository.AddHistoryAsync(new SubscriptionHistory
                    {
                        SubscriptionId = dbSubscription.Id,
                        EventType = "TrialConverted",
                        Metadata = $"{{\"source\": \"payment_completed\", \"oldStatus\": \"{oldStatus}\", \"stripeSubscriptionId\": \"{subscription.Id}\"}}"
                    });
                }

                // Check if plan changed
                if (subscription.Items?.Data?.Any() == true)
                {
                    var priceId = subscription.Items.Data[0].Price?.Id;
                    if (!string.IsNullOrEmpty(priceId))
                    {
                        var plan = await _planRepository.GetPlanByStripePriceIdAsync(priceId);
                        if (plan != null && plan.Id != dbSubscription.SubscriptionPlanId)
                        {
                            var oldPlanId = dbSubscription.SubscriptionPlanId;
                            dbSubscription.SubscriptionPlanId = plan.Id;

                            await _historyRepository.AddHistoryAsync(new SubscriptionHistory
                            {
                                SubscriptionId = dbSubscription.Id,
                                EventType = "PlanChanged",
                                OldPlanId = oldPlanId,
                                NewPlanId = plan.Id
                            });
                        }
                    }
                }

                await _subscriptionRepository.UpdateSubscriptionAsync(dbSubscription);

                // Log status change
                if (oldStatus != dbSubscription.Status)
                {
                    await _historyRepository.AddHistoryAsync(new SubscriptionHistory
                    {
                        SubscriptionId = dbSubscription.Id,
                        EventType = "StatusChanged",
                        Metadata = $"{{\"oldStatus\": \"{oldStatus}\", \"newStatus\": \"{dbSubscription.Status}\"}}"
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error handling subscription updated event");
            }
        }

        public async Task HandleSubscriptionDeletedAsync(Event stripeEvent)
        {
            var subscription = stripeEvent.Data.Object as Stripe.Subscription;
            if (subscription == null) return;

            _logger.LogInformation("Handling subscription deleted: {SubscriptionId}", subscription.Id);

            try
            {
                var dbSubscription = await _subscriptionRepository.GetSubscriptionByStripeIdAsync(subscription.Id);
                if (dbSubscription == null)
                {
                    _logger.LogWarning("Subscription {SubscriptionId} not found in database", subscription.Id);
                    return;
                }

                // Transition to Free plan rather than leaving them on Cancelled.
                // This handles both explicit cancellations and period-end expirations
                // from downgrade-to-free flows (cancel_at_period_end = true).
                var freePlan = await _planRepository.GetPlanByNameAsync("Free");
                if (freePlan != null)
                {
                    dbSubscription.SubscriptionPlanId = freePlan.Id;
                    dbSubscription.Status = "Active";
                    dbSubscription.CancelAtPeriodEnd = false;
                    dbSubscription.CancelledAt = null;
                    dbSubscription.StripeSubscriptionId = null; // Subscription is gone in Stripe
                    // Keep StripeCustomerId so re-subscription doesn't create a duplicate customer
                }
                else
                {
                    dbSubscription.Status = "Cancelled";
                    dbSubscription.CancelledAt = DateTime.Now;
                }

                await _subscriptionRepository.UpdateSubscriptionAsync(dbSubscription);

                await _historyRepository.AddHistoryAsync(new SubscriptionHistory
                {
                    SubscriptionId = dbSubscription.Id,
                    EventType = freePlan != null ? "DowngradedToFree" : "Deleted"
                });

                // Notify admins about subscription cancellation
                var organization = await _context.Organizations
                    .FirstOrDefaultAsync(o => o.SubscriptionId == dbSubscription.Id);

                Models.User? user = null;
                if (organization != null && organization.OwnerId.HasValue)
                {
                    user = await _context.Users.FindAsync(organization.OwnerId.Value);
                }
                else
                {
                    // Fallback: try to find user by Stripe customer ID
                    user = await _context.Users
                        .FirstOrDefaultAsync(u => u.StripeCustomerId == subscription.CustomerId);
                }

                if (user != null && organization != null)
                {
                    var plan = await _planRepository.GetPlanByIdAsync(dbSubscription.SubscriptionPlanId);
                    await NotifyAdminsAboutSubscriptionAsync(user, organization, dbSubscription, plan, isNewSubscription: false);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error handling subscription deleted event");
            }
        }

        public async Task HandleInvoicePaymentSucceededAsync(Event stripeEvent)
        {
            var invoice = stripeEvent.Data.Object as Stripe.Invoice;
            if (invoice == null || string.IsNullOrEmpty(invoice.SubscriptionId)) return;

            _logger.LogInformation("Handling invoice payment succeeded for subscription: {SubscriptionId}", invoice.SubscriptionId);

            try
            {
                var dbSubscription = await _subscriptionRepository.GetSubscriptionByStripeIdAsync(invoice.SubscriptionId);
                if (dbSubscription == null)
                {
                    _logger.LogWarning("Subscription {SubscriptionId} not found in database", invoice.SubscriptionId);
                    return;
                }

                var oldStatus = dbSubscription.Status;

                // Update subscription status to Active if it was past due or payment pending
                // When payment succeeds, subscription should be active
                if (dbSubscription.Status == "PastDue" || dbSubscription.Status == "PaymentPending")
                {
                    // Fetch the current subscription from Stripe to get the latest status
                    try
                    {
                        var subscriptionService = new Stripe.SubscriptionService();
                        var stripeSubscription = await subscriptionService.GetAsync(invoice.SubscriptionId);

                        // Only update to Active if Stripe says it's active
                        if (stripeSubscription.Status == "active")
                        {
                            _logger.LogInformation("Payment succeeded: Updating subscription {SubscriptionId} from {OldStatus} to Active",
                                dbSubscription.Id, oldStatus);

                            dbSubscription.Status = "Active";
                            dbSubscription.CurrentPeriodStart = stripeSubscription.CurrentPeriodStart;
                            dbSubscription.CurrentPeriodEnd = stripeSubscription.CurrentPeriodEnd;
                            dbSubscription.TrialStart = stripeSubscription.TrialStart;
                            dbSubscription.TrialEnd = stripeSubscription.TrialEnd;

                            await _subscriptionRepository.UpdateSubscriptionAsync(dbSubscription);

                            // Add history for trial conversion if it was PaymentPending
                            if (oldStatus == "PaymentPending")
                            {
                                await _historyRepository.AddHistoryAsync(new SubscriptionHistory
                                {
                                    SubscriptionId = dbSubscription.Id,
                                    EventType = "TrialConverted",
                                    Metadata = $"{{\"source\": \"invoice_payment_succeeded\", \"oldStatus\": \"{oldStatus}\", \"invoiceId\": \"{invoice.Id}\"}}"
                                });
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to fetch subscription {SubscriptionId} from Stripe during invoice payment succeeded, updating status anyway", invoice.SubscriptionId);
                        // Fallback: update to Active if we can't verify from Stripe
                        dbSubscription.Status = "Active";
                        await _subscriptionRepository.UpdateSubscriptionAsync(dbSubscription);
                    }
                }

                await _historyRepository.AddHistoryAsync(new SubscriptionHistory
                {
                    SubscriptionId = dbSubscription.Id,
                    EventType = "PaymentSucceeded",
                    Metadata = $"{{\"invoiceId\": \"{invoice.Id}\", \"amount\": {invoice.AmountPaid}}}"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error handling invoice payment succeeded event");
            }
        }

        public async Task HandleInvoicePaymentFailedAsync(Event stripeEvent)
        {
            var invoice = stripeEvent.Data.Object as Stripe.Invoice;
            if (invoice == null || string.IsNullOrEmpty(invoice.SubscriptionId)) return;

            _logger.LogInformation("Handling invoice payment failed for subscription: {SubscriptionId}", invoice.SubscriptionId);

            try
            {
                var dbSubscription = await _subscriptionRepository.GetSubscriptionByStripeIdAsync(invoice.SubscriptionId);
                if (dbSubscription == null)
                {
                    _logger.LogWarning("Subscription {SubscriptionId} not found in database", invoice.SubscriptionId);
                    return;
                }

                dbSubscription.Status = "PastDue";
                await _subscriptionRepository.UpdateSubscriptionAsync(dbSubscription);

                await _historyRepository.AddHistoryAsync(new SubscriptionHistory
                {
                    SubscriptionId = dbSubscription.Id,
                    EventType = "PaymentFailed",
                    Metadata = $"{{\"invoiceId\": \"{invoice.Id}\", \"attemptCount\": {invoice.AttemptCount}}}"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error handling invoice payment failed event");
            }
        }

        public async Task HandleTrialWillEndAsync(Event stripeEvent)
        {
            var subscription = stripeEvent.Data.Object as Stripe.Subscription;
            if (subscription == null) return;

            _logger.LogInformation("Handling trial will end for subscription: {SubscriptionId}", subscription.Id);

            try
            {
                var dbSubscription = await _subscriptionRepository.GetSubscriptionByStripeIdAsync(subscription.Id);
                if (dbSubscription == null)
                {
                    _logger.LogWarning("Subscription {SubscriptionId} not found in database", subscription.Id);
                    return;
                }

                await _historyRepository.AddHistoryAsync(new SubscriptionHistory
                {
                    SubscriptionId = dbSubscription.Id,
                    EventType = "TrialWillEnd"
                });

                // TODO: Send notification to user about trial ending
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error handling trial will end event");
            }
        }

        public async Task HandlePaymentIntentSucceededAsync(Event stripeEvent)
        {
            var paymentIntent = stripeEvent.Data.Object as Stripe.PaymentIntent;
            if (paymentIntent == null)
            {
                _logger.LogError("payment_intent.succeeded: PaymentIntent object is null in event {EventId}", stripeEvent.Id);
                return;
            }

            // Only process intents that have a leaseId — subscription payment intents won't have one
            if (!paymentIntent.Metadata.TryGetValue("leaseId", out var leaseIdStr) ||
                !long.TryParse(leaseIdStr, out var leaseId))
            {
                _logger.LogInformation("payment_intent.succeeded: No leaseId in metadata for {PaymentIntentId}, skipping rent allocation", paymentIntent.Id);
                return;
            }

            _logger.LogInformation("payment_intent.succeeded: Processing rent payment {PaymentIntentId} for lease {LeaseId}", paymentIntent.Id, leaseId);

            // Idempotency: a Completed record means the webhook already finalized this intent.
            // Processing records are intentionally finalized below by removing/replacing them with Completed records.
            var alreadyCompleted = await _context.Payments
                .AnyAsync(p => p.Reference == paymentIntent.Id && p.LeaseId == leaseId && p.Status == "Completed");

            if (alreadyCompleted)
            {
                _logger.LogInformation("payment_intent.succeeded: Payment {PaymentIntentId} already completed for lease {LeaseId}, skipping", paymentIntent.Id, leaseId);
                return;
            }

            var amount = paymentIntent.Amount / 100m; // Stripe amounts are in cents
            var paymentDate = paymentIntent.Created;

            var result = await _stripeService.ConfirmPaymentAllocatedAsync(paymentIntent.Id, leaseId, amount, paymentDate, recordAsProcessing: false);

            if (!result.Success)
            {
                _logger.LogError("payment_intent.succeeded: Allocation failed for {PaymentIntentId}: {Message}", paymentIntent.Id, result.Message);
            }
            else
            {
                var completedPayments = await _context.Payments
                    .Where(p => p.LeaseId == leaseId && (p.StripePaymentIntentId == paymentIntent.Id || p.Reference == paymentIntent.Id))
                    .ToListAsync();

                foreach (var payment in completedPayments)
                {
                    payment.StripePaymentIntentId ??= paymentIntent.Id;
                    payment.StripePaymentMethodId ??= paymentIntent.PaymentMethodId;
                    payment.StripeChargeId ??= paymentIntent.LatestChargeId;
                    payment.CompletedAt ??= DateTime.UtcNow;
                    payment.StripeStatusChangedAt = DateTime.UtcNow;
                    payment.UpdatedAt = DateTime.UtcNow;
                }

                await _context.SaveChangesAsync();
                _logger.LogInformation("payment_intent.succeeded: Successfully allocated {Amount} for lease {LeaseId}", amount, leaseId);
            }
        }


        public async Task HandlePaymentIntentProcessingAsync(Event stripeEvent)
        {
            var paymentIntent = stripeEvent.Data.Object as Stripe.PaymentIntent;
            if (paymentIntent == null)
            {
                _logger.LogError("payment_intent.processing: PaymentIntent object is null in event {EventId}", stripeEvent.Id);
                return;
            }

            if (!TryGetLeaseId(paymentIntent, out var leaseId))
            {
                _logger.LogInformation("payment_intent.processing: No leaseId in metadata for {PaymentIntentId}, skipping rent status update", paymentIntent.Id);
                return;
            }

            await UpdateTenantPaymentIntentStatusAsync(paymentIntent.Id, leaseId, "Processing", "Stripe is still processing this payment.");
        }

        public async Task HandlePaymentIntentPaymentFailedAsync(Event stripeEvent)
        {
            var paymentIntent = stripeEvent.Data.Object as Stripe.PaymentIntent;
            if (paymentIntent == null)
            {
                _logger.LogError("payment_intent.payment_failed: PaymentIntent object is null in event {EventId}", stripeEvent.Id);
                return;
            }

            if (!TryGetLeaseId(paymentIntent, out var leaseId))
            {
                _logger.LogInformation("payment_intent.payment_failed: No leaseId in metadata for {PaymentIntentId}, skipping rent status update", paymentIntent.Id);
                return;
            }

            var failureMessage = paymentIntent.LastPaymentError?.Message;
            await UpdateTenantPaymentIntentStatusAsync(paymentIntent.Id, leaseId, "Failed", failureMessage ?? "Stripe reported this payment as failed.");
        }

        public async Task HandlePaymentIntentCanceledAsync(Event stripeEvent)
        {
            var paymentIntent = stripeEvent.Data.Object as Stripe.PaymentIntent;
            if (paymentIntent == null)
            {
                _logger.LogError("payment_intent.canceled: PaymentIntent object is null in event {EventId}", stripeEvent.Id);
                return;
            }

            if (!TryGetLeaseId(paymentIntent, out var leaseId))
            {
                _logger.LogInformation("payment_intent.canceled: No leaseId in metadata for {PaymentIntentId}, skipping rent status update", paymentIntent.Id);
                return;
            }

            await UpdateTenantPaymentIntentStatusAsync(paymentIntent.Id, leaseId, "Canceled", "Stripe canceled this payment before it completed.");
        }

        public async Task HandleChargeDisputeCreatedAsync(Event stripeEvent)
        {
            var dispute = stripeEvent.Data.Object as Stripe.Dispute;
            if (dispute == null)
            {
                _logger.LogError("charge.dispute.created: Dispute object is null in event {EventId}", stripeEvent.Id);
                return;
            }

            if (string.IsNullOrWhiteSpace(dispute.PaymentIntentId))
            {
                _logger.LogInformation("charge.dispute.created: No PaymentIntentId for dispute {DisputeId}, skipping rent status update", dispute.Id);
                return;
            }

            var payments = await _context.Payments
                .Where(p => p.StripePaymentIntentId == dispute.PaymentIntentId || p.Reference == dispute.PaymentIntentId)
                .ToListAsync();

            if (payments.Count == 0)
            {
                _logger.LogInformation("charge.dispute.created: No Brownstone payment records found for PaymentIntent {PaymentIntentId}", dispute.PaymentIntentId);
                return;
            }

            foreach (var payment in payments)
            {
                var wasCompleted = string.Equals(payment.Status, "Completed", StringComparison.OrdinalIgnoreCase);
                payment.Status = "Disputed";
                payment.StripeDisputeId = dispute.Id;
                payment.StripeChargeId ??= dispute.ChargeId;
                payment.DisputedAt ??= DateTime.UtcNow;
                payment.StripeStatusChangedAt = DateTime.UtcNow;
                payment.UpdatedAt = DateTime.UtcNow;

                if (wasCompleted)
                {
                    await CreatePaymentDisputeReversalLedgerEntryAsync(payment, dispute.Id);
                }
            }

            await _context.SaveChangesAsync();

            foreach (var payment in payments)
            {
                await NotifyTenantPaymentStatusChangedAsync(payment, "Disputed", "A previously completed bank payment was returned or disputed. The amount has been added back to the balance.");
            }

            _logger.LogWarning("charge.dispute.created: Marked {Count} payment record(s) as Disputed for PaymentIntent {PaymentIntentId}, Dispute {DisputeId}", payments.Count, dispute.PaymentIntentId, dispute.Id);
        }

        private static bool TryGetLeaseId(Stripe.PaymentIntent paymentIntent, out long leaseId)
        {
            leaseId = 0;
            return paymentIntent.Metadata != null
                && paymentIntent.Metadata.TryGetValue("leaseId", out var leaseIdStr)
                && long.TryParse(leaseIdStr, out leaseId);
        }

        private async Task UpdateTenantPaymentIntentStatusAsync(string paymentIntentId, long leaseId, string status, string reason)
        {
            var payments = await _context.Payments
                .Where(p => p.LeaseId == leaseId && (p.StripePaymentIntentId == paymentIntentId || p.Reference == paymentIntentId))
                .ToListAsync();

            if (payments.Count == 0)
            {
                _logger.LogInformation("PaymentIntent {PaymentIntentId} for lease {LeaseId} has status {Status}, but no local payment records exist yet. Reason: {Reason}", paymentIntentId, leaseId, status, reason);
                return;
            }

            var changedPayments = new List<Payment>();
            foreach (var payment in payments)
            {
                if (payment.Status == "Completed" && status == "Processing")
                    continue;

                if (!string.Equals(payment.Status, status, StringComparison.OrdinalIgnoreCase))
                {
                    changedPayments.Add(payment);
                }

                payment.Status = status;
                if (string.Equals(status, "Processing", StringComparison.OrdinalIgnoreCase))
                    payment.SubmittedAt ??= DateTime.UtcNow;
                else if (string.Equals(status, "Failed", StringComparison.OrdinalIgnoreCase))
                    payment.FailedAt ??= DateTime.UtcNow;
                else if (string.Equals(status, "Canceled", StringComparison.OrdinalIgnoreCase) || string.Equals(status, "Cancelled", StringComparison.OrdinalIgnoreCase))
                    payment.CanceledAt ??= DateTime.UtcNow;
                payment.StripeStatusChangedAt = DateTime.UtcNow;
                payment.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            if (!string.Equals(status, "Processing", StringComparison.OrdinalIgnoreCase))
            {
                foreach (var payment in changedPayments)
                {
                    await NotifyTenantPaymentStatusChangedAsync(payment, status, reason);
                }
            }

            _logger.LogInformation("Marked {Count} local payment record(s) for PaymentIntent {PaymentIntentId}, lease {LeaseId} as {Status}. Reason: {Reason}", payments.Count, paymentIntentId, leaseId, status, reason);
        }

        private async Task CreatePaymentDisputeReversalLedgerEntryAsync(Payment payment, string disputeId)
        {
            try
            {
                if (!payment.OrganizationId.HasValue)
                {
                    _logger.LogInformation("Skipping dispute ledger reversal for payment {PaymentId}; no organization id", payment.Id);
                    return;
                }

                var originalEntry = await _context.GeneralLedgerEntries
                    .AsNoTracking()
                    .Where(e => e.OrganizationId == payment.OrganizationId.Value
                        && e.TransactionId == payment.Id
                        && e.TransactionType == "Payment")
                    .OrderByDescending(e => e.CreatedAt)
                    .FirstOrDefaultAsync();

                if (originalEntry == null)
                {
                    _logger.LogInformation("No completed payment ledger entry found to reverse for disputed payment {PaymentId}", payment.Id);
                    return;
                }

                var reversalReference = $"Dispute:{disputeId}";
                var reversalExists = await _context.GeneralLedgerEntries.AnyAsync(e =>
                    e.OrganizationId == payment.OrganizationId.Value
                    && e.TransactionId == payment.Id
                    && e.TransactionType == "PaymentDisputeReversal"
                    && e.Reference == reversalReference);

                if (reversalExists)
                {
                    _logger.LogInformation("Dispute ledger reversal already exists for payment {PaymentId}, dispute {DisputeId}", payment.Id, disputeId);
                    return;
                }

                await _context.GeneralLedgerEntries.AddAsync(new GeneralLedgerEntry
                {
                    OrganizationId = payment.OrganizationId.Value,
                    AccountId = originalEntry.AccountId,
                    TransactionId = payment.Id,
                    TransactionType = "PaymentDisputeReversal",
                    Amount = -Math.Abs(originalEntry.Amount),
                    TransactionDate = DateTime.UtcNow,
                    Description = "Reversal for returned/disputed rent payment",
                    Reference = reversalReference
                });

                _logger.LogInformation("Created dispute ledger reversal for payment {PaymentId}, dispute {DisputeId}", payment.Id, disputeId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating dispute ledger reversal for payment {PaymentId}, dispute {DisputeId}", payment.Id, disputeId);
            }
        }

        private async Task NotifyTenantPaymentStatusChangedAsync(Payment payment, string status, string reason)
        {
            try
            {
                var paymentWithLease = await _context.Payments
                    .AsNoTracking()
                    .Include(p => p.Lease)
                        .ThenInclude(l => l.Unit)
                            .ThenInclude(u => u.Property)
                    .Include(p => p.Lease)
                        .ThenInclude(l => l.TenantLeases)
                            .ThenInclude(tl => tl.Tenant)
                    .FirstOrDefaultAsync(p => p.Id == payment.Id);

                if (paymentWithLease?.Lease?.Unit?.Property == null)
                {
                    _logger.LogInformation("Skipping payment status notifications for payment {PaymentId}; lease/property not found", payment.Id);
                    return;
                }

                var lease = paymentWithLease.Lease;
                var property = lease.Unit.Property;
                var amount = Math.Abs(paymentWithLease.Amount);
                var statusLower = status.ToLowerInvariant();
                var isDisputed = statusLower == "disputed";
                var isFailed = statusLower == "failed";
                var isCanceled = statusLower == "canceled" || statusLower == "cancelled";

                var landlordTitle = isDisputed ? "Payment Returned or Disputed" : isFailed ? "Payment Failed" : isCanceled ? "Payment Canceled" : $"Payment {status}";
                var landlordMessage = isDisputed
                    ? $"A previously completed payment of ${amount:F2} for {property.Name} was returned or disputed. The tenant balance has been reopened."
                    : $"A payment of ${amount:F2} for {property.Name} is now {status}. Reason: {reason}";

                await _notificationService.CreateNotification(new CreateNotificationDto
                {
                    UserId = property.LandlordId,
                    OrganizationId = paymentWithLease.OrganizationId,
                    Type = ENotificationType.Payment,
                    Title = landlordTitle,
                    Message = landlordMessage,
                    RelatedId = lease.Id,
                    SendEmail = true,
                    SendSMS = isDisputed
                });

                var tenantTitle = isDisputed ? "Bank Payment Returned" : isFailed ? "Bank Payment Could Not Be Completed" : isCanceled ? "Payment Canceled" : $"Payment {status}";
                var tenantMessage = isDisputed
                    ? $"Your previous bank payment of ${amount:F2} for {property.Name} was returned or disputed by the bank. The amount has been added back to your balance. Please submit a new payment or contact your landlord."
                    : $"Your payment of ${amount:F2} for {property.Name} could not be completed. Please submit another payment method if rent is still due.";

                var tenantUserIds = lease.TenantLeases
                    .Select(tl => tl.Tenant?.UserId)
                    .Where(userId => userId.HasValue)
                    .Select(userId => userId!.Value)
                    .Distinct()
                    .ToList();

                foreach (var tenantUserId in tenantUserIds)
                {
                    await _notificationService.CreateNotification(new CreateNotificationDto
                    {
                        UserId = tenantUserId,
                        OrganizationId = paymentWithLease.OrganizationId,
                        Type = ENotificationType.Payment,
                        Title = tenantTitle,
                        Message = tenantMessage,
                        RelatedId = lease.Id,
                        SendEmail = true,
                        SendSMS = isDisputed
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending payment status notifications for payment {PaymentId}, status {Status}", payment.Id, status);
            }
        }

        private void UpdateSubscriptionFromStripe(Models.Subscription dbSubscription, Stripe.Subscription stripeSubscription)
        {
            // When Stripe has pause_collection set, subscription status stays "active" but we treat it as Paused in our DB
            if (stripeSubscription.PauseCollection != null)
            {
                dbSubscription.Status = "Paused";
                dbSubscription.PausedAtPeriodEnd = false; // Stripe doesn't have "at period end" for pause_collection the same way
                dbSubscription.PausedAt = DateTime.UtcNow; // mark as paused now (webhook doesn't get ResumesAt semantics for UI)
            }
            else
            {
                var newStatus = MapStripeStatus(stripeSubscription.Status);

                // Always update status from Stripe - if payment was pending and is now active, update to Active
                if (dbSubscription.Status == "PaymentPending" && newStatus == "Active")
                {
                    _logger.LogInformation("Subscription {SubscriptionId} payment completed: transitioning from PaymentPending to Active",
                        dbSubscription.Id);
                }

                // If subscription is reactivated (transitioning from Cancelled to Active), clear CancelledAt
                if (dbSubscription.Status == "Cancelled" && newStatus == "Active")
                {
                    _logger.LogInformation("Subscription {SubscriptionId} reactivated: transitioning from Cancelled to Active, clearing CancelledAt",
                        dbSubscription.Id);
                    dbSubscription.CancelledAt = null;
                }

                dbSubscription.Status = newStatus;
                dbSubscription.PausedAtPeriodEnd = false;
                dbSubscription.PausedAt = null;
            }

            dbSubscription.CurrentPeriodStart = stripeSubscription.CurrentPeriodStart;
            dbSubscription.CurrentPeriodEnd = stripeSubscription.CurrentPeriodEnd;
            dbSubscription.TrialStart = stripeSubscription.TrialStart;
            dbSubscription.TrialEnd = stripeSubscription.TrialEnd;
            dbSubscription.CancelAtPeriodEnd = stripeSubscription.CancelAtPeriodEnd;

            if (dbSubscription.Status == "Active" || dbSubscription.Status == "Trial")
            {
                dbSubscription.CancelledAt = null;
            }
            else
            {
                dbSubscription.CancelledAt = stripeSubscription.CanceledAt;
            }

            dbSubscription.UpdatedAt = DateTime.Now;
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

        private async Task NotifyAdminsAboutSubscriptionAsync(
            Models.User user,
            Organization? organization,
            Models.Subscription subscription,
            SubscriptionPlan? plan,
            bool isNewSubscription)
        {
            try
            {
                var adminUsers = await _userRepository.GetAdminUsersAsync();
                if (adminUsers == null || !adminUsers.Any())
                {
                    _logger.LogInformation("No admin users found to notify about subscription event");
                    return;
                }

                var planName = plan?.Name ?? "Unknown Plan";
                var orgName = organization?.Name ?? user.Email;
                var action = isNewSubscription ? "subscribed" : "unsubscribed";
                var title = isNewSubscription
                    ? $"New Subscription: {orgName}"
                    : $"Subscription Cancelled: {orgName}";
                var message = isNewSubscription
                    ? $"{orgName} ({user.Email}) has subscribed to {planName} plan."
                    : $"{orgName} ({user.Email}) has cancelled their {planName} subscription.";

                foreach (var admin in adminUsers)
                {
                    try
                    {
                        // Get notification settings for admin
                        var settings = await _notificationSettingRepository.GetNotificationSettings(admin.Id);
                        if (settings == null)
                        {
                            // Create default settings if they don't exist
                            settings = await _notificationSettingRepository.AddNotificationSettings(admin.Id);
                            if (string.IsNullOrEmpty(settings.EmailAddress) && !string.IsNullOrEmpty(admin.Email))
                            {
                                settings.EmailAddress = admin.Email;
                                await _notificationSettingRepository.UpdateNotificationSettings(settings);
                            }
                        }

                        // Check if admin has enabled subscription notifications
                        bool shouldNotify = isNewSubscription
                            ? settings.AdminSubscriptionNotifications.Email || settings.AdminSubscriptionNotifications.Phone
                            : settings.AdminSubscriptionNotifications.Email || settings.AdminSubscriptionNotifications.Phone;

                        if (!shouldNotify)
                        {
                            _logger.LogInformation("Admin {AdminId} has disabled subscription notifications, skipping", admin.Id);
                            continue;
                        }

                        var notificationDto = new CreateNotificationDto
                        {
                            UserId = admin.Id,
                            Type = ENotificationType.System,
                            Title = title,
                            Message = message,
                            RelatedId = subscription.Id,
                            SendEmail = settings.AdminSubscriptionNotifications.Email,
                            SendSMS = settings.AdminSubscriptionNotifications.Phone
                        };

                        await _notificationService.CreateNotification(notificationDto);
                        _logger.LogInformation("Sent subscription notification to admin {AdminId} ({AdminEmail})", admin.Id, admin.Email);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error sending subscription notification to admin {AdminId}", admin.Id);
                        // Continue with other admins even if one fails
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error notifying admins about subscription event");
                // Don't throw - this is a non-critical operation
            }
        }
    }
}

