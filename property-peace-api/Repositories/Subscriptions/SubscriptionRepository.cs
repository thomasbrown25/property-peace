using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.Subscriptions
{
    public class SubscriptionRepository : ISubscriptionRepository
    {
        private readonly DataContext _context;
        private readonly ILogger<SubscriptionRepository> _logger;

        public SubscriptionRepository(DataContext context, ILogger<SubscriptionRepository> logger)
        {
            _context = context;
            _logger = logger;
        }


        public async Task<Subscription?> GetSubscriptionByOrganizationIdAsync(long organizationId)
        {
            try
            {
                return await _context.Subscriptions
                    .Include(s => s.SubscriptionPlan)
                    .Include(s => s.Organization)
                    .FirstOrDefaultAsync(s => s.OrganizationId == organizationId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting subscription for organization {OrganizationId}", organizationId);
                throw;
            }
        }

        public async Task<Subscription?> GetSubscriptionByUserIdAsync(long userId)
        {
            try
            {
                return await _context.Subscriptions
                    .Include(s => s.SubscriptionPlan)
                    .Include(s => s.User)
                    .FirstOrDefaultAsync(s => s.UserId == userId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting subscription for user {UserId}", userId);
                throw;
            }
        }

        public async Task<Subscription?> GetSubscriptionByOwnerUserIdAsync(long ownerUserId)
        {
            try
            {
                // Prefer active/trial subscriptions; fall back to any if none active
                return await _context.Subscriptions
                    .Include(s => s.SubscriptionPlan)
                    .Where(s => s.OwnerUserId == ownerUserId)
                    .OrderByDescending(s => s.Status == "Active" || s.Status == "Trial" ? 1 : 0)
                    .ThenByDescending(s => s.CreatedAt)
                    .FirstOrDefaultAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting subscription for owner user {OwnerUserId}", ownerUserId);
                throw;
            }
        }

        public async Task<Subscription?> GetSubscriptionByStripeIdAsync(string stripeSubscriptionId)
        {
            try
            {
                return await _context.Subscriptions
                    .Include(s => s.SubscriptionPlan)
                    .Include(s => s.Organization)
                    .FirstOrDefaultAsync(s => s.StripeSubscriptionId == stripeSubscriptionId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting subscription by Stripe ID {StripeSubscriptionId}", stripeSubscriptionId);
                throw;
            }
        }

        public async Task<Subscription?> GetSubscriptionByStripeCustomerIdAsync(string stripeCustomerId)
        {
            try
            {
                return await _context.Subscriptions
                    .Include(s => s.SubscriptionPlan)
                    .Include(s => s.Organization)
                    .FirstOrDefaultAsync(s => s.StripeCustomerId == stripeCustomerId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting subscription by Stripe customer ID {StripeCustomerId}", stripeCustomerId);
                throw;
            }
        }

        public async Task<Subscription> CreateSubscriptionAsync(Subscription subscription)
        {
            try
            {
                await _context.Subscriptions.AddAsync(subscription);
                await _context.SaveChangesAsync();
                return subscription;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating subscription for organization {OrganizationId}", subscription.OrganizationId);
                throw;
            }
        }

        public async Task<Subscription> UpdateSubscriptionAsync(Subscription subscription)
        {
            try
            {
                subscription.UpdatedAt = DateTime.Now;
                _context.Subscriptions.Update(subscription);
                await _context.SaveChangesAsync();
                return subscription;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating subscription {SubscriptionId}", subscription.Id);
                throw;
            }
        }

        public async Task<List<Subscription>> GetActiveSubscriptionsAsync()
        {
            try
            {
                return await _context.Subscriptions
                    .Include(s => s.SubscriptionPlan)
                    .Include(s => s.Organization)
                        .ThenInclude(o => o.Owner)
                    .Include(s => s.Organization)
                        .ThenInclude(o => o.Members)
                            .ThenInclude(m => m.User)
                    .Where(s => s.Status == "Active" || s.Status == "Trial")
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting active subscriptions");
                throw;
            }
        }

        public async Task<List<Subscription>> GetExpiringTrialsAsync(DateTime date)
        {
            try
            {
                return await _context.Subscriptions
                    .Include(s => s.SubscriptionPlan)
                    .Include(s => s.Organization)
                    .Where(s => s.Status == "Trial" && 
                                s.TrialEnd.HasValue && 
                                s.TrialEnd.Value.Date == date.Date)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting expiring trials for date {Date}", date);
                throw;
            }
        }

        public async Task<List<Subscription>> GetSubscriptionsToPauseAsync()
        {
            try
            {
                var today = DateTime.UtcNow.Date;
                return await _context.Subscriptions
                    .Include(s => s.SubscriptionPlan)
                    .Include(s => s.Organization)
                    .Where(s => s.PausedAtPeriodEnd && 
                                s.CurrentPeriodEnd.HasValue && 
                                s.CurrentPeriodEnd.Value.Date <= today &&
                                s.Status != "Paused")
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting subscriptions to pause");
                throw;
            }
        }

        public async Task<bool> DeleteSubscriptionAsync(long subscriptionId)
        {
            try
            {
                var subscription = await _context.Subscriptions.FindAsync(subscriptionId);
                if (subscription == null)
                    return false;

                _context.Subscriptions.Remove(subscription);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting subscription {SubscriptionId}", subscriptionId);
                throw;
            }
        }

        public async Task<List<Subscription>> GetOrphanedSubscriptionsAsync()
        {
            try
            {
                return await _context.Subscriptions
                    .Include(s => s.SubscriptionPlan)
                    .Include(s => s.Organization)
                        .ThenInclude(o => o.Owner)
                    .Include(s => s.Organization)
                        .ThenInclude(o => o.Members)
                            .ThenInclude(m => m.User)
                    .Where(s => string.IsNullOrEmpty(s.StripeSubscriptionId) || string.IsNullOrEmpty(s.StripeCustomerId))
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting orphaned subscriptions");
                throw;
            }
        }

        public async Task<Subscription?> GetSubscriptionByIdAsync(long subscriptionId)
        {
            try
            {
                return await _context.Subscriptions
                    .Include(s => s.SubscriptionPlan)
                    .Include(s => s.Organization)
                        .ThenInclude(o => o.Owner)
                    .Include(s => s.Organization)
                        .ThenInclude(o => o.Members)
                            .ThenInclude(m => m.User)
                    .FirstOrDefaultAsync(s => s.Id == subscriptionId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting subscription {SubscriptionId}", subscriptionId);
                throw;
            }
        }

        public async Task<List<Subscription>> GetSubscriptionsByPlanIdAsync(long planId)
        {
            try
            {
                return await _context.Subscriptions
                    .Include(s => s.SubscriptionPlan)
                    .Include(s => s.Organization)
                    .Where(s => s.SubscriptionPlanId == planId && 
                                !string.IsNullOrEmpty(s.StripeSubscriptionId) &&
                                (s.Status == "Active" || s.Status == "Trial"))
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting subscriptions for plan {PlanId}", planId);
                throw;
            }
        }
    }
}

