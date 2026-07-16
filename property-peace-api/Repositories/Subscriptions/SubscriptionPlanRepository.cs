using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.Subscriptions
{
    public class SubscriptionPlanRepository : ISubscriptionPlanRepository
    {
        private readonly DataContext _context;
        private readonly ILogger<SubscriptionPlanRepository> _logger;

        public SubscriptionPlanRepository(DataContext context, ILogger<SubscriptionPlanRepository> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<List<SubscriptionPlan>> GetAllPlansAsync()
        {
            try
            {
                return await _context.SubscriptionPlans
                    .Where(sp => sp.IsActive)
                    .OrderBy(sp => sp.MonthlyPrice)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all subscription plans");
                throw;
            }
        }

        public async Task<SubscriptionPlan?> GetPlanByIdAsync(long planId)
        {
            try
            {
                return await _context.SubscriptionPlans.FindAsync(planId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting subscription plan {PlanId}", planId);
                throw;
            }
        }

        public async Task<SubscriptionPlan?> GetPlanByNameAsync(string name)
        {
            try
            {
                return await _context.SubscriptionPlans
                    .FirstOrDefaultAsync(sp => sp.Name == name);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting subscription plan by name {PlanName}", name);
                throw;
            }
        }

        public async Task<SubscriptionPlan?> GetPlanByStripePriceIdAsync(string stripePriceId)
        {
            try
            {
                return await _context.SubscriptionPlans
                    .FirstOrDefaultAsync(sp => sp.StripePriceIdMonthly == stripePriceId || 
                                                sp.StripePriceIdAnnual == stripePriceId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting subscription plan by Stripe price ID {StripePriceId}", stripePriceId);
                throw;
            }
        }

        public async Task<SubscriptionPlan> CreatePlanAsync(SubscriptionPlan plan)
        {
            try
            {
                plan.CreatedAt = DateTime.Now;
                plan.UpdatedAt = DateTime.Now;
                await _context.SubscriptionPlans.AddAsync(plan);
                await _context.SaveChangesAsync();
                return plan;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating subscription plan {PlanName}", plan.Name);
                throw;
            }
        }

        public async Task<SubscriptionPlan> UpdatePlanAsync(SubscriptionPlan plan)
        {
            try
            {
                plan.UpdatedAt = DateTime.Now;
                _context.SubscriptionPlans.Update(plan);
                await _context.SaveChangesAsync();
                return plan;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating subscription plan {PlanId}", plan.Id);
                throw;
            }
        }

        public async Task<bool> DeletePlanAsync(long planId)
        {
            try
            {
                var plan = await _context.SubscriptionPlans.FindAsync(planId);
                if (plan == null)
                    return false;

                _context.SubscriptionPlans.Remove(plan);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting subscription plan {PlanId}", planId);
                throw;
            }
        }
    }
}

