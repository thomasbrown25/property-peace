using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Data
{
    public static class SubscriptionPlanSeeder
    {
        public static async Task SeedSubscriptionPlansAsync(DataContext context)
        {
            var plans = new[]
            {
                new SubscriptionPlan
                {
                    Name = "Free",
                    Description = "Start free with the essentials for a small portfolio.",
                    MaxProperties = null,
                    MaxTotalUnits = 5,
                    MonthlyPrice = 0,
                    AnnualPrice = 0,
                    Features = "[\"Up to 5 units\", \"Hosted Property Peace listing page\", \"1 active external listing (coming soon)\", \"Lead management and showing scheduling\", \"Tenant portal\", \"Maintenance request tracking\", \"Lease management\", \"Basic rent tracking\", \"Expense tracking\", \"Document storage\", \"Digital rental applications\"]",
                    IsActive = true,
                    IsTrial = false,
                },
                new SubscriptionPlan
                {
                    Name = "Premium",
                    Description = "Complete portfolio management with unlimited units and advanced workflows.",
                    MaxProperties = null,
                    MaxTotalUnits = null,
                    MonthlyPrice = 14.99m,
                    AnnualPrice = 152.90m,
                    Features = "[\"Everything in Free\", \"Unlimited units\", \"Multiple active external listings (coming soon)\", \"Online rent collection\", \"Automated rent reminders\", \"Advanced accounting and Schedule E\", \"Reports and analytics\", \"Occupancy tracking\", \"Rent estimates\", \"LeaseShield\", \"Percy Pilot workflows\", \"Priority support\"]",
                    IsActive = true,
                    IsTrial = false,
                },
                new SubscriptionPlan
                {
                    Name = "Lifetime Plan",
                    Description = "Internal lifetime Premium software access plan for admin-assigned accounts.",
                    MaxProperties = null,
                    MaxTotalUnits = null,
                    MonthlyPrice = 0,
                    AnnualPrice = 0,
                    Features = "[\"Everything in Premium\", \"Unlimited units\", \"Multiple active external listings (coming soon)\", \"Lifetime software access\"]",
                    IsActive = true,
                    IsTrial = false,
                },
            };

            foreach (var desired in plans)
            {
                var existing = await context.SubscriptionPlans
                    .SingleOrDefaultAsync(plan => plan.Name == desired.Name);

                if (existing == null)
                {
                    desired.CreatedAt = DateTime.Now;
                    desired.UpdatedAt = DateTime.Now;
                    await context.SubscriptionPlans.AddAsync(desired);
                    continue;
                }

                // Keep database identity, activation state, and Stripe identifiers intact while
                // synchronizing the product-owned packaging shown in the app.
                existing.Description = desired.Description;
                existing.MaxProperties = desired.MaxProperties;
                existing.MaxTotalUnits = desired.MaxTotalUnits;
                existing.MonthlyPrice = desired.MonthlyPrice;
                existing.AnnualPrice = desired.AnnualPrice;
                existing.Features = desired.Features;
                existing.UpdatedAt = DateTime.Now;
            }

            await context.SaveChangesAsync();
        }
    }
}
