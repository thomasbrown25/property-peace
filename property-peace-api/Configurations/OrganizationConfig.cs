using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class OrganizationConfig : IEntityTypeConfiguration<Organization>
    {
        public void Configure(EntityTypeBuilder<Organization> b)
        {
            b.ToTable("Organizations", "organization");
            b.HasKey(o => o.Id);

            b.HasOne(o => o.Owner)
                .WithMany()
                .HasForeignKey(o => o.OwnerId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(o => o.Subscription)
                .WithMany()
                .HasForeignKey(o => o.SubscriptionId)
                .OnDelete(DeleteBehavior.SetNull);

            b.Property(o => o.Name)
                .IsRequired()
                .HasMaxLength(255);

            b.Property(o => o.Description)
                .HasMaxLength(1000);

            b.Property(o => o.StripeCustomerId)
                .HasMaxLength(255);

            b.Property(o => o.IsActive)
                .HasDefaultValue(true);

            b.Property(o => o.IsDeleted)
                .HasDefaultValue(false);

            b.HasIndex(o => o.OwnerId);
            b.HasIndex(o => o.SubscriptionId);
            b.HasIndex(o => o.StripeCustomerId);
            b.HasIndex(o => o.IsActive);
            b.HasIndex(o => o.IsDeleted);
        }
    }
}

