using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class SubscriptionPlanConfig : IEntityTypeConfiguration<SubscriptionPlan>
    {
        public void Configure(EntityTypeBuilder<SubscriptionPlan> b)
        {
            b.ToTable("SubscriptionPlans", "subscription");
            b.HasKey(sp => sp.Id);

            b.Property(sp => sp.Name)
                .IsRequired()
                .HasMaxLength(100);

            b.Property(sp => sp.Description)
                .HasMaxLength(500);

            b.Property(sp => sp.MonthlyPrice)
                .HasPrecision(18, 2);

            b.Property(sp => sp.AnnualPrice)
                .HasPrecision(18, 2);

            b.Property(sp => sp.MaxTotalUnits);

            b.Property(sp => sp.StripePriceIdMonthly)
                .HasMaxLength(255);

            b.Property(sp => sp.StripePriceIdAnnual)
                .HasMaxLength(255);

            b.Property(sp => sp.StripeProductId)
                .HasMaxLength(255);

            b.HasIndex(sp => sp.Name)
                .IsUnique();

            b.HasIndex(sp => sp.StripePriceIdMonthly);
            b.HasIndex(sp => sp.StripePriceIdAnnual);
            b.HasIndex(sp => sp.IsActive);
        }
    }
}

