using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Data
{
    public static class MaintenanceCategorySeeder
    {
        public static async Task SeedMaintenanceCategoriesAsync(DataContext context)
        {
            // Check if categories already exist
            if (await context.MaintenanceCategories.AnyAsync())
            {
                // Update existing categories or add missing ones
                var existingCategories = await context.MaintenanceCategories.ToListAsync();
                var existingValues = existingCategories.Select(c => c.Value.ToLowerInvariant()).ToHashSet();

                var categoriesToAdd = new List<MaintenanceCategory>();

                var defaultCategories = new List<MaintenanceCategory>
                {
                    new MaintenanceCategory { Value = "appliances", Label = "Appliances", CreatedDate = DateTime.Now },
                    new MaintenanceCategory { Value = "electrical", Label = "Electrical", CreatedDate = DateTime.Now },
                    new MaintenanceCategory { Value = "exterior", Label = "Exterior", CreatedDate = DateTime.Now },
                    new MaintenanceCategory { Value = "household", Label = "Household", CreatedDate = DateTime.Now },
                    new MaintenanceCategory { Value = "outdoors", Label = "Outdoors", CreatedDate = DateTime.Now },
                    new MaintenanceCategory { Value = "plumbing", Label = "Plumbing", CreatedDate = DateTime.Now }
                };

                // Only add categories that don't exist
                foreach (var category in defaultCategories)
                {
                    if (!existingValues.Contains(category.Value.ToLowerInvariant()))
                    {
                        categoriesToAdd.Add(category);
                    }
                }

                if (categoriesToAdd.Any())
                {
                    await context.MaintenanceCategories.AddRangeAsync(categoriesToAdd);
                    await context.SaveChangesAsync();
                }
            }
            else
            {
                // No categories exist, seed all default categories
                var defaultCategories = new List<MaintenanceCategory>
                {
                    new MaintenanceCategory { Value = "appliances", Label = "Appliances", CreatedDate = DateTime.Now },
                    new MaintenanceCategory { Value = "electrical", Label = "Electrical", CreatedDate = DateTime.Now },
                    new MaintenanceCategory { Value = "exterior", Label = "Exterior", CreatedDate = DateTime.Now },
                    new MaintenanceCategory { Value = "household", Label = "Household", CreatedDate = DateTime.Now },
                    new MaintenanceCategory { Value = "outdoors", Label = "Outdoors", CreatedDate = DateTime.Now },
                    new MaintenanceCategory { Value = "plumbing", Label = "Plumbing", CreatedDate = DateTime.Now }
                };

                await context.MaintenanceCategories.AddRangeAsync(defaultCategories);
                await context.SaveChangesAsync();
            }
        }
    }
}
