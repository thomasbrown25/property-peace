using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Data
{
    public static class SubscriptionPlanSeeder
    {
        public static async Task SeedSubscriptionPlansAsync(DataContext context)
        {
            if (await context.SubscriptionPlans.AnyAsync())
            {
                return; // Plans already seeded
            }

            var plans = new List<SubscriptionPlan>
            {
                new SubscriptionPlan
                {
                    Name = "Free",
                    Description = "Get started at no cost — no credit card required.",
                    MaxProperties = null,
                    MaxTotalUnits = 2,
                    MonthlyPrice = 0,
                    AnnualPrice = 0,
                    Features = "[\"Up to 2 units\", \"Tenant portal\", \"Maintenance request tracking\", \"Lease management\", \"Basic rent tracking\", \"Expense tracking\", \"Document storage\", \"Digital rental applications\"]",
                    IsActive = true,
                    IsTrial = false,
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                },
                new SubscriptionPlan
                {
                    Name = "Premium",
                    Description = "Advanced features for growing portfolios.",
                    MaxProperties = null,
                    MaxTotalUnits = null, // Unlimited
                    MonthlyPrice = 14.99m,
                    AnnualPrice = 152.90m, // ~15% discount
                    Features = "[\"Up to 2 units\", \"Tenant portal\", \"Maintenance request tracking\", \"Lease management\", \"Basic rent tracking\", \"Expense tracking\", \"Document storage\", \"Digital rental applications\", \"Unlimited units\", \"Online rent collection\", \"Automated rent reminders\", \"Financial reports & Schedule E\", \"Reports & analytics\", \"Rent estimates\", \"LeaseShield\", \"AI-powered features\", \"Priority support\"]",
                    IsActive = true,
                    IsTrial = false,
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                },
                new SubscriptionPlan
                {
                    Name = "Lifetime Plan",
                    Description = "Internal lifetime premium access plan for admin-assigned accounts.",
                    MaxProperties = null,
                    MaxTotalUnits = null, // Unlimited
                    MonthlyPrice = 0,
                    AnnualPrice = 0,
                    Features = "[\"Unlimited units\", \"Everything in Premium\", \"Lifetime access\"]",
                    IsActive = true,
                    IsTrial = false,
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                }
            };

            await context.SubscriptionPlans.AddRangeAsync(plans);
            await context.SaveChangesAsync();
        }
    }
}
