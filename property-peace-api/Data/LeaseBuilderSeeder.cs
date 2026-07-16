using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Data
{
    public static class LeaseBuilderSeeder
    {
        public static async Task SeedLeaseBuilderDataAsync(DataContext context)
        {
            // Seed default lease template policies
            if (!await context.LeaseTemplateDefaultPolicies.AnyAsync())
            {
                var defaultPolicies = new List<LeaseTemplateDefaultPolicy>
                {
                    new LeaseTemplateDefaultPolicy
                    {
                        Title = "Rent Payment",
                        Content = "Rent is due on the first day of each month; late payments may incur a fee as specified in the lease agreement.",
                        Category = "Rent",
                        Order = 1,
                        CreatedAt = DateTime.Now
                    },
                    new LeaseTemplateDefaultPolicy
                    {
                        Title = "Rent Payment",
                        Content = "Tenant shall provide a security deposit prior to occupancy, which may be used to cover damages or unpaid rent and will be returned in accordance with state laws.",
                        Category = "Rent",
                        Order = 2,
                        CreatedAt = DateTime.Now
                    },
                    new LeaseTemplateDefaultPolicy
                    {
                        Title = "Quiet Hours",
                        Content = "Quiet hours are from 10:00 PM to 7:00 AM daily: Tenant is expected to minimize noise during these hours to avoid disturbing neighbors.",
                        Category = "QuietHours",
                        Order = 3,
                        CreatedAt = DateTime.Now
                    },
                    new LeaseTemplateDefaultPolicy
                    {
                        Title = "Parking",
                        Content = "Parking is permitted only in designated areas; Tenant shall not block driveways or park in spaces assigned to other residents.",
                        Category = "Parking",
                        Order = 4,
                        CreatedAt = DateTime.Now
                    },
                    new LeaseTemplateDefaultPolicy
                    {
                        Title = "Trash Disposal",
                        Content = "Tenant is responsible for proper disposal of trash and recycling in designated containers and must adhere to local waste collection schedules.",
                        Category = "Trash",
                        Order = 5,
                        CreatedAt = DateTime.Now
                    },
                    new LeaseTemplateDefaultPolicy
                    {
                        Title = "Maintenance",
                        Content = "Tenant shall promptly notify the landlord of any maintenance or repair issues; minor maintenance may be the Tenant's responsibility as outlined in the lease.",
                        Category = "Maintenance",
                        Order = 6,
                        CreatedAt = DateTime.Now
                    },
                    new LeaseTemplateDefaultPolicy
                    {
                        Title = "Guests",
                        Content = "Guests are allowed with prior notice to the landlord if staying longer than 7 consecutive days; overnight visitors must comply with lease terms.",
                        Category = "Guests",
                        Order = 7,
                        CreatedAt = DateTime.Now
                    },
                    new LeaseTemplateDefaultPolicy
                    {
                        Title = "Smoking",
                        Content = "Smoking and the use of illegal drugs are strictly prohibited within the property and common areas to ensure a safe and healthy environment.",
                        Category = "Smoking",
                        Order = 8,
                        CreatedAt = DateTime.Now
                    },
                    new LeaseTemplateDefaultPolicy
                    {
                        Title = "Pets",
                        Content = "Pets are allowed only with prior written approval and may be subject to additional fees or restrictions as specified in the lease.",
                        Category = "Pets",
                        Order = 9,
                        CreatedAt = DateTime.Now
                    },
                    new LeaseTemplateDefaultPolicy
                    {
                        Title = "Security Deposit",
                        Content = "Tenant shall not change or add locks without landlord's written consent; lost keys must be reported immediately for security purposes.",
                        Category = "Deposit",
                        Order = 10,
                        CreatedAt = DateTime.Now
                    },
                    new LeaseTemplateDefaultPolicy
                    {
                        Title = "Alterations",
                        Content = "No alterations or modifications to the property are permitted without prior written approval from the landlord.",
                        Category = "Alterations",
                        Order = 11,
                        CreatedAt = DateTime.Now
                    },
                    new LeaseTemplateDefaultPolicy
                    {
                        Title = "Move-Out",
                        Content = "Tenant is responsible for cleaning the premises upon move-out, including removing all personal belongings and leaving the property in a clean condition.",
                        Category = "Cleaning",
                        Order = 12,
                        CreatedAt = DateTime.Now
                    },
                    new LeaseTemplateDefaultPolicy
                    {
                        Title = "Utilities",
                        Content = "Utilities shall be paid by the Tenant as specified in the lease; any utility accounts must be established in the Tenant's name unless otherwise agreed.",
                        Category = "Utilities",
                        Order = 13,
                        CreatedAt = DateTime.Now
                    },
                    new LeaseTemplateDefaultPolicy
                    {
                        Title = "Subletting",
                        Content = "Subletting or assigning the lease is prohibited without prior written consent from the landlord.",
                        Category = "Subletting",
                        Order = 14,
                        CreatedAt = DateTime.Now
                    },
                    new LeaseTemplateDefaultPolicy
                    {
                        Title = "Maintenance",
                        Content = "Landlord reserves the right to enter the property for inspections, repairs, or emergencies with reasonable notice to the Tenant.",
                        Category = "Maintenance",
                        Order = 15,
                        CreatedAt = DateTime.Now
                    }
                };

                await context.LeaseTemplateDefaultPolicies.AddRangeAsync(defaultPolicies);
            }

            // Seed default policy pack
            if (!await context.PolicyPacks.AnyAsync(p => p.IsDefault))
            {
                var defaultPolicyPack = new PolicyPack
                {
                    Name = "Standard House Rules",
                    Description = "Default policy pack with common house rules for residential properties",
                    IsDefault = true,
                    CreatedAt = DateTime.Now,
                    Items = new List<PolicyPackItem>
                    {
                        new PolicyPackItem
                        {
                            Title = "Quiet Hours",
                            Content = "Tenant shall maintain quiet hours between 10:00 PM and 7:00 AM. Excessive noise during these hours may result in lease violation.",
                            Category = "QuietHours",
                            Order = 1
                        },
                        new PolicyPackItem
                        {
                            Title = "Parking",
                            Content = "Tenant shall park only in assigned parking spaces. No blocking of driveways, fire lanes, or other tenants' spaces. Unauthorized vehicles may be towed at tenant's expense.",
                            Category = "Parking",
                            Order = 2
                        },
                        new PolicyPackItem
                        {
                            Title = "Trash Disposal",
                            Content = "Tenant shall dispose of trash in designated containers and follow the scheduled trash collection days. Trash must be properly bagged and not left outside containers.",
                            Category = "Trash",
                            Order = 3
                        },
                        new PolicyPackItem
                        {
                            Title = "Maintenance Reporting",
                            Content = "Tenant shall report all maintenance issues promptly. For emergencies, contact landlord immediately. For non-emergencies, provide 24-hour notice when possible.",
                            Category = "Maintenance",
                            Order = 4
                        },
                        new PolicyPackItem
                        {
                            Title = "Guests",
                            Content = "Guests are permitted for reasonable periods. Overnight guests staying more than 7 consecutive days or 14 days per month must be approved by landlord.",
                            Category = "Guests",
                            Order = 5
                        },
                        new PolicyPackItem
                        {
                            Title = "Smoking",
                            Content = "Smoking is prohibited in all interior areas of the property. Smoking is only permitted in designated outdoor areas, if any.",
                            Category = "Smoking",
                            Order = 6
                        },
                        new PolicyPackItem
                        {
                            Title = "Pets",
                            Content = "Pets are subject to landlord approval and may require additional deposit or fees. Tenant must comply with all pet-related addendums and local regulations.",
                            Category = "Pets",
                            Order = 7
                        },
                        new PolicyPackItem
                        {
                            Title = "Keys and Locks",
                            Content = "Tenant shall not duplicate keys or change locks without landlord permission. Lost keys may result in replacement fees. All keys must be returned upon move-out.",
                            Category = "Keys",
                            Order = 8
                        },
                        new PolicyPackItem
                        {
                            Title = "Alterations",
                            Content = "Tenant shall not make any alterations, modifications, or improvements to the property without written landlord consent. Unauthorized alterations must be restored at tenant's expense.",
                            Category = "Alterations",
                            Order = 9
                        },
                        new PolicyPackItem
                        {
                            Title = "Move-Out Cleaning",
                            Content = "Upon move-out, tenant shall return the property in clean condition, normal wear and tear excepted. Failure to do so may result in cleaning charges deducted from security deposit.",
                            Category = "Cleaning",
                            Order = 10
                        },
                        new PolicyPackItem
                        {
                            Title = "Utilities",
                            Content = "Tenant is responsible for utilities as specified in the lease agreement. Tenant must maintain utility service in their name and pay all charges promptly.",
                            Category = "Utilities",
                            Order = 11
                        }
                    }
                };

                await context.PolicyPacks.AddAsync(defaultPolicyPack);
            }


            await context.SaveChangesAsync();
        }
    }
}
