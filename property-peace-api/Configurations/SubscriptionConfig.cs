using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class SubscriptionConfig : IEntityTypeConfiguration<Subscription>
    {
        public void Configure(EntityTypeBuilder<Subscription> b)
        {
            b.ToTable("Subscriptions", "subscription");
            b.HasKey(s => s.Id);

            // Landlord subscriptions: OrganizationId set. Tenant subscriptions: UserId set.
            b.HasOne(s => s.Organization)
                .WithOne(o => o.Subscription)
                .HasForeignKey<Subscription>(s => s.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict)
                .IsRequired(false);

            b.HasOne(s => s.User)
                .WithMany()
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.Restrict)
                .IsRequired(false);

            b.HasOne(s => s.SubscriptionPlan)
                .WithMany(sp => sp.Subscriptions)
                .HasForeignKey(s => s.SubscriptionPlanId)
                .OnDelete(DeleteBehavior.Restrict);

            b.Property(s => s.Status)
                .IsRequired()
                .HasMaxLength(50);

            b.Property(s => s.BillingCycle)
                .IsRequired()
                .HasMaxLength(20);

            b.Property(s => s.StripeSubscriptionId)
                .HasMaxLength(255);

            b.Property(s => s.StripeCustomerId)
                .HasMaxLength(255);

            // One subscription per organization (when OrganizationId set); one per user (when UserId set)
            b.HasIndex(s => s.OrganizationId)
                .IsUnique()
                .HasFilter("[OrganizationId] IS NOT NULL");
            b.HasIndex(s => s.UserId)
                .IsUnique()
                .HasFilter("[UserId] IS NOT NULL");

            b.HasIndex(s => s.StripeSubscriptionId)
                .IsUnique()
                .HasFilter("[StripeSubscriptionId] IS NOT NULL");

            // OwnerUserId: the landlord user who owns this subscription.
            // Not a navigation property — just a column for fast cross-org lookup.
            // Not unique: technically one per user, but enforced at service layer only.
            b.Property(s => s.OwnerUserId).IsRequired(false);
            b.HasIndex(s => s.OwnerUserId).HasFilter("[OwnerUserId] IS NOT NULL");

            b.HasIndex(s => s.StripeCustomerId);
            b.HasIndex(s => s.Status);
            b.HasIndex(s => s.CurrentPeriodEnd);
        }
    }
}

